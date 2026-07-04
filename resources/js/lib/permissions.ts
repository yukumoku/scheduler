import type { Group, Team } from '@/types/api'

type GroupLike = Pick<Group, 'myRole'> | null | undefined
type TeamLike = Pick<Team, 'leader' | 'isDefault' | 'members'> | null | undefined

function isLeaderMember(team: TeamLike, userId: string | null | undefined): boolean {
  if (!team || !userId) {
    return false
  }

  if (team.leader?.userId === userId) {
    return true
  }

  return team.members?.some((member) => member.userId === userId && member.role === 'leader') ?? false
}

export function canManageGroup(group: GroupLike): boolean {
  return group?.myRole === 'owner'
}

export function canDeleteGroup(group: GroupLike): boolean {
  return group?.myRole === 'owner'
}

export function canManageTeam(team: TeamLike, groupRole: Group['myRole'] | null | undefined, userId: string | null | undefined): boolean {
  if (groupRole === 'owner') {
    return true
  }

  return isLeaderMember(team, userId)
}

export function canEditTeam(team: TeamLike, groupRole: Group['myRole'] | null | undefined, userId: string | null | undefined): boolean {
  return canManageTeam(team, groupRole, userId) && !team?.isDefault
}

export function canCreateTask(team: TeamLike, groupRole: Group['myRole'] | null | undefined, userId: string | null | undefined): boolean {
  return canEditTeam(team, groupRole, userId)
}

export function canManageEvent(groupRole: Group['myRole'] | null | undefined, isTeamLeader: boolean): boolean {
  return groupRole === 'owner' || isTeamLeader
}
