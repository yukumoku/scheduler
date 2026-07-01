<?php

namespace Database\Factories;

use App\Models\Event;
use App\Models\EventSlot;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<EventSlot>
 */
class EventSlotFactory extends Factory
{
    protected $model = EventSlot::class;

    public function definition(): array
    {
        return [
            'event_id' => Event::factory(),
            'date' => now()->addDays(7)->toDateString(),
            'start_time' => '09:00:00',
            'end_time' => '12:00:00',
            'required_people' => 1,
            'location' => fake()->city(),
            'note' => fake()->sentence(),
        ];
    }
}
