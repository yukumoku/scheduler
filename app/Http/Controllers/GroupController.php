<?php

namespace App\Http\Controllers;

use App\Enums\GroupRole;
use App\Models\Group;
use App\Models\Team;
use App\Enums\TeamMemberRole;
use App\Support\AvatarUrl;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class GroupController extends Controller
{
    public function index(Request $request)
    {
        $groups = $request->user()
            ?->memberships()
            ->with('group.owner')
            ->latest('joined_at')
            ->get()
            ->map(fn ($membership) => $this->serializeGroup($membership->group, $membership->role));

        return response()->json([
            'success' => true,
            'data' => $groups?->values() ?? [],
            'error' => null,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'iconUrl' => ['nullable', 'string', 'max:2048'],
        ]);

        $user = $request->user();
        $group = Group::query()->create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'icon_url' => $validated['iconUrl'] ?? null,
            'owner_id' => $user->id,
            'invite_code' => Str::upper(Str::random(10)),
            'is_invite_enabled' => true,
        ]);

        $group->members()->create([
            'user_id' => $user->id,
            'role' => GroupRole::Owner,
            'joined_at' => now(),
        ]);

        $this->ensureDefaultTeam($group, $user->id);

        return response()->json([
            'success' => true,
            'data' => $this->serializeGroup($group, GroupRole::Owner),
            'error' => null,
        ], 201);
    }

    public function show(Request $request, Group $group)
    {
        $this->requireGroupMember($request, $group);
        $group->loadMissing('owner');
        $role = $request->user()
            ?->memberships()
            ->where('group_id', $group->id)
            ->first()
            ?->role;

        return response()->json([
            'success' => true,
            'data' => $this->serializeGroup($group, $role),
            'error' => null,
        ]);
    }

    public function destroy(Request $request, Group $group)
    {
        $this->requireGroupOwner($request, $group);

        $group->delete();

        return response()->json([
            'success' => true,
            'data' => ['deleted' => true],
            'error' => null,
        ]);
    }

    private function serializeGroup(object $group, ?GroupRole $role = null): array
    {
        return [
            'id' => $group->id,
            'name' => $group->name,
            'description' => $group->description,
            'iconUrl' => $group->icon_url,
            'memberCount' => $group->members()->count(),
            'myRole' => $role?->value,
            'inviteEnabled' => (bool) $group->is_invite_enabled,
            'owner' => $group->owner ? [
                'id' => $group->owner->id,
                'displayName' => $group->owner->display_name,
                'email' => $group->owner->email,
                'avatarUrl' => AvatarUrl::public($group->owner->avatar_url),
                'provider' => $group->owner->provider,
            ] : null,
        ];
    }

    private function ensureDefaultTeam(object $group, ?string $leaderUserId = null): Team
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

        $group->members()->with('user')->get()->each(function ($membership) use ($team, $leaderUserId): void {
            $team->members()->updateOrCreate(
                ['user_id' => $membership->user_id],
                [
                    'role' => $membership->user_id === $leaderUserId ? TeamMemberRole::Leader : TeamMemberRole::Member,
                    'joined_at' => $membership->joined_at ?? now(),
                ],
            );
        });

        return $team;
    }
}
