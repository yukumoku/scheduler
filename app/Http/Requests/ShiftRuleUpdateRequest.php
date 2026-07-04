<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ShiftRuleUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'slotMinutes' => ['required', 'integer', 'min:15', 'max:1440'],
            'minWorkMinutes' => ['required', 'integer', 'min:0', 'max:1440'],
            'maxWorkMinutes' => ['required', 'integer', 'min:0', 'max:1440'],
            'maxContinuousMinutes' => ['required', 'integer', 'min:0', 'max:1440'],
            'breakMinutes' => ['required', 'integer', 'min:0', 'max:1440'],
            'leaderRequiredPerSlot' => ['required', 'integer', 'min:0', 'max:100'],
        ];
    }
}
