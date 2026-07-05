export type ApiError = {
  code: string
  message: string
}

export type ApiResponse<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: ApiError }

export type AuthUser = {
  id: string
  displayName: string | null
  email: string
  avatarUrl: string | null
  provider: string | null
  tutorialCompletedAt: string | null
}

export type Group = {
  id: string
  name: string
  description: string | null
  iconUrl: string | null
  memberCount: number
  myRole: 'owner' | 'member' | null
  inviteEnabled: boolean
  owner?: AuthUser | null
}

export type Invitation = {
  id: string
  groupId: string
  group: {
    id: string
    name: string
    description: string | null
  } | null
  email: string | null
  token: string
  code: string | null
  inviteUrl: string
  expiresAt: string | null
  acceptedAt: string | null
  inviter: AuthUser | null
}

export type CommonAvailabilitySet = {
  id: string
  groupId: string
  eventId: string | null
  name: string
  description: string | null
  startDate: string | null
  endDate: string | null
  deadline: string | null
  activityRules: ActivityRules
  availabilityCount: number
}

export type ActivityRules = {
  weekly: Record<string, { enabled: boolean; startTime: string; endTime: string }>
  excludedDates: string[]
  specialDates: Array<{ date: string; startTime: string; endTime: string; note: string | null }>
}

export type CommonAvailability = {
  id: string
  commonAvailabilitySetId: string
  userId: string
  date: string
  startTime: string
  endTime: string
  status: 'available' | 'unavailable' | 'preferred'
  comment: string | null
}

export type CommonAvailabilityMeSlot = {
  id: string
  commonAvailabilitySetId: string
  userId: string | null
  date: string
  startTime: string
  endTime: string
  requiredPeople: number
  location: string | null
  note: string | null
  isCustom?: boolean
  availabilityStatus: 'available' | 'unavailable' | 'preferred' | null
  availabilityComment: string | null
}

export type CommonAvailabilitySubmissionMember = {
  id: string
  userId: string
  displayName: string | null
  email: string | null
  avatarUrl: string | null
  submittedSlots: number
  availableSlots: number
  preferredSlots: number
  hasSubmitted: boolean
}

export type CommonAvailabilitySubmissionSlot = {
  date: string
  startTime: string
  endTime: string
  requiredPeople: number
  location: string | null
  note: string | null
  isCustom?: boolean
  availablePeople: number
  preferredPeople: number
  insufficientPeople: number
}

export type CommonAvailabilitySubmissions = {
  summary: {
    totalMembers: number
    submittedMembers: number
    submissionRate: number
    totalSlots: number
    insufficientSlots: number
  }
  slots: CommonAvailabilitySubmissionSlot[]
  members: CommonAvailabilitySubmissionMember[]
}

export type TeamMemberRole = 'leader' | 'member'

export type TeamMember = {
  id: string
  userId: string
  displayName: string | null
  email: string | null
  avatarUrl: string | null
  role: TeamMemberRole
  joinedAt: string | null
}

export type Team = {
  id: string
  groupId: string
  eventId: string | null
  isDefault: boolean
  name: string
  description: string | null
  color: string | null
  memberCount: number
  leader: TeamMember | null
  members: TeamMember[]
}

export type GroupMember = {
  id: string
  userId: string
  displayName: string | null
  email: string | null
  avatarUrl: string | null
  role: 'owner' | 'member'
  joinedAt: string | null
}

export type EventItem = {
  id: string
  groupId: string
  commonAvailabilitySetId: string | null
  scope?: 'group' | 'team'
  name: string
  description: string | null
  location: string | null
  startDate: string | null
  endDate: string | null
  availabilityDeadline: string | null
  status: 'draft' | 'collecting' | 'generated' | 'published' | 'closed'
  creator?: AuthUser | null
}

export type EventTask = {
  id: string
  eventId: string
  teamId: string | null
  name: string
  description: string | null
  desiredTotalHours: number | null
  requiredPeoplePerSlot: number
  workStartDate: string | null
  workEndDate: string | null
  desiredPeriods: Array<{
    date: string
    startTime: string
    endTime: string
    requiredPeople: number
    location: string | null
    note: string | null
  }>
  requiredMemberIds: string[]
  requiredRole: 'leader' | 'member' | null
  allowCrossTeamHelp: boolean
  color: string | null
  sortOrder: number
  team?: {
    id: string
    name: string
    color: string | null
  } | null
  slotCount?: number | null
}

