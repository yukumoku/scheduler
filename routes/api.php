<?php

use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => response()->json([
    'success' => true,
    'data' => ['status' => 'ok'],
    'error' => null,
]));
