<?php

namespace App\Models;

use App\Enums\ShiftStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Shift extends Model
{
    use HasFactory;

    protected $fillable = ['event_id', 'event_slot_id', 'status', 'generated_at', 'published_at'];
    protected $casts = [
        'generated_at' => 'datetime',
        'published_at' => 'datetime',
        'status' => ShiftStatus::class,
    ];
    public function event(): BelongsTo { return $this->belongsTo(Event::class); }
    public function eventSlot(): BelongsTo { return $this->belongsTo(EventSlot::class); }
    public function assignments(): HasMany { return $this->hasMany(ShiftAssignment::class); }
}
