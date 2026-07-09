<?php

namespace App\Services;

use App\Enums\AvailabilityStatus;
use App\Models\CommonAvailability;
use App\Models\CommonAvailabilitySet;
use App\Models\Event;
use App\Models\User;
use App\Support\AvatarUrl;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

class AvailabilitySummaryService
{
    public function buildCommonAvailabilityMePayload(
        CommonAvailabilitySet $set,
        User $user,
        Collection $slots,
        Collection $availabilities,
        int $availabilityCount,
    ): array {
        $slots = $this->mergeCommonAvailabilitySlots($set, $slots, $availabilities);

        return [
            'set' => $this->serializeCommonAvailabilitySet($set, $availabilityCount),
            'slots' => $slots->map(function (array $slot) use ($set, $user, $availabilities) {
                $availability = $this->matchCommonAvailability($availabilities, $slot);

                return [
                    'id' => $slot['date'].'-'.$slot['startTime'].'-'.$slot['endTime'],
                    'commonAvailabilitySetId' => $set->id,
                    'userId' => $user->id,
                    ...$slot,
                    'availabilityStatus' => $availability?->status?->value,
                    'availabilityComment' => $availability?->comment,
                ];
            })->values(),
        ];
    }

    public function buildCommonAvailabilitySubmissionsPayload(
        CommonAvailabilitySet $set,
        Collection $members,
        Collection $availabilities,
        Collection $slots,
    ): array {
        $slots = $this->mergeCommonAvailabilitySlots($set, $slots, $availabilities);

        $memberRows = $members->map(function ($member) use ($availabilities) {
            $memberAvailabilities = $availabilities->where('user_id', $member->user_id);

            return [
                'id' => $member->id,
                'userId' => $member->user_id,
                'displayName' => $member->user?->display_name,
                'email' => $member->user?->email,
                'avatarUrl' => AvatarUrl::public($member->user?->avatar_url),
                'submittedSlots' => $memberAvailabilities->count(),
                'availableSlots' => $memberAvailabilities->filter(fn (CommonAvailability $availability) => in_array($this->availabilityStatusValue($availability->status), ['available', 'preferred'], true))->count(),
                'preferredSlots' => $memberAvailabilities->filter(fn (CommonAvailability $availability) => $this->availabilityStatusValue($availability->status) === 'preferred')->count(),
                'hasSubmitted' => $memberAvailabilities->isNotEmpty(),
            ];
        })->values();

        $slotRows = $slots->map(function (array $slot) use ($availabilities) {
            $matching = $this->filterCommonAvailabilities($availabilities, $slot);

            $availablePeople = $matching->filter(fn (CommonAvailability $availability) => in_array($this->availabilityStatusValue($availability->status), ['available', 'preferred'], true))->count();
            $preferredPeople = $matching->filter(fn (CommonAvailability $availability) => $this->availabilityStatusValue($availability->status) === 'preferred')->count();

            return [
                ...$slot,
                'availablePeople' => $availablePeople,
                'preferredPeople' => $preferredPeople,
                'insufficientPeople' => max($slot['requiredPeople'] - $availablePeople, 0),
            ];
        })->values();

        $submittedMembers = $memberRows->where('hasSubmitted', true)->count();
        $totalMembers = $memberRows->count();

        return [
            'summary' => [
                'totalMembers' => $totalMembers,
                'submittedMembers' => $submittedMembers,
                'submissionRate' => $totalMembers > 0 ? round(($submittedMembers / $totalMembers) * 100, 1) : 0,
                'totalSlots' => $slotRows->count(),
                'insufficientSlots' => $slotRows->where('insufficientPeople', '>', 0)->count(),
            ],
            'slots' => $slotRows,
            'members' => $memberRows,
        ];
    }

