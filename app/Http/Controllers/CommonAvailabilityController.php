<?php

namespace App\Http\Controllers;

use App\Models\CommonAvailability;
use App\Models\CommonAvailabilitySet;
use App\Services\AvailabilitySummaryService;
use Illuminate\Support\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CommonAvailabilityController extends Controller
{
    public function __construct(private readonly AvailabilitySummaryService $availabilitySummaryService)
    {
    }

    public function me(Request $request, CommonAvailabilitySet $set): JsonResponse
    {
        $this->requireCommonAvailabilityMember($request, $set);

        $slots = $this->availabilitySummaryService->buildCommonAvailabilitySlots($set);
        $availabilities = $set->availabilities()
            ->where('user_id', $request->user()->id)
            ->get();
        $availabilityCount = $set->availabilities()->count();

        return response()->json([
            'success' => true,
            'data' => $this->availabilitySummaryService->buildCommonAvailabilityMePayload($set, $request->user(), $slots, $availabilities, $availabilityCount),
            'error' => null,
        ]);
    }

    public function updateMe(Request $request, CommonAvailabilitySet $set): JsonResponse
    {
        $this->requireCommonAvailabilityMember($request, $set);

        $validated = $request->validate([
            'availabilities' => ['required', 'array'],
            'availabilities.*.date' => ['required', 'date'],
            'availabilities.*.startTime' => ['required', 'date_format:H:i'],
            'availabilities.*.endTime' => ['required', 'date_format:H:i'],
            'availabilities.*.status' => ['required', 'in:available,preferred'],
            'availabilities.*.comment' => ['nullable', 'string', 'max:2000'],
        ]);

        $user = $request->user();
        $submittedKeys = [];
        $seenKeys = [];

        foreach ($validated['availabilities'] as $index => $availabilityInput) {
            if ($availabilityInput['startTime'] >= $availabilityInput['endTime']) {
                throw ValidationException::withMessages([
                    "availabilities.$index.endTime" => '終了時刻は開始時刻より後にしてください。',
                ]);
            }

            $activityWindow = $this->activityWindowForDate($set, $availabilityInput['date']);
            if (! $activityWindow) {
                throw ValidationException::withMessages([
                    "availabilities.$index.date" => 'この日は参加確認の対象外です。',
                ]);
            }

            if ($availabilityInput['startTime'] < $activityWindow['startTime'] || $availabilityInput['endTime'] > $activityWindow['endTime']) {
                throw ValidationException::withMessages([
                    "availabilities.$index.startTime" => "入力できるのは {$activityWindow['startTime']} - {$activityWindow['endTime']} の間です。",
                ]);
            }

            $submittedKey = $availabilityInput['date'].'|'.$availabilityInput['startTime'].'|'.$availabilityInput['endTime'];
            $submittedKeys[] = $submittedKey;
            if (in_array($submittedKey, $seenKeys, true)) {
                throw ValidationException::withMessages([
                    "availabilities.$index.startTime" => '同じ時間帯が重複しています。',
                ]);
            }
            $seenKeys[] = $submittedKey;

            CommonAvailability::query()->updateOrCreate(
                [
                    'common_availability_set_id' => $set->id,
                    'user_id' => $user->id,
                    'date' => $availabilityInput['date'],
                    'start_time' => $availabilityInput['startTime'],
                    'end_time' => $availabilityInput['endTime'],
                ],
                [
                    'status' => $availabilityInput['status'],
                    'comment' => $availabilityInput['comment'] ?? null,
                ],
            );
        }

        $set->availabilities()
            ->where('user_id', $user->id)
            ->get()
            ->filter(function (CommonAvailability $availability) use ($submittedKeys) {
                $key = $availability->date?->toDateString().'|'.$this->normalizeTime($availability->start_time).'|'.$this->normalizeTime($availability->end_time);

                return ! in_array($key, $submittedKeys, true);
            })
            ->each->delete();

        $members = $set->group->members()->with('user')->orderBy('joined_at')->get();
        $slots = $this->availabilitySummaryService->buildCommonAvailabilitySlots($set);
        $availabilities = $set->availabilities()->with('user')->get();
        $summary = $this->availabilitySummaryService->buildCommonAvailabilitySubmissionsPayload($set, $members, $availabilities, $slots);

        return response()->json([
            'success' => true,
            'data' => [
                'saved' => true,
                'summary' => $summary['summary'],
            ],
            'error' => null,
        ]);
    }

    public function submissions(Request $request, CommonAvailabilitySet $set): JsonResponse
    {
        $this->requireCommonAvailabilityManager($request, $set);

        $availabilities = $set->availabilities()->with('user')->get();
        $members = $set->group->members()->with('user')->orderBy('joined_at')->get();
        $slots = $this->availabilitySummaryService->buildCommonAvailabilitySlots($set);

        return response()->json([
            'success' => true,
            'data' => $this->availabilitySummaryService->buildCommonAvailabilitySubmissionsPayload($set, $members, $availabilities, $slots),
            'error' => null,
        ]);
    }

    private function normalizeTime(mixed $time): ?string
    {
        if ($time === null) {
            return null;
        }

        $time = (string) $time;

        return strlen($time) >= 5 ? substr($time, 0, 5) : $time;
    }

    /**
     * @return array{startTime: string, endTime: string}|null
     */
    private function activityWindowForDate(CommonAvailabilitySet $set, string $date): ?array
    {
        $dateString = Carbon::parse($date)->toDateString();
        if ($set->starts_at && $dateString < $set->starts_at->toDateString()) {
            return null;
        }
        if ($set->ends_at && $dateString > $set->ends_at->toDateString()) {
            return null;
        }

        $rules = is_array($set->activity_rules) ? $set->activity_rules : [];
        $excludedDates = collect($rules['excludedDates'] ?? [])
            ->filter(fn ($item) => is_string($item) && $item !== '')
            ->map(fn (string $item) => Carbon::parse($item)->toDateString())
            ->all();
        if (in_array($dateString, $excludedDates, true)) {
            return null;
        }

        $specialDate = collect($rules['specialDates'] ?? [])
            ->first(fn ($item) => is_array($item) && ($item['date'] ?? null) && Carbon::parse($item['date'])->toDateString() === $dateString);
        if (is_array($specialDate) && ! empty($specialDate['startTime']) && ! empty($specialDate['endTime'])) {
            $startTime = $this->normalizeTime($specialDate['startTime']);
            $endTime = $this->normalizeTime($specialDate['endTime']);

            return $startTime && $endTime && $startTime < $endTime
                ? ['startTime' => $startTime, 'endTime' => $endTime]
                : null;
        }

        $weekly = is_array($rules['weekly'] ?? null) ? $rules['weekly'] : [];
        $weekdayRule = $weekly[strtolower(Carbon::parse($dateString)->format('D'))] ?? null;
        if (($weekdayRule['enabled'] ?? true) === false) {
            return null;
        }

        $startTime = $this->normalizeTime($weekdayRule['startTime'] ?? '09:00');
        $endTime = $this->normalizeTime($weekdayRule['endTime'] ?? '12:00');

        return $startTime && $endTime && $startTime < $endTime
            ? ['startTime' => $startTime, 'endTime' => $endTime]
            : null;
    }

}
