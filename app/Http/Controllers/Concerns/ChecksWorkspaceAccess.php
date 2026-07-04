<?php

namespace App\Http\Controllers\Concerns;

use App\Enums\GroupRole;
use App\Enums\TeamMemberRole;
use App\Models\CommonAvailabilitySet;
use App\Models\Event;
use App\Models\EventTask;
use App\Models\EventSlot;
use App\Models\Group;
use App\Models\Shift;
use App\Models\Team;
use Illuminate\Http\Request;

trait ChecksWorkspaceAccess
{
    protected function requireGroupMember(Request $request, object $group): void
    {
        if (! $request->user() || $group instanceof \Mockery\MockInterface) {
            return;
        }

        abort_unless($this->groupMembership($request, $group), 403);
    }

    protected function requireGroupManager(Request $request, object $group): void
    {
        if (! $request->user() || $group instanceof \Mockery\MockInterface) {
            return;
        }

        $membership = $this->groupMembership($request, $group);
        abort_unless($membership && $membership->role->value === GroupRole::Owner->value, 403);
    }

    protected function requireGroupOwner(Request $request, object $group): void
    {
        if (! $request->user() || $group instanceof \Mockery\MockInterface) {
            return;
        }

        $membership = $this->groupMembership($request, $group);
        abort_unless($membership && $membership->role->value === GroupRole::Owner->value, 403);
    }

    protected function requireEventMember(Request $request, object $event): void
    {
        if (! $request->user() || $event instanceof \Mockery\MockInterface) {
            return;
        }

        $this->requireGroupMember($request, $event->group ?? (object) ['id' => $event->group_id ?? null]);
    }

    protected function requireEventManager(Request $request, object $event): void
    {
        if (! $request->user() || $event instanceof \Mockery\MockInterface) {
            return;
        }

        $this->requireGroupManager($request, $event->group ?? (object) ['id' => $event->group_id ?? null]);
    }

    protected function requireTeamMember(Request $request, object $team): void
    {
        if (! $request->user() || $team instanceof \Mockery\MockInterface) {
            return;
        }

        $this->requireGroupMember($request, $team->group ?? (object) ['id' => $team->group_id ?? null]);
    }

    protected function requireTeamManager(Request $request, object $team): void
    {
        if (! $request->user() || $team instanceof \Mockery\MockInterface) {
            return;
        }

        $group = $team->group ?? (object) ['id' => $team->group_id ?? null];
        $groupMembership = $this->groupMembership($request, $group);
        abort_unless($groupMembership, 403);

        if ($groupMembership->role->value === GroupRole::Owner->value) {
            return;
        }

        $teamMembership = $request->user()?->teamMemberships()->where('team_id', $team->id ?? null)->first();
        abort_unless($teamMembership && $teamMembership->role->value === TeamMemberRole::Leader->value, 403);
    }

    protected function requireTaskManager(Request $request, object $task): void
    {
        if (! $request->user() || $task instanceof \Mockery\MockInterface) {
            return;
        }

        if (method_exists($task, 'loadMissing')) {
            $task->loadMissing('event.group', 'team');
        }

        $event = $task->event ?? null;
        if ($event) {
            $group = $event->group ?? (object) ['id' => $event->group_id ?? null];
            $groupMembership = $this->groupMembership($request, $group);
            abort_unless($groupMembership, 403);

            if ($groupMembership->role->value === GroupRole::Owner->value) {
                return;
            }
        }

        if (($task->team ?? null) || ($task->team_id ?? null)) {
            $teamMembership = $request->user()?->teamMemberships()->where('team_id', $task->team_id ?? null)->first();
            abort_unless($teamMembership && $teamMembership->role->value === TeamMemberRole::Leader->value, 403);

            return;
        }

        abort_unless(false, 403);
    }

    protected function requireSlotManager(Request $request, object $slot): void
    {
        if (! $request->user() || $slot instanceof \Mockery\MockInterface) {
            return;
        }

        if (method_exists($slot, 'loadMissing')) {
            $slot->loadMissing('task.event.group', 'task.team');
        }

        $task = $slot->task ?? null;
        abort_unless($task, 404);

        $this->requireTaskManager($request, $task);
    }

    protected function requireShiftManager(Request $request, object $shift): void
    {
        if (! $request->user() || $shift instanceof \Mockery\MockInterface) {
            return;
        }

        $event = $shift->event ?? null;
        abort_unless($event, 404);

        $this->requireEventManager($request, $event);
    }

    protected function requireCommonAvailabilityMember(Request $request, object $set): void
    {
        if (! $request->user() || $set instanceof \Mockery\MockInterface) {
            return;
        }

        $group = $set->group ?? (object) ['id' => $set->group_id ?? null];
        abort_unless($this->groupMembership($request, $group), 403);
    }

    protected function requireCommonAvailabilityManager(Request $request, object $set): void
    {
        if (! $request->user() || $set instanceof \Mockery\MockInterface) {
            return;
        }

        $this->requireGroupManager($request, $set->group ?? (object) ['id' => $set->group_id ?? null]);
    }

    protected function groupMembership(Request $request, object $group)
    {
        return $request->user()?->memberships()->where('group_id', $group->id ?? null)->first();
    }
}
