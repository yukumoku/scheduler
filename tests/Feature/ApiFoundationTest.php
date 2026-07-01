<?php

namespace Tests\Feature;

use App\Enums\EventStatus;
use App\Enums\GroupRole;
use App\Enums\ShiftStatus;
use App\Models\Event;
use App\Models\EventSlot;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Shift;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ApiFoundationTest extends TestCase
{
    use RefreshDatabase;

    public function test_group_api_can_list_show_store_and_update(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $group = Group::factory()->create([
            'owner_id' => $user->id,
        ]);

        GroupMember::factory()->create([
            'group_id' => $group->id,
            'user_id' => $user->id,
            'role' => GroupRole::Owner,
        ]);

        $list = $this->getJson('/api/groups');
        $list->assertOk()->assertJsonPath('data.0.id', $group->id);

        $show = $this->getJson("/api/groups/{$group->id}");
        $show->assertOk()->assertJsonPath('data.id', $group->id);

        $created = $this->postJson('/api/groups', [
            'name' => 'New Group',
            'description' => 'Description',
            'iconUrl' => null,
        ]);

        $created->assertCreated()->assertJsonPath('data.name', 'New Group');

        $updated = $this->patchJson("/api/groups/{$group->id}", [
            'name' => 'Updated Group',
            'isInviteEnabled' => false,
        ]);

        $updated->assertOk()->assertJsonPath('data.name', 'Updated Group');
        $updated->assertJsonPath('data.inviteEnabled', false);
    }

    public function test_group_members_and_event_api_work_with_sanctum_auth(): void
    {
        $user = User::factory()->create();
        $member = User::factory()->create();
        Sanctum::actingAs($user);

        $group = Group::factory()->create([
            'owner_id' => $user->id,
        ]);

        GroupMember::factory()->create([
            'group_id' => $group->id,
            'user_id' => $user->id,
            'role' => GroupRole::Owner,
        ]);

        GroupMember::factory()->create([
            'group_id' => $group->id,
            'user_id' => $member->id,
            'role' => GroupRole::Member,
        ]);

        $event = Event::factory()->create([
            'group_id' => $group->id,
            'created_by' => $user->id,
            'status' => EventStatus::Collecting,
        ]);

        EventSlot::factory()->create([
            'event_id' => $event->id,
        ]);

        Shift::factory()->create([
            'event_id' => $event->id,
            'status' => ShiftStatus::Draft,
        ]);

        $members = $this->getJson("/api/groups/{$group->id}/members");
        $members->assertOk()
            ->assertJsonFragment(['userId' => $user->id])
            ->assertJsonFragment(['userId' => $member->id]);

        $events = $this->getJson("/api/groups/{$group->id}/events");
        $events->assertOk()->assertJsonPath('data.0.id', $event->id);

        $created = $this->postJson("/api/groups/{$group->id}/events", [
            'name' => 'Festival Shift',
            'description' => 'Shift description',
            'location' => 'Gym',
            'startDate' => now()->addWeek()->toDateString(),
            'endDate' => now()->addWeek()->toDateString(),
            'availabilityDeadline' => now()->addDays(3)->toISOString(),
            'status' => 'collecting',
        ]);

        $created->assertCreated()->assertJsonPath('data.name', 'Festival Shift');

        $fetched = $this->getJson("/api/events/{$event->id}");
        $fetched->assertOk()->assertJsonPath('data.id', $event->id);

        $patched = $this->patchJson("/api/events/{$event->id}", [
            'name' => 'Updated Event',
            'status' => 'published',
        ]);

        $patched->assertOk()->assertJsonPath('data.name', 'Updated Event');
        $patched->assertJsonPath('data.status', 'published');
    }
}
