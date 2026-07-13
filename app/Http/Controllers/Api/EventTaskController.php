<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\EventTaskStoreRequest;
use App\Http\Requests\EventTaskUpdateRequest;
use App\Http\Resources\EventTaskResource;
use App\Enums\GroupRole;
use App\Models\EventSlot;
use App\Models\Event;
use App\Models\EventTask;
use App\Models\Team;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class EventTaskController extends Controller
{
    public function index(Request $request, Event $event): JsonResponse
    {
        $this->requireEventMember($request, $event);
        $tasks = $event->tasks()->with('team')->withCount('slots')->orderBy('sort_order')->orderBy('created_at')->get();

        return response()->json([
            'success' => true,
            'data' => EventTaskResource::collection($tasks),
            'error' => null,
        ]);
    }

    public function store(EventTaskStoreRequest $request, Event $event): JsonResponse
    {
        $data = $request->validated();
        $this->ensureTaskManageAccess($request, $event, $data['teamId'] ?? null);
        $task = $event->tasks()->create($this->taskAttributes([
            'team_id' => $data['teamId'] ?? null,
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'desired_total_hours' => $data['desiredTotalHours'] ?? null,
            'required_people_per_slot' => array_key_exists('requiredPeoplePerSlot', $data) ? $data['requiredPeoplePerSlot'] : null,
            'work_start_date' => $data['workStartDate'] ?? null,
            'work_end_date' => $data['workEndDate'] ?? null,
            'desired_periods' => $data['desiredPeriods'] ?? [],
            'required_member_ids' => $data['requiredMemberIds'] ?? [],
            'required_role' => null,
            'allow_cross_team_help' => $data['allowCrossTeamHelp'],
            'color' => $data['color'] ?? '#7c3aed',
            'sort_order' => $data['sortOrder'],
        ]));

        $this->syncDesiredPeriodsToSlots($task, $data['desiredPeriods'] ?? []);

        return response()->json([
            'success' => true,
            'data' => new EventTaskResource($task->load('team')->loadCount('slots')),
            'error' => null,
        ], 201);
    }

    public function show(Request $request, EventTask $task): JsonResponse
    {
        $task->loadMissing('team');
        $this->requireEventMember($request, $task->event);

        return response()->json([
            'success' => true,
            'data' => new EventTaskResource($task->loadMissing('team')->loadCount('slots')),
            'error' => null,
        ]);
    }

    public function update(EventTaskUpdateRequest $request, EventTask $task): JsonResponse
    {
        $data = $request->validated();
        $this->ensureTaskManageAccess($request, $task->event, $data['teamId'] ?? $task->team_id);
        $desiredPeriods = array_key_exists('desiredPeriods', $data)
            ? ($data['desiredPeriods'] ?? [])
            : ($task->desired_periods ?? []);
        $desiredTotalHours = array_key_exists('desiredTotalHours', $data)
            ? ($data['desiredTotalHours'] ?? null)
            : $task->desired_total_hours;
        $requiredPeoplePerSlot = array_key_exists('requiredPeoplePerSlot', $data)
            ? $data['requiredPeoplePerSlot']
            : $task->required_people_per_slot;

        $task->update([
            ...$this->taskAttributes([
                'team_id' => $data['teamId'] ?? null,
                'name' => $data['name'],
                'description' => $data['description'] ?? null,
                'desired_total_hours' => $desiredTotalHours,
                'required_people_per_slot' => $requiredPeoplePerSlot,
                'work_start_date' => $data['workStartDate'] ?? $task->work_start_date,
                'work_end_date' => $data['workEndDate'] ?? $task->work_end_date,
                'desired_periods' => $desiredPeriods,
                'required_member_ids' => $data['requiredMemberIds'] ?? ($task->required_member_ids ?? []),
                'allow_cross_team_help' => $data['allowCrossTeamHelp'],
                'color' => $data['color'] ?? $task->color,
                'sort_order' => $data['sortOrder'],
            ]),
        ]);

        $this->syncDesiredPeriodsToSlots($task, $desiredPeriods);

        return response()->json([
            'success' => true,
            'data' => new EventTaskResource($task->refresh()->load('team')->loadCount('slots')),
            'error' => null,
        ]);
    }

    public function destroy(Request $request, EventTask $task): JsonResponse
    {
        $this->ensureTaskManageAccess($request, $task->event, $task->team_id);
        $task->delete();

        return response()->json([
            'success' => true,
            'data' => ['deleted' => true],
            'error' => null,
        ]);
    }

    private function syncDesiredPeriodsToSlots(EventTask $task, array $desiredPeriods): void
    {
        if (! $desiredPeriods) {
            $task->slots()->delete();
            return;
        }

        if (! Schema::hasTable('event_slots')) {
            return;
        }

        $requiredColumns = ['task_id', 'date', 'start_time', 'end_time'];
        foreach ($requiredColumns as $column) {
            if (! Schema::hasColumn('event_slots', $column)) {
                return;
            }
        }

        $keepSlotIds = [];
        foreach ($desiredPeriods as $period) {
            $startAt = Carbon::parse($period['date'].' '.$period['startTime']);
            $endAt = Carbon::parse($period['date'].' '.$period['endTime']);

            $slot = EventSlot::query()->updateOrCreate(
                [
                    'task_id' => $task->id,
                    'date' => $startAt->toDateString(),
                    'start_time' => $startAt->format('H:i:s'),
                    'end_time' => $endAt->format('H:i:s'),
                ],
                $this->slotAttributes([
                    'event_id' => $task->event_id,
                    'start_datetime' => $startAt,
                    'end_datetime' => $endAt,
                    'required_people' => max((int) ($period['requiredPeople'] ?? $task->required_people_per_slot ?? 1), 1),
                    'status' => 'open',
                    'location' => $period['location'] ?? null,
                    'note' => $period['note'] ?? null,
                ]),
            );

            $keepSlotIds[] = $slot->id;
        }

        $task->slots()->whereNotIn('id', $keepSlotIds)->delete();
    }

    private function ensureTaskManageAccess(Request $request, Event $event, ?string $teamId = null): void
    {
        $this->requireEventMember($request, $event);

        $membership = $this->groupMembership($request, $event->group);
        if ($membership && $membership->role->value === GroupRole::Owner->value) {
            return;
        }

        abort_unless($teamId, 403);

        $team = $event->teams()->whereKey($teamId)->first();
        abort_unless($team, 404);

        $teamMembership = $request->user()?->teamMemberships()->where('team_id', $team->id)->first();
        abort_unless($teamMembership && $teamMembership->role->value === 'leader', 403);
    }

    private function taskAttributes(array $attributes): array
    {
        $columnMap = [
            'team_id' => 'team_id',
            'name' => 'name',
            'description' => 'description',
            'desired_total_hours' => 'desired_total_hours',
            'required_people_per_slot' => 'required_people_per_slot',
            'work_start_date' => 'work_start_date',
            'work_end_date' => 'work_end_date',
            'desired_periods' => 'desired_periods',
            'required_member_ids' => 'required_member_ids',
            'required_role' => 'required_role',
            'allow_cross_team_help' => 'allow_cross_team_help',
            'color' => 'color',
            'sort_order' => 'sort_order',
        ];

        return collect($attributes)
            ->only(array_filter($columnMap, fn (string $column) => Schema::hasColumn('event_tasks', $column)))
            ->all();
    }

    private function slotAttributes(array $attributes): array
    {
        $columns = [
            'event_id',
            'task_id',
            'date',
            'start_time',
            'end_time',
            'required_people',
            'status',
            'location',
            'note',
            'start_datetime',
            'end_datetime',
        ];

        return collect($attributes)
            ->only(array_filter($columns, fn (string $column) => Schema::hasColumn('event_slots', $column)))
            ->all();
    }
}
