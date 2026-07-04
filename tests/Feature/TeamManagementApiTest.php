<?php

namespace Tests\Feature;

use App\Enums\GroupRole;
use App\Enums\TeamMemberRole;
use App\Http\Requests\TeamStoreRequest;
use App\Http\Resources\TeamResource;
use App\Http\Controllers\TeamController;
use App\Models\Group;
use App\Models\Team;
use App\Models\TeamMember;
use Illuminate\Support\Collection;
use Illuminate\Http\Request;
use Mockery;
use Tests\TestCase;

class TeamManagementApiTest extends TestCase
{
    public function test_team_store_request_accepts_expected_fields(): void
    {
        $request = new TeamStoreRequest();
        $rules = $request->rules();

        $this->assertArrayHasKey('name', $rules);
        $this->assertArrayHasKey('description', $rules);
        $this->assertArrayHasKey('color', $rules);
    }

    public function test_team_resource_matches_frontend_shape(): void
    {
        $team = new Team();
        $team->id = 'team-1';
        $team->group_id = 'group-1';
        $team->event_id = 'event-1';
        $team->name = '装飾班';
        $team->description = '会場装飾';
        $team->color = '#7c3aed';

        $leader = new TeamMember();
        $leader->id = 'member-1';
        $leader->user_id = 'user-1';
        $leader->role = TeamMemberRole::Leader;
        $leader->joined_at = now();
        $leader->setRelation('user', (object) [
            'display_name' => 'リーダー',
            'email' => 'leader@example.com',
            'avatar_url' => null,
        ]);

        $member = new TeamMember();
        $member->id = 'member-2';
        $member->user_id = 'user-2';
        $member->role = TeamMemberRole::Member;
        $member->joined_at = now();
        $member->setRelation('user', (object) [
            'display_name' => '班員',
            'email' => 'member@example.com',
            'avatar_url' => null,
        ]);

        $team->setRelation('members', new Collection([$leader, $member]));

        $resource = (new TeamResource($team))->toArray(request());

        $this->assertSame('team-1', $resource['id']);
        $this->assertSame('group-1', $resource['groupId']);
        $this->assertSame('event-1', $resource['eventId']);
        $this->assertSame('装飾班', $resource['name']);
        $this->assertSame(2, $resource['memberCount']);
        $this->assertSame('member-1', $resource['leader']['id']);
        $this->assertCount(2, $resource['members']);
        $this->assertSame('leader', $resource['members'][0]['role']);
    }

    public function test_team_management_roles_are_defined(): void
    {
        $this->assertSame(['owner', 'member'], array_map(fn (GroupRole $case) => $case->value, GroupRole::cases()));
        $this->assertSame(['leader', 'member'], array_map(fn (TeamMemberRole $case) => $case->value, TeamMemberRole::cases()));
    }

