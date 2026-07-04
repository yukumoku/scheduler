<?php

namespace App\Http\Controllers;

use App\Enums\EventStatus;
use App\Enums\GroupRole;
use App\Models\Event;
use App\Models\Group;
use App\Support\AvatarUrl;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class EventController extends Controller
{
    public function index(Group $group)
    {
        $this->requireGroupMember(request(), $group);
        $events = $group->events()->latest()->get()->map(fn (Event $event) => $this->serializeEvent($event));

        return response()->json([
            'success' => true,
            'data' => $events->values(),
            'error' => null,
        ]);
    }

    public function store(Request $request, Group $group)
    {
        $this->requireGroupManager($request, $group);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'location' => ['nullable', 'string', 'max:255'],
            'startDate' => ['required', 'date'],
            'endDate' => ['required', 'date'],
            'availabilityDeadline' => ['nullable', 'date'],
            'commonAvailabilitySetId' => [
                'nullable',
                'uuid',
                Rule::exists('common_availability_sets', 'id')->where('group_id', $group->id),
            ],
            'status' => ['required', 'in:' . implode(',', array_map(fn ($case) => $case->value, EventStatus::cases()))],
        ]);

        $event = $group->events()->create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'location' => $validated['location'] ?? null,
            'start_date' => $validated['startDate'],
            'end_date' => $validated['endDate'],
            'availability_deadline' => $validated['availabilityDeadline'] ?? null,
            'common_availability_set_id' => $validated['commonAvailabilitySetId'] ?? null,
            'status' => $validated['status'],
            'created_by' => $request->user()->id,
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->serializeEvent($event),
            'error' => null,
        ], 201);
    }

    public function show(Event $event)
    {
        $this->requireEventMember(request(), $event);
        return response()->json([
            'success' => true,
            'data' => $this->serializeEvent($event),
            'error' => null,
        ]);
    }

    public function update(Request $request, Event $event)
    {
        $this->requireEventManager($request, $event);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'location' => ['nullable', 'string', 'max:255'],
            'startDate' => ['nullable', 'date'],
            'endDate' => ['nullable', 'date'],
            'availabilityDeadline' => ['nullable', 'date'],
            'commonAvailabilitySetId' => [
                'nullable',
                'uuid',
                Rule::exists('common_availability_sets', 'id')->where('group_id', $event->group_id),
            ],
            'status' => ['required', 'in:' . implode(',', array_map(fn ($case) => $case->value, EventStatus::cases()))],
        ]);

        $event->update([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'location' => $validated['location'] ?? null,
            'start_date' => $validated['startDate'] ?? $event->start_date,
            'end_date' => $validated['endDate'] ?? $event->end_date,
            'availability_deadline' => $validated['availabilityDeadline'] ?? $event->availability_deadline,
            'common_availability_set_id' => $validated['commonAvailabilitySetId'] ?? null,
            'status' => $validated['status'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->serializeEvent($event->refresh()),
            'error' => null,
        ]);
    }

    public function destroy(Request $request, Event $event)
    {
        $this->requireEventManager($request, $event);
        $event->delete();

        return response()->json([
            'success' => true,
            'data' => ['deleted' => true],
            'error' => null,
        ]);
    }

    private function serializeEvent(Event $event): array
    {
        return [
            'id' => $event->id,
            'groupId' => $event->group_id,
            'name' => $event->name,
            'description' => $event->description,
            'location' => $event->location,
            'startDate' => $event->start_date?->toDateString(),
            'endDate' => $event->end_date?->toDateString(),
            'availabilityDeadline' => $event->availability_deadline?->toIso8601String(),
            'status' => $event->status->value,
            'commonAvailabilitySetId' => $event->common_availability_set_id,
            'scope' => $event->scope?->value,
            'creator' => $event->relationLoaded('creator') && $event->creator ? [
                'id' => $event->creator->id,
                'displayName' => $event->creator->display_name,
                'email' => $event->creator->email,
                'avatarUrl' => AvatarUrl::public($event->creator->avatar_url),
                'provider' => $event->creator->provider,
            ] : null,
        ];
    }
}
