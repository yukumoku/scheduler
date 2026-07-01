<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\GroupStoreRequest;
use App\Http\Requests\Api\GroupUpdateRequest;
use App\Http\Resources\GroupResource;
use App\Models\Group;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class GroupController extends Controller
{
    use AuthorizesRequests;

    public function index(Request $request): JsonResponse
    {
        $groups = $request->user()
            ->groups()
            ->withCount('members')
            ->with(['owner', 'members'])
            ->get();

        return response()->json([
            'success' => true,
            'data' => GroupResource::collection($groups)->resolve(),
            'error' => null,
        ]);
    }

    public function store(GroupStoreRequest $request): JsonResponse
    {
        $user = $request->user();
        $group = Group::query()->create([
            'name' => $request->validated('name'),
            'description' => $request->validated('description'),
            'icon_url' => $request->validated('iconUrl'),
            'owner_id' => $user->id,
            'invite_code' => Str::upper(Str::random(10)),
            'is_invite_enabled' => true,
        ]);

        $group->load(['owner', 'members']);

        return response()->json([
            'success' => true,
            'data' => new GroupResource($group),
            'error' => null,
        ], 201);
    }

    public function show(Request $request, Group $group): JsonResponse
    {
        $this->authorize('view', $group);

        $group->load(['owner', 'members'])->loadCount('members');

        return response()->json([
            'success' => true,
            'data' => new GroupResource($group),
            'error' => null,
        ]);
    }

    public function update(GroupUpdateRequest $request, Group $group): JsonResponse
    {
        $this->authorize('update', $group);

        $group->fill([
            'name' => $request->validated('name', $group->name),
            'description' => $request->validated('description', $group->description),
            'icon_url' => $request->validated('iconUrl', $group->icon_url),
            'is_invite_enabled' => $request->has('isInviteEnabled')
                ? (bool) $request->validated('isInviteEnabled')
                : $group->is_invite_enabled,
        ])->save();

        $group->load(['owner', 'members'])->loadCount('members');

        return response()->json([
            'success' => true,
            'data' => new GroupResource($group),
            'error' => null,
        ]);
    }
}
