<?php

namespace Database\Factories;

use App\Enums\AvailabilityStatus;
use App\Models\CommonAvailability;
use App\Models\CommonAvailabilitySet;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<CommonAvailability>
 */
class CommonAvailabilityFactory extends Factory
{
    protected $model = CommonAvailability::class;

    public function definition(): array
    {
        return [
            'common_availability_set_id' => CommonAvailabilitySet::factory(),
            'user_id' => User::factory(),
            'date' => now()->addDays(7)->toDateString(),
            'start_time' => '09:00:00',
            'end_time' => '12:00:00',
            'status' => AvailabilityStatus::Available,
            'comment' => fake()->sentence(),
        ];
    }
}
