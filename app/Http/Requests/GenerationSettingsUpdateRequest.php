<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class GenerationSettingsUpdateRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'preferenceWeight' => ['required', 'integer', 'min:0', 'max:100'],
            'fairnessWeight' => ['required', 'integer', 'min:0', 'max:100'],
            'balanceWorkloadWeight' => ['required', 'integer', 'min:0', 'max:100'],
            'avoidContinuousWorkWeight' => ['required', 'integer', 'min:0', 'max:100'],
            'leaderAssignmentWeight' => ['required', 'integer', 'min:0', 'max:100'],
            'requiredPeopleWeight' => ['required', 'integer', 'min:0', 'max:100'],
        ];
    }
}
