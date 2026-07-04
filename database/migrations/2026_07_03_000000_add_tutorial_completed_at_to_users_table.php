<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestampTz('tutorial_completed_at')->nullable()->after('provider_id');
        });

        DB::table('users')
            ->whereNull('tutorial_completed_at')
            ->update([
                'tutorial_completed_at' => now(),
            ]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('tutorial_completed_at');
        });
    }
};
