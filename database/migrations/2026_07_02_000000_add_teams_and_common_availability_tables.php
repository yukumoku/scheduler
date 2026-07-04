<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('teams', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('group_id')->constrained('groups')->cascadeOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('color', 32)->nullable();
            $table->timestampsTz();
            $table->index(['group_id', 'name']);
        });

        Schema::create('team_members', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('team_id')->constrained('teams')->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->enum('role', ['leader', 'member'])->default('member');
            $table->timestampTz('joined_at')->nullable();
            $table->timestampsTz();
            $table->unique(['team_id', 'user_id']);
            $table->index(['team_id', 'role']);
        });

        Schema::create('common_availability_sets', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('group_id')->constrained('groups')->cascadeOnDelete();
            $table->foreignUuid('event_id')->nullable()->constrained('events')->nullOnDelete();
            $table->string('name');
            $table->text('description')->nullable();
            $table->timestampTz('starts_at')->nullable();
            $table->timestampTz('ends_at')->nullable();
            $table->timestampsTz();
            $table->index(['group_id', 'name']);
            $table->index(['event_id', 'name']);
        });

        Schema::create('common_availability', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('common_availability_set_id')->constrained('common_availability_sets')->cascadeOnDelete();
            $table->foreignUuid('user_id')->constrained('users')->cascadeOnDelete();
            $table->date('date');
            $table->time('start_time')->nullable();
            $table->time('end_time')->nullable();
            $table->enum('status', ['available', 'unavailable', 'preferred'])->default('available');
            $table->text('comment')->nullable();
            $table->timestampsTz();
            $table->unique(['common_availability_set_id', 'user_id', 'date', 'start_time', 'end_time']);
            $table->index(['common_availability_set_id', 'user_id', 'date']);
        });

        Schema::table('events', function (Blueprint $table) {
            $table->foreignUuid('team_id')->nullable()->after('group_id')->constrained('teams')->nullOnDelete();
            $table->foreignUuid('common_availability_set_id')->nullable()->after('team_id')->constrained('common_availability_sets')->nullOnDelete();
            $table->enum('scope', ['group', 'team'])->default('group')->after('group_id');
            $table->index(['team_id', 'scope']);
            $table->index('common_availability_set_id');
        });

        Schema::table('event_slots', function (Blueprint $table) {
            $table->foreignUuid('team_id')->nullable()->after('event_id')->constrained('teams')->nullOnDelete();
            $table->boolean('allow_cross_team_help')->default(false)->after('team_id');
            $table->index(['team_id', 'allow_cross_team_help']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement('alter table events add constraint events_scope_team_check check ((scope = \'group\' and team_id is null) or (scope = \'team\' and team_id is not null))');
        }
    }

    public function down(): void
    {
        Schema::table('event_slots', function (Blueprint $table) {
            $table->dropConstrainedForeignId('team_id');
            $table->dropColumn('allow_cross_team_help');
        });

        Schema::table('events', function (Blueprint $table) {
            $table->dropConstrainedForeignId('team_id');
            $table->dropConstrainedForeignId('common_availability_set_id');
            $table->dropColumn('scope');
        });

        Schema::dropIfExists('common_availability');
        Schema::dropIfExists('common_availability_sets');
        Schema::dropIfExists('team_members');
        Schema::dropIfExists('teams');
    }
};
