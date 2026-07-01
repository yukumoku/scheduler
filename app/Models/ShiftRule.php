<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShiftRule extends Model
{
    use HasFactory;

    protected $fillable = ['event_id', 'slot_minutes', 'min_work_minutes', 'max_work_minutes', 'max_continuous_minutes', 'break_minutes', 'leader_required_per_slot'];

    protected $casts = [
        'slot_minutes' => 'integer',
        'min_work_minutes' => 'integer',
        'max_work_minutes' => 'integer',
        'max_continuous_minutes' => 'integer',
        'break_minutes' => 'integer',
        'leader_required_per_slot' => 'integer',
    ];

    public function event(): BelongsTo { return $this->belongsTo(Event::class); }
}
