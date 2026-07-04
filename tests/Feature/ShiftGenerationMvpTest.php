<?php

namespace Tests\Feature;

use App\Enums\ShiftStatus;
use App\Http\Controllers\Api\ShiftController;
use App\Http\Requests\ShiftGenerateRequest;
use App\Http\Resources\ShiftResource;
use App\Models\EventSlot;
use App\Models\Event;
use App\Models\Shift;
use App\Services\ShiftGenerationService;
use Illuminate\Support\Carbon;
use Illuminate\Foundation\Auth\User as AuthenticatableUser;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Mockery;
use Tests\TestCase;

class ShiftGenerationMvpTest extends TestCase
{
    public function test_common_availability_time_range_can_cover_a_shorter_slot(): void
    {
        $slot = new EventSlot();
        $slot->date = Carbon::parse('2026-07-20');
        $slot->start_time = '09:00';
        $slot->end_time = '12:00';

        $availability = new class {
            public Carbon $date;
            public string $start_time = '09:00';
            public string $end_time = '18:00';

            public function __construct()
            {
                $this->date = Carbon::parse('2026-07-20');
            }
        };

        $method = new \ReflectionMethod(ShiftGenerationService::class, 'availabilityCoversSlot');
        $method->setAccessible(true);

        $this->assertTrue($method->invoke(new ShiftGenerationService(), $availability, $slot));
    }

    public function test_shift_generate_request_has_expected_rules(): void
    {
        $request = new ShiftGenerateRequest();

        $this->assertSame([], $request->rules());
        $this->assertTrue($request->authorize());
    }

    public function test_shift_resource_matches_frontend_shape(): void
    {
        $shift = new Shift();
        $shift->id = 'shift-1';
        $shift->event_id = 'event-1';
        $shift->event_slot_id = null;
        $shift->status = ShiftStatus::Generated;
        $shift->generated_at = now();
        $shift->published_at = null;
        $shift->setRelation('event', (object) [
            'id' => 'event-1',
            'name' => '文化祭',
            'group_id' => 'group-1',
            'common_availability_set_id' => 'set-1',
        ]);
        $shift->setRelation('assignments', new Collection());

        $resource = (new ShiftResource($shift))->toArray(request());

        $this->assertSame('shift-1', $resource['id']);
        $this->assertSame('event-1', $resource['eventId']);
        $this->assertSame('generated', $resource['status']);
        $this->assertSame('group-1', $resource['event']['groupId']);
        $this->assertNotNull($resource['assignments']);
    }

    public function test_shift_controller_wraps_generation_result_and_list_response(): void
    {
        $generatedShift = new Shift();
        $generatedShift->id = 'shift-1';
        $generatedShift->event_id = 'event-1';
        $generatedShift->event_slot_id = null;
        $generatedShift->status = ShiftStatus::Generated;
        $generatedShift->generated_at = now();
        $generatedShift->published_at = null;
        $generatedShift->setRelation('event', (object) [
            'id' => 'event-1',
            'name' => '文化祭',
            'group_id' => 'group-1',
            'common_availability_set_id' => 'set-1',
        ]);
        $generatedShift->setRelation('assignments', new Collection());

        $service = Mockery::mock(ShiftGenerationService::class);
        $service->shouldReceive('generate')
            ->once()
            ->andReturn([
                'shift' => $generatedShift,
                'warnings' => [
                    [
                        'slotId' => 'slot-1',
                        'taskId' => 'task-1',
                        'date' => '2026-07-20',
                        'startTime' => '09:00',
                        'endTime' => '12:00',
                        'requiredPeople' => 2,
                        'assignedPeople' => 1,
                        'missingPeople' => 1,
                        'message' => '必要人数に満たない時間枠があります。',
                    ],
                ],
                'metrics' => [
                    'totalSlots' => 1,
                    'requiredPeopleTotal' => 2,
                    'assignedPeopleTotal' => 1,
                    'fillRate' => 50.0,
                    'preferredAssignments' => 1,
                    'availableAssignments' => 1,
                    'preferenceReflectionRate' => 100.0,
                    'memberWorkload' => [],
                ],
            ]);

        $controller = new ShiftController($service);
        $shiftList = collect([
            tap(new Shift(), function (Shift $shift): void {
                $shift->id = 'shift-1';
                $shift->event_id = 'event-1';
                $shift->event_slot_id = null;
                $shift->status = ShiftStatus::Generated;
                $shift->generated_at = now();
                $shift->published_at = null;
                $shift->setRelation('event', (object) [
                    'id' => 'event-1',
                    'name' => '文化祭',
                    'group_id' => 'group-1',
                    'common_availability_set_id' => 'set-1',
                ]);
                $shift->setRelation('assignments', new Collection());
            }),
        ]);
        $event = Mockery::mock(Event::class);
        $event->shouldReceive('shifts->with->latest->latest->get')->andReturn($shiftList);

        $request = Mockery::mock(ShiftGenerateRequest::class);
        $request->shouldReceive('validated')->andReturn([]);
        $request->shouldReceive('user')->andReturn(new class extends AuthenticatableUser {});

        $generateResponse = $controller->generate($request, $event);

        $this->assertSame(201, $generateResponse->getStatusCode());
        $this->assertSame('shift-1', $generateResponse->getData(true)['data']['shift']['id']);
        $this->assertEquals(50.0, $generateResponse->getData(true)['data']['metrics']['fillRate']);

        $indexResponse = $controller->index($event);
        $this->assertSame(200, $indexResponse->getStatusCode());
        $this->assertSame('shift-1', $indexResponse->getData(true)['data'][0]['id']);

        $generatedShift = Mockery::mock(Shift::class)->makePartial();
        $generatedShift->id = 'shift-1';
        $generatedShift->event_id = 'event-1';
        $generatedShift->event_slot_id = null;
        $generatedShift->status = ShiftStatus::Generated;
        $generatedShift->generated_at = now();
        $generatedShift->published_at = null;
        $generatedShift->setRelation('event', (object) [
            'id' => 'event-1',
            'name' => '文化祭',
            'group_id' => 'group-1',
            'common_availability_set_id' => 'set-1',
        ]);
        $generatedShift->setRelation('assignments', new Collection());
        $generatedShift->shouldReceive('load')->andReturnSelf();

        $showResponse = $controller->show($generatedShift);
        $this->assertSame(200, $showResponse->getStatusCode());
        $this->assertSame('shift-1', $showResponse->getData(true)['data']['id']);
    }

}
