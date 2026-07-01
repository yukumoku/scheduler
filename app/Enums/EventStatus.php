<?php

namespace App\Enums;

enum EventStatus: string
{
    case Draft = 'draft';
    case Collecting = 'collecting';
    case Generated = 'generated';
    case Published = 'published';
    case Closed = 'closed';
}
