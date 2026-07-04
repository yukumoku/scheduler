<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GroupMember;
use App\Models\ShiftAssignment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class CalendarController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $groupIds = array_values(array_filter((array) $request->input('groupIds', [])));
        $eventIds = array_values(array_filter((array) $request->input('eventIds', [])));
        $accessibleGroupIds = GroupMember::query()
            ->where('user_id', $user->id)
            ->pluck('group_id')
            ->all();
        $groupIds = $groupIds ? array_values(array_intersect($groupIds, $accessibleGroupIds)) : $accessibleGroupIds;

        $assignments = ShiftAssignment::query()
            ->whereHas('shift.event', fn ($query) => $query->whereIn('group_id', $groupIds))
            ->with([
                'shift.event.group',
                'eventSlot.task.team',
                'user',
            ])
            ->when($eventIds, function ($query) use ($eventIds): void {
                $query->whereHas('shift', function ($shiftQuery) use ($eventIds): void {
                    $shiftQuery->whereIn('event_id', $eventIds);
                });
            })
            ->get()
            ->sortBy(function (ShiftAssignment $assignment): string {
                $slot = $assignment->eventSlot;
                $start = $slot?->start_datetime ?? ($slot?->date && $slot?->start_time ? Carbon::parse($slot->date->toDateString().' '.$slot->start_time) : null);

                return $start?->format('Y-m-d H:i') ?? '';
            })
            ->values()
            ->map(function (ShiftAssignment $assignment): array {
                $slot = $assignment->eventSlot;
                $shift = $assignment->shift;
                $event = $shift?->event;
                $group = $event?->group;
                $task = $slot?->task;
                $team = $task?->team;
                $start = $slot?->start_datetime ?? ($slot?->date && $slot?->start_time ? Carbon::parse($slot->date->toDateString().' '.$slot->start_time) : null);
                $end = $slot?->end_datetime ?? ($slot?->date && $slot?->end_time ? Carbon::parse($slot->date->toDateString().' '.$slot->end_time) : null);

                return [
                    'id' => $assignment->id,
                    'shiftId' => $assignment->shift_id,
                    'shiftStatus' => $shift?->status?->value ?? $shift?->status,
                    'publishedAt' => $shift?->published_at?->toIso8601String(),
                    'groupId' => $group?->id,
                    'groupName' => $group?->name,
                    'eventId' => $event?->id,
                    'eventName' => $event?->name,
                    'taskId' => $task?->id,
                    'taskName' => $task?->name,
                    'teamId' => $team?->id,
                    'teamName' => $team?->name,
                    'date' => $start?->toDateString(),
                    'startTime' => $start?->format('H:i'),
                    'endTime' => $end?->format('H:i'),
                    'location' => $slot?->location,
                    'note' => $slot?->note,
                    'requiredPeople' => $slot?->required_people ?? 0,
                    'isLeader' => (bool) $assignment->is_leader,
                    'role' => $assignment->is_leader ? 'leader' : 'member',
                    'allowCrossTeamHelp' => (bool) ($task?->allow_cross_team_help ?? false),
                    'userId' => $assignment->user?->id,
                    'userName' => $assignment->user?->display_name,
                    'userAvatarUrl' => $assignment->user?->avatar_url,
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $assignments,
            'error' => null,
        ]);
    }
}
