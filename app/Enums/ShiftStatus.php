<?php

namespace App\Enums;

enum ShiftStatus: string
{
    case Draft = 'draft';
    case Generated = 'generated';
    case Published = 'published';
    case Closed = 'closed';
}
