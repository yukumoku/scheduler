<?php

use App\Http\Controllers\AuthController;
use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('app');
});

Route::view('/login', 'app');
Route::view('/signup', 'app');
Route::view('/tutorial', 'app');
Route::get('/auth/google/redirect', fn () => app(AuthController::class)->redirect(request(), 'google'));
Route::get('/auth/google/callback', fn () => app(AuthController::class)->callback(request(), 'google'));
Route::get('/auth/line/redirect', fn () => app(AuthController::class)->redirect(request(), 'line'));
Route::get('/auth/line/callback', fn () => app(AuthController::class)->callback(request(), 'line'));
Route::view('/groups', 'app');
Route::view('/groups/{group}', 'app');
Route::view('/dashboard', 'app');
Route::view('/calendar', 'app');
Route::view('/invite/{token}', 'app');
Route::view('/events', 'app');
Route::view('/events/{event}', 'app');
Route::view('/events/{event}/shift-settings', 'app');
Route::view('/shifts/create', 'app');
Route::view('/shifts/{shift}', 'app');
Route::view('/availability-sets/{set}', 'app');
Route::view('/settings/account', 'app');
Route::view('/{any}', 'app')->where('any', '^(?!api|auth).*$');
