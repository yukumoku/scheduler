<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class EventSlotResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $startDateTime = $this->start_datetime ?? ($this->date && $this->start_time ? $this->date->copy()->setTimeFromTimeString($this->start_time) : null);
        $endDateTime = $this->end_datetime ?? ($this->date && $this->end_time ? $this->date->copy()->setTimeFromTimeString($this->end_time) : null);

        return [
            'id' => $this->id,
            'eventId' => $this->event_id,
            'taskId' => $this->task_id,
            'date' => $startDateTime?->toDateString(),
            'startTime' => $startDateTime?->format('H:i'),
            'endTime' => $endDateTime?->format('H:i'),
            'requiredPeople' => $this->required_people,
            'status' => $this->status ?? 'open',
            'location' => $this->location,
            'note' => $this->note,
            'task' => $this->relationLoaded('task') && $this->task ? [
                'id' => $this->task->id,
                'eventId' => $this->task->event_id,
                'teamId' => $this->task->team_id,
                'name' => $this->task->name,
                'description' => $this->task->description,
                'desiredTotalHours' => $this->task->desired_total_hours !== null ? (float) $this->task->desired_total_hours : null,
                'requiredPeoplePerSlot' => max((int) ($this->task->required_people_per_slot ?? 1), 1),
                'allowCrossTeamHelp' => (bool) $this->task->allow_cross_team_help,
                'color' => $this->task->color,
                'sortOrder' => $this->task->sort_order,
                'team' => $this->task->relationLoaded('team') && $this->task->team ? [
                    'id' => $this->task->team->id,
                    'name' => $this->task->team->name,
                    'color' => $this->task->team->color,
                ] : null,
            ] : null,
        ];
    }
}
