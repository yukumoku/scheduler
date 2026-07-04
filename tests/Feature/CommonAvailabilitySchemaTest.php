<?php

namespace Tests\Feature;

use App\Models\CommonAvailability;
use App\Models\CommonAvailabilitySet;
use Tests\TestCase;

class CommonAvailabilitySchemaTest extends TestCase
{
    public function test_common_availability_set_contains_expected_fields(): void
    {
        $set = new CommonAvailabilitySet();

        $this->assertContains('group_id', $set->getFillable());
        $this->assertContains('event_id', $set->getFillable());
        $this->assertContains('name', $set->getFillable());
        $this->assertContains('description', $set->getFillable());
        $this->assertContains('starts_at', $set->getFillable());
        $this->assertContains('ends_at', $set->getFillable());
        $this->assertContains('deadline', $set->getFillable());
        $this->assertTrue(method_exists($set, 'group'));
        $this->assertTrue(method_exists($set, 'event'));
        $this->assertTrue(method_exists($set, 'availabilities'));
    }

    public function test_common_availability_contains_expected_fields(): void
    {
        $availability = new CommonAvailability();

        $this->assertContains('common_availability_set_id', $availability->getFillable());
        $this->assertContains('user_id', $availability->getFillable());
        $this->assertContains('date', $availability->getFillable());
        $this->assertContains('start_time', $availability->getFillable());
        $this->assertContains('end_time', $availability->getFillable());
        $this->assertContains('status', $availability->getFillable());
        $this->assertContains('comment', $availability->getFillable());
        $this->assertTrue(method_exists($availability, 'commonAvailabilitySet'));
        $this->assertTrue(method_exists($availability, 'user'));
    }
}
