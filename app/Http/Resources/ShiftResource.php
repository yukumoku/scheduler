<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

class ShiftResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $assignments = $this->relationLoaded('assignments') ? $this->assignments : collect();
        $event = $this->relationLoaded('event') ? $this->event : null;
        $slots = $event && method_exists($event, 'relationLoaded') && $event->relationLoaded('slots')
            ? $event->slots
            : $assignments->map(fn ($assignment) => $assignment->eventSlot)->filter()->unique('id')->values();
        $metrics = $this->buildMetrics($slots, $assignments, $event);
        $warnings = $this->buildWarnings($slots, $assignments);

        return [
            'id' => $this->id,
            'eventId' => $this->event_id,
            'eventSlotId' => $this->event_slot_id,
            'status' => $this->status?->value ?? $this->status,
            'generatedAt' => $this->generated_at?->toIso8601String(),
            'publishedAt' => $this->published_at?->toIso8601String(),
            'event' => $event ? [
                'id' => $event->id,
                'name' => $event->name,
                'groupId' => $event->group_id,
                'commonAvailabilitySetId' => $event->common_availability_set_id,
            ] : null,
            'slots' => EventSlotResource::collection($slots),
            'assignments' => $this->relationLoaded('assignments') ? ShiftAssignmentResource::collection($assignments) : [],
            'warnings' => $warnings,
            'metrics' => $metrics,
        ];
    }

    private function buildWarnings($slots, $assignments): array
    {
        return $slots
            ->map(function ($slot) use ($assignments) {
                $assignedPeople = $assignments->where('event_slot_id', $slot->id)->count();
                $missingPeople = max(($slot->required_people ?? 0) - $assignedPeople, 0);

                if ($missingPeople === 0) {
                    return null;
                }

                return [
                    'slotId' => $slot->id,
                    'taskId' => $slot->task_id,
                    'date' => $slot->date?->toDateString(),
                    'startTime' => $this->normalizeTime($slot->start_time),
                    'endTime' => $this->normalizeTime($slot->end_time),
                    'requiredPeople' => $slot->required_people,
                    'assignedPeople' => $assignedPeople,
                    'missingPeople' => $missingPeople,
                    'message' => '必要人数に満たない時間枠があります。',
                ];
            })
            ->filter()
            ->values()
            ->all();
    }

    private function buildMetrics($slots, $assignments, $event): array
    {
        $requiredPeopleTotal = (int) $slots->sum('required_people');
        $assignedPeopleTotal = $assignments->count();
        $missingPeopleTotal = max($requiredPeopleTotal - $assignedPeopleTotal, 0);
        $plannedWorkMinutes = (int) $slots->sum(fn ($slot) => $this->durationMinutes($slot));
        $completeWorkMinutes = (int) $slots->sum(function ($slot) use ($assignments) {
            $assignedPeople = $assignments->where('event_slot_id', $slot->id)->count();

            return $assignedPeople >= max((int) ($slot->required_people ?? 1), 1)
                ? $this->durationMinutes($slot)
                : 0;
        });
        $staffedWorkMinutes = (int) $slots->sum(function ($slot) use ($assignments) {
            return $assignments->where('event_slot_id', $slot->id)->isNotEmpty()
                ? $this->durationMinutes($slot)
                : 0;
        });
        $preferredAssignments = 0;
        $availableAssignments = 0;

        $availabilities = $event
            && method_exists($event, 'relationLoaded')
            && $event->relationLoaded('commonAvailabilitySet')
            && $event->commonAvailabilitySet
            && method_exists($event->commonAvailabilitySet, 'relationLoaded')
            && $event->commonAvailabilitySet->relationLoaded('availabilities')
            ? $event->commonAvailabilitySet->availabilities
            : collect();

        foreach ($assignments as $assignment) {
            $slot = $assignment->eventSlot;
            if (! $slot) {
                continue;
            }

            $availability = $availabilities->first(function ($availability) use ($assignment, $slot) {
                return $availability->user_id === $assignment->user_id
                    && $this->availabilityCoversSlot($availability, $slot);
            });

            $status = $availability?->status?->value ?? $availability?->status;
            if (in_array($status, ['available', 'preferred'], true)) {
                $availableAssignments++;
            }
            if ($status === 'preferred') {
                $preferredAssignments++;
            }
        }

        return [
            'totalSlots' => $slots->count(),
            'requiredPeopleTotal' => $requiredPeopleTotal,
            'assignedPeopleTotal' => $assignedPeopleTotal,
            'missingPeopleTotal' => $missingPeopleTotal,
            'plannedWorkMinutes' => $plannedWorkMinutes,
            'completeWorkMinutes' => $completeWorkMinutes,
            'staffedWorkMinutes' => $staffedWorkMinutes,
            'workCoverageRate' => $plannedWorkMinutes > 0 ? round(($completeWorkMinutes / $plannedWorkMinutes) * 100, 1) : 0,
            'fillRate' => $requiredPeopleTotal > 0 ? round(($assignedPeopleTotal / $requiredPeopleTotal) * 100, 1) : 0,
            'preferredAssignments' => $preferredAssignments,
            'availableAssignments' => $availableAssignments,
            'preferenceReflectionRate' => $assignedPeopleTotal > 0 ? round(($preferredAssignments / $assignedPeopleTotal) * 100, 1) : 0,
            'memberWorkload' => $assignments
                ->groupBy('user_id')
                ->map(function ($items, string $userId) {
                    $minutes = $items->sum(fn ($assignment) => $this->durationMinutes($assignment->eventSlot));
                    $user = $items->first()?->user;

                    return [
                        'userId' => $userId,
                        'displayName' => $user?->display_name,
                        'minutes' => $minutes,
                    ];
                })
                ->sortByDesc('minutes')
                ->values(),
        ];
    }

    private function durationMinutes($slot): int
    {
        if (! $slot) {
            return 0;
        }

        $start = $slot->start_datetime ? Carbon::parse($slot->start_datetime) : Carbon::parse($slot->date?->toDateString().' '.$slot->start_time);
        $end = $slot->end_datetime ? Carbon::parse($slot->end_datetime) : Carbon::parse($slot->date?->toDateString().' '.$slot->end_time);

        return max($start->diffInMinutes($end), 0);
    }

    private function normalizeTime(?string $time): ?string
    {
        return $time ? Carbon::parse($time)->format('H:i') : null;
    }

    private function availabilityCoversSlot($availability, $slot): bool
    {
        if (! $slot || $availability->date?->toDateString() !== $slot->date?->toDateString()) {
            return false;
        }

        $availabilityStart = $this->normalizeTime($availability->start_time);
        $availabilityEnd = $this->normalizeTime($availability->end_time);
        $slotStart = $this->normalizeTime($slot->start_time);
        $slotEnd = $this->normalizeTime($slot->end_time);

        if (! $availabilityStart || ! $availabilityEnd || ! $slotStart || ! $slotEnd) {
            return false;
        }

        return $availabilityStart <= $slotStart && $availabilityEnd >= $slotEnd;
    }
}
