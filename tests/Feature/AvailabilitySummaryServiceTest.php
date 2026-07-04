<?php

namespace Tests\Feature;

use App\Enums\AvailabilityStatus;
use App\Models\CommonAvailability;
use App\Models\CommonAvailabilitySet;
use App\Models\Event;
use App\Models\EventSlot;
use App\Models\User;
use App\Services\AvailabilitySummaryService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Tests\TestCase;

class AvailabilitySummaryServiceTest extends TestCase
{
    public function test_common_availability_summary_is_aggregated_in_one_place(): void
    {
        $service = app(AvailabilitySummaryService::class);
        $set = $this->makeCommonAvailabilitySet();
        $members = $this->makeMembers([
            ['id' => 'member-a', 'user_id' => 'user-a', 'display_name' => 'A'],
            ['id' => 'member-b', 'user_id' => 'user-b', 'display_name' => 'B'],
        ]);
        $slots = collect([
            $this->makeCommonSlot($set->id, '2026-07-20', '09:00', '12:00'),
        ]);
        $availabilities = collect([
            $this->makeCommonAvailability($set->id, 'user-a', '2026-07-20', '09:00:00', '12:00:00', AvailabilityStatus::Preferred),
        ]);

        $me = $service->buildCommonAvailabilityMePayload($set, $this->makeUser('user-a'), $slots, $availabilities, 1);
        $summary = $service->buildCommonAvailabilitySubmissionsPayload($set, $members, $availabilities, $slots);

        $this->assertSame($set->id, $me['set']['id']);
        $this->assertCount(1, $me['slots']);
        $this->assertSame(AvailabilityStatus::Preferred->value, $me['slots'][0]['availabilityStatus']);

        $this->assertSame(2, $summary['summary']['totalMembers']);
        $this->assertSame(1, $summary['summary']['submittedMembers']);
        $this->assertSame(50.0, $summary['summary']['submissionRate']);
        $this->assertSame(1, $summary['summary']['totalSlots']);
        $this->assertSame(0, $summary['summary']['insufficientSlots']);
        $this->assertCount(2, $summary['members']);
    }

    public function test_event_availability_summary_still_works_for_legacy_routes(): void
    {
        $service = app(AvailabilitySummaryService::class);
        $event = $this->makeEvent();
        $members = $this->makeMembers([
            ['id' => 'member-a', 'user_id' => 'user-a', 'display_name' => 'A'],
        ]);
        $slot = $this->makeEventSlot($event->id, Carbon::parse('2026-07-20'), '09:00:00', '12:00:00', 1);
        $slots = collect([$slot]);
        $availabilities = collect([
            $this->makeEventAvailability($event->id, 'user-a', '2026-07-20', '09:00:00', '12:00:00', AvailabilityStatus::Available),
        ]);

        $summary = $service->buildEventAvailabilitySummaryPayload($event, $members, $slots, $availabilities);
        $me = $service->buildEventAvailabilityMePayload($event, $this->makeUser('user-a'), $slots, $availabilities);

        $this->assertSame(1, $summary['summary']['totalMembers']);
        $this->assertSame(1, $summary['summary']['submittedMembers']);
        $this->assertSame(100.0, $summary['summary']['submissionRate']);
        $this->assertCount(1, $summary['slots']);
        $this->assertSame(AvailabilityStatus::Available->value, $me['slots'][0]['availabilityStatus']);
    }

    private function makeCommonAvailabilitySet(): CommonAvailabilitySet
    {
        $set = new CommonAvailabilitySet();
        $set->id = 'set-1';
        $set->group_id = 'group-1';
        $set->name = '夏休み期間の参加可能日時';
        $set->description = null;
        $set->starts_at = Carbon::parse('2026-07-20');
        $set->ends_at = Carbon::parse('2026-07-20');
        $set->deadline = Carbon::parse('2026-07-19');

        return $set;
    }

    /**
     * @param array<int, array{id: string, user_id: string, display_name: string}> $members
     */
    private function makeMembers(array $members): Collection
    {
        return collect(array_map(function (array $member): object {
            return (object) [
                'id' => $member['id'],
                'user_id' => $member['user_id'],
                'user' => (object) [
                    'display_name' => $member['display_name'],
                    'email' => $member['display_name'].'@example.com',
                    'avatar_url' => null,
                ],
            ];
        }, $members));
    }

    private function makeUser(string $userId): User
    {
        $user = new User();
        $user->id = $userId;
        $user->display_name = 'A';
        $user->email = 'a@example.com';
        $user->avatar_url = null;

        return $user;
    }

    private function makeCommonSlot(string $setId, string $date, string $startTime, string $endTime): array
    {
        return [
            'commonAvailabilitySetId' => $setId,
            'userId' => null,
            'date' => $date,
            'startTime' => $startTime,
            'endTime' => $endTime,
            'requiredPeople' => 1,
            'location' => null,
            'note' => null,
        ];
    }

    private function makeCommonAvailability(string $setId, string $userId, string $date, string $startTime, string $endTime, AvailabilityStatus $status): object
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

    private function makeEvent(): Event
    {
        $event = new Event();
        $event->id = 'event-1';
        $event->group_id = 'group-1';

        return $event;
    }

    private function makeEventSlot(string $eventId, Carbon $date, string $startTime, string $endTime, int $requiredPeople): object
    {
        return (object) [
            'id' => 'slot-1',
            'event_id' => $eventId,
            'date' => $date,
            'start_time' => $startTime,
            'end_time' => $endTime,
            'required_people' => $requiredPeople,
            'location' => null,
            'note' => null,
        ];
    }

    private function makeEventAvailability(string $eventId, string $userId, string $date, string $startTime, string $endTime, AvailabilityStatus $status): object
    {
        return (object) [
            'event_id' => $eventId,
            'user_id' => $userId,
            'date' => Carbon::parse($date),
            'start_time' => $startTime,
            'end_time' => $endTime,
            'status' => $status,
            'comment' => null,
        ];
    }
}
