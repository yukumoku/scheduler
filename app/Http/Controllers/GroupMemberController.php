<?php

namespace App\Http\Controllers;

use App\Enums\GroupRole;
use App\Models\Group;
use App\Support\AvatarUrl;
use Illuminate\Http\Request;

class GroupMemberController extends Controller
{
    public function index(Request $request, Group $group)
    {
        $this->requireGroupMember($request, $group);
        $members = $group->members()->with('user')->latest('joined_at')->get()->map(function ($membership) {
            return [
                'id' => $membership->id,
                'userId' => $membership->user_id,
                'displayName' => $membership->user?->display_name,
                'email' => $membership->user?->email,
                'avatarUrl' => AvatarUrl::public($membership->user?->avatar_url),
                'role' => $membership->role->value,
                'joinedAt' => $membership->joined_at?->toIso8601String(),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => $members->values(),
            'error' => null,
        ]);
    }

    public function update(Request $request, Group $group, $member)
    {
        $this->requireGroupManager($request, $group);

        $validated = $request->validate([
            'role' => ['required', 'in:owner,member'],
        ]);

        $targetMembership = $group->members()->whereKey($member)->firstOrFail();
        $newRole = GroupRole::from($validated['role']);
        $ownerCount = $group->members()->where('role', GroupRole::Owner->value)->count();

        abort_if($targetMembership->user_id === $group->owner_id && $newRole !== GroupRole::Owner, 422, 'グループオーナーは少なくとも1人必要です。');
        abort_if($targetMembership->role->value === GroupRole::Owner->value && $newRole !== GroupRole::Owner->value && $ownerCount <= 1, 422, 'オーナーは最低1人必要です。');

        $targetMembership->update([
            'role' => $newRole,
        ]);
        $targetMembership->loadMissing('user');

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $targetMembership->id,
                'userId' => $targetMembership->user_id,
                'displayName' => $targetMembership->user?->display_name,
                'email' => $targetMembership->user?->email,
                'avatarUrl' => AvatarUrl::public($targetMembership->user?->avatar_url),
                'role' => $targetMembership->role->value,
                'joinedAt' => $targetMembership->joined_at?->toIso8601String(),
            ],
            'error' => null,
        ]);
    }
}
