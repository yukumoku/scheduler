<?php

namespace App\Models;

use App\Enums\TeamMemberRole;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TeamMember extends Model
{
    use HasFactory;

    protected $fillable = ['team_id', 'user_id', 'role', 'joined_at'];

    protected $casts = [
        'joined_at' => 'datetime',
        'role' => TeamMemberRole::class,
    ];

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
