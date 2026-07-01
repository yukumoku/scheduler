<?php

namespace App\Models;

use App\Enums\AvailabilityStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Availability extends Model
{
    use HasFactory;

    protected $table = 'availability';

    protected $fillable = ['event_id', 'user_id', 'date', 'start_time', 'end_time', 'status', 'comment'];

    protected $casts = [
        'date' => 'date',
        'status' => AvailabilityStatus::class,
    ];

    public function event(): BelongsTo { return $this->belongsTo(Event::class); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
