<?php

namespace App\Services;

use App\Enums\AvailabilityStatus;
use App\Enums\ShiftStatus;
use App\Models\Event;
use App\Models\EventSlot;
use App\Models\ShiftGenerationSetting;
use App\Models\Shift;
use App\Models\ShiftRule;
use App\Models\ShiftAssignment;
use Illuminate\Support\Collection;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

class ShiftGenerationService
{
    /**
     * @return array{shift: Shift, warnings: array<int, array<string, mixed>>}
     */
    public function generate(Event $event): array
    {
        $event->loadMissing('group', 'commonAvailabilitySet', 'teams.members.user', 'tasks.team.members.user', 'slots.task.team', 'shiftRule', 'shiftGenerationSetting');
        $shiftRule = $this->resolveShiftRule($event);
        $generationSetting = $this->resolveGenerationSetting($event);
        $this->syncTaskPlanSlots($event, $shiftRule);

        $slots = $event->slots()->with('task.team.members.user')->orderBy('start_datetime')->get();
        $availabilities = $event->commonAvailabilitySet
            ? $event->commonAvailabilitySet->availabilities()->with('user')->get()
            : collect();
        $groupMembers = $event->group->members()->with('user')->get();
        $teamMemberByUserId = $this->buildTeamMembershipLookup($event);
        $workload = $this->initializeWorkload($groupMembers);
        $lastAssignedEndAt = $this->initializeSlotMemory($groupMembers);
        $continuousMinutes = $this->initializeSlotMemory($groupMembers);
        $warnings = [];
        $assignmentRecords = [];
        $availabilityLookup = $this->buildAvailabilityLookup($slots, $availabilities);

        $shift = Shift::query()->create([
            'event_id' => $event->id,
            'event_slot_id' => null,
            'status' => ShiftStatus::Generated,
            'generated_at' => now(),
            'published_at' => null,
        ]);

        foreach ($slots as $slot) {
            $slotStart = $slot->start_datetime ? Carbon::parse($slot->start_datetime) : Carbon::parse($slot->date?->toDateString().' '.$slot->start_time);
            $slotEnd = $slot->end_datetime ? Carbon::parse($slot->end_datetime) : Carbon::parse($slot->date?->toDateString().' '.$slot->end_time);
            $slotDuration = max($slotStart->diffInMinutes($slotEnd), 0);
            $assignedUsers = $this->selectUsersForSlot(
                event: $event,
                slot: $slot,
                groupMembers: $groupMembers,
                availabilities: $availabilities,
                teamMemberByUserId: $teamMemberByUserId,
                workload: $workload,
                lastAssignedEndAt: $lastAssignedEndAt,
                continuousMinutes: $continuousMinutes,
                shiftRule: $shiftRule,
                generationSetting: $generationSetting,
            );

            if (count($assignedUsers) < $slot->required_people) {
                $warnings[] = [
                    'slotId' => $slot->id,
                    'taskId' => $slot->task_id,
                    'date' => $slot->date?->toDateString(),
                    'startTime' => $slot->start_time,
                    'endTime' => $slot->end_time,
                    'requiredPeople' => $slot->required_people,
                    'assignedPeople' => count($assignedUsers),
                    'missingPeople' => $slot->required_people - count($assignedUsers),
                    'missingPeopleTotal' => $slot->required_people - count($assignedUsers),
                    'message' => '必要人数に満たない時間枠があります。',
                ];
            }

            foreach ($assignedUsers as $user) {
                $taskTeamId = $slot->task?->team_id;
                $teamInfo = $teamMemberByUserId[$user->id] ?? ['teams' => [], 'isLeader' => false];
                $isLeader = $taskTeamId
                    ? (($teamInfo['teams'][$taskTeamId] ?? null) === 'leader')
                    : (bool) ($teamInfo['isLeader'] ?? false);
                $status = $availabilityLookup[$slot->id][$user->id]['status'] ?? ($event->common_availability_set_id ? null : AvailabilityStatus::Available->value);

                ShiftAssignment::query()->create([
                    'shift_id' => $shift->id,
                    'event_slot_id' => $slot->id,
                    'user_id' => $user->id,
                    'is_leader' => $isLeader,
                ]);

                $workload[$user->id] = ($workload[$user->id] ?? 0) + $this->durationMinutes($slot);
                $previousEndAt = $lastAssignedEndAt[$user->id] ?? null;
                $gapMinutes = $previousEndAt instanceof Carbon ? $previousEndAt->diffInMinutes($slotStart, false) : null;
                $hasEnoughBreak = $gapMinutes !== null && $gapMinutes > 0 && ((int) $shiftRule->break_minutes === 0 || $gapMinutes >= $shiftRule->break_minutes);
                $lastAssignedEndAt[$user->id] = $slotEnd->copy();
                $continuousMinutes[$user->id] = $hasEnoughBreak
                    ? $slotDuration
                    : (($continuousMinutes[$user->id] ?? 0) + $slotDuration);
                $assignmentRecords[] = [
                    'slotId' => $slot->id,
                    'userId' => $user->id,
                    'status' => $status,
                ];
            }
        }

        foreach ($event->tasks as $task) {
            $desiredMinutes = (int) round(((float) ($task->desired_total_hours ?? 0)) * 60);
            if ($desiredMinutes <= 0) {
                continue;
            }

            $plannedMinutes = (int) $slots
                ->where('task_id', $task->id)
                ->sum(fn (EventSlot $slot) => $this->durationMinutes($slot));

            if ($plannedMinutes < $desiredMinutes) {
                $warnings[] = [
                    'slotId' => null,
                    'taskId' => $task->id,
                    'date' => null,
                    'startTime' => null,
                    'endTime' => null,
                    'requiredPeople' => 0,
                    'assignedPeople' => 0,
                    'missingPeople' => 0,
                    'missingPeopleTotal' => 0,
                    'missingMinutes' => $desiredMinutes - $plannedMinutes,
                    'message' => '作業に必要な時間を確保できていません。',
                ];
            }
        }

        $requiredPeopleTotal = $slots->sum('required_people');
        $assignedPeopleTotal = count($assignmentRecords);
        $missingPeopleTotal = max($requiredPeopleTotal - $assignedPeopleTotal, 0);
        $assignmentsBySlot = collect($assignmentRecords)->groupBy('slotId');
        $scheduledWorkMinutes = (int) $slots->sum(fn (EventSlot $slot) => $this->durationMinutes($slot));
        $desiredWorkMinutes = (int) $event->tasks->sum(fn ($task) => (int) round(((float) ($task->desired_total_hours ?? 0)) * 60));
        $plannedWorkMinutes = max($scheduledWorkMinutes, $desiredWorkMinutes);
        $completeWorkMinutes = (int) $slots->sum(function (EventSlot $slot) use ($assignmentsBySlot) {
            $assignedPeople = $assignmentsBySlot->get($slot->id, collect())->count();

            return $assignedPeople >= max((int) ($slot->required_people ?? 1), 1)
                ? $this->durationMinutes($slot)
                : 0;
        });
        $staffedWorkMinutes = (int) $slots->sum(function (EventSlot $slot) use ($assignmentsBySlot) {
            return $assignmentsBySlot->get($slot->id, collect())->isNotEmpty()
                ? $this->durationMinutes($slot)
                : 0;
        });
        $preferredAssignments = collect($assignmentRecords)->where('status', AvailabilityStatus::Preferred->value)->count();
        $availableAssignments = collect($assignmentRecords)->whereIn('status', [AvailabilityStatus::Available->value, AvailabilityStatus::Preferred->value])->count();

        return [
            'shift' => $shift->load(['assignments.user', 'assignments.eventSlot.task.team', 'event']),
            'warnings' => $warnings,
            'metrics' => [
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
                'memberWorkload' => collect($workload)
                    ->map(function (int $minutes, string $userId) use ($groupMembers) {
                        $member = $groupMembers->firstWhere('user_id', $userId);

                        return [
                            'userId' => $userId,
                            'displayName' => $member?->user?->display_name,
                            'minutes' => $minutes,
                        ];
                    })
                    ->sortByDesc('minutes')
                    ->values(),
            ],
        ];
    }

