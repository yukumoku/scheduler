<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Team extends Model
{
    use HasFactory;

    protected $fillable = ['group_id', 'event_id', 'is_default', 'name', 'description', 'color'];

    protected $casts = [
        'is_default' => 'boolean',
    ];

    public function group(): BelongsTo
    {
        return $this->belongsTo(Group::class);
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(Event::class);
    }

    public function members(): HasMany
    {
        return $this->hasMany(TeamMember::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(Event::class);
    }

    public function slots(): HasMany
    {
        return $this->hasMany(EventSlot::class);
    }
}
