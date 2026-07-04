<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EventTask extends Model
{
    use HasFactory;

    protected $fillable = [
        'event_id',
        'team_id',
        'name',
        'description',
        'desired_total_hours',
        'required_people_per_slot',
        'work_start_date',
        'work_end_date',
        'desired_periods',
        'required_member_ids',
        'required_role',
        'allow_cross_team_help',
        'color',
        'sort_order',
    ];

    protected $casts = [
        'desired_total_hours' => 'decimal:2',
        'required_people_per_slot' => 'integer',
        'work_start_date' => 'date',
        'work_end_date' => 'date',
        'desired_periods' => 'array',
        'required_member_ids' => 'array',
        'allow_cross_team_help' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function slots(): HasMany
    {
        return $this->hasMany(EventSlot::class, 'task_id');
    }
}