    private function resolveShiftRule(Event $event): ShiftRule
    {
        return $event->shiftRule()->firstOrCreate(
            ['event_id' => $event->id],
            [
                'slot_minutes' => 60,
                'min_work_minutes' => 0,
                'max_work_minutes' => 0,
                'max_continuous_minutes' => 0,
                'break_minutes' => 0,
                'leader_required_per_slot' => 0,
            ],
        );
    }

    private function resolveGenerationSetting(Event $event): ShiftGenerationSetting
    {
        return $event->shiftGenerationSetting()->firstOrCreate(
            ['event_id' => $event->id],
            [
                'preference_weight' => 50,
                'fairness_weight' => 50,
                'balance_workload_weight' => 50,
                'avoid_continuous_work_weight' => 50,
                'leader_assignment_weight' => 50,
                'required_people_weight' => 50,
            ],
        );
    }

    private function initializeSlotMemory(Collection $groupMembers): array
    {
        return $groupMembers->mapWithKeys(fn ($member) => [$member->user_id => null])->all();
    }

    private function selectUsersForSlot(
        Event $event,
        EventSlot $slot,
        Collection $groupMembers,
        Collection $availabilities,
        array $teamMemberByUserId,
        array &$workload,
        array &$lastAssignedEndAt,
        array &$continuousMinutes,
        ShiftRule $shiftRule,
        ShiftGenerationSetting $generationSetting,
    ): array {
        $slotStart = $slot->start_datetime ? Carbon::parse($slot->start_datetime) : Carbon::parse($slot->date?->toDateString().' '.$slot->start_time);
        $slotEnd = $slot->end_datetime ? Carbon::parse($slot->end_datetime) : Carbon::parse($slot->date?->toDateString().' '.$slot->end_time);
        $slotDuration = max($slotStart->diffInMinutes($slotEnd), 0);
        $requiredMemberIds = array_values(array_filter((array) ($slot->task?->required_member_ids ?? [])));
        $requiredCount = max((int) $slot->required_people, 0);

        $candidates = [];
        foreach ($groupMembers as $member) {
            $user = $member->user;
            if (! $user) {
                continue;
            }

            $status = $this->availabilityStatusForUserAndSlot($availabilities, $slot, $user->id);
            if ($availabilities->isNotEmpty() && ! in_array($status, [AvailabilityStatus::Available->value, AvailabilityStatus::Preferred->value], true)) {
                continue;
            }

            $teamInfo = $teamMemberByUserId[$user->id] ?? ['teams' => [], 'isLeader' => false];
            $taskTeamId = $slot->task?->team_id;
            $roleInTaskTeam = $taskTeamId ? ($teamInfo['teams'][$taskTeamId] ?? null) : null;
            $isTeamMember = $taskTeamId ? $roleInTaskTeam !== null : true;
            if ($slot->task?->team_id && ! $slot->task->allow_cross_team_help && ! $isTeamMember) {
                continue;
            }

            $isLeader = $taskTeamId ? $roleInTaskTeam === 'leader' : (bool) ($teamInfo['isLeader'] ?? false);
            $hasRequiredRole = $slot->task?->required_role === 'leader' ? $isLeader : true;

            $candidates[] = [
                'user' => $user,
                'status' => $status ?? AvailabilityStatus::Available->value,
                'isTeamMember' => $isTeamMember,
                'isLeader' => $isLeader,
                'isRequiredMember' => in_array($user->id, $requiredMemberIds, true),
                'workload' => (int) ($workload[$user->id] ?? 0),
                'lastEndAt' => $lastAssignedEndAt[$user->id] ?? null,
                'continuousMinutes' => (int) ($continuousMinutes[$user->id] ?? 0),
                'hasRequiredRole' => $hasRequiredRole,
                'violatesLimit' => $this->candidateViolatesLimit(
                    workload: (int) ($workload[$user->id] ?? 0),
                    continuousMinutes: (int) ($continuousMinutes[$user->id] ?? 0),
                    lastEndAt: $lastAssignedEndAt[$user->id] ?? null,
                    slotStart: $slotStart,
                    slotDuration: $slotDuration,
                    shiftRule: $shiftRule,
                ),
            ];
        }

        usort($candidates, function (array $left, array $right) use ($slot, $shiftRule, $generationSetting, $slotStart, $slotDuration) {
            return $this->compareCandidate($left, $right, $slot, $shiftRule, $generationSetting, $slotStart, $slotDuration);
        });

        $selected = [];
        $selectedIds = [];

        $requiredCandidates = array_values(array_filter($candidates, fn (array $candidate) => $candidate['isRequiredMember']));
        $optionalCandidates = array_values(array_filter($candidates, fn (array $candidate) => ! $candidate['isRequiredMember']));

        foreach ([...$requiredCandidates, ...$optionalCandidates] as $candidate) {
            if (count($selected) >= $requiredCount) {
                break;
            }

            $user = $candidate['user'];
            if (in_array($user->id, $selectedIds, true)) {
                continue;
            }

            $selected[] = $user;
            $selectedIds[] = $user->id;
        }

        return $selected;
    }

