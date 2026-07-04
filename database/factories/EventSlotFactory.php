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
        $date = now()->addDays(7);
        $startTime = '09:00:00';
        $endTime = '12:00:00';

        return [
            'event_id' => Event::factory(),
            'task_id' => null,
            'date' => $date->toDateString(),
            'start_time' => $startTime,
            'end_time' => $endTime,
            'start_datetime' => $date->copy()->setTimeFromTimeString($startTime),
            'end_datetime' => $date->copy()->setTimeFromTimeString($endTime),
            'required_people' => 1,
            'status' => 'open',
            'location' => fake()->city(),
            'note' => fake()->sentence(),
        ];
    }
}
