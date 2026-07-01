<?php

namespace Database\Factories;

use App\Models\Event;
use App\Models\ShiftGenerationSetting;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ShiftGenerationSetting>
 */
class ShiftGenerationSettingFactory extends Factory
{
    protected $model = ShiftGenerationSetting::class;

    public function definition(): array
    {
        return [
            'event_id' => Event::factory(),
            'preference_weight' => 80,
            'fairness_weight' => 80,
            'balance_workload_weight' => 80,
            'avoid_continuous_work_weight' => 70,
            'leader_assignment_weight' => 60,
            'required_people_weight' => 90,
        ];
    }
}
