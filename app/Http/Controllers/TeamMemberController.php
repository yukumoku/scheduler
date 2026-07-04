<?php

namespace App\Http\Controllers;

use App\Enums\TeamMemberRole;
use App\Models\User;
use App\Models\Team;
use App\Models\TeamMember;
use App\Support\AvatarUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TeamMemberController extends Controller
{
    public function index(Request $request, Team $team): JsonResponse
    {
        $team->loadMissing('group');
        $this->requireTeamMember($request, $team);

        $members = $team->members()->with('user')->latest('joined_at')->get()->map(fn (TeamMember $membership) => $this->serializeMember($membership));

        return response()->json([
            'success' => true,
            'data' => $members->values(),
            'error' => null,
        ]);
    }

    public function store(Request $request, Team $team): JsonResponse
    {
        $team->loadMissing('group');
        $this->requireTeamManager($request, $team);

        $validated = $request->validate([
            'userId' => ['nullable', 'uuid', 'exists:users,id'],
            'email' => ['nullable', 'email'],
            'role' => ['required', 'in:leader,member'],
        ]);

        if (! ($validated['userId'] ?? null) && ! ($validated['email'] ?? null)) {
            abort(422, 'userIdまたはemailのどちらかを指定してください。');
        }

        $user = null;
        if (! empty($validated['userId'])) {
            $user = User::query()->findOrFail($validated['userId']);
        } else {
            $user = User::query()->where('email', $validated['email'])->firstOrFail();
        }

        $membership = $team->members()->updateOrCreate(
            ['user_id' => $user->id],
            [
                'role' => $validated['role'],
                'joined_at' => now(),
            ],
        );

        return response()->json([
            'success' => true,
            'data' => $this->serializeMember($membership->loadMissing('user')),
            'error' => null,
        ], 201);
    }

    public function update(Request $request, Team $team, TeamMember $member): JsonResponse
    {
        $team->loadMissing('group');
        abort_unless($member->team_id === $team->id, 404);
        $this->requireTeamManager($request, $team);
        $this->ensureOwnerProtected($team, $member);

        $validated = $request->validate([
            'role' => ['required', 'in:leader,member'],
        ]);

        $this->ensureLeaderWouldRemain($team, $member, $validated['role']);

        $member->update([
            'role' => $validated['role'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->serializeMember($member->fresh()->loadMissing('user')),
            'error' => null,
        ]);
    }

    public function destroy(Request $request, Team $team, TeamMember $member): JsonResponse
    {
        $team->loadMissing('group');
        abort_unless($member->team_id === $team->id, 404);
        $this->requireTeamManager($request, $team);
        $this->ensureOwnerProtected($team, $member);
        $this->ensureLeaderWouldRemain($team, $member, null);
        $member->delete();

        return response()->json([
            'success' => true,
            'data' => ['deleted' => true],
            'error' => null,
        ]);
    }

    private function ensureLeaderWouldRemain(Team $team, TeamMember $member, ?string $nextRole): void
    {
        if ($team->is_default) {
            abort(422, '全体班のメンバーは外せません。');
        }

        if ($member->role->value !== TeamMemberRole::Leader->value) {
            return;
        }

        if ($nextRole === TeamMemberRole::Leader->value) {
            return;
        }

        $hasOtherLeader = $team->members()
            ->where('role', TeamMemberRole::Leader->value)
            ->where('id', '!=', $member->id)
            ->exists();

        abort_unless($hasOtherLeader, 422, '最後のリーダーは外せません。先に別のリーダーを設定してください。');
    }

    private function ensureOwnerProtected(Team $team, TeamMember $member): void
    {
        if ($team->group?->owner_id === $member->user_id) {
            abort(422, 'オーナーは班から外せません。');
        }
    }

    private function serializeMember(TeamMember $membership): array
    {
        return [
            'id' => $membership->id,
            'userId' => $membership->user_id,
            'displayName' => $membership->user?->display_name,
            'email' => $membership->user?->email,
            'avatarUrl' => AvatarUrl::public($membership->user?->avatar_url),
            'role' => $membership->role->value,
            'joinedAt' => $membership->joined_at?->toIso8601String(),
        ];
    }
}
