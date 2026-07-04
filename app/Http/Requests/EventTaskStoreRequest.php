<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class EventTaskStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'desiredTotalHours' => ['nullable', 'numeric', 'gt:0'],
            'requiredPeoplePerSlot' => ['nullable', 'integer', 'min:1', 'max:999'],
            'workStartDate' => ['nullable', 'date'],
            'workEndDate' => ['nullable', 'date'],
            'desiredPeriods' => ['nullable', 'array'],
            'desiredPeriods.*.date' => ['required_with:desiredPeriods', 'date'],
            'desiredPeriods.*.startTime' => ['required_with:desiredPeriods', 'date_format:H:i'],
            'desiredPeriods.*.endTime' => ['required_with:desiredPeriods', 'date_format:H:i'],
            'desiredPeriods.*.requiredPeople' => ['required_with:desiredPeriods', 'integer', 'min:1', 'max:999'],
            'desiredPeriods.*.location' => ['nullable', 'string', 'max:255'],
            'desiredPeriods.*.note' => ['nullable', 'string', 'max:2000'],
            'requiredMemberIds' => ['nullable', 'array'],
            'requiredMemberIds.*' => ['uuid', 'exists:users,id'],
            'teamId' => ['nullable', 'uuid', 'exists:teams,id'],
            'allowCrossTeamHelp' => ['required', 'boolean'],
            'color' => ['nullable', 'string', 'max:32'],
            'sortOrder' => ['required', 'integer', 'min:0'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            foreach ((array) $this->input('desiredPeriods', []) as $index => $period) {
                $startTime = $period['startTime'] ?? null;
                $endTime = $period['endTime'] ?? null;

                if ($startTime && $endTime && strcmp($startTime, $endTime) >= 0) {
                    $validator->errors()->add("desiredPeriods.$index.endTime", '終了時刻は開始時刻より後にしてください。');
                }
            }

            $requiredMemberIds = array_filter((array) $this->input('requiredMemberIds', []));
            if (count($requiredMemberIds) !== count(array_unique($requiredMemberIds))) {
                $validator->errors()->add('requiredMemberIds', '同じメンバーは重複して選べません。');
            }

            $workStartDate = $this->input('workStartDate');
            $workEndDate = $this->input('workEndDate');
            if ($workStartDate && $workEndDate && $workStartDate > $workEndDate) {
                $validator->errors()->add('workEndDate', '終了日は開始日以降にしてください。');
            }
        });
    }
}
