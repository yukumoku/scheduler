<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('alter table event_tasks drop constraint if exists event_tasks_required_people_per_slot_check');
        DB::statement('alter table event_tasks alter column required_people_per_slot drop not null');
        DB::statement('alter table event_tasks alter column required_people_per_slot drop default');
        DB::statement('alter table event_tasks add constraint event_tasks_required_people_per_slot_check check (required_people_per_slot is null or required_people_per_slot >= 1)');
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::statement('alter table event_tasks drop constraint if exists event_tasks_required_people_per_slot_check');
        DB::statement('update event_tasks set required_people_per_slot = 1 where required_people_per_slot is null');
        DB::statement('alter table event_tasks alter column required_people_per_slot set default 1');
        DB::statement('alter table event_tasks alter column required_people_per_slot set not null');
        DB::statement('alter table event_tasks add constraint event_tasks_required_people_per_slot_check check (required_people_per_slot >= 1)');
    }
};
