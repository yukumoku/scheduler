<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model as BaseModel;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

abstract class Model extends BaseModel
{
    use HasUuids;

    public $incrementing = false;

    protected $keyType = 'string';
}
