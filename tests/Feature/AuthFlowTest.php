<?php

namespace Tests\Feature;

use Illuminate\Foundation\Auth\User as AuthenticatableUser;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Two\User as SocialiteUser;
use Mockery;
use Tests\TestCase;

class AuthFlowTest extends TestCase
{
    private function fakeGuard(): object
    {
        return new class {
            public mixed $user = null;

            public function login(mixed $user): void
            {
                $this->user = $user;
            }

            public function setUser(mixed $user): void
            {
                $this->user = $user;
            }

            public function check(): bool
            {
                return $this->user !== null;
            }

            public function user(): mixed
            {
                return $this->user;
            }
        };
    }

    public function test_google_callback_creates_user_logs_in_and_allows_api_access(): void
    {
        $socialiteUser = SocialiteUser::fake([
            'id' => 'google-123',
            'name' => 'Google User',
            'email' => 'google@example.com',
            'avatar' => 'https://example.com/avatar.png',
        ]);

        $savedUser = new class extends AuthenticatableUser {
            public $id;
            public $display_name;
            public $email;
            public $avatar_url;
            public $provider;
            public $provider_id;
        };
        $savedUser->id = 'user-google-123';
        $savedUser->email = 'google@example.com';
        $savedUser->display_name = 'Google User';
        $savedUser->avatar_url = 'https://example.com/avatar.png';
        $savedUser->provider = 'google';
        $savedUser->provider_id = 'google-123';

        $provider = Mockery::mock();
        $provider->shouldReceive('user')->once()->andReturn($socialiteUser);

        Socialite::shouldReceive('driver')
            ->with('google')
            ->andReturn($provider);

        $query = Mockery::mock();
        $query->shouldReceive('updateOrCreate')
            ->once()
            ->with(
                ['email' => 'google@example.com'],
                Mockery::on(function (array $attributes): bool {
                    return $attributes['display_name'] === 'Google User'
                        && $attributes['avatar_url'] === 'https://example.com/avatar.png'
                        && $attributes['provider'] === 'google'
                        && $attributes['provider_id'] === 'google-123';
                }),
            )
            ->andReturn($savedUser);

        $userModel = Mockery::mock('alias:App\Models\User');
        $userModel->shouldReceive('query')->once()->andReturn($query);

        $membersRelation = new class {
            public function create(array $attributes): void
            {
                //
            }

            public function count(): int
            {
                return 1;
            }
        };

        $group = new class($membersRelation) {
            public function __construct(private object $membersRelation)
            {
                $this->owner = null;
                $this->name = '文化祭実行委員会';
                $this->description = 'OAuth後に作成するグループ';
                $this->icon_url = null;
                $this->is_invite_enabled = true;
                $this->id = 'group-123';
            }

            public function members(): object
            {
                return $this->membersRelation;
            }
        };

        $groupModel = Mockery::mock('alias:App\Models\Group');
        $groupModel->shouldReceive('query')->once()->andReturn(new class($group) {
            public function __construct(private object $group)
            {
            }

            public function create(array $attributes): object
            {
                return $this->group;
            }
        });

        $guard = $this->fakeGuard();

        Auth::shouldReceive('guard')
            ->withAnyArgs()
            ->andReturn($guard);
        Auth::shouldReceive('shouldUse')->andReturnNull();
        Auth::shouldReceive('userResolver')
            ->andReturn(fn () => $guard->user());

        $response = $this->get('/auth/google/callback?code=fake-code&state=fake-state');

        $response->assertRedirect(config('app.frontend_url', config('app.url')));

        $apiResponse = $this->getJson('/api/auth/me');

        $apiResponse->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.email', 'google@example.com')
            ->assertJsonPath('data.displayName', 'Google User');

        $groupResponse = $this->postJson('/api/groups', [
            'name' => '文化祭実行委員会',
            'description' => 'OAuth後に作成するグループ',
            'iconUrl' => null,
        ]);

        $groupResponse->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.myRole', 'owner');
    }

    public function test_google_callback_updates_existing_user_with_same_email(): void
    {
        $socialiteUser = SocialiteUser::fake([
            'id' => 'google-999',
            'name' => 'New Google Name',
            'email' => 'google@example.com',
            'avatar' => 'https://example.com/new-avatar.png',
        ]);

        $updated = new class extends AuthenticatableUser {
            public $id;
            public $display_name;
            public $email;
            public $avatar_url;
            public $provider;
            public $provider_id;
        };
        $updated->id = 'user-existing';
        $updated->email = 'google@example.com';
        $updated->display_name = 'New Google Name';
        $updated->avatar_url = 'https://example.com/new-avatar.png';
        $updated->provider = 'google';
        $updated->provider_id = 'google-999';

        $provider = Mockery::mock();
        $provider->shouldReceive('user')->once()->andReturn($socialiteUser);

        Socialite::shouldReceive('driver')
            ->with('google')
            ->andReturn($provider);

        $query = Mockery::mock();
        $query->shouldReceive('updateOrCreate')
            ->once()
            ->with(
                ['email' => 'google@example.com'],
                Mockery::on(function (array $attributes): bool {
                    return $attributes['display_name'] === 'New Google Name'
                        && $attributes['avatar_url'] === 'https://example.com/new-avatar.png'
                        && $attributes['provider'] === 'google'
                        && $attributes['provider_id'] === 'google-999';
                }),
            )
            ->andReturn($updated);

        $userModel = Mockery::mock('alias:App\Models\User');
        $userModel->shouldReceive('query')->once()->andReturn($query);

        $guard = $this->fakeGuard();

        Auth::shouldReceive('guard')
            ->withAnyArgs()
            ->andReturn($guard);
        Auth::shouldReceive('shouldUse')->andReturnNull();

        $response = $this->get('/auth/google/callback?code=fake-code&state=fake-state');

        $response->assertRedirect(config('app.frontend_url', config('app.url')));
    }

