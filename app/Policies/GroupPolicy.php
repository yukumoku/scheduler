<?php

namespace App\Policies;

use App\Enums\GroupRole;
use App\Models\Group;
use App\Models\User;

class GroupPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return true;
    }

    public function view(User $user, Group $group): bool
    {
        return $this->isMember($user, $group);
    }

    public function update(User $user, Group $group): bool
    {
        return $this->isOwnerOrAdmin($user, $group);
    }

    public function delete(User $user, Group $group): bool
    {
        return $this->isOwner($user, $group);
    }

    public function viewMembers(User $user, Group $group): bool
    {
        return $this->isMember($user, $group);
    }

    public function viewEvents(User $user, Group $group): bool
    {
        return $this->isMember($user, $group);
    }

    public function createEvent(User $user, Group $group): bool
    {
        return $this->isOwnerOrAdmin($user, $group);
    }

    private function isOwner(User $user, Group $group): bool
    {
        return $group->owner_id === $user->id;
    }

    private function isMember(User $user, Group $group): bool
    {
        return $this->isOwner($user, $group) || $group->members()->where('user_id', $user->id)->exists();
    }

    private function isOwnerOrAdmin(User $user, Group $group): bool
    {
        return $this->isOwner($user, $group) || $group->members()
            ->where('user_id', $user->id)
            ->whereIn('role', [GroupRole::Owner->value, GroupRole::Admin->value])
            ->exists();
    }
}
