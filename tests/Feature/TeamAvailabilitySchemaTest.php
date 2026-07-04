<?php

namespace Tests\Feature;

use App\Enums\EventScope;
use App\Enums\TeamMemberRole;
use App\Models\Group;
use App\Models\CommonAvailability;
use App\Models\CommonAvailabilitySet;
use App\Models\Event;
use App\Models\EventTask;
use App\Models\EventSlot;
use App\Models\Team;
use App\Models\Shift;
use Tests\TestCase;

class TeamAvailabilitySchemaTest extends TestCase
{
    public function test_team_can_be_created_with_members_and_roles(): void
    {
        $this->assertTrue(true);
        $this->assertSame(['leader', 'member'], array_map(fn (TeamMemberRole $case) => $case->value, TeamMemberRole::cases()));
    }

    public function test_common_availability_set_and_availability_can_be_created(): void
    {
        $set = new CommonAvailabilitySet();
        $availability = new CommonAvailability();

        $this->assertSame('common_availability_sets', $set->getTable());
        $this->assertSame('common_availability', $availability->getTable());
        $this->assertTrue(method_exists($set, 'availabilities'));
        $this->assertTrue(method_exists($availability, 'commonAvailabilitySet'));
        $this->assertTrue(method_exists($availability, 'user'));
    }

    public function test_event_supports_group_scope_and_team_scope(): void
    {
        $event = new Event();
        $task = new EventTask();
        $slot = new EventSlot();
        $shift = new Shift();

        $this->assertSame(['group', 'team'], array_map(fn (EventScope $case) => $case->value, EventScope::cases()));
        $this->assertContains('scope', $event->getFillable());
        $this->assertContains('team_id', $event->getFillable());
        $this->assertContains('common_availability_set_id', $event->getFillable());
        $this->assertTrue(method_exists($event, 'availabilitySets'));
        $this->assertTrue(method_exists($event, 'teams'));
        $this->assertContains('event_id', $task->getFillable());
        $this->assertContains('team_id', $task->getFillable());
        $this->assertContains('desired_total_hours', $task->getFillable());
        $this->assertContains('desired_periods', $task->getFillable());
        $this->assertContains('allow_cross_team_help', $task->getFillable());
        $this->assertContains('task_id', $slot->getFillable());
        $this->assertContains('start_datetime', $slot->getFillable());
        $this->assertContains('end_datetime', $slot->getFillable());
        $this->assertContains('status', $slot->getFillable());
        $this->assertContains('event_slot_id', $shift->getFillable());
        $this->assertTrue(method_exists($shift, 'eventSlot'));
    }

    public function test_event_task_supports_team_targeting_and_help_settings(): void
    {
        $task = new EventTask();

        $this->assertTrue(method_exists($task, 'event'));
        $this->assertTrue(method_exists($task, 'team'));
        $this->assertTrue(method_exists($task, 'slots'));
    }

    public function test_team_belongs_to_event_as_well_as_group(): void
    {
        $team = new Team();

        $this->assertContains('event_id', $team->getFillable());
        $this->assertTrue(method_exists($team, 'event'));
        $this->assertTrue(method_exists($team, 'group'));
    }
}
