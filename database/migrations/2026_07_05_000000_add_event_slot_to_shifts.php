<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('shifts', function (Blueprint $table) {
            $table->foreignUuid('event_slot_id')->nullable()->after('event_id')->constrained('event_slots')->nullOnDelete();
            $table->index(['event_slot_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::table('shifts', function (Blueprint $table) {
            $table->dropConstrainedForeignId('event_slot_id');
        });
    }
};
