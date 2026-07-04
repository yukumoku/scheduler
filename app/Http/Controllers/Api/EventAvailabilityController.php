<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\EventAvailabilityUpdateRequest;
use App\Models\Availability;
use App\Models\Event;
use App\Services\AvailabilitySummaryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * @deprecated Compatibility layer for legacy event-specific availability.
 *             New implementations should use CommonAvailability and CommonAvailabilitySet.
 */
class EventAvailabilityController extends Controller
{
    public function __construct(private readonly AvailabilitySummaryService $availabilitySummaryService)
    {
    }

    public function index(Event $event): JsonResponse
    {
        $this->requireEventMember(request(), $event);
        $slots = $event->slots()
            ->orderBy('date')
            ->orderBy('start_time')
            ->get();
        $availabilities = $event->availabilities()->get();
        $members = $event->group
            ->members()
            ->with('user')
            ->orderBy('joined_at')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $this->availabilitySummaryService->buildEventAvailabilitySummaryPayload($event, $members, $slots, $availabilities),
            'error' => null,
        ]);
    }

    public function me(Request $request, Event $event): JsonResponse
    {
        $this->requireEventMember($request, $event);
        $slots = $event->slots()
            ->orderBy('date')
            ->orderBy('start_time')
            ->get();
        $availabilities = $event->availabilities()->get();

        return response()->json([
            'success' => true,
            'data' => $this->availabilitySummaryService->buildEventAvailabilityMePayload($event, $request->user(), $slots, $availabilities),
            'error' => null,
        ]);
    }

    public function updateMe(EventAvailabilityUpdateRequest $request, Event $event): JsonResponse
    {
        $this->requireEventMember($request, $event);
        $user = $request->user();

        foreach ($request->validated('slots') as $slotInput) {
            $slot = $event->slots()->whereKey($slotInput['slotId'])->firstOrFail();

            Availability::query()->updateOrCreate(
                [
                    'event_id' => $event->id,
                    'user_id' => $user->id,
                    'date' => $slot->date?->toDateString(),
                    'start_time' => $slot->start_time,
                    'end_time' => $slot->end_time,
                ],
                [
                    'status' => $slotInput['status'],
                    'comment' => $slotInput['comment'] ?? null,
                ],
            );
        }

        return response()->json([
            'success' => true,
            'data' => ['saved' => true],
            'error' => null,
        ]);
    }
}
