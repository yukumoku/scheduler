<?php

namespace Database\Factories;

use App\Enums\EventStatus;
use App\Models\Event;
use App\Models\Group;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Event>
 */
class EventFactory extends Factory
{
    protected $model = Event::class;

    public function definition(): array
    {
        $start = fake()->dateTimeBetween('+1 week', '+2 weeks');
        $end = (clone $start)->modify('+2 days');

        return [
            'group_id' => Group::factory(),
            'name' => fake()->catchPhrase(),
            'description' => fake()->paragraph(),
            'location' => fake()->city(),
            'start_date' => $start->format('Y-m-d'),
            'end_date' => $end->format('Y-m-d'),
            'availability_deadline' => now()->addDays(7),
            'status' => EventStatus::Draft,
            'created_by' => User::factory(),
        ];
    }
}
