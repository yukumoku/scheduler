<?php

namespace Database\Factories;

use App\Enums\AvailabilityStatus;
use App\Models\Availability;
use App\Models\Event;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Availability>
 */
class AvailabilityFactory extends Factory
{
    protected $model = Availability::class;

    public function definition(): array
    {
        return [
            'event_id' => Event::factory(),
            'user_id' => User::factory(),
            'date' => now()->addDays(7)->toDateString(),
            'start_time' => '09:00:00',
            'end_time' => '12:00:00',
            'status' => AvailabilityStatus::Available,
            'comment' => fake()->sentence(),
        ];
    }
}
