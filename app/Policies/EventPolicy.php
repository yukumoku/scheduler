<?php

namespace App\Policies;

use App\Enums\GroupRole;
use App\Models\Event;
use App\Models\User;

class EventPolicy
{
    public function view(User $user, Event $event): bool
    {
        return $this->canAccessGroup($user, $event);
    }

    public function update(User $user, Event $event): bool
    {
        return $this->isOwnerOrAdmin($user, $event);
    }

    private function canAccessGroup(User $user, Event $event): bool
    {
        return $event->group->owner_id === $user->id
            || $event->group->members()->where('user_id', $user->id)->exists();
    }

    private function isOwnerOrAdmin(User $user, Event $event): bool
    {
        return $event->group->owner_id === $user->id
            || $event->group->members()
                ->where('user_id', $user->id)
                ->whereIn('role', [GroupRole::Owner->value, GroupRole::Admin->value])
                ->exists();
    }
}
