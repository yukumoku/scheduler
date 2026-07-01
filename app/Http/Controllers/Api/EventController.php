<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\EventStoreRequest;
use App\Http\Requests\Api\EventUpdateRequest;
use App\Http\Resources\EventResource;
use App\Models\Event;
use App\Models\Group;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EventController extends Controller
{
    use AuthorizesRequests;

    public function index(Group $group): JsonResponse
    {
        $this->authorize('viewEvents', $group);

        $events = $group->events()->with(['creator', 'slots'])->latest()->get();

        return response()->json([
            'success' => true,
            'data' => EventResource::collection($events)->resolve(),
            'error' => null,
        ]);
    }

    public function store(EventStoreRequest $request, Group $group): JsonResponse
    {
        $this->authorize('createEvent', $group);

        $event = $group->events()->create([
            'name' => $request->validated('name'),
            'description' => $request->validated('description'),
            'location' => $request->validated('location'),
            'start_date' => $request->validated('startDate'),
            'end_date' => $request->validated('endDate'),
            'availability_deadline' => $request->validated('availabilityDeadline'),
            'status' => $request->validated('status', 'draft'),
            'created_by' => $request->user()->id,
        ]);

        $event->load(['creator', 'slots']);

        return response()->json([
            'success' => true,
            'data' => new EventResource($event),
            'error' => null,
        ], 201);
    }

    public function show(Request $request, Event $event): JsonResponse
    {
        $this->authorize('view', $event);

        $event->load(['creator', 'slots']);

        return response()->json([
            'success' => true,
            'data' => new EventResource($event),
            'error' => null,
        ]);
    }

    public function update(EventUpdateRequest $request, Event $event): JsonResponse
    {
        $this->authorize('update', $event);

        $event->fill([
            'name' => $request->validated('name', $event->name),
            'description' => $request->validated('description', $event->description),
            'location' => $request->validated('location', $event->location),
            'start_date' => $request->validated('startDate', $event->start_date),
            'end_date' => $request->validated('endDate', $event->end_date),
            'availability_deadline' => $request->validated('availabilityDeadline', $event->availability_deadline),
            'status' => $request->validated('status', $event->status?->value ?? $event->status),
        ])->save();

        $event->load(['creator', 'slots']);

        return response()->json([
            'success' => true,
            'data' => new EventResource($event),
            'error' => null,
        ]);
    }
}
