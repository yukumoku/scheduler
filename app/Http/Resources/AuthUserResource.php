<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;

class AuthUserResource extends UserResource
{
    public function toArray(Request $request): array
    {
        return parent::toArray($request);
    }
}
