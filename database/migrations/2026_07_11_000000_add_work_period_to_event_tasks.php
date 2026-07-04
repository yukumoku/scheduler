<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('event_tasks', function (Blueprint $table) {
            $table->date('work_start_date')->nullable()->after('desired_total_hours');
            $table->date('work_end_date')->nullable()->after('work_start_date');
        });
    }

    public function down(): void
    {
        Schema::table('event_tasks', function (Blueprint $table) {
            $table->dropColumn(['work_start_date', 'work_end_date']);
        });
    }
};
