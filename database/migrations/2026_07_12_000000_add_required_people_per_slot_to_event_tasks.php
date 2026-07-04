<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('event_tasks', function (Blueprint $table) {
            $table->unsignedInteger('required_people_per_slot')->default(1)->after('desired_total_hours');
            $table->index(['event_id', 'required_people_per_slot'], 'event_tasks_event_required_people_index');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('alter table event_tasks add constraint event_tasks_required_people_per_slot_check check (required_people_per_slot >= 1)');
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('alter table event_tasks drop constraint if exists event_tasks_required_people_per_slot_check');
        }

        Schema::table('event_tasks', function (Blueprint $table) {
            $table->dropIndex('event_tasks_event_required_people_index');
            $table->dropColumn('required_people_per_slot');
        });
    }
};
