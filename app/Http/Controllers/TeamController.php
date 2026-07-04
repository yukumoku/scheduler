<?php

namespace App\Http\Controllers;

use App\Enums\GroupRole;
use App\Http\Requests\TeamStoreRequest;
use App\Http\Resources\TeamResource;
use App\Models\Event;
use App\Models\Group;
use App\Models\Team;
use App\Enums\TeamMemberRole;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TeamController extends Controller
{
    public function index(Request $request, Group $group): JsonResponse
    {
        $this->requireGroupMember($request, $group);
        $this->ensureDefaultTeam($group);
        $this->ensureOwnerJoined($group);

        try {
            $teams = $group->teams()
                ->with(['members.user'])
                ->latest()
                ->get();
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
            'data' => TeamResource::collection($teams),
            'error' => null,
        ]);
    }

    public function indexByEvent(Request $request, Event $event): JsonResponse
    {
        $this->requireEventMember($request, $event);
        $this->ensureDefaultTeam($event->group);
        $this->ensureOwnerJoined($event->group);

        try {
            $teams = $event->teams()
                ->with(['members.user'])
                ->latest()
                ->get()
                ->merge(
                    $event->group->teams()
                        ->whereNull('event_id')
                        ->with(['members.user'])
                        ->latest()
                        ->get(),
                )
                ->unique('id')
                ->values();
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
            'data' => TeamResource::collection($teams),
            'error' => null,
        ]);
    }

    public function store(TeamStoreRequest $request, Group $group): JsonResponse
    {
        $this->requireGroupManager($request, $group);
        $validated = $request->validated();

        $team = $group->teams()->create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'color' => $validated['color'] ?? '#7c3aed',
        ]);

        $team->members()->updateOrCreate(
            ['user_id' => $request->user()->id],
            [
                'role' => TeamMemberRole::Leader,
                'joined_at' => now(),
            ],
        );
        $this->ensureOwnerJoined($group);

        return response()->json([
            'success' => true,
            'data' => new TeamResource($team->load(['members.user'])),
            'error' => null,
        ], 201);
    }

    public function storeByEvent(TeamStoreRequest $request, Event $event): JsonResponse
    {
        $this->requireEventManager($request, $event);
        $validated = $request->validated();

        $team = $event->teams()->create([
            'group_id' => $event->group_id,
            'event_id' => $event->id,
            'is_default' => false,
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'color' => $validated['color'] ?? '#7c3aed',
        ]);

        $team->members()->updateOrCreate(
            ['user_id' => $request->user()->id],
            [
                'role' => TeamMemberRole::Leader,
                'joined_at' => now(),
            ],
        );
        $this->ensureOwnerJoined($event->group);

        return response()->json([
            'success' => true,
            'data' => new TeamResource($team->load(['members.user'])),
            'error' => null,
        ], 201);
    }

    public function show(Request $request, Team $team): JsonResponse
    {
        $team->loadMissing(['group', 'members.user']);
        $this->requireGroupMember($request, $team->group);
        $this->ensureDefaultTeam($team->group);
        $this->ensureOwnerJoined($team->group);

        return response()->json([
            'success' => true,
            'data' => new TeamResource($team),
            'error' => null,
        ]);
    }

    public function update(Request $request, Team $team): JsonResponse
    {
        $team->loadMissing('group');
        $this->requireTeamManager($request, $team);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:1000'],
            'color' => ['nullable', 'string', 'max:32'],
        ]);

        $team->update([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'color' => $validated['color'] ?? $team->color,
        ]);

        return response()->json([
            'success' => true,
            'data' => new TeamResource($team->refresh()->load(['members.user'])),
            'error' => null,
        ]);
    }

    public function destroy(Request $request, Team $team): JsonResponse
    {
        $team->loadMissing('group');
        $this->requireTeamManager($request, $team);
        abort_if($team->is_default, 422, '全体班は削除できません。');
        $team->delete();

        return response()->json([
            'success' => true,
            'data' => ['deleted' => true],
            'error' => null,
        ]);
    }

    private function ensureDefaultTeam(object $group): Team
    {
        if (! method_exists($group, 'teams') || ! method_exists($group, 'members')) {
            return Team::make([
                'group_id' => $group->id ?? null,
                'event_id' => null,
                'is_default' => true,
                'name' => '全体班',
                'description' => 'グループ全員が参加する班です。',
                'color' => '#7c3aed',
            ]);
        }

        $team = $group->teams()->firstOrCreate(
            ['is_default' => true],
            [
                'event_id' => null,
                'name' => '全体班',
                'description' => 'グループ全員が参加する班です。',
                'color' => '#7c3aed',
            ],
        );

        $group->members()->with('user')->get()->each(function ($membership) use ($team): void {
            $team->members()->updateOrCreate(
                ['user_id' => $membership->user_id],
                [
                    'role' => $membership->role->value === GroupRole::Owner->value ? TeamMemberRole::Leader : TeamMemberRole::Member,
                    'joined_at' => $membership->joined_at ?? now(),
                ],
            );
        });

        return $team;
    }

    private function ensureOwnerJoined(Group $group): void
    {
        if (! property_exists($group, 'owner_id') || ! $group->owner_id) {
            return;
        }

        $group->teams()->get()->each(function (Team $team) use ($group): void {
            $team->members()->updateOrCreate(
                ['user_id' => $group->owner_id],
                [
                    'role' => TeamMemberRole::Leader,
                    'joined_at' => now(),
                ],
            );
        });
    }

}
