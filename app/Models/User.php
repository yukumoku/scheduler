<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasUuids, Notifiable;

    protected $fillable = [
        'display_name',
        'email',
        'avatar_url',
        'provider',
        'provider_id',
        'tutorial_completed_at',
    ];

    protected $hidden = [
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'tutorial_completed_at' => 'datetime',
        ];
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(GroupMember::class);
    }

    public function teamMemberships(): HasMany
    {
        return $this->hasMany(TeamMember::class);
    }

    public function ownedGroups(): HasMany
    {
        return $this->hasMany(Group::class, 'owner_id');
    }

    public function createdEvents(): HasMany
    {
        return $this->hasMany(Event::class, 'created_by');
    }

    public function availabilities(): HasMany
    {
        return $this->hasMany(Availability::class);
    }

    public function shiftAssignments(): HasMany
    {
        return $this->hasMany(ShiftAssignment::class);
    }

    public function invitationsSent(): HasMany
    {
        return $this->hasMany(Invitation::class, 'invited_by');
    }
}
