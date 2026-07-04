<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('event_tasks', function (Blueprint $table) {
            $table->json('required_member_ids')->nullable()->after('desired_periods');
        });
    }

    public function down(): void
    {
        Schema::table('event_tasks', function (Blueprint $table) {
            $table->dropColumn('required_member_ids');
        });
    }
};
