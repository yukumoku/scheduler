<?php

namespace Database\Factories;

use App\Models\Group;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Group>
 */
class GroupFactory extends Factory
{
    protected $model = Group::class;

    public function definition(): array
    {
        return [
            'name' => fake()->company(),
            'description' => fake()->sentence(),
            'icon_url' => fake()->imageUrl(128, 128),
            'owner_id' => User::factory(),
            'invite_code' => Str::upper(Str::random(10)),
            'is_invite_enabled' => true,
        ];
    }
}
