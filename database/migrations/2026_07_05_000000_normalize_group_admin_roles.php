<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('group_members')
            ->where('role', 'admin')
            ->update(['role' => 'owner']);
    }

    public function down(): void
    {
        // Reintroducing admin would conflict with the simplified role model.
    }
};