export type EventSlot = {
  id: string
  eventId: string
  taskId?: string | null
  date: string
  startTime: string
  endTime: string
  requiredPeople: number
  status?: 'draft' | 'open' | 'closed'
  location: string | null
  note: string | null
  task?: EventTask | null
}

export type EventSlotBulkCreateResult = {
  createdCount: number
  skippedCount: number
  slots: EventSlot[]
}

export type DeletedResult = {
  deleted: boolean
}

export type AvailabilityStatus = 'available' | 'unavailable' | 'preferred'

export type EventAvailabilitySlot = EventSlot & {
  availabilityStatus: AvailabilityStatus | null
  availabilityComment: string | null
}

export type EventAvailabilityMember = {
  id: string
  userId: string
  displayName: string | null
  email: string | null
  avatarUrl: string | null
  submittedSlots: number
  availableSlots: number
  preferredSlots: number
  hasSubmitted: boolean
}

export type EventAvailabilitySummary = {
  totalMembers: number
  submittedMembers: number
  submissionRate: number
  totalSlots: number
  insufficientSlots: number
}

export type EventAvailabilityAdmin = {
  summary: EventAvailabilitySummary
  slots: Array<
    EventAvailabilitySlot & {
      availablePeople: number
      preferredPeople: number
      insufficientPeople: number
    }
  >
  members: EventAvailabilityMember[]
}

export type ShiftRule = {
  id: string
  eventId: string
  slotMinutes: number
  minWorkMinutes: number
  maxWorkMinutes: number
  maxContinuousMinutes: number
  breakMinutes: number
  leaderRequiredPerSlot: number
}

export type ShiftGenerationSetting = {
  id: string
  eventId: string
  preferenceWeight: number
  fairnessWeight: number
  balanceWorkloadWeight: number
  avoidContinuousWorkWeight: number
  leaderAssignmentWeight: number
  requiredPeopleWeight: number
}

export type ShiftSettings = {
  shiftRule: ShiftRule
  generationSetting: ShiftGenerationSetting
}

export type ShiftAssignment = {
  id: string
  shiftId: string
  eventSlotId: string
  userId: string
  isLeader: boolean
  user?: AuthUser | null
  eventSlot?: EventSlot | null
}

export type Shift = {
  id: string
  eventId: string
  eventSlotId: string | null
  status: 'draft' | 'generated' | 'published' | 'closed'
  generatedAt: string | null
  publishedAt: string | null
  event?: {
    id: string
    name: string
    groupId: string
    commonAvailabilitySetId: string | null
  } | null
  slots: EventSlot[]
  assignments: ShiftAssignment[]
  warnings: ShiftWarning[]
  metrics: ShiftMetrics
}

export type ShiftWarning = {
  slotId: string
  taskId: string | null
  date: string | null
  startTime: string | null
  endTime: string | null
  requiredPeople: number
  assignedPeople: number
  missingPeople: number
  message: string
}

export type ShiftMetrics = {
  totalSlots: number
  requiredPeopleTotal: number
  assignedPeopleTotal: number
  missingPeopleTotal: number
  plannedWorkMinutes: number
  completeWorkMinutes: number
  staffedWorkMinutes: number
  workCoverageRate: number
  fillRate: number
  preferredAssignments: number
  availableAssignments: number
  preferenceReflectionRate: number
  memberWorkload: Array<{
    userId: string
    displayName: string | null
    minutes: number
  }>
}

export type ShiftGenerateResult = {
  shift: Shift
  warnings: ShiftWarning[]
  metrics: ShiftMetrics
}

export type CalendarShiftItem = {
  id: string
  shiftId: string
  shiftStatus: Shift['status']
  publishedAt: string | null
  groupId: string | null
  groupName: string | null
  eventId: string | null
  eventName: string | null
  taskId: string | null
  taskName: string | null
  teamId: string | null
  teamName: string | null
  date: string | null
  startTime: string | null
  endTime: string | null
  location: string | null
  note: string | null
  requiredPeople: number
  isLeader: boolean
  role: 'leader' | 'member'
  allowCrossTeamHelp: boolean
  userId: string | null
  userName: string | null
  userAvatarUrl: string | null
}
