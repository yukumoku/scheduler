<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EventAvailabilitySlotResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this['slot']->id,
            'eventId' => $this['slot']->event_id,
            'date' => $this['slot']->date?->toDateString(),
            'startTime' => $this['slot']->start_time,
            'endTime' => $this['slot']->end_time,
            'requiredPeople' => $this['slot']->required_people,
            'location' => $this['slot']->location,
            'note' => $this['slot']->note,
            'availabilityStatus' => $this['availabilityStatus'],
            'availabilityComment' => $this['availabilityComment'],
        ];
    }
}