    public function test_line_redirect_builds_authorize_url_and_keeps_state_in_session(): void
    {
        config([
            'services.line.channel_id' => 'line-channel-id',
            'services.line.redirect' => 'http://127.0.0.1:8000/auth/line/callback',
        ]);

        $response = $this->get('/auth/line/redirect');

        $response->assertRedirect();

        $location = (string) $response->headers->get('Location');
        $this->assertStringStartsWith('https://access.line.me/oauth2/v2.1/authorize?', $location);

        $query = [];
        parse_str((string) parse_url($location, PHP_URL_QUERY), $query);

        $this->assertSame('code', $query['response_type'] ?? null);
        $this->assertSame('line-channel-id', $query['client_id'] ?? null);
        $this->assertSame('http://127.0.0.1:8000/auth/line/callback', $query['redirect_uri'] ?? null);
        $this->assertSame('profile openid email', $query['scope'] ?? null);
        $this->assertNotEmpty($query['state'] ?? null);
        $this->assertNotEmpty($query['nonce'] ?? null);
    }

    public function test_line_callback_creates_user_logs_in_and_allows_api_access(): void
    {
        Http::fake([
            'https://api.line.me/oauth2/v2.1/token' => Http::response([
                'access_token' => 'line-access-token',
                'id_token' => 'line-id-token',
            ], 200),
            'https://api.line.me/v2/profile' => Http::response([
                'userId' => 'line-user-123',
                'displayName' => 'LINE User',
                'pictureUrl' => 'https://example.com/line-avatar.png',
            ], 200),
            'https://api.line.me/oauth2/v2.1/verify' => Http::response([
                'sub' => 'line-user-123',
                'email' => 'line@example.com',
                'name' => 'LINE User',
                'picture' => 'https://example.com/line-avatar.png',
            ], 200),
        ]);

        $savedUser = new class extends AuthenticatableUser {
            public $id;
            public $display_name;
            public $email;
            public $avatar_url;
            public $provider;
            public $provider_id;
        };
        $savedUser->id = 'user-line-123';
        $savedUser->email = 'line@example.com';
        $savedUser->display_name = 'LINE User';
        $savedUser->avatar_url = 'https://example.com/line-avatar.png';
        $savedUser->provider = 'line';
        $savedUser->provider_id = 'line-user-123';

        $query = Mockery::mock();
        $query->shouldReceive('updateOrCreate')
            ->once()
            ->with(
                ['email' => 'line@example.com'],
                Mockery::on(function (array $attributes): bool {
                    return $attributes['display_name'] === 'LINE User'
                        && $attributes['avatar_url'] === 'https://example.com/line-avatar.png'
                        && $attributes['provider'] === 'line'
                        && $attributes['provider_id'] === 'line-user-123';
                }),
            )
            ->andReturn($savedUser);

        $userModel = Mockery::mock('alias:App\Models\User');
        $userModel->shouldReceive('query')->once()->andReturn($query);

        $guard = $this->fakeGuard();

        Auth::shouldReceive('guard')
            ->withAnyArgs()
            ->andReturn($guard);
        Auth::shouldReceive('shouldUse')->andReturnNull();
        Auth::shouldReceive('userResolver')
            ->andReturn(fn () => $guard->user());

        $response = $this->withSession([
            'oauth.line.state' => 'line-state-123',
            'oauth.line.nonce' => 'line-nonce-123',
        ])->get('/auth/line/callback?code=line-code-123&state=line-state-123');

        $response->assertRedirect(config('app.frontend_url', config('app.url')));

        $apiResponse = $this->getJson('/api/auth/me');

        $apiResponse->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.email', 'line@example.com')
            ->assertJsonPath('data.displayName', 'LINE User');
    }

    public function test_tutorial_completion_is_persisted_and_returned_by_me_endpoint(): void
    {
        $user = new class {
            public string $id = 'user-tutorial';
            public ?string $display_name = 'Tutorial User';
            public string $email = 'tutorial@example.com';
            public ?string $avatar_url = null;
            public ?string $provider = 'google';
            public ?string $tutorial_completed_at = null;

            public function forceFill(array $attributes): self
            {
                foreach ($attributes as $key => $value) {
                    $this->{$key} = $value;
                }

                return $this;
            }

            public function save(): void
            {
                //
            }

            public function refresh(): self
            {
                return $this;
            }
        };

        $guard = $this->fakeGuard();
        $guard->setUser($user);

        Auth::shouldReceive('guard')
            ->withAnyArgs()
            ->andReturn($guard);
        Auth::shouldReceive('shouldUse')->andReturnNull();
        Auth::shouldReceive('userResolver')
            ->andReturn(fn () => $guard->user());

        $response = $this->postJson('/api/auth/tutorial/complete');

        $response->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $user->id);
        $this->assertNotNull($response->json('data.tutorialCompletedAt'));

        $meResponse = $this->getJson('/api/auth/me');

        $meResponse->assertOk()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.id', $user->id);
        $this->assertNotNull($meResponse->json('data.tutorialCompletedAt'));
    }
}