    public function test_team_store_adds_creator_as_leader_without_duplicates(): void
    {
        $controller = new TeamController();
        $user = new class {
            public string $id = 'user-1';

            public function memberships(): object
            {
                return new class {
                    public function where(string $column, mixed $value): object
                    {
                        return new class {
                            public function first(): object
                            {
                                return (object) ['role' => GroupRole::Owner];
                            }

                            public function exists(): bool
                            {
                                return true;
                            }
                        };
                    }
                };
            }

            public function teamMemberships(): object
            {
                return new class {
                    public function where(string $column, mixed $value): object
                    {
                        return new class {
                            public function first(): mixed
                            {
                                return null;
                            }
                        };
                    }
                };
            }
        };

        $request = Mockery::mock(TeamStoreRequest::class);
        $request->shouldReceive('user')->andReturn($user);
        $request->shouldReceive('validated')->andReturn([
            'name' => '受付班',
            'description' => '受付担当',
            'color' => '#7c3aed',
        ]);

        $existingMember = new TeamMember();
        $existingMember->id = 'member-existing';
        $existingMember->user_id = $user->id;
        $existingMember->role = TeamMemberRole::Leader;
        $existingMember->joined_at = now();
        $existingMember->setRelation('user', (object) [
            'display_name' => '作成者',
            'email' => 'creator@example.com',
            'avatar_url' => null,
        ]);

        $membersRelation = new class($existingMember, $user) {
            public function __construct(
                private TeamMember $member,
                private object $user,
            ) {
            }

            public function updateOrCreate(array $attributes, array $values): TeamMember
            {
                $this->member->role = $values['role'];
                $this->member->joined_at = $values['joined_at'];

                return $this->member;
            }
        };

        $team = new class($membersRelation, $existingMember) {
            public string $id = 'team-1';
            public string $group_id = 'group-1';
            public string $name = '受付班';
            public ?string $description = '受付担当';
            public ?string $color = '#7c3aed';

            public function __construct(
                private object $membersRelation,
                private TeamMember $member,
            ) {
                $this->members = collect([$member]);
            }

            public Collection $members;

            public function members(): object
            {
                return $this->membersRelation;
            }

            public function load(array $relations): self
            {
                return $this;
            }
        };

        $group = new class($team) extends Group {
            public string $id = 'group-1';
            public string $name = '文化祭実行委員会';
            public ?string $description = null;
            public ?string $icon_url = null;
            public bool $is_invite_enabled = true;

            public function __construct(private object $team)
            {
            }

            public function teams(): object
            {
                return new class($this->team) {
                    public function __construct(private object $team)
                    {
                    }

                    public function create(array $attributes): object
                    {
                        return $this->team;
                    }
                };
            }

            public function members(): object
            {
                return new class {
                    public function count(): int
                    {
                        return 1;
                    }
                };
            }
        };

        $response = $controller->store($request, $group);

        $this->assertSame(201, $response->getStatusCode());
        $this->assertSame('leader', $response->getData(true)['data']['leader']['role']);
        $this->assertSame($user->id, $response->getData(true)['data']['leader']['userId']);
        $this->assertCount(1, $team->members);
        $this->assertSame(1, $team->members->where('user_id', $user->id)->count());
    }

    public function test_group_member_can_open_team_detail(): void
    {
        $controller = new TeamController();

        $groupMembership = new class {
            public GroupRole $role;

            public function __construct()
            {
                $this->role = GroupRole::Member;
            }
        };

        $user = new class($groupMembership) {
            public string $id = 'user-2';

            public function __construct(private object $groupMembership)
            {
            }

            public function memberships(): object
            {
                return new class($this->groupMembership) {
                    public function __construct(private object $groupMembership)
                    {
                    }

                    public function where(string $column, mixed $value): object
                    {
                        return new class($this->groupMembership) {
                            public function __construct(private object $groupMembership)
                            {
                            }

                            public function first(): object
                            {
                                return $this->groupMembership;
                            }
                        };
                    }
                };
            }

            public function teamMemberships(): object
            {
                return new class {
                    public function where(string $column, mixed $value): object
                    {
                        return new class {
                            public function first(): mixed
                            {
                                return null;
                            }
                        };
                    }
                };
            }
        };

        $request = Mockery::mock(Request::class);
        $request->shouldReceive('user')->andReturn($user);

        $team = new class extends Team {
            public string $id = 'team-1';
            public string $group_id = 'group-1';
            public ?string $name = '受付班';
            public ?string $description = '受付担当';
            public ?string $color = '#7c3aed';
        };

        $group = new class extends Group {
            public string $id = 'group-1';
            public ?object $owner = null;
            public ?string $owner_id = null;

            public function members(): object
            {
                return new class {
                    public function with(string $relation): self
                    {
                        return $this;
                    }

                    public function get(): object
                    {
                        return new class {
                            public function each(callable $callback): void
                            {
                                //
                            }
                        };
                    }

                    public function count(): int
                    {
                        return 1;
                    }
                };
            }

            public function teams(): object
            {
                return new class {
                    public function get(): object
                    {
                        return new class {
                            public function each(callable $callback): void
                            {
                                //
                            }
                        };
                    }

                    public function firstOrCreate(array $attributes, array $values): object
                    {
                        $team = new Team();
                        $team->id = 'team-1';
                        $team->group_id = 'group-1';
                        $team->is_default = true;
                        $team->name = '全体班';
                        $team->description = 'グループ全員が参加する班です。';
                        $team->color = '#7c3aed';

                        return $team;
                    }
                };
            }
        };

        $team->setRelation('group', $group);
        $team->setRelation('members', collect());

        $response = $controller->show($request, $team);

        $this->assertSame(200, $response->getStatusCode());
        $this->assertSame('team-1', $response->getData(true)['data']['id']);
    }
}
