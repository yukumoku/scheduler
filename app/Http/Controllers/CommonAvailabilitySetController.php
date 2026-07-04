<?php

namespace App\Http\Controllers;

use App\Models\CommonAvailability;
use App\Models\CommonAvailabilitySet;
use App\Models\Event;
use App\Models\Group;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CommonAvailabilitySetController extends Controller
{
    public function index(Request $request, Group $group): JsonResponse
    {
        $this->requireGroupMember($request, $group);

        try {
            $sets = $group->commonAvailabilitySets()
                ->withCount('availabilities')
                ->latest()
                ->get()
                ->map(fn (CommonAvailabilitySet $set) => $this->serializeSet($set));
        } catch (QueryException $exception) {
            report($exception);

            return response()->json([
                'success' => true,
                'data' => [],
                'error' => null,
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => $sets->values(),
            'error' => null,
        ]);
    }

    public function indexByEvent(Request $request, Event $event): JsonResponse
    {
        $this->requireEventMember($request, $event);

        try {
            $sets = $event->availabilitySets()
                ->withCount('availabilities')
                ->latest()
                ->get()
                ->map(fn (CommonAvailabilitySet $set) => $this->serializeSet($set));
        } catch (QueryException $exception) {
            report($exception);

            return response()->json([
                'success' => true,
                'data' => [],
                'error' => null,
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => $sets->values(),
            'error' => null,
        ]);
    }

    public function store(Request $request, Group $group): JsonResponse
    {
        $this->requireGroupManager($request, $group);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'startDate' => ['required', 'date'],
            'endDate' => ['required', 'date', 'after_or_equal:startDate'],
            'deadline' => ['nullable', 'date'],
        ]);

        $set = $group->commonAvailabilitySets()->create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'starts_at' => $validated['startDate'],
            'ends_at' => $validated['endDate'],
            'deadline' => $validated['deadline'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->serializeSet($set->loadCount('availabilities')),
            'error' => null,
        ], 201);
    }

    public function show(Request $request, CommonAvailabilitySet $set): JsonResponse
    {
        $set->loadMissing('group');
        $this->requireCommonAvailabilityMember($request, $set);

        return response()->json([
            'success' => true,
            'data' => $this->serializeSet($set->loadCount('availabilities')),
            'error' => null,
        ]);
    }

    public function storeByEvent(Request $request, Event $event): JsonResponse
    {
        $this->requireEventManager($request, $event);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'startDate' => ['required', 'date'],
            'endDate' => ['required', 'date', 'after_or_equal:startDate'],
            'deadline' => ['nullable', 'date'],
        ]);

        $set = $event->availabilitySets()->create([
            'group_id' => $event->group_id,
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'starts_at' => $validated['startDate'],
            'ends_at' => $validated['endDate'],
            'deadline' => $validated['deadline'] ?? null,
        ]);

        if (! $event->common_availability_set_id) {
            $event->forceFill([
                'common_availability_set_id' => $set->id,
            ])->save();
        }

        return response()->json([
            'success' => true,
            'data' => $this->serializeSet($set->loadCount('availabilities')),
            'error' => null,
        ], 201);
    }

    public function update(Request $request, CommonAvailabilitySet $set): JsonResponse
    {
        $set->loadMissing('group');
        $this->requireCommonAvailabilityManager($request, $set);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'startDate' => ['required', 'date'],
            'endDate' => ['required', 'date', 'after_or_equal:startDate'],
            'deadline' => ['nullable', 'date'],
        ]);

        $set->update([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'starts_at' => $validated['startDate'],
            'ends_at' => $validated['endDate'],
            'deadline' => $validated['deadline'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->serializeSet($set->refresh()->loadCount('availabilities')),
            'error' => null,
        ]);
    }

    public function destroy(Request $request, CommonAvailabilitySet $set): JsonResponse
    {
        $set->loadMissing('group');
        $this->requireCommonAvailabilityManager($request, $set);
        $set->delete();

        return response()->json([
            'success' => true,
            'data' => ['deleted' => true],
            'error' => null,
        ]);
    }

    private function serializeSet(CommonAvailabilitySet $set): array
    {
        return [
            'id' => $set->id,
            'groupId' => $set->group_id,
            'eventId' => $set->event_id,
            'name' => $set->name,
            'description' => $set->description,
            'startDate' => $set->starts_at?->toDateString(),
            'endDate' => $set->ends_at?->toDateString(),
            'deadline' => $set->deadline?->toIso8601String(),
            'availabilityCount' => $set->getAttribute('availabilities_count') ?? $set->availabilities()->count(),
        ];
    }
}
