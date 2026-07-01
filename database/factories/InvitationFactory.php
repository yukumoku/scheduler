<?php

namespace Database\Factories;

use App\Models\Group;
use App\Models\Invitation;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Invitation>
 */
class InvitationFactory extends Factory
{
    protected $model = Invitation::class;

    public function definition(): array
    {
        return [
            'group_id' => Group::factory(),
            'invited_email' => fake()->safeEmail(),
            'invited_by' => User::factory(),
            'token' => Str::random(40),
            'expires_at' => now()->addDays(7),
            'accepted_at' => null,
        ];
    }
}
