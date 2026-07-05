<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('common_availability_sets', function (Blueprint $table) {
            $table->json('activity_rules')->nullable()->after('deadline');
        });
    }

    public function down(): void
    {
        Schema::table('common_availability_sets', function (Blueprint $table) {
            $table->dropColumn('activity_rules');
        });
    }
};
