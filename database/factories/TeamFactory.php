<?php

namespace Database\Factories;

use App\Models\Group;
use App\Models\Team;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Team>
 */
class TeamFactory extends Factory
{
    protected $model = Team::class;

    public function definition(): array
    {
        return [
            'group_id' => Group::factory(),
            'event_id' => null,
            'name' => fake()->randomElement(['装飾班', '受付班', 'ステージ班']),
            'description' => fake()->sentence(),
            'color' => fake()->hexColor(),
        ];
    }
}
