<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ChecksWorkspaceAccess;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;

abstract class Controller
{
    use AuthorizesRequests;
    use ChecksWorkspaceAccess;
    use ValidatesRequests;
}
