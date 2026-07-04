<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GenerationSettingsResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'eventId' => $this->event_id,
            'preferenceWeight' => $this->preference_weight,
            'fairnessWeight' => $this->fairness_weight,
            'balanceWorkloadWeight' => $this->balance_workload_weight,
            'avoidContinuousWorkWeight' => $this->avoid_continuous_work_weight,
            'leaderAssignmentWeight' => $this->leader_assignment_weight,
            'requiredPeopleWeight' => $this->required_people_weight,
        ];
    }
}
