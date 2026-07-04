<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\EventController;
use App\Http\Controllers\GroupController;
use App\Http\Controllers\GroupMemberController;
use App\Http\Controllers\InvitationController;
use App\Http\Controllers\TeamController;
use App\Http\Controllers\TeamMemberController;
use App\Http\Controllers\CommonAvailabilitySetController;
use App\Http\Controllers\CommonAvailabilityController;
use App\Http\Controllers\Api\EventSlotController;
use App\Http\Controllers\Api\EventTaskController;
use App\Http\Controllers\Api\EventAvailabilityController;
use App\Http\Controllers\Api\CalendarController;
use App\Http\Controllers\Api\ShiftSettingsController;
use App\Http\Controllers\Api\ShiftController;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => response()->json([
    'success' => true,
    'data' => ['status' => 'ok'],
    'error' => null,
]));
Route::get('/avatar-proxy', [AuthController::class, 'avatarProxy']);

Route::get('/invitations/code/{code}', [InvitationController::class, 'showByCode']);
Route::get('/invitations/{token}', [InvitationController::class, 'show']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::patch('/auth/me', [AuthController::class, 'updateMe']);
    Route::delete('/auth/me', [AuthController::class, 'destroy']);
    Route::post('/auth/profile', [AuthController::class, 'updateProfile']);
    Route::post('/auth/tutorial/complete', [AuthController::class, 'completeTutorial']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    Route::get('/groups', [GroupController::class, 'index']);
    Route::post('/groups', [GroupController::class, 'store']);
    Route::get('/groups/{group}', [GroupController::class, 'show']);
    Route::delete('/groups/{group}', [GroupController::class, 'destroy']);
    Route::get('/groups/{group}/members', [GroupMemberController::class, 'index']);
    Route::patch('/groups/{group}/members/{member}', [GroupMemberController::class, 'update']);
    Route::get('/groups/{group}/invitations', [InvitationController::class, 'index']);
    Route::post('/groups/{group}/invitations', [InvitationController::class, 'store']);
    Route::get('/groups/{group}/teams', [TeamController::class, 'index']);
    Route::post('/groups/{group}/teams', [TeamController::class, 'store']);
    Route::get('/groups/{group}/common-availability-sets', [CommonAvailabilitySetController::class, 'index']);
    Route::post('/groups/{group}/common-availability-sets', [CommonAvailabilitySetController::class, 'store']);
    Route::get('/groups/{group}/events', [EventController::class, 'index']);
    Route::post('/groups/{group}/events', [EventController::class, 'store']);
    Route::get('/events/{event}/teams', [TeamController::class, 'indexByEvent']);
    Route::post('/events/{event}/teams', [TeamController::class, 'storeByEvent']);
    Route::get('/common-availability-sets/{set}', [CommonAvailabilitySetController::class, 'show']);
    Route::patch('/common-availability-sets/{set}', [CommonAvailabilitySetController::class, 'update']);
    Route::delete('/common-availability-sets/{set}', [CommonAvailabilitySetController::class, 'destroy']);
    Route::get('/common-availability-sets/{set}/me', [CommonAvailabilityController::class, 'me']);
    Route::put('/common-availability-sets/{set}/me', [CommonAvailabilityController::class, 'updateMe']);
    Route::get('/common-availability-sets/{set}/submissions', [CommonAvailabilityController::class, 'submissions']);
    Route::get('/teams/{team}', [TeamController::class, 'show']);
    Route::patch('/teams/{team}', [TeamController::class, 'update']);
    Route::delete('/teams/{team}', [TeamController::class, 'destroy']);
    Route::get('/teams/{team}/members', [TeamMemberController::class, 'index']);
    Route::post('/teams/{team}/members', [TeamMemberController::class, 'store']);
    Route::patch('/teams/{team}/members/{member}', [TeamMemberController::class, 'update']);
    Route::delete('/teams/{team}/members/{member}', [TeamMemberController::class, 'destroy']);
    Route::get('/events/{event}', [EventController::class, 'show']);
    Route::patch('/events/{event}', [EventController::class, 'update']);
    Route::delete('/events/{event}', [EventController::class, 'destroy']);
    Route::get('/events/{event}/availability-sets', [CommonAvailabilitySetController::class, 'indexByEvent']);
    Route::post('/events/{event}/availability-sets', [CommonAvailabilitySetController::class, 'storeByEvent']);
    Route::get('/events/{event}/tasks', [EventTaskController::class, 'index']);
    Route::post('/events/{event}/tasks', [EventTaskController::class, 'store']);
    Route::get('/event-tasks/{task}', [EventTaskController::class, 'show']);
    Route::patch('/event-tasks/{task}', [EventTaskController::class, 'update']);
    Route::delete('/event-tasks/{task}', [EventTaskController::class, 'destroy']);
    Route::get('/event-tasks/{task}/slots', [EventSlotController::class, 'indexByTask']);
    Route::post('/event-tasks/{task}/slots', [EventSlotController::class, 'storeByTask']);
    Route::post('/event-tasks/{task}/slots/bulk', [EventSlotController::class, 'bulkStoreByTask']);
    Route::patch('/event-slots/{slot}', [EventSlotController::class, 'updateBySlot']);
    Route::delete('/event-slots/{slot}', [EventSlotController::class, 'destroyBySlot']);

    // Deprecated legacy routes kept for compatibility.
    Route::get('/events/{event}/availability', [EventAvailabilityController::class, 'index']);
    Route::get('/events/{event}/shift-settings', [ShiftSettingsController::class, 'show']);
    Route::get('/events/{event}/shift-rules', [ShiftSettingsController::class, 'shiftRule']);
    Route::put('/events/{event}/shift-rules', [ShiftSettingsController::class, 'updateShiftRule']);
    Route::get('/events/{event}/generation-settings', [ShiftSettingsController::class, 'generationSettings']);
    Route::put('/events/{event}/generation-settings', [ShiftSettingsController::class, 'updateGenerationSettings']);
    Route::get('/calendar', [CalendarController::class, 'index']);
    Route::get('/events/{event}/shifts', [ShiftController::class, 'index']);
    Route::post('/events/{event}/shifts/generate', [ShiftController::class, 'generate']);
    Route::get('/shifts/{shift}', [ShiftController::class, 'show']);
    Route::post('/shifts/{shift}/publish', [ShiftController::class, 'publish']);
    Route::post('/shifts/{shift}/unpublish', [ShiftController::class, 'unpublish']);
    Route::delete('/shifts/{shift}', [ShiftController::class, 'destroy']);
    Route::get('/events/{event}/slots', [EventSlotController::class, 'index']);
    Route::post('/events/{event}/slots', [EventSlotController::class, 'store']);
    Route::post('/events/{event}/slots/bulk', [EventSlotController::class, 'bulkStore']);
    Route::patch('/events/{event}/slots/{slot}', [EventSlotController::class, 'update']);
    Route::delete('/events/{event}/slots/{slot}', [EventSlotController::class, 'destroy']);
    Route::get('/events/{event}/availability/me', [EventAvailabilityController::class, 'me']);
    Route::put('/events/{event}/availability/me', [EventAvailabilityController::class, 'updateMe']);
    Route::post('/invitations/code/{code}/accept', [InvitationController::class, 'acceptByCode']);
    Route::post('/invitations/{token}/accept', [InvitationController::class, 'accept']);
    Route::delete('/invitations/{invitation}', [InvitationController::class, 'destroy']);
});