    private function compareCandidate(
        array $left,
        array $right,
        EventSlot $slot,
        ShiftRule $shiftRule,
        ShiftGenerationSetting $generationSetting,
        Carbon $slotStart,
        int $slotDuration,
    ): int {
        if ($left['violatesLimit'] !== $right['violatesLimit']) {
            return $left['violatesLimit'] ? 1 : -1;
        }

        $leftScore = $this->candidateScore($left, $slot, $shiftRule, $generationSetting, $slotStart, $slotDuration);
        $rightScore = $this->candidateScore($right, $slot, $shiftRule, $generationSetting, $slotStart, $slotDuration);

        if ($leftScore === $rightScore) {
            return Str::lower((string) ($left['user']->display_name ?? $left['user']->email)) <=> Str::lower((string) ($right['user']->display_name ?? $right['user']->email));
        }

        return $rightScore <=> $leftScore;
    }

    private function candidateScore(
        array $candidate,
        EventSlot $slot,
        ShiftRule $shiftRule,
        ShiftGenerationSetting $generationSetting,
        Carbon $slotStart,
        int $slotDuration,
    ): int {
        $score = 0;

        if ($candidate['isRequiredMember']) {
            $score += 200_000 + ($generationSetting->required_people_weight * 1_000);
        }

        if ($candidate['hasRequiredRole']) {
            $score += 20_000;
        }

        if ($slot->task?->team_id) {
            $score += $candidate['isTeamMember'] ? 100_000 : 10_000;
        }

        if ($slot->task?->required_role === 'leader' || (int) $shiftRule->leader_required_per_slot > 0) {
            $score += $candidate['isLeader'] ? (100_000 + ($generationSetting->leader_assignment_weight * 1_000)) : -50_000;
        }

        $score += match ($candidate['status']) {
            AvailabilityStatus::Preferred->value => 50_000 + ($generationSetting->preference_weight * 1_000),
            AvailabilityStatus::Available->value => 25_000 + (int) ($generationSetting->preference_weight * 500),
            default => 0,
        };

        if ((int) $shiftRule->min_work_minutes > 0 && $candidate['workload'] < $shiftRule->min_work_minutes) {
            $score += (int) (($shiftRule->min_work_minutes - $candidate['workload']) * max(1, $generationSetting->fairness_weight));
        }

        $score += max(0, 50_000 - (int) ($candidate['workload'] * max(1, $generationSetting->balance_workload_weight + $generationSetting->fairness_weight)));
        $score += max(0, 20_000 - intdiv($candidate['continuousMinutes'] * max(1, $generationSetting->avoid_continuous_work_weight), 2));

        if (($candidate['lastEndAt'] ?? null) instanceof Carbon) {
            $gapMinutes = $candidate['lastEndAt']->diffInMinutes($slotStart, false);
            if ($gapMinutes >= 0 && (int) $shiftRule->break_minutes > 0 && $gapMinutes < $shiftRule->break_minutes) {
                $score -= (int) (($shiftRule->break_minutes - $gapMinutes) * max(1, $generationSetting->avoid_continuous_work_weight));
            }
        }

        if ((int) $shiftRule->max_continuous_minutes > 0 && $candidate['continuousMinutes'] + $slotDuration > $shiftRule->max_continuous_minutes) {
            $score -= 150_000;
        }

        if ((int) $shiftRule->max_work_minutes > 0 && $candidate['workload'] + $slotDuration > $shiftRule->max_work_minutes) {
            $score -= 80_000;
        }

        return $score;
    }

