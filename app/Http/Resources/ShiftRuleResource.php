<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ShiftRuleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'eventId' => $this->event_id,
            'slotMinutes' => $this->slot_minutes,
            'minWorkMinutes' => $this->min_work_minutes,
            'maxWorkMinutes' => $this->max_work_minutes,
            'maxContinuousMinutes' => $this->max_continuous_minutes,
            'breakMinutes' => $this->break_minutes,
            'leaderRequiredPerSlot' => $this->leader_required_per_slot,
        ];
    }
}
