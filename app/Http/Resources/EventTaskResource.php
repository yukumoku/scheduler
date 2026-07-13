<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EventTaskResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'eventId' => $this->event_id,
            'teamId' => $this->team_id,
            'name' => $this->name,
            'description' => $this->description,
            'desiredTotalHours' => $this->desired_total_hours !== null ? (float) $this->desired_total_hours : null,
            'requiredPeoplePerSlot' => $this->required_people_per_slot !== null
                ? max((int) $this->required_people_per_slot, 1)
                : null,
            'workStartDate' => $this->work_start_date?->toDateString(),
            'workEndDate' => $this->work_end_date?->toDateString(),
            'desiredPeriods' => $this->desired_periods ?? [],
            'requiredMemberIds' => $this->required_member_ids ?? [],
            'requiredRole' => $this->required_role,
            'allowCrossTeamHelp' => (bool) $this->allow_cross_team_help,
            'color' => $this->color,
            'sortOrder' => $this->sort_order,
            'team' => $this->relationLoaded('team') && $this->team ? [
                'id' => $this->team->id,
                'name' => $this->team->name,
                'color' => $this->team->color,
            ] : null,
            'slotCount' => $this->whenCounted('slots', $this->slots_count ?? null),
        ];
    }
}
