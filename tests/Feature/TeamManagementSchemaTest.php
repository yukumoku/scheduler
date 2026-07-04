<?php

namespace Tests\Feature;

use App\Enums\TeamMemberRole;
use App\Models\Team;
use App\Models\TeamMember;
use Tests\TestCase;

class TeamManagementSchemaTest extends TestCase
{
    public function test_team_model_contains_expected_fillable_and_relations(): void
    {
        $team = new Team();

        $this->assertContains('group_id', $team->getFillable());
        $this->assertContains('event_id', $team->getFillable());
        $this->assertContains('name', $team->getFillable());
        $this->assertContains('description', $team->getFillable());
        $this->assertContains('color', $team->getFillable());
        $this->assertTrue(method_exists($team, 'group'));
        $this->assertTrue(method_exists($team, 'event'));
        $this->assertTrue(method_exists($team, 'members'));
        $this->assertTrue(method_exists($team, 'events'));
        $this->assertTrue(method_exists($team, 'slots'));
    }

    public function test_team_member_role_enum_is_available(): void
    {
        $this->assertSame(['leader', 'member'], array_map(fn (TeamMemberRole $case) => $case->value, TeamMemberRole::cases()));
        $member = new TeamMember();
        $this->assertContains('role', $member->getFillable());
        $this->assertTrue(method_exists($member, 'team'));
        $this->assertTrue(method_exists($member, 'user'));
    }
}
