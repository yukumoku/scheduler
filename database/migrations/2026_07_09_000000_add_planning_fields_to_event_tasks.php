<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('event_tasks', function (Blueprint $table) {
            $table->decimal('desired_total_hours', 5, 2)->nullable()->after('description');
            $table->json('desired_periods')->nullable()->after('desired_total_hours');
            $table->index(['event_id', 'sort_order', 'desired_total_hours'], 'event_tasks_event_sort_hours_index');
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("alter table event_tasks add constraint event_tasks_desired_total_hours_check check (desired_total_hours is null or desired_total_hours >= 0)");
        }
    }

    public function down(): void
    {
        Schema::table('event_tasks', function (Blueprint $table) {
            $table->dropIndex('event_tasks_event_sort_hours_index');
            $table->dropColumn(['desired_total_hours', 'desired_periods']);
        });
    }
};
