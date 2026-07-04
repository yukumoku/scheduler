<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('event_tasks', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('event_id')->constrained('events')->cascadeOnDelete();
            $table->foreignUuid('team_id')->nullable()->constrained('teams')->nullOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('required_role')->nullable();
            $table->boolean('allow_cross_team_help')->default(false);
            $table->string('color', 32)->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestampsTz();
            $table->index(['event_id', 'sort_order']);
            $table->index(['team_id', 'name']);
        });

        Schema::table('event_slots', function (Blueprint $table) {
            $table->dropUnique('event_slots_event_id_date_start_time_end_time_unique');
            $table->foreignUuid('task_id')->nullable()->after('event_id')->constrained('event_tasks')->nullOnDelete();
            $table->dateTimeTz('start_datetime')->nullable()->after('task_id');
            $table->dateTimeTz('end_datetime')->nullable()->after('start_datetime');
            $table->enum('status', ['draft', 'open', 'closed'])->default('open')->after('end_datetime');
            $table->index(['task_id', 'status']);
            $table->unique(['task_id', 'date', 'start_time', 'end_time']);
        });

        DB::table('event_slots')->orderBy('id')->get()->each(function ($slot): void {
            $date = $slot->date ? \Illuminate\Support\Carbon::parse($slot->date) : null;
            $startTime = $slot->start_time ? (string) $slot->start_time : null;
            $endTime = $slot->end_time ? (string) $slot->end_time : null;

            DB::table('event_slots')
                ->where('id', $slot->id)
                ->update([
                    'start_datetime' => $date && $startTime ? $date->copy()->setTimeFromTimeString($startTime) : null,
                    'end_datetime' => $date && $endTime ? $date->copy()->setTimeFromTimeString($endTime) : null,
                    'status' => 'open',
                ]);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("alter table event_tasks add constraint event_tasks_required_role_check check (required_role is null or required_role in ('leader', 'member'))");
            DB::statement("alter table event_tasks add constraint event_tasks_sort_order_check check (sort_order >= 0)");
            DB::statement("alter table event_slots add constraint event_slots_task_time_check check (start_datetime is null or end_datetime is null or start_datetime < end_datetime)");

            $hasStatusCheck = DB::selectOne(
                "select exists (
                    select 1
                    from pg_constraint c
                    join pg_class r on r.oid = c.conrelid
                    join pg_namespace n on n.oid = r.relnamespace
                    where r.relname = 'event_slots'
                      and c.conname = 'event_slots_status_check'
                      and n.nspname = current_schema()
                ) as exists",
            );

            if (! ($hasStatusCheck->exists ?? false)) {
                DB::statement("alter table event_slots add constraint event_slots_status_check check (status in ('draft', 'open', 'closed'))");
            }
        }

        Schema::table('event_slots', function (Blueprint $table) {
            $table->dropConstrainedForeignId('team_id');
            $table->dropColumn('allow_cross_team_help');
        });
    }

    public function down(): void
    {
        Schema::table('event_slots', function (Blueprint $table) {
            $table->foreignUuid('team_id')->nullable()->after('event_id')->constrained('teams')->nullOnDelete();
            $table->boolean('allow_cross_team_help')->default(false)->after('team_id');
        });

        Schema::table('event_slots', function (Blueprint $table) {
            $table->dropConstrainedForeignId('task_id');
            $table->dropColumn(['start_datetime', 'end_datetime', 'status']);
        });

        Schema::dropIfExists('event_tasks');
    }
};
