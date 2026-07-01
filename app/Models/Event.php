<?php

namespace App\Models;

use App\Enums\EventStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Event extends Model
{
    use HasFactory;

    protected $fillable = ['group_id', 'name', 'description', 'location', 'start_date', 'end_date', 'availability_deadline', 'status', 'created_by'];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'availability_deadline' => 'datetime',
        'status' => EventStatus::class,
    ];

    public function group(): BelongsTo { return $this->belongsTo(Group::class); }
    public function creator(): BelongsTo { return $this->belongsTo(User::class, 'created_by'); }
    public function slots(): HasMany { return $this->hasMany(EventSlot::class); }
    public function availabilities(): HasMany { return $this->hasMany(Availability::class); }
    public function shiftRule(): HasOne { return $this->hasOne(ShiftRule::class); }
    public function shiftGenerationSetting(): HasOne { return $this->hasOne(ShiftGenerationSetting::class); }
    public function shifts(): HasMany { return $this->hasMany(Shift::class); }
}
