<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ShiftGenerateRequest;
use App\Http\Resources\ShiftResource;
use App\Models\Event;
use App\Models\Shift;
use App\Services\ShiftGenerationService;
use Throwable;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class ShiftController extends Controller
{
    public function __construct(private readonly ShiftGenerationService $shiftGenerationService)
    {
    }

    public function index(Event $event): JsonResponse
    {
        $this->requireEventMember(request(), $event);
        $shifts = $event->shifts()
            ->with([
                'event.slots.task.team',
                'event.tasks',
                'event.commonAvailabilitySet.availabilities',
                'assignments.user',
                'assignments.eventSlot.task.team',
                'eventSlot.task.team',
            ])
            ->latest('generated_at')
            ->latest('created_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => ShiftResource::collection($shifts),
            'error' => null,
        ]);
    }

    public function generate(ShiftGenerateRequest $request, Event $event): JsonResponse
    {
        $this->requireEventManager($request, $event);
        $this->extendShiftGenerationRuntime();

        try {
            $result = $this->shiftGenerationService->generate($event);
        } catch (Throwable $exception) {
            logger()->error('Shift generation failed', [
                'event_id' => $event->id,
                'user_id' => $request->user()?->id,
                'message' => $exception->getMessage(),
                'file' => $exception->getFile(),
                'line' => $exception->getLine(),
            ]);

            return response()->json([
                'success' => false,
                'data' => null,
                'error' => 'シフト作成に失敗しました。作業・参加確認・期間設定を確認してください。',
            ], 500);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'shift' => new ShiftResource($result['shift']),
                'warnings' => $result['warnings'],
                'metrics' => $result['metrics'],
            ],
            'error' => null,
        ], 201);
    }

    private function extendShiftGenerationRuntime(): void
    {
        @set_time_limit(180);
        @ini_set('max_execution_time', '180');
    }

    public function show(Shift $shift): JsonResponse
    {
        $this->requireShiftManager(request(), $shift);
        $shift->load([
            'event.slots.task.team',
            'event.tasks',
            'event.commonAvailabilitySet.availabilities',
            'assignments.user',
            'assignments.eventSlot.task.team',
            'eventSlot.task.team',
        ]);

        return response()->json([
            'success' => true,
            'data' => new ShiftResource($shift),
            'error' => null,
        ]);
    }

    public function publish(Shift $shift): JsonResponse
    {
        $this->requireShiftOwner(request(), $shift);
        $shift->update([
            'status' => 'published',
            'published_at' => now(),
        ]);

        $shift->load([
            'event.slots.task.team',
            'event.tasks',
            'event.commonAvailabilitySet.availabilities',
            'assignments.user',
            'assignments.eventSlot.task.team',
            'eventSlot.task.team',
        ]);

        return response()->json([
            'success' => true,
            'data' => new ShiftResource($shift),
            'error' => null,
        ]);
    }

    public function unpublish(Shift $shift): JsonResponse
    {
        $this->requireShiftOwner(request(), $shift);
        $shift->update([
            'status' => 'generated',
            'published_at' => null,
        ]);

        $shift->load([
            'event.slots.task.team',
            'event.tasks',
            'event.commonAvailabilitySet.availabilities',
            'assignments.user',
            'assignments.eventSlot.task.team',
            'eventSlot.task.team',
        ]);

        return response()->json([
            'success' => true,
            'data' => new ShiftResource($shift),
            'error' => null,
        ]);
    }

    public function destroy(Shift $shift): JsonResponse
    {
        $this->requireShiftOwner(request(), $shift);
        $eventId = $shift->event_id;
        $shift->delete();

        return response()->json([
            'success' => true,
            'data' => ['deleted' => true, 'eventId' => $eventId],
            'error' => null,
        ]);
    }

    private function requireShiftOwner(Request $request, Shift $shift): void
    {
        $shift->loadMissing('event.group');
        $this->requireGroupOwner($request, $shift->event->group ?? (object) ['id' => $shift->event->group_id ?? null]);
    }
}
