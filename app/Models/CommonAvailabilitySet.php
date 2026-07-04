<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CommonAvailabilitySet extends Model
{
    use HasFactory;

    protected $fillable = ['group_id', 'event_id', 'name', 'description', 'starts_at', 'ends_at', 'deadline'];

    protected $casts = [
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'deadline' => 'datetime',
    ];

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function availabilities(): HasMany
    {
        return $this->hasMany(CommonAvailability::class, 'common_availability_set_id');
    }
}
