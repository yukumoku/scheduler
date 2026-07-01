<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('groups', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('icon_url')->nullable();
            $table->foreignUuid('owner_id')->constrained('users')->cascadeOnDelete();
            $table->string('invite_code', 32)->unique();
            $table->boolean('is_invite_enabled')->default(true);
            $table->timestampsTz();
            $table->index('owner_id');
        });

        Schema::create('group_members', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('group_id')->constrained('groups')->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('role', ['owner', 'admin', 'member'])->default('member');
            $table->timestampTz('joined_at')->nullable();
            $table->timestampsTz();
            $table->unique(['group_id', 'user_id']);
            $table->index(['group_id', 'role']);
        });

        Schema::create('events', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('group_id')->constrained('groups')->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('location')->nullable();
            $table->date('start_date');
            $table->date('end_date');
            $table->timestampTz('availability_deadline')->nullable();
            $table->enum('status', ['draft', 'collecting', 'generated', 'published', 'closed'])->default('draft');
            $table->foreignUuid('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestampsTz();
            $table->index(['group_id', 'status']);
            $table->index('created_by');
        });

        Schema::create('event_slots', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('event_id')->constrained('events')->cascadeOnDelete();
            $table->date('date');
            $table->time('start_time');
            $table->time('end_time');
            $table->unsignedInteger('required_people')->default(1);
            $table->string('location')->nullable();
            $table->text('note')->nullable();
            $table->timestampsTz();
            $table->index(['event_id', 'date']);
            $table->unique(['event_id', 'date', 'start_time', 'end_time']);
        });

        Schema::create('availability', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('event_id')->constrained('events')->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->date('date');
            $table->time('start_time')->nullable();
            $table->time('end_time')->nullable();
            $table->enum('status', ['available', 'unavailable', 'preferred'])->default('available');
            $table->text('comment')->nullable();
            $table->timestampsTz();
            $table->unique(['event_id', 'user_id', 'date', 'start_time', 'end_time']);
            $table->index(['event_id', 'user_id', 'date']);
        });

        Schema::create('shift_rules', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('event_id')->constrained('events')->cascadeOnDelete();
            $table->unsignedInteger('slot_minutes')->default(60);
            $table->unsignedInteger('min_work_minutes')->default(0);
            $table->unsignedInteger('max_work_minutes')->default(0);
            $table->unsignedInteger('max_continuous_minutes')->default(0);
            $table->unsignedInteger('break_minutes')->default(0);
            $table->unsignedInteger('leader_required_per_slot')->default(0);
            $table->timestampsTz();
            $table->unique('event_id');
            $table->index('event_id');
        });

        Schema::create('shift_generation_settings', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('event_id')->constrained('events')->cascadeOnDelete();
            $table->unsignedSmallInteger('preference_weight')->default(50);
            $table->unsignedSmallInteger('fairness_weight')->default(50);
            $table->unsignedSmallInteger('balance_workload_weight')->default(50);
            $table->unsignedSmallInteger('avoid_continuous_work_weight')->default(50);
            $table->unsignedSmallInteger('leader_assignment_weight')->default(50);
            $table->unsignedSmallInteger('required_people_weight')->default(50);
            $table->timestampsTz();
            $table->unique('event_id');
            $table->index('event_id');
        });

        Schema::create('shifts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('event_id')->constrained('events')->cascadeOnDelete();
            $table->enum('status', ['draft', 'generated', 'published', 'closed'])->default('draft');
            $table->timestampTz('generated_at')->nullable();
            $table->timestampTz('published_at')->nullable();
            $table->timestampsTz();
            $table->index(['event_id', 'status']);
        });

        Schema::create('shift_assignments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('shift_id')->constrained('shifts')->cascadeOnDelete();
            $table->foreignUuid('event_slot_id')->constrained('event_slots')->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->boolean('is_leader')->default(false);
            $table->timestampsTz();
            $table->unique(['shift_id', 'event_slot_id', 'user_id']);
            $table->index(['shift_id', 'event_slot_id']);
        });

        Schema::create('invitations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('group_id')->constrained('groups')->cascadeOnDelete();
            $table->string('invited_email')->nullable();
            $table->foreignUuid('invited_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('token')->unique();
            $table->timestampTz('expires_at')->nullable();
            $table->timestampTz('accepted_at')->nullable();
            $table->timestampsTz();
            $table->unique(['group_id', 'invited_email']);
            $table->index(['group_id', 'accepted_at']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('alter table events add constraint events_date_check check (start_date <= end_date)');
            DB::statement('alter table event_slots add constraint event_slots_time_check check (start_time < end_time)');
            DB::statement('alter table availability add constraint availability_time_check check (start_time is null or end_time is null or start_time < end_time)');
            DB::statement('alter table shift_generation_settings add constraint shift_generation_settings_preference_weight_check check (preference_weight between 0 and 100)');
            DB::statement('alter table shift_generation_settings add constraint shift_generation_settings_fairness_weight_check check (fairness_weight between 0 and 100)');
            DB::statement('alter table shift_generation_settings add constraint shift_generation_settings_balance_workload_weight_check check (balance_workload_weight between 0 and 100)');
            DB::statement('alter table shift_generation_settings add constraint shift_generation_settings_avoid_continuous_work_weight_check check (avoid_continuous_work_weight between 0 and 100)');
            DB::statement('alter table shift_generation_settings add constraint shift_generation_settings_leader_assignment_weight_check check (leader_assignment_weight between 0 and 100)');
            DB::statement('alter table shift_generation_settings add constraint shift_generation_settings_required_people_weight_check check (required_people_weight between 0 and 100)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('invitations');
        Schema::dropIfExists('shift_assignments');
        Schema::dropIfExists('shifts');
        Schema::dropIfExists('shift_generation_settings');
        Schema::dropIfExists('shift_rules');
        Schema::dropIfExists('availability');
        Schema::dropIfExists('event_slots');
        Schema::dropIfExists('events');
        Schema::dropIfExists('group_members');
        Schema::dropIfExists('groups');
    }
};
