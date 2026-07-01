<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Laravel\Socialite\Contracts\User as SocialiteUser;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Sanctum\Sanctum;
use Mockery;
use Tests\TestCase;

class AuthFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_google_callback_creates_or_updates_user_and_logs_in(): void
    {
        $socialiteUser = $this->fakeSocialiteUser(
            id: 'google-123',
            email: 'user@example.com',
            name: 'Google User',
            avatar: 'https://example.com/avatar.png'
        );

        Socialite::shouldReceive('driver->stateless->user')
            ->once()
            ->andReturn($socialiteUser);

        $response = $this->get('/auth/google/callback');

        $response->assertRedirect('/login');

        $this->assertDatabaseHas('users', [
            'email' => 'user@example.com',
            'display_name' => 'Google User',
            'provider' => 'google',
            'provider_id' => 'google-123',
        ]);

        $this->assertAuthenticated();
    }

    public function test_microsoft_callback_updates_existing_user_by_email(): void
    {
        User::factory()->create([
            'email' => 'member@example.com',
            'display_name' => 'Old Name',
            'provider' => 'google',
            'provider_id' => 'old-id',
        ]);

        $socialiteUser = $this->fakeSocialiteUser(
            id: 'microsoft-456',
            email: 'member@example.com',
            name: 'Microsoft User',
            avatar: 'https://example.com/ms.png'
        );

        Socialite::shouldReceive('driver->stateless->user')
            ->once()
            ->andReturn($socialiteUser);

        $response = $this->get('/auth/microsoft/callback');

        $response->assertRedirect('/login');

        $this->assertDatabaseHas('users', [
            'email' => 'member@example.com',
            'display_name' => 'Microsoft User',
            'provider' => 'microsoft',
            'provider_id' => 'microsoft-456',
        ]);

        $this->assertDatabaseCount('users', 1);
    }

    public function test_me_and_logout_api_use_sanctum(): void
    {
        $user = User::factory()->create();
        Sanctum::actingAs($user);

        $me = $this->getJson('/api/auth/me');
        $me->assertOk()->assertJsonPath('data.id', $user->id);

        $logout = $this->postJson('/api/auth/logout');
        $logout->assertOk()->assertJsonPath('data.loggedOut', true);
    }

    public function test_redirect_routes_exist(): void
    {
        $this->get('/auth/google/redirect')->assertStatus(302);
        $this->get('/auth/microsoft/redirect')->assertStatus(302);
    }

    private function fakeSocialiteUser(string $id, string $email, string $name, string $avatar): SocialiteUser
    {
        $user = Mockery::mock(SocialiteUser::class);
        $user->shouldReceive('getId')->andReturn($id);
        $user->shouldReceive('getEmail')->andReturn($email);
        $user->shouldReceive('getName')->andReturn($name);
        $user->shouldReceive('getNickname')->andReturn(null);
        $user->shouldReceive('getAvatar')->andReturn($avatar);

        return $user;
    }
}
