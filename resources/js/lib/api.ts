import type {
  ApiResponse,
  AuthUser,
  ActivityRules,
  CommonAvailability,
  CommonAvailabilitySet,
  CommonAvailabilityMeSlot,
  CommonAvailabilitySubmissions,
  AvailabilityStatus,
  EventAvailabilityAdmin,
  EventAvailabilitySlot,
  EventItem,
  EventTask,
  EventSlot,
  EventSlotBulkCreateResult,
  DeletedResult,
  Group,
  GroupMember,
  Invitation,
  Team,
  TeamMember,
  TeamMemberRole,
  ShiftSettings,
  ShiftRule,
  ShiftGenerationSetting,
  Shift,
  ShiftGenerateResult,
  CalendarShiftItem,
} from '@/types/api'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? `${window.location.origin}/api`
const apiOrigin = new URL(apiBaseUrl, window.location.origin).origin
const csrfCookieUrl = `${apiOrigin}/sanctum/csrf-cookie`

let csrfCookiePromise: Promise<void> | null = null

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null
  }

  const value = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=')

  return value ? decodeURIComponent(value) : null
}

async function ensureCsrfCookie(): Promise<void> {
  if (csrfCookiePromise) {
    await csrfCookiePromise
    return
  }

  csrfCookiePromise = fetch(csrfCookieUrl, {
    credentials: 'include',
  }).then(() => undefined)

  await csrfCookiePromise
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method?.toUpperCase() ?? 'GET'
  const needsCsrf = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData
  if (needsCsrf) {
    await ensureCsrfCookie()
  }

  const headers: HeadersInit = {
    Accept: 'application/json',
    ...(needsCsrf && readCookie('XSRF-TOKEN') ? { 'X-XSRF-TOKEN': readCookie('XSRF-TOKEN') ?? '' } : {}),
    ...(init?.headers ?? {}),
  }

  if (!isFormData) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    headers,
    ...init,
  })

  const rawBody = await response.text()
  let payload: ApiResponse<T> | null = null

  try {
    payload = rawBody ? (JSON.parse(rawBody) as ApiResponse<T>) : null
  } catch (error) {
    console.error('[API] JSON parse failed', { path, status: response.status, body: rawBody, error })
    throw new Error(`API response parse failed: ${response.status}`)
  }

  if (!response.ok || !payload) {
    console.error('[API] Request failed', {
      path,
      status: response.status,
      body: rawBody,
    })
    if (response.status === 413) {
      throw new Error('画像が大きすぎます。小さめの画像を選んでください。')
    }
    throw new Error(`Request failed: ${response.status}`)
  }

  if (!payload.success) {
    console.error('[API] Domain error', {
      path,
      status: response.status,
      error: payload.error,
      body: rawBody,
    })
    throw new Error(payload.error.message)
  }

  return payload.data
}

export function authRedirectUrl(provider: 'google' | 'line'): string {
  return `/auth/${provider}/redirect`
}

