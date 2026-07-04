<?php

namespace App\Http\Resources;

use App\Support\AvatarUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TeamResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $members = $this->members->map(fn ($membership) => [
            'id' => $membership->id,
            'userId' => $membership->user_id,
            'displayName' => $membership->user?->display_name,
            'email' => $membership->user?->email,
            'avatarUrl' => AvatarUrl::public($membership->user?->avatar_url),
            'role' => $membership->role->value,
            'joinedAt' => $membership->joined_at?->toIso8601String(),
        ]);

        return [
            'id' => $this->id,
            'groupId' => $this->group_id,
            'eventId' => $this->event_id ?? null,
            'isDefault' => (bool) ($this->is_default ?? false),
            'name' => $this->name,
            'description' => $this->description,
            'color' => $this->color,
            'memberCount' => $members->count(),
            'leader' => $members->firstWhere('role', 'leader'),
            'members' => $members->values(),
        ];
    }
}
