<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EventSlot extends Model
{
    use HasFactory;

    protected $fillable = [
        'event_id',
        'task_id',
        'date',
        'start_time',
        'end_time',
        'start_datetime',
        'end_datetime',
        'required_people',
        'status',
        'location',
        'note',
    ];

    protected $casts = [
        'date' => 'date',
        'start_datetime' => 'datetime',
        'end_datetime' => 'datetime',
        'status' => 'string',
    ];

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function task(): BelongsTo
    {
        return $this->belongsTo(EventTask::class, 'task_id');
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(ShiftAssignment::class);
    }
}
