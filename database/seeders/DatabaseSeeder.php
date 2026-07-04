<?php

namespace Database\Seeders;

use App\Enums\EventStatus;
use App\Enums\EventScope;
use App\Enums\GroupRole;
use App\Enums\TeamMemberRole;
use App\Enums\ShiftStatus;
use App\Models\Availability;
use App\Models\CommonAvailability;
use App\Models\CommonAvailabilitySet;
use App\Models\Event;
use App\Models\EventSlot;
use App\Models\EventTask;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Invitation;
use App\Models\Team;
use App\Models\TeamMember;
use App\Models\Shift;
use App\Models\ShiftAssignment;
use App\Models\ShiftGenerationSetting;
use App\Models\ShiftRule;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $owner = User::factory()->create([
            'display_name' => 'Test Owner',
            'email' => 'owner@example.com',
        ]);

        $member = User::factory()->create([
            'display_name' => 'Test Member',
            'email' => 'member@example.com',
        ]);

        $helper = User::factory()->create([
            'display_name' => 'Test Helper',
            'email' => 'helper@example.com',
        ]);

        $group = Group::factory()->create([
            'owner_id' => $owner->id,
            'invite_code' => 'SCHEDULE-CRAFT',
        ]);

        GroupMember::query()->create([
            'group_id' => $group->id,
            'user_id' => $owner->id,
            'role' => GroupRole::Owner,
            'joined_at' => now(),
        ]);

        GroupMember::query()->create([
            'group_id' => $group->id,
            'user_id' => $member->id,
            'role' => GroupRole::Member,
            'joined_at' => now(),
        ]);

        GroupMember::query()->create([
            'group_id' => $group->id,
            'user_id' => $helper->id,
            'role' => GroupRole::Member,
            'joined_at' => now(),
        ]);

        $decorTeam = Team::factory()->create([
            'group_id' => $group->id,
            'event_id' => null,
            'name' => '装飾班',
            'color' => '#7c3aed',
        ]);
        $receptionTeam = Team::factory()->create([
            'group_id' => $group->id,
            'event_id' => null,
            'name' => '受付班',
            'color' => '#3b82f6',
        ]);
        $stageTeam = Team::factory()->create([
            'group_id' => $group->id,
            'event_id' => null,
            'name' => 'ステージ班',
            'color' => '#10b981',
        ]);

        TeamMember::query()->create([
            'team_id' => $decorTeam->id,
            'user_id' => $owner->id,
            'role' => TeamMemberRole::Leader,
            'joined_at' => now(),
        ]);
        TeamMember::query()->create([
            'team_id' => $decorTeam->id,
            'user_id' => $member->id,
            'role' => TeamMemberRole::Member,
            'joined_at' => now(),
        ]);
        TeamMember::query()->create([
            'team_id' => $receptionTeam->id,
            'user_id' => $helper->id,
            'role' => TeamMemberRole::Leader,
            'joined_at' => now(),
        ]);
        TeamMember::query()->create([
            'team_id' => $stageTeam->id,
            'user_id' => $helper->id,
            'role' => TeamMemberRole::Member,
            'joined_at' => now(),
        ]);

        $commonAvailabilitySet = CommonAvailabilitySet::factory()->create([
            'group_id' => $group->id,
            'name' => '夏休み期間の参加可能日時',
            'deadline' => now()->addDays(7),
        ]);

        CommonAvailability::factory()->create([
            'common_availability_set_id' => $commonAvailabilitySet->id,
            'user_id' => $owner->id,
        ]);
        CommonAvailability::factory()->create([
            'common_availability_set_id' => $commonAvailabilitySet->id,
            'user_id' => $member->id,
        ]);
        CommonAvailability::factory()->create([
            'common_availability_set_id' => $commonAvailabilitySet->id,
            'user_id' => $helper->id,
        ]);

        $event = Event::factory()->create([
            'group_id' => $group->id,
            'team_id' => $decorTeam->id,
            'common_availability_set_id' => $commonAvailabilitySet->id,
            'scope' => EventScope::Team,
            'created_by' => $owner->id,
            'status' => EventStatus::Collecting,
        ]);

        $commonAvailabilitySet->update([
            'event_id' => $event->id,
        ]);

        $decorTeam->update(['event_id' => $event->id]);
        $receptionTeam->update(['event_id' => $event->id]);
        $stageTeam->update(['event_id' => $event->id]);

        $tasks = collect([
            EventTask::factory()->create([
                'event_id' => $event->id,
                'team_id' => $decorTeam->id,
                'name' => '受付',
                'description' => '来場者対応',
                'desired_total_hours' => 6,
                'required_people_per_slot' => 2,
                'desired_periods' => [
                    [
                        'date' => now()->addDays(7)->toDateString(),
                        'startTime' => '09:00',
                        'endTime' => '12:00',
                        'requiredPeople' => 2,
                        'location' => '正門',
                        'note' => '午前の受付',
                    ],
                    [
                        'date' => now()->addDays(7)->toDateString(),
                        'startTime' => '12:00',
                        'endTime' => '15:00',
                        'requiredPeople' => 2,
                        'location' => '正門',
                        'note' => '昼の受付',
                    ],
                ],
                'allow_cross_team_help' => false,
                'sort_order' => 1,
            ]),
            EventTask::factory()->create([
                'event_id' => $event->id,
                'team_id' => $decorTeam->id,
                'name' => '装飾',
                'description' => '会場装飾',
                'desired_total_hours' => 4,
                'required_people_per_slot' => 3,
                'desired_periods' => [
                    [
                        'date' => now()->addDays(6)->toDateString(),
                        'startTime' => '13:00',
                        'endTime' => '17:00',
                        'requiredPeople' => 3,
                        'location' => '体育館',
                        'note' => '飾り付け',
                    ],
                ],
                'allow_cross_team_help' => true,
                'sort_order' => 2,
            ]),
            EventTask::factory()->create([
                'event_id' => $event->id,
                'team_id' => $decorTeam->id,
                'name' => 'ステージ',
                'description' => 'ステージ運営',
                'desired_total_hours' => 5,
                'required_people_per_slot' => 4,
                'desired_periods' => [
                    [
                        'date' => now()->addDays(8)->toDateString(),
                        'startTime' => '10:00',
                        'endTime' => '15:00',
                        'requiredPeople' => 4,
                        'location' => '講堂',
                        'note' => '本番',
                    ],
                ],
                'allow_cross_team_help' => true,
                'sort_order' => 3,
            ]),
        ]);

        $slots = collect();

        foreach ($tasks as $task) {
            foreach ($task->desired_periods ?? [] as $period) {
                $startAt = \Illuminate\Support\Carbon::parse($period['date'].' '.$period['startTime']);
                $endAt = \Illuminate\Support\Carbon::parse($period['date'].' '.$period['endTime']);

                $slots->push(EventSlot::factory()->create([
                    'event_id' => $event->id,
                    'task_id' => $task->id,
                    'date' => $startAt->toDateString(),
                    'start_time' => $startAt->format('H:i:s'),
                    'end_time' => $endAt->format('H:i:s'),
                    'start_datetime' => $startAt,
                    'end_datetime' => $endAt,
                    'required_people' => $period['requiredPeople'] ?? 1,
                    'status' => 'open',
                    'location' => $period['location'] ?? null,
                    'note' => $period['note'] ?? null,
                ]));
            }
        }

        Availability::factory()->create([
            'event_id' => $event->id,
            'user_id' => $member->id,
        ]);

        ShiftRule::factory()->create([
            'event_id' => $event->id,
        ]);

        ShiftGenerationSetting::factory()->create([
            'event_id' => $event->id,
        ]);

        $shift = Shift::factory()->create([
            'event_id' => $event->id,
            'event_slot_id' => $slots->first()->id,
            'status' => ShiftStatus::Draft,
        ]);

        ShiftAssignment::factory()->create([
            'shift_id' => $shift->id,
            'event_slot_id' => $slots->first()->id,
            'user_id' => $member->id,
        ]);

        Invitation::factory()->create([
            'group_id' => $group->id,
            'invited_by' => $owner->id,
        ]);
    }
}
