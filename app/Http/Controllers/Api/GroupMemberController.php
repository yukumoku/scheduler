<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\GroupMemberResource;
use App\Models\Group;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\JsonResponse;

class GroupMemberController extends Controller
{
    use AuthorizesRequests;

    public function index(Group $group): JsonResponse
    {
        $this->authorize('viewMembers', $group);

        $members = $group->members()->with('user')->get();

        return response()->json([
            'success' => true,
            'data' => GroupMemberResource::collection($members)->resolve(),
            'error' => null,
        ]);
    }
}
