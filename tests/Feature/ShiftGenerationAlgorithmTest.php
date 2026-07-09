<?php

namespace Tests\Feature;

use App\Models\Event;
use App\Models\EventSlot;
use App\Models\EventTask;
use App\Models\CommonAvailabilitySet;
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

    private function selectUsersForSlot(
        EventSlot $slot,
        array $users,
        array $lookup,
        array $workload = [],
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