    public function buildEventAvailabilitySummaryPayload(
        Event $event,
        Collection $members,
        Collection $slots,
        Collection $availabilities,
    ): array {
        $memberRows = $members->map(function ($member) use ($availabilities) {
            $memberAvailabilities = $availabilities->where('user_id', $member->user_id);

            return [
                'id' => $member->id,
                'userId' => $member->user_id,
                'displayName' => $member->user?->display_name,
                'email' => $member->user?->email,
                'avatarUrl' => AvatarUrl::public($member->user?->avatar_url),
                'submittedSlots' => $memberAvailabilities->count(),
                'availableSlots' => $memberAvailabilities->filter(fn ($availability) => in_array($this->availabilityStatusValue($availability->status), [AvailabilityStatus::Available->value, AvailabilityStatus::Preferred->value], true))->count(),
                'preferredSlots' => $memberAvailabilities->filter(fn ($availability) => $this->availabilityStatusValue($availability->status) === AvailabilityStatus::Preferred->value)->count(),
                'hasSubmitted' => $memberAvailabilities->isNotEmpty(),
            ];
        })->values();

        $slotRows = $slots->map(function ($slot) use ($availabilities) {
            $matching = $this->filterEventAvailabilities($availabilities, $slot->date?->toDateString(), $slot->start_time, $slot->end_time);

            $availablePeople = $matching->filter(fn ($availability) => in_array($this->availabilityStatusValue($availability->status), [AvailabilityStatus::Available->value, AvailabilityStatus::Preferred->value], true))->count();
            $preferredPeople = $matching->filter(fn ($availability) => $this->availabilityStatusValue($availability->status) === AvailabilityStatus::Preferred->value)->count();

            return [
                'id' => $slot->id,
                'eventId' => $slot->event_id,
                'date' => $slot->date?->toDateString(),
                'startTime' => $slot->start_time,
                'endTime' => $slot->end_time,
                'requiredPeople' => $slot->required_people,
                'location' => $slot->location,
                'note' => $slot->note,
                'availablePeople' => $availablePeople,
                'preferredPeople' => $preferredPeople,
                'insufficientPeople' => max($slot->required_people - $availablePeople, 0),
            ];
        })->values();

        $submittedMembers = $memberRows->where('hasSubmitted', true)->count();
        $totalMembers = $memberRows->count();

        return [
            'summary' => [
                'totalMembers' => $totalMembers,
                'submittedMembers' => $submittedMembers,
                'submissionRate' => $totalMembers > 0 ? round(($submittedMembers / $totalMembers) * 100, 1) : 0,
                'totalSlots' => $slotRows->count(),
                'insufficientSlots' => $slotRows->where('insufficientPeople', '>', 0)->count(),
            ],
            'slots' => $slotRows,
            'members' => $memberRows,
        ];
    }

    public function buildEventAvailabilityMePayload(
        Event $event,
        User $user,
        Collection $slots,
        Collection $availabilities,
    ): array {
        return [
            'slots' => $slots->map(function ($slot) use ($event, $user, $availabilities) {
                $availability = $availabilities
                    ->where('user_id', $user->id)
                    ->first(function ($availability) use ($slot) {
                        return $availability->date?->toDateString() === $slot->date?->toDateString()
                            && $this->normalizeTime($availability->start_time) === $this->normalizeTime($slot->start_time)
                            && $this->normalizeTime($availability->end_time) === $this->normalizeTime($slot->end_time);
                    });

                return [
                    'id' => $slot->id,
                    'eventId' => $slot->event_id,
                    'date' => $slot->date?->toDateString(),
                    'startTime' => $slot->start_time,
                    'endTime' => $slot->end_time,
                    'requiredPeople' => $slot->required_people,
                    'location' => $slot->location,
                    'note' => $slot->note,
                    'availabilityStatus' => $availability?->status?->value,
                    'availabilityComment' => $availability?->comment,
                ];
            })->values(),
        ];
    }

    public function buildCommonAvailabilitySlots(CommonAvailabilitySet $set): Collection
    {
        $start = Carbon::parse($set->starts_at ?? now());
        $end = Carbon::parse($set->ends_at ?? now());
        $rules = is_array($set->activity_rules) ? $set->activity_rules : [];
        $weekly = is_array($rules['weekly'] ?? null) ? $rules['weekly'] : [];
        $excludedDates = collect($rules['excludedDates'] ?? [])
            ->filter(fn ($date) => is_string($date) && $date !== '')
            ->map(fn (string $date) => Carbon::parse($date)->toDateString())
            ->all();
        $specialDates = collect($rules['specialDates'] ?? [])
            ->filter(fn ($item) => is_array($item) && ! empty($item['date']) && ! empty($item['startTime']) && ! empty($item['endTime']))
            ->keyBy(fn (array $item) => Carbon::parse($item['date'])->toDateString());
        $slots = collect();

        for ($date = $start->copy(); $date->lessThanOrEqualTo($end); $date->addDay()) {
            $dateString = $date->toDateString();

            if (in_array($dateString, $excludedDates, true)) {
                continue;
            }

            $specialDate = $specialDates->get($dateString);
            $weekdayRule = $weekly[strtolower($date->format('D'))] ?? null;
            $startTime = $specialDate['startTime'] ?? ($weekdayRule['startTime'] ?? '09:00');
            $endTime = $specialDate['endTime'] ?? ($weekdayRule['endTime'] ?? '12:00');
            $enabled = $specialDate !== null || (bool) ($weekdayRule['enabled'] ?? true);

            if (! $enabled || $this->normalizeTime($startTime) >= $this->normalizeTime($endTime)) {
                continue;
            }

            $slots->push([
                'commonAvailabilitySetId' => $set->id,
                'userId' => null,
                'date' => $dateString,
                'startTime' => $this->normalizeTime($startTime),
                'endTime' => $this->normalizeTime($endTime),
                'requiredPeople' => 1,
                'location' => null,
                'note' => $specialDate['note'] ?? null,
                'isCustom' => false,
            ]);
        }

        return $slots;
    }

