<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\GenerationSettingsUpdateRequest;
use App\Http\Requests\ShiftRuleUpdateRequest;
use App\Http\Resources\GenerationSettingsResource;
use App\Http\Resources\ShiftRuleResource;
use App\Models\Event;
use App\Models\ShiftGenerationSetting;
use App\Models\ShiftRule;
use Illuminate\Http\JsonResponse;

class ShiftSettingsController extends Controller
{
    public function show(Event $event): JsonResponse
    {
        $this->requireEventMember(request(), $event);

        return response()->json([
            'success' => true,
            'data' => [
                'shiftRule' => new ShiftRuleResource($this->resolveShiftRule($event)),
                'generationSetting' => new GenerationSettingsResource($this->resolveGenerationSetting($event)),
            ],
            'error' => null,
        ]);
    }

    public function shiftRule(Event $event): JsonResponse
    {
        $this->requireEventMember(request(), $event);
        $shiftRule = $this->resolveShiftRule($event);

        return response()->json([
            'success' => true,
            'data' => new ShiftRuleResource($shiftRule),
            'error' => null,
        ]);
    }

    public function updateShiftRule(ShiftRuleUpdateRequest $request, Event $event): JsonResponse
    {
        $this->requireEventManager($request, $event);
        $shiftRule = $event->shiftRule()->firstOrNew(['event_id' => $event->id]);
        $data = $request->validated();
        $shiftRule->fill([
            'event_id' => $event->id,
            'slot_minutes' => $data['slotMinutes'],
            'min_work_minutes' => $data['minWorkMinutes'],
            'max_work_minutes' => $data['maxWorkMinutes'],
            'max_continuous_minutes' => $data['maxContinuousMinutes'],
            'break_minutes' => $data['breakMinutes'],
            'leader_required_per_slot' => $data['leaderRequiredPerSlot'],
        ]);
        $shiftRule->save();

        return response()->json([
            'success' => true,
            'data' => new ShiftRuleResource($shiftRule->fresh()),
            'error' => null,
        ]);
    }

    public function generationSettings(Event $event): JsonResponse
    {
        $this->requireEventMember(request(), $event);
        $generationSetting = $this->resolveGenerationSetting($event);

        return response()->json([
            'success' => true,
            'data' => new GenerationSettingsResource($generationSetting),
            'error' => null,
        ]);
    }

    private function resolveShiftRule(Event $event): ShiftRule
    {
        return $event->shiftRule()->firstOrCreate(
            ['event_id' => $event->id],
            [
                'slot_minutes' => 60,
                'min_work_minutes' => 0,
                'max_work_minutes' => 0,
                'max_continuous_minutes' => 0,
                'break_minutes' => 0,
                'leader_required_per_slot' => 0,
            ],
        );
    }

    private function resolveGenerationSetting(Event $event): ShiftGenerationSetting
    {
        return $event->shiftGenerationSetting()->firstOrCreate(
            ['event_id' => $event->id],
            [
                'preference_weight' => 50,
                'fairness_weight' => 50,
                'balance_workload_weight' => 50,
                'avoid_continuous_work_weight' => 50,
                'leader_assignment_weight' => 50,
                'required_people_weight' => 50,
            ],
        );
    }

    public function updateGenerationSettings(GenerationSettingsUpdateRequest $request, Event $event): JsonResponse
    {
        $this->requireEventManager($request, $event);
        $generationSetting = $event->shiftGenerationSetting()->firstOrNew(['event_id' => $event->id]);
        $data = $request->validated();
        $generationSetting->fill([
            'event_id' => $event->id,
            'preference_weight' => $data['preferenceWeight'],
            'fairness_weight' => $data['fairnessWeight'],
            'balance_workload_weight' => $data['balanceWorkloadWeight'],
            'avoid_continuous_work_weight' => $data['avoidContinuousWorkWeight'],
            'leader_assignment_weight' => $data['leaderAssignmentWeight'],
            'required_people_weight' => $data['requiredPeopleWeight'],
        ]);
        $generationSetting->save();

        return response()->json([
            'success' => true,
            'data' => new GenerationSettingsResource($generationSetting->fresh()),
            'error' => null,
        ]);
    }
}
