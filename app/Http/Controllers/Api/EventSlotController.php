<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\EventSlotBulkStoreRequest;
use App\Http\Requests\EventSlotStoreRequest;
use App\Http\Requests\EventSlotUpdateRequest;
use App\Http\Resources\EventSlotResource;
use App\Models\Event;
use App\Models\EventTask;
use App\Models\EventSlot;
use App\Enums\GroupRole;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EventSlotController extends Controller
{
    public function indexByTask(Request $request, EventTask $task): JsonResponse
    {
        $this->requireEventMember($request, $task->event);
        $slots = $task->slots()->with('task.team')->orderBy('start_datetime')->get();

        return response()->json([
            'success' => true,
            'data' => EventSlotResource::collection($slots),
            'error' => null,
        ]);
    }

    public function storeByTask(EventSlotStoreRequest $request, EventTask $task): JsonResponse
    {
        $data = $request->validated();
        $this->ensureSlotManageAccess($request, $task);
        $startAt = Carbon::parse($data['startDatetime'] ?? ($data['date'].' '.$data['startTime']));
        $endAt = Carbon::parse($data['endDatetime'] ?? ($data['date'].' '.$data['endTime']));

        $slot = $task->slots()->create([
            'event_id' => $task->event_id,
            'task_id' => $task->id,
            'date' => $startAt->toDateString(),
            'start_time' => $startAt->format('H:i:s'),
            'end_time' => $endAt->format('H:i:s'),
            'start_datetime' => $startAt,
            'end_datetime' => $endAt,
            'required_people' => $data['requiredPeople'],
            'status' => $data['status'] ?? 'open',
            'location' => $data['location'] ?? null,
            'note' => $data['note'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'data' => new EventSlotResource($slot->loadMissing('task.team')),
            'error' => null,
        ], 201);
    }

    public function bulkStoreByTask(EventSlotBulkStoreRequest $request, EventTask $task): JsonResponse
    {
        $data = $request->validated();
        $this->ensureSlotManageAccess($request, $task);
        $event = $task->event()->firstOrFail();
        $startDate = Carbon::parse($data['startDate'])->startOfDay();
        $endDate = Carbon::parse($data['endDate'])->startOfDay();
        $excludedDates = collect($data['excludedDates'] ?? [])->map(fn (string $date) => Carbon::parse($date)->toDateString())->all();
        $weekdayMap = [
            '0' => 0, 'sun' => 0,
            '1' => 1, 'mon' => 1,
            '2' => 2, 'tue' => 2,
            '3' => 3, 'wed' => 3,
            '4' => 4, 'thu' => 4,
            '5' => 5, 'fri' => 5,
            '6' => 6, 'sat' => 6,
        ];

        $weekdays = collect($data['weekdays'])
            ->map(fn ($weekday) => strtolower((string) $weekday))
            ->map(fn (string $weekday) => $weekdayMap[$weekday] ?? null)
            ->filter(fn ($weekday) => $weekday !== null)
            ->unique()
            ->values()
            ->all();

        $existingKeys = $task->slots()
            ->get()
            ->mapWithKeys(fn (EventSlot $slot) => [
                $slot->start_datetime?->toIso8601String().'|'.$slot->end_datetime?->toIso8601String() => true,
            ])
            ->all();

        $createdCount = 0;
        $skippedCount = 0;
        $createdSlots = [];

        foreach (new \DatePeriod($startDate, new \DateInterval('P1D'), $endDate->copy()->addDay()) as $date) {
            if (! in_array($date->format('w'), array_map('strval', $weekdays), true)) {
                continue;
            }

            $dateString = $date->format('Y-m-d');
            if (in_array($dateString, $excludedDates, true)) {
                continue;
            }

            foreach ($data['timeBlocks'] as $timeBlock) {
                $startAt = Carbon::parse($dateString.' '.$timeBlock['startTime']);
                $endAt = Carbon::parse($dateString.' '.$timeBlock['endTime']);
                $key = $startAt->toIso8601String().'|'.$endAt->toIso8601String();

                if (isset($existingKeys[$key])) {
                    $skippedCount++;
                    continue;
                }

                $slot = $task->slots()->create([
                    'event_id' => $event->id,
                    'task_id' => $task->id,
                    'date' => $dateString,
                    'start_time' => $startAt->format('H:i:s'),
                    'end_time' => $endAt->format('H:i:s'),
                    'start_datetime' => $startAt,
                    'end_datetime' => $endAt,
                    'required_people' => $timeBlock['requiredPeople'],
                    'status' => 'open',
                    'location' => $timeBlock['location'] ?? null,
                    'note' => $timeBlock['note'] ?? null,
                ]);

                $existingKeys[$key] = true;
                $createdSlots[] = new EventSlotResource($slot->loadMissing('task.team'));
                $createdCount++;
            }
        }

        return response()->json([
            'success' => true,
            'data' => [
                'createdCount' => $createdCount,
                'skippedCount' => $skippedCount,
                'slots' => $createdSlots,
            ],
            'error' => null,
        ], 201);
    }

    public function updateBySlot(Request $request, EventSlotUpdateRequest $slotRequest, EventSlot $slot): JsonResponse
    {
        $data = $slotRequest->validated();
        $this->ensureSlotManageAccess($request, $slot->task()->firstOrFail());
        $task = $this->resolveTaskBySlot($slot, $data['taskId'] ?? $slot->task_id);
        $startAt = Carbon::parse($data['startDatetime'] ?? ($data['date'].' '.$data['startTime']));
        $endAt = Carbon::parse($data['endDatetime'] ?? ($data['date'].' '.$data['endTime']));

        $slot->update([
            'task_id' => $task->id,
            'event_id' => $task->event_id,
            'date' => $startAt->toDateString(),
            'start_time' => $startAt->format('H:i:s'),
            'end_time' => $endAt->format('H:i:s'),
            'start_datetime' => $startAt,
            'end_datetime' => $endAt,
            'required_people' => $data['requiredPeople'],
            'location' => $data['location'] ?? null,
            'note' => $data['note'] ?? null,
            'status' => $data['status'] ?? $slot->status ?? 'open',
        ]);

        return response()->json([
            'success' => true,
            'data' => new EventSlotResource($slot->fresh()->loadMissing('task.team')),
            'error' => null,
        ]);
    }

    public function destroyBySlot(Request $request, EventSlot $slot): JsonResponse
    {
        $this->ensureSlotManageAccess($request, $slot->task()->firstOrFail());
        $slot->delete();

        return response()->json([
            'success' => true,
            'data' => ['deleted' => true],
            'error' => null,
        ]);
    }

    public function index(Request $request, Event $event): JsonResponse
    {
        $this->requireEventMember($request, $event);
        $slots = $event->slots()->with('task.team')->orderBy('start_datetime')->get();

        return response()->json([
            'success' => true,
            'data' => EventSlotResource::collection($slots),
            'error' => null,
        ]);
    }

    public function store(EventSlotStoreRequest $request, Event $event): JsonResponse
    {
        $data = $request->validated();
        abort_unless($request->filled('taskId'), 422, '作業を選択してください。');
        $task = $this->resolveTask($event, $data['taskId'] ?? null);
        $this->ensureSlotManageAccess($request, $task);
        $startAt = Carbon::parse($data['startDatetime'] ?? ($data['date'].' '.$data['startTime']));
        $endAt = Carbon::parse($data['endDatetime'] ?? ($data['date'].' '.$data['endTime']));

        $slot = $event->slots()->create([
            'task_id' => $task->id,
            'date' => $startAt->toDateString(),
            'start_time' => $startAt->format('H:i:s'),
            'end_time' => $endAt->format('H:i:s'),
            'start_datetime' => $startAt,
            'end_datetime' => $endAt,
            'required_people' => $data['requiredPeople'],
            'status' => $data['status'] ?? 'open',
            'location' => $data['location'] ?? null,
            'note' => $data['note'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'data' => new EventSlotResource($slot->loadMissing('task.team')),
            'error' => null,
        ], 201);
    }

    public function update(Request $request, EventSlotUpdateRequest $slotRequest, Event $event, EventSlot $slot): JsonResponse
    {
        abort_unless($slot->event_id === $event->id, 404);

        $data = $slotRequest->validated();
        $task = $this->resolveTask($event, $data['taskId'] ?? $slot->task_id);
        $this->ensureSlotManageAccess($request, $task);
        $startAt = Carbon::parse($data['startDatetime'] ?? ($data['date'].' '.$data['startTime']));
        $endAt = Carbon::parse($data['endDatetime'] ?? ($data['date'].' '.$data['endTime']));

        $slot->update([
            'task_id' => $task->id,
            'date' => $startAt->toDateString(),
            'start_time' => $startAt->format('H:i:s'),
            'end_time' => $endAt->format('H:i:s'),
            'start_datetime' => $startAt,
            'end_datetime' => $endAt,
            'required_people' => $data['requiredPeople'],
            'location' => $data['location'] ?? null,
            'note' => $data['note'] ?? null,
            'status' => $data['status'] ?? $slot->status ?? 'open',
        ]);

        return response()->json([
            'success' => true,
            'data' => new EventSlotResource($slot->fresh()->loadMissing('task.team')),
            'error' => null,
        ]);
    }

    public function bulkStore(EventSlotBulkStoreRequest $request, Event $event): JsonResponse
    {
        abort_unless($request->filled('taskId'), 422, '作業を選択してください。');

        return $this->bulkStoreByTask($request, $this->resolveTask($event, (string) $request->input('taskId')));
    }

    public function destroy(Event $event, EventSlot $slot): JsonResponse
    {
        abort_unless($slot->event_id === $event->id, 404);
        $this->ensureSlotManageAccess(request(), $slot->task()->firstOrFail());

        $slot->delete();

        return response()->json([
            'success' => true,
            'data' => ['deleted' => true],
            'error' => null,
        ]);
    }

    private function resolveTask(Event $event, ?string $taskId = null): EventTask
    {
        if ($taskId) {
            $task = $event->tasks()->whereKey($taskId)->first();

            abort_unless($task, 404);

            return $task;
        }

        abort(422, '作業を選択してください。');
    }

    private function resolveTaskBySlot(EventSlot $slot, ?string $taskId = null): EventTask
    {
        $event = $slot->event()->first() ?? $slot->task?->event;

        abort_unless($event, 404);

        return $this->resolveTask($event, $taskId);
    }

    private function ensureSlotManageAccess(Request $request, EventTask $task): void
    {
        $task->loadMissing('event.group', 'team');
        $membership = $this->groupMembership($request, $task->event->group);
        abort_unless($membership, 403);

        if ($membership->role->value === GroupRole::Owner->value) {
            return;
        }

        if (! $task->team_id) {
            abort(403);
        }

        $teamMembership = $request->user()?->teamMemberships()->where('team_id', $task->team_id)->first();
        abort_unless($teamMembership && $teamMembership->role->value === 'leader', 403);
    }
}
