<?php

namespace Database\Factories;

use App\Models\EventSlot;
use App\Models\Shift;
use App\Models\ShiftAssignment;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ShiftAssignment>
 */
class ShiftAssignmentFactory extends Factory
{
    protected $model = ShiftAssignment::class;

    public function definition(): array
    {
        return [
            'shift_id' => Shift::factory(),
            'event_slot_id' => EventSlot::factory(),
            'user_id' => User::factory(),
            'is_leader' => false,
        ];
    }
}
