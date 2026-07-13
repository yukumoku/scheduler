<?php

namespace Tests\Feature;

use App\Enums\AvailabilityStatus;
use App\Models\Event;
use App\Models\EventSlot;
use App\Models\EventTask;
use App\Models\CommonAvailabilitySet;
use App\Models\CommonAvailability;
use App\Models\GroupMember;
use App\Models\ShiftGenerationSetting;
use App\Models\ShiftRule;
use App\Models\User;
use App\Services\ShiftGenerationService;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class ShiftGenerationAlgorithmTest extends TestCase
{
    public function test_required_task_member_is_selected_even_when_user_belongs_to_multiple_teams(): void
    {
        $requiredUser = $this->user('user-required', '担当者');
        $fallbackUser = $this->user('user-fallback', '代替候補');
        $slot = $this->slot([
            'team_id' => 'team-target',
            'required_member_ids' => [$requiredUser->id],
            'allow_cross_team_help' => false,
        ]);

        $selected = $this->selectUsersForSlot(
            slot: $slot,
            users: [$requiredUser, $fallbackUser],
            lookup: [
                $requiredUser->id => [
                    'teams' => [
                        'team-target' => 'member',
                        'team-other' => 'leader',
                    ],
                    'isLeader' => true,
                ],
                $fallbackUser->id => [
                    'teams' => ['team-target' => 'member'],
                    'isLeader' => false,
                ],
            ],
        );

        $this->assertSame($requiredUser->id, $selected[0]->id);
    }

    public function test_shift_limits_move_overloaded_users_behind_available_candidates(): void
    {
        $overloadedUser = $this->user('user-overloaded', '多めの人');
        $freshUser = $this->user('user-fresh', '少ない人');
        $slot = $this->slot([
            'team_id' => null,
            'required_member_ids' => [],
            'allow_cross_team_help' => true,
        ]);

        $selected = $this->selectUsersForSlot(
            slot: $slot,
            users: [$overloadedUser, $freshUser],
            lookup: [
                $overloadedUser->id => ['teams' => [], 'isLeader' => false],
                $freshUser->id => ['teams' => [], 'isLeader' => false],
            ],
            workload: [
                $overloadedUser->id => 60,
                $freshUser->id => 0,
            ],
            shiftRule: $this->shiftRule(['max_work_minutes' => 60]),
        );

        $this->assertSame($freshUser->id, $selected[0]->id);
    }

    public function test_user_already_assigned_to_overlapping_slot_is_not_selected_again(): void
    {
        $busyUser = $this->user('user-busy', '同時刻の人');
        $freeUser = $this->user('user-free', '空いている人');
        $slot = $this->slot([
            'team_id' => null,
            'required_member_ids' => [],
            'allow_cross_team_help' => true,
        ]);

        $selected = $this->selectUsersForSlot(
            slot: $slot,
            users: [$busyUser, $freeUser],
            lookup: [
                $busyUser->id => ['teams' => [], 'isLeader' => false],
                $freeUser->id => ['teams' => [], 'isLeader' => false],
            ],
            assignedIntervalsByUser: [
                $busyUser->id => [
                    [
                        'start' => Carbon::parse('2026-07-20 09:30:00'),
                        'end' => Carbon::parse('2026-07-20 10:30:00'),
                        'slotId' => 'other-slot',
                    ],
                ],
            ],
        );

        $this->assertSame($freeUser->id, $selected[0]->id);
        $this->assertNotContains($busyUser->id, array_map(fn (User $user) => $user->id, $selected));
    }

    public function test_estimated_task_slots_follow_common_availability_activity_rules(): void
    {
        $event = new Event();
        $set = new CommonAvailabilitySet();
        $set->activity_rules = [
            'weekly' => [
                'mon' => ['enabled' => true, 'startTime' => '13:00', 'endTime' => '15:00'],
                'tue' => ['enabled' => true, 'startTime' => '09:00', 'endTime' => '11:00'],
            ],
            'excludedDates' => ['2026-07-21'],
            'specialDates' => [
                ['date' => '2026-07-22', 'startTime' => '10:00', 'endTime' => '12:00', 'note' => null],
            ],
        ];
        $event->setRelation('commonAvailabilitySet', $set);

        $method = new \ReflectionMethod(ShiftGenerationService::class, 'activityWindowsForDates');
        $method->setAccessible(true);

        $windows = $method->invoke(
            new ShiftGenerationService(),
            $event,
            [
                Carbon::parse('2026-07-20'),
                Carbon::parse('2026-07-21'),
                Carbon::parse('2026-07-22'),
            ],
            60,
        );

        $this->assertSame(
            ['2026-07-20 13:00', '2026-07-20 14:00', '2026-07-22 10:00', '2026-07-22 11:00'],
            array_map(fn (array $window) => $window['start']->format('Y-m-d H:i'), $windows),
        );
    }

    public function test_estimated_task_slots_are_distributed_across_whole_period(): void
    {
        $windows = collect(range(0, 4))
            ->map(fn (int $index) => [
                'start' => Carbon::parse('2026-07-20 09:00:00')->addDays($index),
                'end' => Carbon::parse('2026-07-20 10:00:00')->addDays($index),
            ])
            ->all();

        $method = new \ReflectionMethod(ShiftGenerationService::class, 'selectDistributedWindows');
        $method->setAccessible(true);

        $selected = $method->invoke(new ShiftGenerationService(), $windows, 3);

        $this->assertSame(
            ['2026-07-20 09:00', '2026-07-22 09:00', '2026-07-24 09:00'],
            array_map(fn (array $window) => $window['start']->format('Y-m-d H:i'), $selected),
        );
    }

    public function test_availability_first_window_selection_prefers_times_with_available_members(): void
    {
        $user = $this->user('user-available', '来られる人');
        $event = new Event();
        $event->id = 'event-1';
        $task = new EventTask();
        $task->id = 'task-1';
        $task->event_id = $event->id;
        $task->team_id = null;
        $task->required_member_ids = [];
        $task->required_role = null;
        $task->allow_cross_team_help = true;

        $member = new GroupMember();
        $member->user_id = $user->id;
        $member->setRelation('user', $user);

        $availability = new CommonAvailability();
        $availability->user_id = $user->id;
        $availability->date = Carbon::parse('2026-07-22');
        $availability->start_time = '09:00:00';
        $availability->end_time = '10:00:00';
        $availability->status = AvailabilityStatus::Available;

        $plannedWorkload = [$user->id => 0];
        $plannedLastAssignedEndAt = [$user->id => null];
        $plannedContinuousMinutes = [$user->id => 0];
        $plannedIntervalsByUser = [$user->id => []];
        $windows = [
            [
                'start' => Carbon::parse('2026-07-20 09:00:00'),
                'end' => Carbon::parse('2026-07-20 10:00:00'),
            ],
            [
                'start' => Carbon::parse('2026-07-22 09:00:00'),
                'end' => Carbon::parse('2026-07-22 10:00:00'),
            ],
        ];

        $method = new \ReflectionMethod(ShiftGenerationService::class, 'selectAvailabilityFirstWindows');
        $method->setAccessible(true);

        $selected = $method->invokeArgs(new ShiftGenerationService(), [
            $event,
            $task,
            $windows,
            1,
            1,
            collect([$member]),
            collect([$availability]),
            [$user->id => ['teams' => [], 'isLeader' => false]],
            &$plannedWorkload,
            &$plannedLastAssignedEndAt,
            &$plannedContinuousMinutes,
            &$plannedIntervalsByUser,
            $this->shiftRule(),
            $this->generationSetting(),
        ]);

        $this->assertSame('2026-07-22 09:00', $selected[0]['window']['start']->format('Y-m-d H:i'));
        $this->assertSame($user->id, $selected[0]['users'][0]->id);
    }

    public function test_candidate_windows_are_limited_for_long_periods(): void
    {
        $windows = collect(range(0, 499))
            ->map(fn (int $index) => [
                'start' => Carbon::parse('2026-07-20 09:00:00')->addHours($index),
                'end' => Carbon::parse('2026-07-20 10:00:00')->addHours($index),
            ])
            ->all();

        $method = new \ReflectionMethod(ShiftGenerationService::class, 'limitCandidateWindows');
        $method->setAccessible(true);

        $limited = $method->invoke(new ShiftGenerationService(), $windows);

        $this->assertLessThanOrEqual(240, count($limited));
        $this->assertSame('2026-07-20 09:00', $limited[0]['start']->format('Y-m-d H:i'));
        $this->assertSame($windows[array_key_last($windows)]['start']->format('Y-m-d H:i'), $limited[array_key_last($limited)]['start']->format('Y-m-d H:i'));
    }

    private function selectUsersForSlot(
        EventSlot $slot,
        array $users,
        array $lookup,
        array $workload = [],
        array $assignedIntervalsByUser = [],
        ?ShiftRule $shiftRule = null,
    ): array {
        $groupMembers = collect(array_map(function (User $user) {
            $member = new GroupMember();
            $member->user_id = $user->id;
            $member->setRelation('user', $user);

            return $member;
        }, $users));
        $workload = array_replace(
            collect($users)->mapWithKeys(fn (User $user) => [$user->id => 0])->all(),
            $workload,
        );
        $lastAssignedEndAt = collect($users)->mapWithKeys(fn (User $user) => [$user->id => null])->all();
        $continuousMinutes = collect($users)->mapWithKeys(fn (User $user) => [$user->id => 0])->all();
        $assignedIntervalsByUser = array_replace(
            collect($users)->mapWithKeys(fn (User $user) => [$user->id => []])->all(),
            $assignedIntervalsByUser,
        );
        $method = new \ReflectionMethod(ShiftGenerationService::class, 'selectUsersForSlot');
        $method->setAccessible(true);

        $service = new ShiftGenerationService();

        return $method->invokeArgs(
            $service,
            [
                new Event(),
                $slot,
                $groupMembers,
                collect(),
                $lookup,
                &$workload,
                &$lastAssignedEndAt,
                &$continuousMinutes,
                &$assignedIntervalsByUser,
                $shiftRule ?? $this->shiftRule(),
                $this->generationSetting(),
            ],
        );
    }

    private function user(string $id, string $name): User
    {
        $user = new User();
        $user->id = $id;
        $user->display_name = $name;
        $user->email = "{$id}@example.com";

        return $user;
    }

    private function slot(array $taskAttributes): EventSlot
    {
        $task = new EventTask();
        $task->team_id = $taskAttributes['team_id'];
        $task->required_member_ids = $taskAttributes['required_member_ids'];
        $task->allow_cross_team_help = $taskAttributes['allow_cross_team_help'];
        $task->required_role = null;

        $slot = new EventSlot();
        $slot->id = 'slot-1';
        $slot->task_id = 'task-1';
        $slot->date = Carbon::parse('2026-07-20');
        $slot->start_time = '09:00:00';
        $slot->end_time = '10:00:00';
        $slot->start_datetime = Carbon::parse('2026-07-20 09:00:00');
        $slot->end_datetime = Carbon::parse('2026-07-20 10:00:00');
        $slot->required_people = 1;
        $slot->setRelation('task', $task);

        return $slot;
    }

    private function shiftRule(array $attributes = []): ShiftRule
    {
        $rule = new ShiftRule();
        foreach (array_replace([
            'slot_minutes' => 60,
            'min_work_minutes' => 0,
            'max_work_minutes' => 0,
            'max_continuous_minutes' => 0,
            'break_minutes' => 0,
            'leader_required_per_slot' => 0,
        ], $attributes) as $key => $value) {
            $rule->{$key} = $value;
        }

        return $rule;
    }

    private function generationSetting(): ShiftGenerationSetting
    {
        $setting = new ShiftGenerationSetting();
        foreach ([
            'preference_weight' => 50,
            'fairness_weight' => 50,
            'balance_workload_weight' => 50,
            'avoid_continuous_work_weight' => 50,
            'leader_assignment_weight' => 50,
            'required_people_weight' => 50,
        ] as $key => $value) {
            $setting->{$key} = $value;
        }

        return $setting;
    }
}
