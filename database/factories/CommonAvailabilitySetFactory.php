<?php

namespace Database\Factories;

use App\Models\CommonAvailabilitySet;
use App\Models\Group;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CommonAvailabilitySet>
 */
class CommonAvailabilitySetFactory extends Factory
{
    protected $model = CommonAvailabilitySet::class;

    public function definition(): array
    {
        return [
            'group_id' => Group::factory(),
            'event_id' => null,
            'name' => '夏休み期間の参加可能日時',
            'description' => fake()->sentence(),
            'starts_at' => now(),
            'ends_at' => now()->addDays(14),
            'deadline' => now()->addDays(7),
        ];
    }
}
