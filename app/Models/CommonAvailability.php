<?php

namespace App\Models;

use App\Enums\AvailabilityStatus;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommonAvailability extends Model
{
    use HasFactory;

    protected $table = 'common_availability';

    protected $fillable = ['common_availability_set_id', 'user_id', 'date', 'start_time', 'end_time', 'status', 'comment'];

    protected $casts = [
        'date' => 'date',
        'status' => AvailabilityStatus::class,
    ];

    public function commonAvailabilitySet(): BelongsTo
    {
        return $this->belongsTo(CommonAvailabilitySet::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
