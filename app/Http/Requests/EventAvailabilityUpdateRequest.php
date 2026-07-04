<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class EventAvailabilityUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'slots' => ['required', 'array', 'min:1'],
            'slots.*.slotId' => ['required', 'uuid'],
            'slots.*.status' => ['required', 'in:available,unavailable,preferred'],
            'slots.*.comment' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
