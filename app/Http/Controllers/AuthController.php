<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\AvatarUrl;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Laravel\Sanctum\PersonalAccessToken;
use Laravel\Socialite\Two\InvalidStateException;
use Laravel\Socialite\Facades\Socialite;
use Symfony\Component\HttpFoundation\RedirectResponse;

class AuthController extends Controller
{
    private const PROVIDERS = ['google', 'line'];

    public function redirect(Request $request, string $provider): RedirectResponse
    {
        abort_unless(in_array($provider, self::PROVIDERS, true), 404);

        if ($provider === 'google') {
            $driver = Socialite::driver($provider);

            $driver = $driver->with([
                'prompt' => 'select_account',
            ]);

            return $driver->redirect();
        }

        $state = Str::random(40);
        $nonce = Str::random(40);
        $request->session()->put('oauth.line.state', $state);
        $request->session()->put('oauth.line.nonce', $nonce);

        $query = http_build_query([
            'response_type' => 'code',
            'client_id' => config('services.line.channel_id'),
            'redirect_uri' => config('services.line.redirect'),
            'state' => $state,
            'scope' => 'profile openid email',
            'nonce' => $nonce,
        ], '', '&', PHP_QUERY_RFC3986);

        return redirect()->away('https://access.line.me/oauth2/v2.1/authorize?'.$query);
    }

    public function callback(Request $request, string $provider): RedirectResponse
    {
        abort_unless(in_array($provider, self::PROVIDERS, true), 404);

        logger()->info('OAuth callback started', [
            'provider' => $provider,
            'has_code' => $request->filled('code'),
        ]);

        try {
            $oauthUser = $this->resolveOAuthUser($request, $provider);
        } catch (InvalidStateException $exception) {
            logger()->warning('OAuth state mismatch, retrying stateless', [
                'provider' => $provider,
                'message' => $exception->getMessage(),
            ]);

            try {
                $oauthUser = $this->resolveOAuthUser($request, $provider, true);
            } catch (\Throwable $innerException) {
                logger()->error('OAuth callback failed', [
                    'provider' => $provider,
                    'message' => $innerException->getMessage(),
                ]);

                $message = urlencode('ログインに失敗しました。しばらくしてからもう一度お試しください。');
                return redirect(config('app.frontend_url', config('app.url')).'/login?error='.$message);
            }
        } catch (\Throwable $exception) {
            logger()->error('OAuth callback failed', [
                'provider' => $provider,
                'step' => 'socialite_user',
                'message' => $exception->getMessage(),
            ]);

            $message = urlencode('ログインに失敗しました。しばらくしてからもう一度お試しください。');
            return redirect(config('app.frontend_url', config('app.url')).'/login?error='.$message);
        }

        if (! $oauthUser->getEmail()) {
            logger()->error('OAuth callback failed', [
                'provider' => $provider,
                'step' => 'missing_email',
                'user' => [
                    'id' => $oauthUser->getId(),
                    'name' => $oauthUser->getName(),
                    'nickname' => $oauthUser->getNickname(),
                ],
            ]);

            $message = urlencode('ログインに失敗しました。メールアドレスを取得できませんでした。');
            return redirect(config('app.frontend_url', config('app.url')).'/login?error='.$message);
        }

        logger()->info('OAuth callback resolved user profile', [
            'provider' => $provider,
            'email' => $oauthUser->getEmail(),
            'name' => $oauthUser->getName(),
            'nickname' => $oauthUser->getNickname(),
            'avatar' => $oauthUser->getAvatar(),
            'provider_id' => (string) $oauthUser->getId(),
        ]);

        try {
            $user = $this->upsertOAuthUser($provider, $oauthUser);
        } catch (\Throwable $exception) {
            logger()->error('OAuth callback failed', [
                'provider' => $provider,
                'step' => 'user_upsert',
                'email' => $oauthUser->getEmail(),
                'message' => $exception->getMessage(),
            ]);

            $message = urlencode('ログインに失敗しました。ユーザー情報の保存に失敗しました。');
            return redirect(config('app.frontend_url', config('app.url')).'/login?error='.$message);
        }

        logger()->info('OAuth user saved', [
            'provider' => $provider,
            'user_id' => $user->id,
            'email' => $user->email,
            'provider_id' => $user->provider_id,
        ]);

        try {
            Auth::guard('web')->login($user);
            $request->session()->regenerate();
        } catch (\Throwable $exception) {
            logger()->error('OAuth callback failed', [
                'provider' => $provider,
                'step' => 'auth_login',
                'user_id' => $user->id,
                'message' => $exception->getMessage(),
            ]);

            $message = urlencode('ログインに失敗しました。ログイン状態を作成できませんでした。');
            return redirect(config('app.frontend_url', config('app.url')).'/login?error='.$message);
        }

        logger()->info('OAuth callback completed', [
            'provider' => $provider,
            'user_id' => $user->id,
            'redirect_to' => config('app.frontend_url', config('app.url')),
        ]);

        return redirect(config('app.frontend_url', config('app.url')));
    }

