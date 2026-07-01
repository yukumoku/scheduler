<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EventSlotResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'eventId' => $this->event_id,
            'date' => optional($this->date)->toDateString(),
            'startTime' => $this->start_time,
            'endTime' => $this->end_time,
            'requiredPeople' => $this->required_people,
            'location' => $this->location,
            'note' => $this->note,
        ];
    }
}
