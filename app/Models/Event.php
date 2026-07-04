<?php

namespace App\Models;

use App\Enums\EventScope;
use App\Enums\EventStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Event extends Model
{
    use HasFactory;

    protected $fillable = ['group_id', 'team_id', 'common_availability_set_id', 'scope', 'name', 'description', 'location', 'start_date', 'end_date', 'availability_deadline', 'status', 'created_by'];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'availability_deadline' => 'datetime',
        'scope' => EventScope::class,
        'status' => EventStatus::class,
    ];

    public function group(): BelongsTo { return $this->belongsTo(Group::class); }
    public function team(): BelongsTo { return $this->belongsTo(Team::class); }
    public function teams(): HasMany { return $this->hasMany(Team::class); }
    public function commonAvailabilitySet(): BelongsTo { return $this->belongsTo(CommonAvailabilitySet::class); }
    public function availabilitySets(): HasMany { return $this->hasMany(CommonAvailabilitySet::class); }
    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
    public function tasks(): HasMany { return $this->hasMany(EventTask::class); }
    public function slots(): HasMany { return $this->hasMany(EventSlot::class); }
    public function availabilities(): HasMany { return $this->hasMany(Availability::class); }
    public function shiftRule(): HasOne { return $this->hasOne(ShiftRule::class); }
    public function shiftGenerationSetting(): HasOne { return $this->hasOne(ShiftGenerationSetting::class); }
    public function shifts(): HasMany { return $this->hasMany(Shift::class); }
}