    public function me(Request $request): \Illuminate\Http\JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'data' => null,
                'error' => [
                    'code' => 'UNAUTHENTICATED',
                    'message' => 'ログインしてください。',
                ],
            ], 401);
        }

        return response()->json([
            'success' => true,
            'data' => $this->serializeUser($user),
            'error' => null,
        ]);
    }

    public function updateMe(Request $request): \Illuminate\Http\JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'data' => null,
                'error' => [
                    'code' => 'UNAUTHENTICATED',
                    'message' => 'ログインしてください。',
                ],
            ], 401);
        }

        $validated = $request->validate([
            'displayName' => ['required', 'string', 'max:255'],
            'avatarUrl' => ['nullable', 'url', 'max:2048'],
        ]);

        $user->update([
            'display_name' => $validated['displayName'],
            'avatar_url' => $validated['avatarUrl'] ?? null,
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->serializeUser($user->refresh()),
            'error' => null,
        ]);
    }

    public function updateProfile(Request $request): \Illuminate\Http\JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'data' => null,
                'error' => [
                    'code' => 'UNAUTHENTICATED',
                    'message' => 'ログインしてください。',
                ],
            ], 401);
        }

        $validated = $request->validate([
            'displayName' => ['required', 'string', 'max:255'],
            'avatar' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp,gif', 'max:2048'],
            'avatarUrl' => ['nullable', 'url', 'max:2048'],
        ]);

        $avatarUrl = $validated['avatarUrl'] ?? $user->avatar_url;

        if ($request->hasFile('avatar')) {
            $directory = public_path('uploads/avatars');
            File::ensureDirectoryExists($directory);

            $file = $request->file('avatar');
            $extension = $file->getClientOriginalExtension() ?: 'png';
            $filename = $user->id.'-'.Str::uuid().'.'.$extension;
            $file->move($directory, $filename);
            $avatarUrl = asset('uploads/avatars/'.$filename);
        }

        $user->update([
            'display_name' => $validated['displayName'],
            'avatar_url' => $avatarUrl,
        ]);

        return response()->json([
            'success' => true,
            'data' => $this->serializeUser($user->refresh()),
            'error' => null,
        ]);
    }

    public function completeTutorial(Request $request): \Illuminate\Http\JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'data' => null,
                'error' => [
                    'code' => 'UNAUTHENTICATED',
                    'message' => 'ログインしてください。',
                ],
            ], 401);
        }

        if (! $user->tutorial_completed_at) {
            $user->forceFill([
                'tutorial_completed_at' => now(),
            ])->save();
        }

        return response()->json([
            'success' => true,
            'data' => $this->serializeUser($user->refresh()),
            'error' => null,
        ]);
    }

    public function logout(Request $request): \Illuminate\Http\JsonResponse
    {
        $user = $request->user();

        $token = $user?->currentAccessToken();

        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }

        if ($request->hasSession()) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json([
            'success' => true,
            'data' => ['loggedOut' => true],
            'error' => null,
        ]);
    }

    public function destroy(Request $request): \Illuminate\Http\JsonResponse
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'success' => false,
                'data' => null,
                'error' => [
                    'code' => 'UNAUTHENTICATED',
                    'message' => 'ログインしてください。',
                ],
            ], 401);
        }

        $token = $user->currentAccessToken();

        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }

        if ($request->hasSession()) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        $user->delete();

        return response()->json([
            'success' => true,
            'data' => ['deleted' => true],
            'error' => null,
        ]);
    }

    private function serializeUser(object $user): array
    {
        return [
            'id' => $user->id,
            'displayName' => $user->display_name,
            'email' => $user->email,
            'avatarUrl' => AvatarUrl::public($user->avatar_url),
            'provider' => $user->provider,
            'tutorialCompletedAt' => $user->tutorial_completed_at ?? null,
        ];
    }

    public function avatarProxy(Request $request): \Symfony\Component\HttpFoundation\Response
    {
        $validated = $request->validate([
            'url' => ['required', 'url', 'max:2048'],
        ]);

        $url = $validated['url'];

        if (! preg_match('/^https?:\\/\\//i', $url)) {
            abort(422, '無効な画像URLです。');
        }

        try {
            $response = Http::timeout(10)->get($url);
            abort_unless($response->successful(), 422, '画像を取得できませんでした。');

            $contentType = $response->header('Content-Type') ?: 'image/jpeg';

            return response($response->body(), 200, [
                'Content-Type' => $contentType,
                'Cache-Control' => 'public, max-age=86400',
            ]);
        } catch (\Throwable $exception) {
            logger()->warning('Avatar proxy failed', [
                'url' => $url,
                'message' => $exception->getMessage(),
            ]);

            abort(422, '画像を取得できませんでした。');
        }
    }

    private function resolveOAuthUser(Request $request, string $provider, bool $stateless = false): object
    {
        if ($provider === 'line') {
            return $this->resolveLineUser($request);
        }

        $driver = Socialite::driver($provider);

        if ($stateless) {
            $driver = $driver->stateless();
        }

        return $driver->user();
    }

    private function resolveLineUser(Request $request): object
    {
        $state = $request->string('state')->toString();
        $expectedState = $request->session()->pull('oauth.line.state');
        abort_if(! $expectedState || $state !== $expectedState, 419, 'LINE認証の状態を確認できませんでした。');

        $code = $request->string('code')->toString();
        abort_if($code === '', 422, '認証コードが見つかりません。');

        $tokenResponse = Http::asForm()->post('https://api.line.me/oauth2/v2.1/token', [
            'grant_type' => 'authorization_code',
            'code' => $code,
            'redirect_uri' => config('services.line.redirect'),
            'client_id' => config('services.line.channel_id'),
            'client_secret' => config('services.line.channel_secret'),
        ]);

        abort_unless($tokenResponse->successful(), 422, 'LINEアクセストークンの取得に失敗しました。');

        $token = $tokenResponse->json();
        $accessToken = $token['access_token'] ?? null;
        $idToken = $token['id_token'] ?? null;
        abort_if(! $accessToken || ! $idToken, 422, 'LINE認証のトークンが不足しています。');

        $profileResponse = Http::withToken($accessToken)->get('https://api.line.me/v2/profile');
        abort_unless($profileResponse->successful(), 422, 'LINEプロフィールの取得に失敗しました。');

        $verifyResponse = Http::asForm()->post('https://api.line.me/oauth2/v2.1/verify', [
            'id_token' => $idToken,
            'client_id' => config('services.line.channel_id'),
        ]);
        abort_unless($verifyResponse->successful(), 422, 'LINEメールアドレスの確認に失敗しました。');

        $profile = $profileResponse->json();
        $claims = $verifyResponse->json();
        $lineUserId = (string) ($profile['userId'] ?? $claims['sub'] ?? '');
        abort_if($lineUserId === '', 422, 'LINEユーザーIDを取得できませんでした。');

        $email = $claims['email'] ?? null;
        if (! $email) {
            $email = 'line-'.$lineUserId.'@line.local';
        }

        return new class(
            id: $lineUserId,
            name: $profile['displayName'] ?? $claims['name'] ?? null,
            email: $email,
            avatar: $profile['pictureUrl'] ?? $claims['picture'] ?? null,
        ) {
            public function __construct(
                private readonly string $id,
                private readonly ?string $name,
                private readonly string $email,
                private readonly ?string $avatar,
            ) {
            }

            public function getId(): string
            {
                return $this->id;
            }

            public function getName(): ?string
            {
                return $this->name;
            }

            public function getNickname(): ?string
            {
                return $this->name;
            }

            public function getEmail(): string
            {
                return $this->email;
            }

            public function getAvatar(): ?string
            {
                return $this->avatar;
            }
        };
    }

    private function upsertOAuthUser(string $provider, object $oauthUser): object
    {
        $lookupEmail = (string) $oauthUser->getEmail();
        $avatarUrl = $this->resolveAndStoreAvatar($oauthUser->getAvatar(), $provider, (string) $oauthUser->getId());

        if ($provider === 'line' && str_ends_with($lookupEmail, '@line.local')) {
            $user = User::query()
                ->where('provider', 'line')
                ->where('provider_id', (string) $oauthUser->getId())
                ->first();

            if (! $user) {
                $user = User::query()
                    ->where('email', $lookupEmail)
                    ->first();
            }

            if ($user) {
                $user->update([
                    'display_name' => $oauthUser->getName() ?: $oauthUser->getNickname() ?: $lookupEmail,
                    'avatar_url' => $avatarUrl,
                    'provider' => $provider,
                    'provider_id' => (string) $oauthUser->getId(),
                    'email_verified_at' => now(),
                ]);

                return $user->refresh();
            }
        }

        return User::query()->updateOrCreate(
            ['email' => $lookupEmail],
            [
                'display_name' => $oauthUser->getName() ?: $oauthUser->getNickname() ?: $lookupEmail,
                'avatar_url' => $avatarUrl,
                'provider' => $provider,
                'provider_id' => (string) $oauthUser->getId(),
                'email_verified_at' => now(),
            ],
        );
    }

    private function resolveAndStoreAvatar(?string $avatarUrl, string $provider, string $providerId): ?string
    {
        if (! is_string($avatarUrl) || trim($avatarUrl) === '') {
            return null;
        }

        if (! preg_match('/^https?:\\/\\//i', $avatarUrl)) {
            return $avatarUrl;
        }

        try {
            $response = Http::timeout(10)->get($avatarUrl);

            if (! $response->successful()) {
                return $avatarUrl;
            }

            $contentType = strtolower((string) $response->header('Content-Type'));
            $extension = match (true) {
                str_contains($contentType, 'png') => 'png',
                str_contains($contentType, 'webp') => 'webp',
                str_contains($contentType, 'gif') => 'gif',
                str_contains($contentType, 'jpeg'), str_contains($contentType, 'jpg') => 'jpg',
                default => pathinfo((string) parse_url($avatarUrl, PHP_URL_PATH), PATHINFO_EXTENSION) ?: 'jpg',
            };

            $directory = public_path('uploads/avatars');
            File::ensureDirectoryExists($directory);

            $filename = 'oauth-'.$provider.'-'.$providerId.'-'.Str::uuid().'.'.$extension;
            File::put($directory.'/'.$filename, $response->body());

            return asset('uploads/avatars/'.$filename);
        } catch (\Throwable $exception) {
            logger()->warning('OAuth avatar could not be stored locally', [
                'provider' => $provider,
                'provider_id' => $providerId,
                'message' => $exception->getMessage(),
            ]);

            return $avatarUrl;
        }
    }
}
