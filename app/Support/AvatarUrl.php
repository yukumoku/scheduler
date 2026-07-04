<?php

namespace App\Support;

final class AvatarUrl
{
    public static function public(?string $avatarUrl): ?string
    {
        if (! is_string($avatarUrl) || trim($avatarUrl) === '') {
            return null;
        }

        return $avatarUrl;
    }
}
