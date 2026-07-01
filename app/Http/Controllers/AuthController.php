<?php

namespace App\Http\Controllers;

use App\Http\Resources\AuthUserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;
use Laravel\Socialite\Contracts\User as SocialiteUser;

class AuthController extends Controller
{
    public function redirect(string $provider)
    {
        $this->ensureSupportedProvider($provider);

        return Socialite::driver($provider)->redirect();
    }

    public function callback(Request $request, string $provider)
    {
        $this->ensureSupportedProvider($provider);

        $socialiteUser = Socialite::driver($provider)->stateless()->user();
        $user = $this->resolveUser($socialiteUser, $provider);

        Auth::login($user, true);
        $request->session()->regenerate();

        return redirect()->to($this->frontendUrl());
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => new AuthUserResource($request->user()),
            'error' => null,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user && $user->currentAccessToken()) {
            $user->currentAccessToken()->delete();
        }

        return response()->json([
            'success' => true,
            'data' => ['loggedOut' => true],
            'error' => null,
        ]);
    }

    private function resolveUser(SocialiteUser $socialiteUser, string $provider): User
    {
        $attributes = [
            'display_name' => $socialiteUser->getName() ?: $socialiteUser->getNickname() ?: $socialiteUser->getEmail(),
            'avatar_url' => $socialiteUser->getAvatar(),
            'provider' => $provider,
            'provider_id' => $socialiteUser->getId(),
            'email_verified_at' => now(),
        ];

        if ($email = $socialiteUser->getEmail()) {
            $user = User::query()->where('email', $email)->first();

            if ($user) {
                $user->fill($attributes + ['email' => $email])->save();

                return $user;
            }

            return User::query()->create($attributes + [
                'email' => $email,
            ]);
        }

        return User::query()->create($attributes + [
            'email' => sprintf('%s@%s.local', Str::slug((string) $socialiteUser->getName() ?: $provider), $provider),
        ]);
    }

    private function frontendUrl(): string
    {
        return rtrim((string) env('FRONTEND_URL', url('/')), '/').'/login';
    }

    private function ensureSupportedProvider(string $provider): void
    {
        abort_unless(in_array($provider, ['google', 'microsoft'], true), 404);
    }
}