export const api = {
  auth: {
    me: () => request<AuthUser>('/auth/me'),
    updateMe: (input: { displayName: string; avatarUrl: string | null }) =>
      request<AuthUser>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    deleteMe: () =>
      request<DeletedResult>('/auth/me', {
        method: 'DELETE',
      }),
    updateProfile: (input: { displayName: string; avatarUrl?: string | null; avatar?: File | null }) => {
      const formData = new FormData()
      formData.append('displayName', input.displayName)
      if (input.avatarUrl) {
        formData.append('avatarUrl', input.avatarUrl)
      }
      if (input.avatar) {
        formData.append('avatar', input.avatar)
      }

      return request<AuthUser>('/auth/profile', {
        method: 'POST',
        body: formData,
      })
    },
    completeTutorial: () =>
      request<AuthUser>('/auth/tutorial/complete', {
        method: 'POST',
      }),
    logout: async () => {
      try {
        return await request<{ loggedOut: boolean }>('/auth/logout', { method: 'POST' })
      } catch (error) {
        if (error instanceof Error && /^Request failed: (401|419)$/.test(error.message)) {
          return { loggedOut: true }
        }

        throw error
      }
    },
  },
  calendar: {
    shifts: () => request<CalendarShiftItem[]>('/calendar'),
  },
  groups: {
    list: () => request<Group[]>('/groups'),
    create: (input: { name: string; description: string | null }) =>
      request<Group>('/groups', {
        method: 'POST',
        body: JSON.stringify({
          name: input.name,
          description: input.description,
          iconUrl: null,
        }),
      }),
    show: (groupId: string) => request<Group>(`/groups/${groupId}`),
    delete: (groupId: string) =>
      request<DeletedResult>(`/groups/${groupId}`, {
        method: 'DELETE',
      }),
    members: (groupId: string) => request<GroupMember[]>(`/groups/${groupId}/members`),
    updateMember: (
      groupId: string,
      memberId: string,
      input: {
        role: 'owner' | 'member'
      },
    ) =>
      request<GroupMember>(`/groups/${groupId}/members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    invitations: (groupId: string) => request<Invitation[]>(`/groups/${groupId}/invitations`),
    createInvitation: (groupId: string, input: { email: string | null }) =>
      request<Invitation>(`/groups/${groupId}/invitations`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    events: (groupId: string) => request<EventItem[]>(`/groups/${groupId}/events`),
    teams: (groupId: string) => request<Team[]>(`/groups/${groupId}/teams`),
    commonAvailabilitySets: (groupId: string) => request<CommonAvailabilitySet[]>(`/groups/${groupId}/common-availability-sets`),
    createCommonAvailabilitySet: (
      groupId: string,
      input: {
        name: string
        description: string | null
        startDate: string
        endDate: string
        deadline: string | null
        activityRules?: ActivityRules
      },
    ) =>
      request<CommonAvailabilitySet>(`/groups/${groupId}/common-availability-sets`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    createTeam: (
      groupId: string,
      input: {
        name: string
        description: string | null
        color: string | null
      },
    ) =>
      request<Team>(`/groups/${groupId}/teams`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    createEvent: (
      groupId: string,
      input: {
        name: string
        description: string | null
        location: string | null
        startDate: string
        endDate: string
        availabilityDeadline: string | null
        commonAvailabilitySetId: string | null
      },
    ) =>
      request<EventItem>(`/groups/${groupId}/events`, {
        method: 'POST',
        body: JSON.stringify({
          name: input.name,
          description: input.description,
          location: input.location,
          commonAvailabilitySetId: input.commonAvailabilitySetId,
          startDate: input.startDate,
          endDate: input.endDate,
          availabilityDeadline: input.availabilityDeadline,
          status: 'draft',
        }),
      }),
  },
  teams: {
    show: (teamId: string) => request<Team>(`/teams/${teamId}`),
    update: (
      teamId: string,
      input: {
        name: string
        description: string | null
        color: string | null
      },
    ) =>
      request<Team>(`/teams/${teamId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    delete: (teamId: string) =>
      request<DeletedResult>(`/teams/${teamId}`, {
        method: 'DELETE',
      }),
    members: (teamId: string) => request<TeamMember[]>(`/teams/${teamId}/members`),
    addMember: (
      teamId: string,
      input: {
        userId: string
        role: TeamMemberRole
      },
    ) =>
      request<TeamMember>(`/teams/${teamId}/members`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    updateMember: (
      teamId: string,
      memberId: string,
      input: {
        role: TeamMemberRole
      },
    ) =>
      request<TeamMember>(`/teams/${teamId}/members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    deleteMember: (teamId: string, memberId: string) =>
      request<DeletedResult>(`/teams/${teamId}/members/${memberId}`, {
        method: 'DELETE',
      }),
  },
  invitations: {
    show: (token: string) => request<Invitation>(`/invitations/${token}`),
    showByCode: (code: string) => request<Invitation>(`/invitations/code/${code}`),
    accept: (token: string) =>
      request<{ accepted: boolean; groupId: string }>(`/invitations/${token}/accept`, {
        method: 'POST',
      }),
    acceptByCode: (code: string) =>
      request<{ accepted: boolean; groupId: string }>(`/invitations/code/${code}/accept`, {
        method: 'POST',
      }),
    delete: (invitationId: string) =>
      request<DeletedResult>(`/invitations/${invitationId}`, {
        method: 'DELETE',
      }),
  },
  commonAvailabilitySets: {
    show: (setId: string) => request<CommonAvailabilitySet>(`/common-availability-sets/${setId}`),
    update: (
      setId: string,
      input: {
        name: string
        description: string | null
        startDate: string
        endDate: string
        deadline: string | null
        activityRules?: ActivityRules
      },
    ) =>
      request<CommonAvailabilitySet>(`/common-availability-sets/${setId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    delete: (setId: string) =>
      request<DeletedResult>(`/common-availability-sets/${setId}`, {
        method: 'DELETE',
      }),
    me: (setId: string) => request<{ set: CommonAvailabilitySet; slots: CommonAvailabilityMeSlot[] }>(`/common-availability-sets/${setId}/me`),
    updateMe: (
      setId: string,
      input: {
        availabilities: Array<{
          date: string
          startTime: string
          endTime: string
          status: 'available' | 'unavailable' | 'preferred'
          comment: string | null
        }>
      },
    ) =>
      request<{ saved: boolean }>(`/common-availability-sets/${setId}/me`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    submissions: (setId: string) => request<CommonAvailabilitySubmissions>(`/common-availability-sets/${setId}/submissions`),
  },
  events: {
    show: (eventId: string) => request<EventItem>(`/events/${eventId}`),
    teams: (eventId: string) => request<Team[]>(`/events/${eventId}/teams`),
    createTeam: (
      eventId: string,
      input: {
        name: string
        description: string | null
        color: string | null
      },
    ) =>
      request<Team>(`/events/${eventId}/teams`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    availabilitySets: (eventId: string) => request<CommonAvailabilitySet[]>(`/events/${eventId}/availability-sets`),
    createAvailabilitySet: (
      eventId: string,
      input: {
        name: string
        description: string | null
        startDate: string
        endDate: string
        deadline: string | null
      },
    ) =>
      request<CommonAvailabilitySet>(`/events/${eventId}/availability-sets`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    slots: (eventId: string) => request<EventSlot[]>(`/events/${eventId}/slots`),
    availabilityMe: (eventId: string) => request<{ slots: EventAvailabilitySlot[] }>(`/events/${eventId}/availability/me`),
    availabilityAdmin: (eventId: string) => request<EventAvailabilityAdmin>(`/events/${eventId}/availability`),
    shiftSettings: (eventId: string) => request<ShiftSettings>(`/events/${eventId}/shift-settings`),
    shiftRule: (eventId: string) => request<ShiftRule>(`/events/${eventId}/shift-rules`),
    generationSettings: (eventId: string) => request<ShiftGenerationSetting>(`/events/${eventId}/generation-settings`),
    update: (
      eventId: string,
      input: {
        name: string
        description: string | null
        location: string | null
        startDate: string | null
        endDate: string | null
        availabilityDeadline: string | null
        commonAvailabilitySetId: string | null
        status: EventItem['status']
      },
    ) =>
      request<EventItem>(`/events/${eventId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    delete: (eventId: string) =>
      request<DeletedResult>(`/events/${eventId}`, {
        method: 'DELETE',
      }),
    createSlot: (
      eventId: string,
      input: {
        date: string
        startTime: string
        endTime: string
        requiredPeople: number
        location: string | null
        note: string | null
      },
    ) =>
      request<EventSlot>(`/events/${eventId}/slots`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    bulkCreateSlots: (
      eventId: string,
      input: {
        startDate: string
        endDate: string
        weekdays: Array<string | number>
        timeBlocks: Array<{
          startTime: string
          endTime: string
          requiredPeople: number
          location: string | null
          note: string | null
        }>
        excludedDates: string[]
      },
    ) =>
      request<EventSlotBulkCreateResult>(`/events/${eventId}/slots/bulk`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    updateSlot: (
      eventId: string,
      slotId: string,
      input: {
        date: string
        startTime: string
        endTime: string
        requiredPeople: number
        location: string | null
        note: string | null
      },
    ) =>
      request<EventSlot>(`/events/${eventId}/slots/${slotId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    deleteSlot: (eventId: string, slotId: string) =>
      request<{ deleted: boolean }>(`/events/${eventId}/slots/${slotId}`, {
        method: 'DELETE',
      }),
    tasks: (eventId: string) => request<EventTask[]>(`/events/${eventId}/tasks`),
    createTask: (
      eventId: string,
      input: {
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
        teamId: string | null
        allowCrossTeamHelp: boolean
        color: string | null
        sortOrder: number
      },
    ) =>
      request<EventTask>(`/events/${eventId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    updateTask: (
      taskId: string,
      input: {
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
        teamId: string | null
        allowCrossTeamHelp: boolean
        color: string | null
        sortOrder: number
      },
    ) =>
      request<EventTask>(`/event-tasks/${taskId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    deleteTask: (taskId: string) =>
      request<{ deleted: boolean }>(`/event-tasks/${taskId}`, {
        method: 'DELETE',
      }),
    saveAvailabilityMe: (
      eventId: string,
      input: {
        slots: Array<{
          slotId: string
          status: AvailabilityStatus
          comment: string | null
        }>
      },
    ) =>
      request<{ saved: boolean }>(`/events/${eventId}/availability/me`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    updateShiftRule: (
      eventId: string,
      input: {
        slotMinutes: number
        minWorkMinutes: number
        maxWorkMinutes: number
        maxContinuousMinutes: number
        breakMinutes: number
        leaderRequiredPerSlot: number
      },
    ) =>
      request<ShiftRule>(`/events/${eventId}/shift-rules`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    updateGenerationSettings: (
      eventId: string,
      input: {
        preferenceWeight: number
        fairnessWeight: number
        balanceWorkloadWeight: number
        avoidContinuousWorkWeight: number
        leaderAssignmentWeight: number
        requiredPeopleWeight: number
      },
    ) =>
      request<ShiftGenerationSetting>(`/events/${eventId}/generation-settings`, {
        method: 'PUT',
        body: JSON.stringify(input),
      }),
    shifts: (eventId: string) => request<Shift[]>(`/events/${eventId}/shifts`),
    generateShifts: (eventId: string) =>
      request<ShiftGenerateResult>(`/events/${eventId}/shifts/generate`, {
        method: 'POST',
      }),
  },
  shifts: {
    show: (shiftId: string) => request<Shift>(`/shifts/${shiftId}`),
    publish: (shiftId: string) =>
      request<Shift>(`/shifts/${shiftId}/publish`, {
        method: 'POST',
      }),
    unpublish: (shiftId: string) =>
      request<Shift>(`/shifts/${shiftId}/unpublish`, {
        method: 'POST',
      }),
    delete: (shiftId: string) =>
      request<DeletedResult>(`/shifts/${shiftId}`, {
        method: 'DELETE',
      }),
  },
  eventTasks: {
    slots: (taskId: string) => request<EventSlot[]>(`/event-tasks/${taskId}/slots`),
    createSlot: (
      taskId: string,
      input: {
        startDatetime: string
        endDatetime: string
        requiredPeople: number
        status?: EventSlot['status']
        location?: string | null
        note?: string | null
      },
    ) =>
      request<EventSlot>(`/event-tasks/${taskId}/slots`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    bulkCreateSlots: (
      taskId: string,
      input: {
        startDate: string
        endDate: string
        weekdays: Array<string | number>
        timeBlocks: Array<{
          startTime: string
          endTime: string
          requiredPeople: number
          location: string | null
          note: string | null
        }>
        excludedDates: string[]
      },
    ) =>
      request<EventSlotBulkCreateResult>(`/event-tasks/${taskId}/slots/bulk`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  },
  eventSlots: {
    update: (
      slotId: string,
      input: {
        taskId?: string | null
        startDatetime: string
        endDatetime: string
        requiredPeople: number
        status?: EventSlot['status']
        location?: string | null
        note?: string | null
      },
    ) =>
      request<EventSlot>(`/event-slots/${slotId}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    delete: (slotId: string) =>
      request<{ deleted: boolean }>(`/event-slots/${slotId}`, {
        method: 'DELETE',
      }),
  },
}
