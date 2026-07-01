<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EventResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'groupId' => $this->group_id,
            'name' => $this->name,
            'description' => $this->description,
            'location' => $this->location,
            'startDate' => optional($this->start_date)->toDateString(),
            'endDate' => optional($this->end_date)->toDateString(),
            'availabilityDeadline' => optional($this->availability_deadline)->toISOString(),
            'status' => $this->status?->value ?? $this->status,
            'creator' => new UserResource($this->whenLoaded('creator')),
            'slots' => EventSlotResource::collection($this->whenLoaded('slots')),
        ];
    }
}