    private function candidateViolatesLimit(
        int $workload,
        int $continuousMinutes,
        mixed $lastEndAt,
        Carbon $slotStart,
        int $slotDuration,
        ShiftRule $shiftRule,
    ): bool {
        if ((int) $shiftRule->max_work_minutes > 0 && $workload + $slotDuration > $shiftRule->max_work_minutes) {
            return true;
        }

        if ((int) $shiftRule->max_continuous_minutes > 0 && $continuousMinutes + $slotDuration > $shiftRule->max_continuous_minutes) {
            return true;
        }

        if ($lastEndAt instanceof Carbon && (int) $shiftRule->break_minutes > 0) {
            $gapMinutes = $lastEndAt->diffInMinutes($slotStart, false);

            return $gapMinutes >= 0 && $gapMinutes < $shiftRule->break_minutes;
        }

        return false;
    }

    private function availabilityStatusForUserAndSlot(Collection $availabilities, EventSlot $slot, string $userId): ?string
    {
        if ($availabilities->isEmpty()) {
            return AvailabilityStatus::Available->value;
        }

        $availability = $availabilities->first(function ($availability) use ($slot, $userId) {
            return $availability->user_id === $userId && $this->availabilityCoversSlot($availability, $slot);
        });

        return $availability?->status?->value ?? $availability?->status;
    }