    private function serializeCommonAvailabilitySet(CommonAvailabilitySet $set, int $availabilityCount = 0): array
    {
        return [
            'id' => $set->id,
            'groupId' => $set->group_id,
            'eventId' => $set->event_id,
            'name' => $set->name,
            'description' => $set->description,
            'startDate' => $set->starts_at?->toDateString(),
            'endDate' => $set->ends_at?->toDateString(),
            'deadline' => $set->deadline?->toIso8601String(),
            'availabilityCount' => $availabilityCount,
        ];
    }

    private function mergeCommonAvailabilitySlots(CommonAvailabilitySet $set, Collection $slots, Collection $availabilities): Collection
    {
        $merged = $slots->values();
        $keys = $merged
            ->map(fn (array $slot) => $slot['date'].'|'.$this->normalizeTime($slot['startTime']).'|'.$this->normalizeTime($slot['endTime']))
            ->all();

        foreach ($availabilities as $availability) {
            $date = $availability->date?->toDateString();
            $startTime = $this->normalizeTime($availability->start_time);
            $endTime = $this->normalizeTime($availability->end_time);

            if (! $date || ! $startTime || ! $endTime) {
                continue;
            }

            $key = $date.'|'.$startTime.'|'.$endTime;
            if (in_array($key, $keys, true)) {
                continue;
            }

            $keys[] = $key;
            $merged->push([
                'commonAvailabilitySetId' => $set->id,
                'userId' => null,
                'date' => $date,
                'startTime' => $startTime,
                'endTime' => $endTime,
                'requiredPeople' => 1,
                'location' => null,
                'note' => null,
                'isCustom' => true,
            ]);
        }

        return $merged
            ->sortBy(fn (array $slot) => $slot['date'].' '.$slot['startTime'])
            ->values();
    }

    private function matchCommonAvailability(Collection $availabilities, array $slot): ?CommonAvailability
    {
        return $availabilities->first(function (CommonAvailability $item) use ($slot) {
            return $item->date?->toDateString() === $slot['date']
                && $this->normalizeTime($item->start_time) === $this->normalizeTime($slot['startTime'])
                && $this->normalizeTime($item->end_time) === $this->normalizeTime($slot['endTime']);
        });
    }

    private function filterCommonAvailabilities(Collection $availabilities, array $slot): Collection
    {
        return $availabilities->filter(function (CommonAvailability $availability) use ($slot) {
            if ($availability->date?->toDateString() !== $slot['date']) {
                return false;
            }

            $availabilityStart = $this->normalizeTime($availability->start_time);
            $availabilityEnd = $this->normalizeTime($availability->end_time);
            $slotStart = $this->normalizeTime($slot['startTime']);
            $slotEnd = $this->normalizeTime($slot['endTime']);

            if (! $availabilityStart || ! $availabilityEnd || ! $slotStart || ! $slotEnd) {
                return false;
            }

            return $availabilityStart < $slotEnd && $availabilityEnd > $slotStart;
        });
    }

    private function filterEventAvailabilities(Collection $availabilities, ?string $date, ?string $startTime, ?string $endTime): Collection
    {
        return $availabilities->filter(function ($availability) use ($date, $startTime, $endTime) {
            return $availability->date?->toDateString() === $date
                && $this->normalizeTime($availability->start_time) === $this->normalizeTime($startTime)
                && $this->normalizeTime($availability->end_time) === $this->normalizeTime($endTime);
        });
    }

    private function availabilityStatusValue(mixed $status): ?string
    {
        return is_object($status) && property_exists($status, 'value')
            ? $status->value
            : $status;
    }

    private function normalizeTime(mixed $time): ?string
    {
        if ($time === null) {
            return null;
        }

        $time = (string) $time;

        return strlen($time) >= 5 ? substr($time, 0, 5) : $time;
    }
}
