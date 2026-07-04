<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('teams', function (Blueprint $table) {
            $table->foreignUuid('event_id')->nullable()->after('group_id')->constrained('events')->nullOnDelete();
            $table->index(['event_id', 'group_id']);
        });
    }

    public function down(): void
    {
        Schema::table('teams', function (Blueprint $table) {
            $table->dropConstrainedForeignId('event_id');
        });
    }
};