    private function buildTeamMembershipLookup(Event $event): array
    {
        $lookup = [];

        $teams = $event->teams()
            ->with('members')
            ->get()
            ->merge(
                $event->group->teams()
                    ->whereNull('event_id')
                    ->with('members')
                    ->get(),
            )
            ->unique('id')
            ->values();

        foreach ($teams as $team) {
            foreach ($team->members as $member) {
                $role = $member->role->value;
                $lookup[$member->user_id] ??= ['teams' => [], 'isLeader' => false];
                $lookup[$member->user_id]['teams'][$team->id] = $role;
                $lookup[$member->user_id]['isLeader'] = $lookup[$member->user_id]['isLeader'] || $role === 'leader';
            }
        }

        return $lookup;
    }

    private function initializeWorkload(Collection $groupMembers): array
    {
        return $groupMembers->mapWithKeys(fn ($member) => [$member->user_id => 0])->all();
    }

    private function buildAvailabilityLookup(Collection $slots, Collection $availabilities): array
    {
        $lookup = [];

        foreach ($slots as $slot) {
            $lookup[$slot->id] = [];
        }

        foreach ($availabilities as $availability) {
            foreach ($slots as $slot) {
                if ($this->availabilityCoversSlot($availability, $slot)) {
                    $lookup[$slot->id][$availability->user_id] = [
                        'status' => $this->availabilityStatusValue($availability->status),
                    ];
                }
            }
        }

        return $lookup;
    }

