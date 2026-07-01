<?php

namespace Database\Factories;

use App\Models\Event;
use App\Models\ShiftRule;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ShiftRule>
 */
class ShiftRuleFactory extends Factory
{
    protected $model = ShiftRule::class;

    public function definition(): array
    {
        return [
            'event_id' => Event::factory(),
            'slot_minutes' => 60,
            'min_work_minutes' => 120,
            'max_work_minutes' => 360,
            'max_continuous_minutes' => 180,
            'break_minutes' => 30,
            'leader_required_per_slot' => 1,
        ];
    }
}
