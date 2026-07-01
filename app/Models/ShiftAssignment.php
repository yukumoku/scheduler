<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShiftAssignment extends Model
{
    use HasFactory;

    protected $fillable = ['shift_id', 'event_slot_id', 'user_id', 'is_leader'];
    protected $casts = ['is_leader' => 'boolean'];
    public function shift(): BelongsTo { return $this->belongsTo(Shift::class); }
    public function eventSlot(): BelongsTo { return $this->belongsTo(EventSlot::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
