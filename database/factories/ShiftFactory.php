<?php

namespace Database\Factories;

use App\Enums\ShiftStatus;
use App\Models\Event;
use App\Models\Shift;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Shift>
 */
class ShiftFactory extends Factory
{
    protected $model = Shift::class;

    public function definition(): array
    {
        return [
            'event_id' => Event::factory(),
            'status' => ShiftStatus::Draft,
            'generated_at' => null,
            'published_at' => null,
        ];
    }
}
