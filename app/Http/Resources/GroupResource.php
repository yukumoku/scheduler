<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GroupResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $user = $request->user();
        $myMembership = $user ? $this->members->firstWhere('user_id', $user->id) : null;

        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'iconUrl' => $this->icon_url,
            'memberCount' => $this->members_count ?? $this->members->count(),
            'myRole' => $myMembership?->role?->value ?? null,
            'inviteEnabled' => (bool) $this->is_invite_enabled,
            'owner' => new UserResource($this->whenLoaded('owner')),
        ];
    }
}
