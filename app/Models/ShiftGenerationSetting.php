<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShiftGenerationSetting extends Model
{
    use HasFactory;

    protected $fillable = ['event_id', 'preference_weight', 'fairness_weight', 'balance_workload_weight', 'avoid_continuous_work_weight', 'leader_assignment_weight', 'required_people_weight'];

    protected $casts = [
        'preference_weight' => 'integer',
        'fairness_weight' => 'integer',
        'balance_workload_weight' => 'integer',
        'avoid_continuous_work_weight' => 'integer',
        'leader_assignment_weight' => 'integer',
        'required_people_weight' => 'integer',
    ];

    public function event(): BelongsTo { return $this->belongsTo(Event::class); }
}