    private function durationMinutes(EventSlot $slot): int
    {
        $start = Carbon::parse($slot->start_datetime ?? $slot->date?->copy()->setTimeFromTimeString($slot->start_time));
        $end = Carbon::parse($slot->end_datetime ?? $slot->date?->copy()->setTimeFromTimeString($slot->end_time));

        return max($start->diffInMinutes($end), 0);
    }

    private function normalizeTime(?string $time): ?string
    {
        if ($time === null) {
            return null;
        }

        return Carbon::parse($time)->format('H:i');
    }

    private function availabilityCoversSlot($availability, EventSlot $slot): bool
    {
        if ($availability->date?->toDateString() !== $slot->date?->toDateString()) {
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

    private function availabilityStatusValue(mixed $status): ?string
    {
        if ($status instanceof AvailabilityStatus) {
            return $status->value;
        }

        return is_string($status) ? $status : null;
    }

    private function syncTaskPlanSlots(Event $event, ShiftRule $shiftRule): void
    {
        foreach ($event->tasks as $task) {
            $desiredPeriods = is_array($task->desired_periods ?? null) ? $task->desired_periods : [];
            if (! $desiredPeriods) {
                $this->syncEstimatedTaskSlots($event, $task, $shiftRule);
                continue;
            }

            $keepSlotIds = [];
            foreach ($desiredPeriods as $period) {
                if (empty($period['date']) || empty($period['startTime']) || empty($period['endTime'])) {
                    continue;
                }

                $startAt = Carbon::parse($period['date'].' '.$period['startTime']);
                $endAt = Carbon::parse($period['date'].' '.$period['endTime']);

                $slot = EventSlot::query()->updateOrCreate(
                    [
                        'task_id' => $task->id,
                        'date' => $startAt->toDateString(),
                        'start_time' => $startAt->format('H:i:s'),
                        'end_time' => $endAt->format('H:i:s'),
                    ],
                    [
                        'event_id' => $event->id,
                        'start_datetime' => $startAt,
                        'end_datetime' => $endAt,
                        'required_people' => max((int) ($period['requiredPeople'] ?? $task->required_people_per_slot ?? 1), 1),
                        'status' => 'open',
                        'location' => $period['location'] ?? null,
                        'note' => $period['note'] ?? null,
                    ],
                );

                $keepSlotIds[] = $slot->id;
            }

            $event->slots()
                ->where('task_id', $task->id)
                ->when($keepSlotIds, fn ($query) => $query->whereNotIn('id', $keepSlotIds))
                ->delete();
        }
    }

    private function syncEstimatedTaskSlots(Event $event, object $task, ShiftRule $shiftRule): void
    {
        $desiredTotalMinutes = (int) round(((float) ($task->desired_total_hours ?? 0)) * 60);
        if ($desiredTotalMinutes <= 0) {
            $event->slots()->where('task_id', $task->id)->delete();
            return;
        }

        $startDate = $task->work_start_date
            ?? $event->commonAvailabilitySet?->starts_at
            ?? $event->start_date;
        $endDate = $task->work_end_date
            ?? $event->commonAvailabilitySet?->ends_at
            ?? $event->end_date
            ?? $startDate;

        if (! $startDate || ! $endDate) {
            $event->slots()->where('task_id', $task->id)->delete();
            return;
        }

        $slotMinutes = max((int) $shiftRule->slot_minutes, 15);
        $slotCount = max((int) ceil($desiredTotalMinutes / $slotMinutes), 1);
        $requiredPeople = max((int) ($task->required_people_per_slot ?? 1), 1);
        $dates = $this->datesBetween(Carbon::parse($startDate)->startOfDay(), Carbon::parse($endDate)->startOfDay());
        if (! $dates) {
            $event->slots()->where('task_id', $task->id)->delete();
            return;
        }

        $candidateWindows = $this->activityWindowsForDates($event, $dates, $slotMinutes);
        if (! $candidateWindows) {
            $event->slots()->where('task_id', $task->id)->delete();
            return;
        }

        $keepSlotIds = [];
        for ($index = 0; $index < min($slotCount, count($candidateWindows)); $index++) {
            $window = $candidateWindows[$index];
            $startAt = $window['start']->copy();
            $endAt = $window['end']->copy();

            $slot = EventSlot::query()->updateOrCreate(
                [
                    'task_id' => $task->id,
                    'date' => $startAt->toDateString(),
                    'start_time' => $startAt->format('H:i:s'),
                    'end_time' => $endAt->format('H:i:s'),
                ],
                [
                    'event_id' => $event->id,
                    'start_datetime' => $startAt,
                    'end_datetime' => $endAt,
                    'required_people' => $requiredPeople,
                    'status' => 'open',
                    'location' => null,
                    'note' => '必要時間から自動作成',
                ],
            );

            $keepSlotIds[] = $slot->id;
        }

        $event->slots()
            ->where('task_id', $task->id)
            ->whereNotIn('id', $keepSlotIds)
            ->delete();
    }

    /**
     * @return array<int, Carbon>
     */
    private function datesBetween(Carbon $startDate, Carbon $endDate): array
    {
        if ($startDate->gt($endDate)) {
            return [];
        }

        $dates = [];
        for ($date = $startDate->copy(); $date->lte($endDate); $date->addDay()) {
            $dates[] = $date->copy();
        }

        return $dates;
    }

    /**
     * @param array<int, Carbon> $dates
     * @return array<int, array{start: Carbon, end: Carbon}>
     */
    private function activityWindowsForDates(Event $event, array $dates, int $slotMinutes): array
    {
        $rules = is_array($event->commonAvailabilitySet?->activity_rules ?? null)
            ? $event->commonAvailabilitySet->activity_rules
            : [];
        $weekly = is_array($rules['weekly'] ?? null) ? $rules['weekly'] : [];
        $excludedDates = collect($rules['excludedDates'] ?? [])
            ->filter(fn ($date) => is_string($date) && $date !== '')
            ->map(fn (string $date) => Carbon::parse($date)->toDateString())
            ->all();
        $specialDates = collect($rules['specialDates'] ?? [])
            ->filter(fn ($item) => is_array($item) && ! empty($item['date']) && ! empty($item['startTime']) && ! empty($item['endTime']))
            ->keyBy(fn (array $item) => Carbon::parse($item['date'])->toDateString());

        $windows = [];
        foreach ($dates as $date) {
            $dateString = $date->toDateString();
            if (in_array($dateString, $excludedDates, true)) {
                continue;
            }

            $specialDate = $specialDates->get($dateString);
            $weekdayRule = $weekly[strtolower($date->format('D'))] ?? null;
            $enabled = $specialDate !== null || (bool) ($weekdayRule['enabled'] ?? true);
            if (! $enabled) {
                continue;
            }

            $startTime = $specialDate['startTime'] ?? ($weekdayRule['startTime'] ?? '09:00');
            $endTime = $specialDate['endTime'] ?? ($weekdayRule['endTime'] ?? '12:00');
            $start = Carbon::parse($dateString.' '.$this->normalizeTime($startTime));
            $end = Carbon::parse($dateString.' '.$this->normalizeTime($endTime));

            if ($start->greaterThanOrEqualTo($end) || $start->copy()->addMinutes($slotMinutes)->greaterThan($end)) {
                continue;
            }

            for ($cursor = $start->copy(); $cursor->copy()->addMinutes($slotMinutes)->lessThanOrEqualTo($end); $cursor->addMinutes($slotMinutes)) {
                $windows[] = [
                    'start' => $cursor->copy(),
                    'end' => $cursor->copy()->addMinutes($slotMinutes),
                ];
            }
        }

        return $windows;
    }
}
