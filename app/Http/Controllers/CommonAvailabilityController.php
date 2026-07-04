<?php

namespace App\Http\Controllers;

use App\Models\CommonAvailability;
use App\Models\CommonAvailabilitySet;
use App\Services\AvailabilitySummaryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
            'availabilities.*.status' => ['required', 'in:available,unavailable,preferred'],
            'availabilities.*.comment' => ['nullable', 'string', 'max:2000'],
        ]);

        $user = $request->user();
        $submittedKeys = [];

        foreach ($validated['availabilities'] as $availabilityInput) {
            abort_if($availabilityInput['startTime'] >= $availabilityInput['endTime'], 422, '終了時刻は開始時刻より後にしてください。');

            $submittedKeys[] = $availabilityInput['date'].'|'.$availabilityInput['startTime'].'|'.$availabilityInput['endTime'];

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

}
