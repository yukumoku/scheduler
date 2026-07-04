<?php

namespace Database\Factories;

use App\Models\Event;
use App\Models\EventTask;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<EventTask>
 */
class EventTaskFactory extends Factory
{
    protected $model = EventTask::class;

    public function definition(): array
    {
        return [
            'event_id' => Event::factory(),
            'team_id' => null,
            'name' => fake()->randomElement(['受付', '装飾', 'ステージ', '撤収']),
            'description' => fake()->sentence(),
            'desired_total_hours' => fake()->randomFloat(2, 1, 8),
            'required_people_per_slot' => 1,
            'work_start_date' => now()->addDays(7)->toDateString(),
            'work_end_date' => now()->addDays(14)->toDateString(),
            'desired_periods' => [
                [
                    'date' => now()->addDays(7)->toDateString(),
                    'startTime' => '09:00',
                    'endTime' => '12:00',
                    'requiredPeople' => 2,
                    'location' => fake()->city(),
                    'note' => fake()->sentence(),
                ],
            ],
            'required_member_ids' => [],
            'required_role' => null,
            'allow_cross_team_help' => false,
            'color' => fake()->hexColor(),
            'sort_order' => 0,
        ];
    }
}
