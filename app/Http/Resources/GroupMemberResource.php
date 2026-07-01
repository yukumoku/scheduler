<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GroupMemberResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'userId' => $this->user_id,
            'displayName' => $this->user?->display_name,
            'email' => $this->user?->email,
            'avatarUrl' => $this->user?->avatar_url,
            'role' => $this->role?->value ?? $this->role,
            'joinedAt' => optional($this->joined_at)->toISOString(),
        ];
    }
}
