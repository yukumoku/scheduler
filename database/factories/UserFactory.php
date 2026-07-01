<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected $model = User::class;

    public function definition(): array
    {
        $name = fake()->name();

        return [
            'display_name' => $name,
            'email' => fake()->unique()->safeEmail(),
            'avatar_url' => fake()->imageUrl(128, 128),
            'provider' => 'google',
            'provider_id' => (string) fake()->uuid(),
            'email_verified_at' => now(),
            'remember_token' => null,
        ];
    }
}
