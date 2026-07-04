<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Group extends Model
{
    use HasFactory;

    protected $fillable = ['name', 'description', 'icon_url', 'owner_id', 'invite_code', 'is_invite_enabled'];

    protected $casts = [
        'is_invite_enabled' => 'boolean',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function members(): HasMany
    {
        return $this->hasMany(GroupMember::class);
    }

    public function teams(): HasMany
    {
        return $this->hasMany(Team::class);
    }

    public function commonAvailabilitySets(): HasMany
    {
        return $this->hasMany(CommonAvailabilitySet::class);
    }

    public function events(): HasMany
    {
        return $this->hasMany(Event::class);
    }

    public function invitations(): HasMany
    {
        return $this->hasMany(Invitation::class);
    }
}
