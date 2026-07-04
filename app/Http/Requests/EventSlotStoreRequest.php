<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class EventSlotStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'taskId' => ['nullable', 'uuid', 'exists:event_tasks,id'],
            'date' => ['nullable', 'date'],
            'startTime' => ['nullable', 'date_format:H:i'],
            'endTime' => ['nullable', 'date_format:H:i'],
            'startDatetime' => ['nullable', 'date'],
            'endDatetime' => ['nullable', 'date'],
            'requiredPeople' => ['required', 'integer', 'min:1', 'max:999'],
            'status' => ['nullable', 'in:draft,open,closed'],
            'location' => ['nullable', 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:2000'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $hasLegacyFields = filled($this->input('date')) && filled($this->input('startTime')) && filled($this->input('endTime'));
            $hasDatetimeFields = filled($this->input('startDatetime')) && filled($this->input('endDatetime'));

            if (! $hasLegacyFields && ! $hasDatetimeFields) {
                $validator->errors()->add('startDatetime', '開始・終了日時、または日付と開始/終了時刻を入力してください。');
            }

            if ($hasLegacyFields && strcmp((string) $this->input('startTime'), (string) $this->input('endTime')) >= 0) {
                $validator->errors()->add('endTime', '終了時刻は開始時刻より後にしてください。');
            }
        });
    }
}
