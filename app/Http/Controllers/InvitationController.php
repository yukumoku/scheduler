<?php

namespace App\Http\Controllers;

use App\Enums\GroupRole;
use App\Models\Group;
use App\Models\Invitation;
use App\Models\Team;
use App\Enums\TeamMemberRole;
use App\Support\AvatarUrl;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class InvitationController extends Controller
{
    public function index(Request $request, Group $group): JsonResponse
    {
        $this->requireGroupManager($request, $group);

        $invitations = $group->invitations()
            ->with('inviter')
            ->latest()
            ->get()
            ->map(fn (Invitation $invitation) => $this->serializeInvitation($invitation));

        return response()->json([
            'success' => true,
            'data' => $invitations->values(),
            'error' => null,
        ]);
    }

    public function store(Request $request, Group $group): JsonResponse
    {
        $this->requireGroupManager($request, $group);

        $validated = $request->validate([
            'email' => ['nullable', 'email', 'max:255'],
        ]);

        $email = $validated['email'] ?? null;

        if ($email && $group->members()->whereHas('user', fn ($query) => $query->where('email', $email))->exists()) {
            abort(422, 'このメールアドレスのメンバーは、すでにグループに参加しています。');
        }

        $invitation = $group->invitations()->create([
            'invited_email' => $email,
            'invited_by' => $request->user()->id,
            'token' => Str::random(48),
            'code' => $this->generateInvitationCode(),
            'expires_at' => now()->addDays(14),
            'accepted_at' => null,
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->serializeInvitation($invitation->load('inviter')),
            'error' => null,
        ], 201);
    }

    public function show(string $token): JsonResponse
    {
        $invitation = Invitation::query()
            ->with(['group', 'inviter'])
            ->where('token', $token)
            ->firstOrFail();

        return response()->json([
            'success' => true,
            'data' => $this->serializeInvitation($invitation),
            'error' => null,
        ]);
    }

    public function showByCode(string $code): JsonResponse
    {
        $invitation = $this->findInvitationByCode($code);

        if (! $invitation) {
            $group = $this->findGroupByInviteCode($code);

            return response()->json([
                'success' => true,
                'data' => $this->serializeGroupCodeInvitation($group),
                'error' => null,
            ]);
        }

        $invitation->load(['group', 'inviter']);

        return response()->json([
            'success' => true,
            'data' => $this->serializeInvitation($invitation),
            'error' => null,
        ]);
    }

    public function accept(Request $request, string $token): JsonResponse
    {
        $invitation = Invitation::query()
            ->with('group')
            ->where('token', $token)
            ->firstOrFail();

        return $this->acceptInvitation($request, $invitation);
    }

    public function acceptByCode(Request $request, string $code): JsonResponse
    {
        $invitation = $this->findInvitationByCode($code);

        if ($invitation) {
            return $this->acceptInvitation($request, $invitation->load('group'));
        }

        return $this->acceptGroupCode($request, $this->findGroupByInviteCode($code));
    }

    public function destroy(Request $request, Invitation $invitation): JsonResponse
    {
        $invitation->loadMissing('group');
        $this->requireGroupManager($request, $invitation->group);
        $invitation->delete();

        return response()->json([
            'success' => true,
            'data' => ['deleted' => true],
            'error' => null,
        ]);
    }

    private function acceptInvitation(Request $request, Invitation $invitation): JsonResponse
    {
        abort_if($invitation->invited_email && $invitation->accepted_at, 422, 'この招待はすでに使用されています。');
        abort_if($invitation->expires_at && $invitation->expires_at->isPast(), 422, 'この招待は期限切れです。');

        if ($invitation->invited_email && $request->user()->email !== $invitation->invited_email) {
            abort(403, 'この招待は別のメールアドレス宛てです。');
        }

        $invitation->group->members()->updateOrCreate(
            ['user_id' => $request->user()->id],
            [
                'role' => GroupRole::Member,
                'joined_at' => now(),
            ],
        );

        $this->ensureDefaultTeam($invitation->group, $request->user()->id);

        if ($invitation->invited_email) {
            $invitation->update([
                'accepted_at' => now(),
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'accepted' => true,
                'groupId' => $invitation->group_id,
            ],
            'error' => null,
        ]);
    }

    private function findInvitationByCode(string $code): ?Invitation
    {
        return Invitation::query()
            ->where('code', $this->normalizeCode($code))
            ->first();
    }

    private function findGroupByInviteCode(string $code): Group
    {
        return Group::query()
            ->where('invite_code', $this->normalizeCode($code))
            ->where('is_invite_enabled', true)
            ->firstOrFail();
    }

    private function normalizeCode(string $code): string
    {
        return Str::upper(trim($code));
    }

    private function acceptGroupCode(Request $request, Group $group): JsonResponse
    {
        $group->members()->updateOrCreate(
            ['user_id' => $request->user()->id],
            [
                'role' => GroupRole::Member,
                'joined_at' => now(),
            ],
        );

        $this->ensureDefaultTeam($group, $request->user()->id);

        return response()->json([
            'success' => true,
            'data' => [
                'accepted' => true,
                'groupId' => $group->id,
            ],
            'error' => null,
        ]);
    }

    private function generateInvitationCode(): string
    {
        do {
            $code = Str::upper(Str::random(8));
        } while (Invitation::query()->where('code', $code)->exists());

        return $code;
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

    private function serializeInvitation(Invitation $invitation): array
    {
        return [
            'id' => $invitation->id,
            'groupId' => $invitation->group_id,
            'group' => $invitation->relationLoaded('group') && $invitation->group ? [
                'id' => $invitation->group->id,
                'name' => $invitation->group->name,
                'description' => $invitation->group->description,
            ] : null,
            'email' => $invitation->invited_email,
            'token' => $invitation->token,
            'code' => $invitation->code,
            'inviteUrl' => url('/invite/'.$invitation->token),
            'expiresAt' => $invitation->expires_at?->toIso8601String(),
            'acceptedAt' => $invitation->accepted_at?->toIso8601String(),
            'inviter' => $invitation->relationLoaded('inviter') && $invitation->inviter ? [
                'id' => $invitation->inviter->id,
                'displayName' => $invitation->inviter->display_name,
                'email' => $invitation->inviter->email,
                'avatarUrl' => AvatarUrl::public($invitation->inviter->avatar_url),
                'provider' => $invitation->inviter->provider,
            ] : null,
        ];
    }

    private function serializeGroupCodeInvitation(Group $group): array
    {
        return [
            'id' => 'group-'.$group->id,
            'groupId' => $group->id,
            'group' => [
                'id' => $group->id,
                'name' => $group->name,
                'description' => $group->description,
            ],
            'email' => null,
            'token' => '',
            'code' => $group->invite_code,
            'inviteUrl' => url('/groups'),
            'expiresAt' => null,
            'acceptedAt' => null,
            'inviter' => null,
        ];
    }
}
