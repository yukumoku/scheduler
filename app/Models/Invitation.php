<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Invitation extends Model
{
    use HasFactory;

    protected $fillable = ['group_id', 'invited_email', 'invited_by', 'token', 'expires_at', 'accepted_at'];
    protected $casts = ['expires_at' => 'datetime', 'accepted_at' => 'datetime'];
    public function group(): BelongsTo { return $this->belongsTo(Group::class); }
    public function inviter(): BelongsTo { return $this->belongsTo(User::class, 'invited_by'); }
}
