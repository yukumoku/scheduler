<?php

namespace Tests\Feature;

use App\Http\Requests\EventTaskStoreRequest;
use App\Http\Requests\EventTaskUpdateRequest;
use App\Http\Resources\EventTaskResource;
use App\Models\EventTask;
use App\Models\Team;
use App\Models\TeamMember;
use App\Enums\TeamMemberRole;
use Illuminate\Support\Collection;
use Tests\TestCase;

class EventTaskManagementSchemaTest extends TestCase
{
    public function test_event_task_model_contains_expected_fillable_and_relations(): void
    {
        $task = new EventTask();

        $this->assertContains('event_id', $task->getFillable());
        $this->assertContains('team_id', $task->getFillable());
        $this->assertContains('name', $task->getFillable());
        $this->assertContains('description', $task->getFillable());
        $this->assertContains('desired_total_hours', $task->getFillable());
        $this->assertContains('required_people_per_slot', $task->getFillable());
        $this->assertContains('work_start_date', $task->getFillable());
        $this->assertContains('work_end_date', $task->getFillable());
        $this->assertContains('desired_periods', $task->getFillable());
        $this->assertContains('required_member_ids', $task->getFillable());
        $this->assertContains('allow_cross_team_help', $task->getFillable());
        $this->assertTrue(method_exists($task, 'event'));
        $this->assertTrue(method_exists($task, 'team'));
        $this->assertTrue(method_exists($task, 'slots'));
    }

    public function test_event_task_resource_matches_frontend_shape(): void
    {
        $task = new EventTask();
        $task->id = 'task-1';
        $task->event_id = 'event-1';
        $task->team_id = 'team-1';
        $task->name = '受付';
        $task->description = '来場者対応';
        $task->desired_total_hours = 6;
        $task->required_people_per_slot = 2;
        $task->work_start_date = '2026-07-20';
        $task->work_end_date = '2026-07-28';
        $task->desired_periods = [
            [
                'date' => '2026-07-20',
                'startTime' => '09:00',
                'endTime' => '12:00',
                'requiredPeople' => 2,
                'location' => '正門',
                'note' => null,
            ],
        ];
        $task->required_member_ids = ['user-1', 'user-2'];
        $task->required_role = null;
        $task->allow_cross_team_help = true;
        $task->color = '#7c3aed';
        $task->sort_order = 2;
        $task->setRelation('team', (object) [
            'id' => 'team-1',
            'name' => '受付班',
            'color' => '#7c3aed',
        ]);
        $task->slots_count = 0;

        $resource = (new EventTaskResource($task))->toArray(request());

        $this->assertSame('task-1', $resource['id']);
        $this->assertSame('event-1', $resource['eventId']);
        $this->assertSame('team-1', $resource['teamId']);
        $this->assertSame('受付', $resource['name']);
        $this->assertTrue($resource['allowCrossTeamHelp']);
        $this->assertSame('#7c3aed', $resource['color']);
        $this->assertSame(2, $resource['sortOrder']);
        $this->assertSame('受付班', $resource['team']['name']);
        $this->assertSame(6.0, $resource['desiredTotalHours']);
        $this->assertSame(2, $resource['requiredPeoplePerSlot']);
        $this->assertSame('2026-07-20', $resource['workStartDate']);
        $this->assertSame('2026-07-28', $resource['workEndDate']);
        $this->assertCount(1, $resource['desiredPeriods']);
        $this->assertSame(['user-1', 'user-2'], $resource['requiredMemberIds']);
    }

    public function test_event_task_requests_validate_expected_fields(): void
    {
        $storeRules = (new EventTaskStoreRequest())->rules();
        $updateRules = (new EventTaskUpdateRequest())->rules();

        foreach (['name', 'description', 'desiredTotalHours', 'requiredPeoplePerSlot', 'workStartDate', 'workEndDate', 'desiredPeriods', 'requiredMemberIds', 'teamId', 'allowCrossTeamHelp', 'color', 'sortOrder'] as $field) {
            $this->assertArrayHasKey($field, $storeRules);
            $this->assertArrayHasKey($field, $updateRules);
        }
    }
}
