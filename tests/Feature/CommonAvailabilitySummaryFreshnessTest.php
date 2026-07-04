<?php

namespace Tests\Feature;

use App\Enums\AvailabilityStatus;
use App\Models\CommonAvailability;
use App\Models\CommonAvailabilitySet;
use App\Services\AvailabilitySummaryService;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class CommonAvailabilitySummaryFreshnessTest extends TestCase
{
    public function test_common_availability_summary_updates_when_new_members_join_and_submit(): void
    {
        $service = app(AvailabilitySummaryService::class);
        $set = $this->makeSet();

        $owner = $this->makeMemberRow('member-owner', 'user-owner', 'オーナー');
        $memberA = $this->makeMemberRow('member-a', 'user-a', '先に参加した人');
        $memberB = $this->makeMemberRow('member-b', 'user-b', 'あとから参加した人');

        $slots = collect([
            $this->makeSlot('2026-07-20', '09:00', '12:00'),
        ]);

        $availabilitiesBefore = collect([
            $this->makeAvailability($set->id, 'user-a', '2026-07-20', '09:00:00', '12:00:00', AvailabilityStatus::Available),
        ]);

        $summaryBefore = $service->buildCommonAvailabilitySubmissionsPayload($set, collect([$owner, $memberA]), $availabilitiesBefore, $slots);

        $this->assertSame(2, $summaryBefore['summary']['totalMembers']);
        $this->assertSame(1, $summaryBefore['summary']['submittedMembers']);
        $this->assertSame(50.0, $summaryBefore['summary']['submissionRate']);
        $this->assertSame(0, $summaryBefore['summary']['insufficientSlots']);

        $availabilitiesAfter = collect([
            $this->makeAvailability($set->id, 'user-a', '2026-07-20', '09:00:00', '12:00:00', AvailabilityStatus::Available),
            $this->makeAvailability($set->id, 'user-b', '2026-07-20', '09:00:00', '12:00:00', AvailabilityStatus::Preferred),
        ]);

        $summaryAfter = $service->buildCommonAvailabilitySubmissionsPayload($set, collect([$owner, $memberA, $memberB]), $availabilitiesAfter, $slots);

        $this->assertSame(3, $summaryAfter['summary']['totalMembers']);
        $this->assertSame(2, $summaryAfter['summary']['submittedMembers']);
        $this->assertSame(66.7, $summaryAfter['summary']['submissionRate']);
        $this->assertSame(0, $summaryAfter['summary']['insufficientSlots']);
        $this->assertSame(2, $summaryAfter['slots'][0]['availablePeople']);
    }

    private function makeSet(): CommonAvailabilitySet
    {
        $set = new CommonAvailabilitySet();
        $set->id = 'set-1';
        $set->group_id = 'group-1';
        $set->name = '夏休みの参加可能日時';
        $set->description = null;
        $set->starts_at = '2026-07-20';
        $set->ends_at = '2026-07-20';
        $set->deadline = '2026-07-19';

        return $set;
    }

    private function makeMemberRow(string $id, string $userId, string $displayName): object
    {
        return (object) [
            'id' => $id,
            'user_id' => $userId,
            'user' => (object) [
                'display_name' => $displayName,
                'email' => $displayName.'@example.com',
                'avatar_url' => null,
            ],
        ];
    }

    private function makeSlot(string $date, string $startTime, string $endTime): array
    {
        return [
            'commonAvailabilitySetId' => 'set-1',
            'userId' => null,
            'date' => $date,
            'startTime' => $startTime,
            'endTime' => $endTime,
            'requiredPeople' => 1,
            'location' => null,
            'note' => null,
        ];
    }

    private function makeAvailability(string $setId, string $userId, string $date, string $startTime, string $endTime, AvailabilityStatus $status): CommonAvailability
    {
        $availability = new CommonAvailability();
        $availability->common_availability_set_id = $setId;
        $availability->user_id = $userId;
        $availability->date = Carbon::parse($date);
        $availability->start_time = $startTime;
        $availability->end_time = $endTime;
        $availability->status = $status;
        $availability->comment = null;

        return $availability;
    }
}
