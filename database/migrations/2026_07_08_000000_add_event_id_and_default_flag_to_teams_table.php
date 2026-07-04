<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('teams', function (Blueprint $table) {
            $table->boolean('is_default')->default(false)->after('event_id');
            $table->index(['group_id', 'is_default']);
            $table->index(['event_id', 'is_default']);
        });
    }

    public function down(): void
    {
        Schema::table('teams', function (Blueprint $table) {
            $table->dropColumn('is_default');
            $table->dropIndex(['group_id', 'is_default']);
            $table->dropIndex(['event_id', 'is_default']);
        });
    }
};
