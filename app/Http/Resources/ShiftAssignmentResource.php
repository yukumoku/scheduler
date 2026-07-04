<?php

namespace App\Http\Resources;

use App\Support\AvatarUrl;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ShiftAssignmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'shiftId' => $this->shift_id,
            'eventSlotId' => $this->event_slot_id,
            'userId' => $this->user_id,
            'isLeader' => (bool) $this->is_leader,
            'user' => $this->relationLoaded('user') && $this->user ? [
                'id' => $this->user->id,
                'displayName' => $this->user->display_name,
                'email' => $this->user->email,
                'avatarUrl' => AvatarUrl::public($this->user->avatar_url),
                'provider' => $this->user->provider,
            ] : null,
            'eventSlot' => $this->relationLoaded('eventSlot') && $this->eventSlot ? new EventSlotResource($this->eventSlot) : null,
        ];
    }
}
