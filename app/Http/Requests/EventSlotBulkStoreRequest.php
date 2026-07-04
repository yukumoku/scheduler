<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class EventSlotBulkStoreRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $weekdayMap = [
            'sun' => 0,
            'mon' => 1,
            'tue' => 2,
            'wed' => 3,
            'thu' => 4,
            'fri' => 5,
            'sat' => 6,
        ];

        $this->merge([
            'weekdays' => collect($this->input('weekdays', []))
                ->map(function ($weekday) use ($weekdayMap) {
                    $value = strtolower((string) $weekday);

                    if (is_numeric($value)) {
                        return (int) $value;
                    }

                    return $weekdayMap[$value] ?? $weekday;
                })
                ->all(),
        ]);
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'startDate' => ['required', 'date'],
            'endDate' => ['required', 'date', 'after_or_equal:startDate'],
            'weekdays' => ['required', 'array', 'min:1'],
            'weekdays.*' => ['required', 'integer', 'between:0,6'],
            'timeBlocks' => ['required', 'array', 'min:1'],
            'timeBlocks.*.startTime' => ['required', 'date_format:H:i'],
            'timeBlocks.*.endTime' => ['required', 'date_format:H:i'],
            'timeBlocks.*.requiredPeople' => ['required', 'integer', 'min:1', 'max:999'],
            'timeBlocks.*.location' => ['nullable', 'string', 'max:255'],
            'timeBlocks.*.note' => ['nullable', 'string', 'max:2000'],
            'excludedDates' => ['nullable', 'array'],
            'excludedDates.*' => ['required', 'date'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            if ($this->filled('startDate') && $this->filled('endDate') && $this->input('startDate') > $this->input('endDate')) {
                $validator->errors()->add('endDate', '終了日は開始日以降を指定してください。');
            }

            foreach ((array) $this->input('timeBlocks', []) as $index => $timeBlock) {
                $startTime = $timeBlock['startTime'] ?? null;
                $endTime = $timeBlock['endTime'] ?? null;

                if ($startTime && $endTime && strcmp($startTime, $endTime) >= 0) {
                    $validator->errors()->add("timeBlocks.$index.endTime", '終了時刻は開始時刻より後にしてください。');
                }

                $requiredPeople = $timeBlock['requiredPeople'] ?? null;
                if ($requiredPeople !== null && (int) $requiredPeople < 1) {
                    $validator->errors()->add("timeBlocks.$index.requiredPeople", '必要人数は1以上で入力してください。');
                }
            }
        });
    }
}
