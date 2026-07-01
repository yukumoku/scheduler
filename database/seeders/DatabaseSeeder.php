<?php

namespace Database\Seeders;

use App\Enums\EventStatus;
use App\Enums\GroupRole;
use App\Enums\ShiftStatus;
use App\Models\Availability;
use App\Models\Event;
use App\Models\EventSlot;
use App\Models\Group;
use App\Models\GroupMember;
use App\Models\Invitation;
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

        $event = Event::factory()->create([
            'group_id' => $group->id,
            'created_by' => $owner->id,
            'status' => EventStatus::Collecting,
        ]);

        $slot = EventSlot::factory()->create([
            'event_id' => $event->id,
        ]);

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
            'status' => ShiftStatus::Draft,
        ]);

        ShiftAssignment::factory()->create([
            'shift_id' => $shift->id,
            'event_slot_id' => $slot->id,
            'user_id' => $member->id,
        ]);

        Invitation::factory()->create([
            'group_id' => $group->id,
            'invited_by' => $owner->id,
        ]);
    }
}
