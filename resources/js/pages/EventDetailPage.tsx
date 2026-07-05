import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowRight,
  CalendarPlus,
  Edit3,
  EllipsisVertical,
  FolderKanban,
  MapPin,
  Plus,
  Trash2,
  Settings2,
  Users,
  Tag,
} from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '@/lib/api'
import type { ActivityRules, EventSlot, Team, Shift, ShiftGenerateResult, ShiftGenerationSetting, ShiftRule } from '@/types/api'
import { ActionMenu } from '@/components/ui/ActionMenu'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { DateField } from '@/components/ui/DateField'
import { TabBar } from '@/components/ui/TabBar'
import { canManageEvent, canManageGroup } from '@/lib/permissions'
import { PeriodPreview } from '@/components/availability/PeriodPreview'
import { ActivityRulesFields, createDefaultActivityRules } from '@/components/availability/ActivityRulesFields'
import { AvailabilityReminderList } from '@/components/availability/AvailabilityReminderList'
import {
  hideEventGuideLocally,
  isEventGuideHiddenLocally,
} from '@/lib/onboarding'

const eventSchema = z.object({
  name: z.string().min(1, 'イベント名を入力してください').max(255),
  description: z.string().max(1000).optional().transform((value) => value?.trim() || ''),
  location: z.string().max(255).optional().transform((value) => value?.trim() || ''),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  availabilityDeadline: z.string().nullable(),
  commonAvailabilitySetId: z.string().optional().transform((value) => value?.trim() || ''),
  status: z.enum(['draft', 'collecting', 'generated', 'published', 'closed']),
})

const availabilitySetSchema = z.object({
  name: z.string().min(1, '期間名を入力してください').max(255),
  description: z.string().max(1000).optional().transform((value) => value?.trim() || ''),
  startDate: z.string().min(1, '開始日を入力してください'),
  endDate: z.string().min(1, '終了日を入力してください'),
  deadline: z.string().optional().transform((value) => value?.trim() || ''),
}).refine((value) => value.startDate <= value.endDate, {
  message: '終了日は開始日以降にしてください',
  path: ['endDate'],
})

const slotSchema = z.object({
  taskId: z.string().min(1, '作業を選択してください'),
  date: z.string().min(1, '日付を入力してください'),
  startTime: z.string().min(1, '開始時刻を入力してください'),
  endTime: z.string().min(1, '終了時刻を入力してください'),
  requiredPeople: z.coerce.number().int().min(1, '必要人数は1以上で入力してください'),
  location: z.string().max(255).optional().transform((value) => value?.trim() || ''),
  note: z.string().max(2000).optional().transform((value) => value?.trim() || ''),
})

const teamSchema = z.object({
  name: z.string().min(1, '班名を入力してください').max(255),
  description: z.string().max(1000).optional().transform((value) => value?.trim() || ''),
  color: z.string().max(32).optional().transform((value) => value?.trim() || ''),
})

type EventFormValues = z.infer<typeof eventSchema>
type SlotFormValues = z.infer<typeof slotSchema>
type TeamFormValues = z.infer<typeof teamSchema>
type AvailabilitySetFormValues = z.infer<typeof availabilitySetSchema>

type BulkTimeBlock = {
  startTime: string
  endTime: string
  requiredPeople: number
  location: string
  note: string
}

const weekdayOptions = [
  { label: '日', value: 0 },
  { label: '月', value: 1 },
  { label: '火', value: 2 },
  { label: '水', value: 3 },
  { label: '木', value: 4 },
  { label: '金', value: 5 },
  { label: '土', value: 6 },
] as const

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toDateInputValue(value: string | null | undefined): string {
  if (!value) {
    return ''
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return formatLocalDate(parsed)
}

function todayDateInput(): string {
  return formatLocalDate(new Date())
}

function dateInputAfter(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return formatLocalDate(date)
}

const emptySlotValues: SlotFormValues = {
  taskId: '',
  date: '',
  startTime: '',
  endTime: '',
  requiredPeople: 1,
  location: '',
  note: '',
}

export function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [eventEditOpen, setEventEditOpen] = useState(false)
  const [slotModalOpen, setSlotModalOpen] = useState(false)
  const [bulkSlotModalOpen, setBulkSlotModalOpen] = useState(false)
  const [editingSlot, setEditingSlot] = useState<EventSlot | null>(null)
  const [bulkStartDate, setBulkStartDate] = useState('')
  const [bulkEndDate, setBulkEndDate] = useState('')
  const [bulkWeekdays, setBulkWeekdays] = useState<number[]>([])
  const [bulkExcludedDates, setBulkExcludedDates] = useState<string[]>([])
  const [bulkExcludedDateInput, setBulkExcludedDateInput] = useState('')
  const [bulkTimeBlocks, setBulkTimeBlocks] = useState<BulkTimeBlock[]>([
    { startTime: '09:00', endTime: '12:00', requiredPeople: 1, location: '', note: '' },
  ])
  const [bulkTaskId, setBulkTaskId] = useState('')
  const [shiftGenerateOpen, setShiftGenerateOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'teams' | 'tasks' | 'slots' | 'settings' | 'shifts'>('overview')
  const [actionMenuOpen, setActionMenuOpen] = useState(false)
  const [teamModalOpen, setTeamModalOpen] = useState(false)
  const [availabilitySetOpen, setAvailabilitySetOpen] = useState(false)
  const [availabilityActivityRules, setAvailabilityActivityRules] = useState<ActivityRules>(() => createDefaultActivityRules())
  const [shiftRuleDraft, setShiftRuleDraft] = useState<Omit<ShiftRule, 'id' | 'eventId'>>({
    slotMinutes: 60,
    minWorkMinutes: 0,
    maxWorkMinutes: 360,
    maxContinuousMinutes: 180,
    breakMinutes: 0,
    leaderRequiredPerSlot: 0,
  })
  const [generationDraft, setGenerationDraft] = useState<Omit<ShiftGenerationSetting, 'id' | 'eventId'>>({
    preferenceWeight: 50,
    fairnessWeight: 50,
    balanceWorkloadWeight: 50,
    avoidContinuousWorkWeight: 50,
    leaderAssignmentWeight: 50,
    requiredPeopleWeight: 50,
  })
  const [selectedTaskId, setSelectedTaskId] = useState('')
  const [latestGenerateResult, setLatestGenerateResult] = useState<ShiftGenerateResult | null>(null)
  const [guideHidden, setGuideHidden] = useState(() => isEventGuideHiddenLocally())
  const [guideOpen, setGuideOpen] = useState(() => !isEventGuideHiddenLocally())

  const eventQuery = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api.events.show(eventId ?? ''),
    enabled: Boolean(eventId),
  })
  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: api.auth.me,
    retry: false,
  })
  const slotsQuery = useQuery({
    queryKey: ['event', eventId, 'slots'],
    queryFn: () => api.events.slots(eventId ?? ''),
    enabled: Boolean(eventId),
  })
  const tasksQuery = useQuery({
    queryKey: ['event', eventId, 'tasks'],
    queryFn: () => api.events.tasks(eventId ?? ''),
    enabled: Boolean(eventId),
  })
  const eventTeamsQuery = useQuery({
    queryKey: ['event', eventId, 'teams'],
    queryFn: () => api.events.teams(eventId ?? ''),
    enabled: Boolean(eventId),
  })
  const groupQuery = useQuery({
    queryKey: ['group', eventQuery.data?.groupId],
    queryFn: () => api.groups.show(eventQuery.data?.groupId ?? ''),
    enabled: Boolean(eventQuery.data?.groupId),
  })
  const availabilitySetsQuery = useQuery({
    queryKey: ['event', eventId, 'availability-sets'],
    queryFn: () => api.events.availabilitySets(eventId ?? ''),
    enabled: Boolean(eventId),
  })
  const ownAvailabilityQuery = useQuery({
    queryKey: ['event', eventId, 'availability-set', eventQuery.data?.commonAvailabilitySetId, 'me'],
    queryFn: () => api.commonAvailabilitySets.me(eventQuery.data?.commonAvailabilitySetId ?? ''),
    enabled: Boolean(eventQuery.data?.commonAvailabilitySetId),
  })
  const shiftSettingsQuery = useQuery({
    queryKey: ['event', eventId, 'shift-settings'],
    queryFn: () => api.events.shiftSettings(eventId ?? ''),
    enabled: Boolean(eventId),
  })
  const shiftsQuery = useQuery({
    queryKey: ['event', eventId, 'shifts'],
    queryFn: () => api.events.shifts(eventId ?? ''),
    enabled: Boolean(eventId),
  })

  const eventForm = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: '',
      description: '',
      location: '',
      startDate: '',
      endDate: '',
      availabilityDeadline: '',
      commonAvailabilitySetId: '',
      status: 'draft',
    },
  })

  const slotForm = useForm<SlotFormValues>({
    resolver: zodResolver(slotSchema),
    defaultValues: emptySlotValues,
  })
  const teamForm = useForm<TeamFormValues>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: '',
      description: '',
      color: '#7c3aed',
    },
  })
  const availabilitySetForm = useForm<AvailabilitySetFormValues>({
    resolver: zodResolver(availabilitySetSchema),
    defaultValues: {
      name: '',
      description: '',
      startDate: '',
      endDate: '',
      deadline: '',
    },
  })

  const event = eventQuery.data
  const slots = useMemo(() => slotsQuery.data ?? [], [slotsQuery.data])
  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data])
  const teams = useMemo(() => eventTeamsQuery.data ?? [], [eventTeamsQuery.data])
  const isOwner = groupQuery.data?.myRole === 'owner'
  const isTeamLeader = useMemo(
    () => teams.some((team) => team.leader?.userId === meQuery.data?.id),
    [meQuery.data?.id, teams],
  )
  const canManageGroupWorkspace = canManageGroup(groupQuery.data)
  const canManageEventWorkspace = canManageEvent(groupQuery.data?.myRole, isTeamLeader)
  const availabilitySets = useMemo(
    () => (Array.isArray(availabilitySetsQuery.data) ? availabilitySetsQuery.data : []),
    [availabilitySetsQuery.data],
  )

  useEffect(() => {
    if (!shiftSettingsQuery.data) {
      return
    }

    setShiftRuleDraft({
      slotMinutes: shiftSettingsQuery.data.shiftRule.slotMinutes,
      minWorkMinutes: shiftSettingsQuery.data.shiftRule.minWorkMinutes,
      maxWorkMinutes: shiftSettingsQuery.data.shiftRule.maxWorkMinutes,
      maxContinuousMinutes: shiftSettingsQuery.data.shiftRule.maxContinuousMinutes,
      breakMinutes: shiftSettingsQuery.data.shiftRule.breakMinutes,
      leaderRequiredPerSlot: shiftSettingsQuery.data.shiftRule.leaderRequiredPerSlot,
    })
    setGenerationDraft({
      preferenceWeight: shiftSettingsQuery.data.generationSetting.preferenceWeight,
      fairnessWeight: shiftSettingsQuery.data.generationSetting.fairnessWeight,
      balanceWorkloadWeight: shiftSettingsQuery.data.generationSetting.balanceWorkloadWeight,
      avoidContinuousWorkWeight: shiftSettingsQuery.data.generationSetting.avoidContinuousWorkWeight,
      leaderAssignmentWeight: shiftSettingsQuery.data.generationSetting.leaderAssignmentWeight,
      requiredPeopleWeight: shiftSettingsQuery.data.generationSetting.requiredPeopleWeight,
    })
  }, [shiftSettingsQuery.data])
  const availabilitySetPreview = availabilitySetForm.watch()
  const currentAvailabilitySet = useMemo(
    () => availabilitySets.find((set) => set.id === event?.commonAvailabilitySetId) ?? null,
    [availabilitySets, event?.commonAvailabilitySetId],
  )
  const shifts = useMemo(() => shiftsQuery.data ?? [], [shiftsQuery.data])
  const selectedBulkTask = tasks.find((task) => task.id === bulkTaskId) ?? null
  const teamsLoading = eventTeamsQuery.isLoading
  const guideRoleLabel = isOwner ? 'オーナー向け' : canManageEventWorkspace ? '班向け' : '閲覧用'

  useEffect(() => {
    if (eventQuery.data) {
      eventForm.reset({
        name: eventQuery.data.name,
        description: eventQuery.data.description ?? '',
        location: eventQuery.data.location ?? '',
        startDate: toDateInputValue(eventQuery.data.startDate),
        endDate: toDateInputValue(eventQuery.data.endDate),
        availabilityDeadline: toDateInputValue(eventQuery.data.availabilityDeadline),
        commonAvailabilitySetId: eventQuery.data.commonAvailabilitySetId ?? '',
        status: eventQuery.data.status,
      })
    }
  }, [eventQuery.data, eventForm])

  useEffect(() => {
    if (!availabilitySetOpen) {
      return
    }

    availabilitySetForm.reset({
      name: '',
      description: '',
      startDate: toDateInputValue(event?.startDate),
      endDate: toDateInputValue(event?.endDate),
      deadline: toDateInputValue(event?.availabilityDeadline),
    })
  }, [availabilitySetForm, availabilitySetOpen, event?.availabilityDeadline, event?.endDate, event?.startDate])

  const updateEventMutation = useMutation({
    mutationFn: (values: EventFormValues) =>
      api.events.update(eventId ?? '', {
        name: values.name,
        description: values.description || null,
        location: values.location || null,
        startDate: values.startDate || null,
        endDate: values.endDate || null,
        availabilityDeadline: values.availabilityDeadline || null,
        commonAvailabilitySetId: values.commonAvailabilitySetId || null,
        status: values.status,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['event', eventId] })
      setEventEditOpen(false)
    },
  })

  const assignAvailabilitySetMutation = useMutation({
    mutationFn: (commonAvailabilitySetId: string | null) =>
      api.events.update(eventId ?? '', {
        name: event?.name ?? '',
        description: event?.description ?? null,
        location: event?.location ?? null,
        startDate: toDateInputValue(event?.startDate) || null,
        endDate: toDateInputValue(event?.endDate) || null,
        availabilityDeadline: toDateInputValue(event?.availabilityDeadline) || null,
        commonAvailabilitySetId,
        status: event?.status ?? 'draft',
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['event', eventId] })
      await queryClient.invalidateQueries({ queryKey: ['event', eventId, 'availability-sets'] })
    },
  })

  const createAvailabilitySetMutation = useMutation({
    mutationFn: (values: AvailabilitySetFormValues) =>
      api.groups.createCommonAvailabilitySet(event?.groupId ?? '', {
        name: values.name,
        description: values.description || null,
        startDate: values.startDate,
        endDate: values.endDate,
        deadline: values.deadline || null,
        activityRules: availabilityActivityRules,
      }),
    onSuccess: async (createdSet) => {
      await assignAvailabilitySetMutation.mutateAsync(createdSet.id)
      await queryClient.invalidateQueries({ queryKey: ['event', eventId] })
      await queryClient.invalidateQueries({ queryKey: ['event', eventId, 'availability-sets'] })
      await queryClient.invalidateQueries({ queryKey: ['group', event?.groupId, 'common-availability-sets'] })
      setAvailabilitySetOpen(false)
      availabilitySetForm.reset({
        name: '',
        description: '',
        startDate: '',
        endDate: '',
        deadline: '',
      })
      setAvailabilityActivityRules(createDefaultActivityRules())
    },
  })

  const createSlotMutation = useMutation({
    mutationFn: (values: SlotFormValues) =>
      api.eventTasks.createSlot(values.taskId, {
        startDatetime: `${values.date}T${values.startTime}:00`,
        endDatetime: `${values.date}T${values.endTime}:00`,
        requiredPeople: values.requiredPeople,
        status: 'open',
        location: values.location || null,
        note: values.note || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['event', eventId, 'slots'] })
      setSlotModalOpen(false)
      setEditingSlot(null)
      setSelectedTaskId('')
      slotForm.reset(emptySlotValues)
    },
  })

  const updateSlotMutation = useMutation({
    mutationFn: (values: SlotFormValues) =>
      api.eventSlots.update(editingSlot?.id ?? '', {
        taskId: values.taskId || null,
        startDatetime: `${values.date}T${values.startTime}:00`,
        endDatetime: `${values.date}T${values.endTime}:00`,
        requiredPeople: values.requiredPeople,
        status: editingSlot?.status ?? 'open',
        location: values.location || null,
        note: values.note || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['event', eventId, 'slots'] })
      setSlotModalOpen(false)
      setEditingSlot(null)
      setSelectedTaskId('')
      slotForm.reset(emptySlotValues)
    },
  })

  const deleteSlotMutation = useMutation({
    mutationFn: (slotId: string) => api.eventSlots.delete(slotId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['event', eventId, 'slots'] })
    },
  })

  const createTeamMutation = useMutation({
    mutationFn: (values: TeamFormValues) =>
      api.events.createTeam(eventId ?? '', {
        name: values.name,
        description: values.description || null,
        color: values.color || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['event', eventId, 'teams'] })
      setTeamModalOpen(false)
      teamForm.reset({
        name: '',
        description: '',
        color: '#7c3aed',
      })
    },
  })

  const deleteEventMutation = useMutation({
    mutationFn: () => api.events.delete(eventId ?? ''),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['group', event?.groupId, 'events'] })
      await queryClient.invalidateQueries({ queryKey: ['groups'] })
      navigate(event?.groupId ? `/groups/${event.groupId}` : '/events')
    },
  })

  const generateShiftsMutation = useMutation({
    mutationFn: async () => {
      const targetEventId = eventId ?? ''
      await api.events.updateShiftRule(targetEventId, shiftRuleDraft)
      await api.events.updateGenerationSettings(targetEventId, generationDraft)
      return api.events.generateShifts(targetEventId)
    },
    onSuccess: async (result) => {
      setLatestGenerateResult(result)
      setShiftGenerateOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['event', eventId, 'shift-settings'] })
      await queryClient.invalidateQueries({ queryKey: ['event', eventId, 'shifts'] })
    },
  })

  const bulkCreateMutation = useMutation({
    mutationFn: () =>
      api.eventTasks.bulkCreateSlots(bulkTaskId, {
        startDate: bulkStartDate,
        endDate: bulkEndDate,
        weekdays: bulkWeekdays,
        timeBlocks: bulkTimeBlocks.map((block) => ({
          startTime: block.startTime,
          endTime: block.endTime,
          requiredPeople: block.requiredPeople,
          location: block.location || null,
          note: block.note || null,
        })),
        excludedDates: bulkExcludedDates,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['event', eventId, 'slots'] })
      setBulkSlotModalOpen(false)
      setBulkTaskId('')
      setBulkWeekdays([])
      setBulkExcludedDates([])
      setBulkExcludedDateInput('')
      setBulkTimeBlocks([{ startTime: '09:00', endTime: '12:00', requiredPeople: 1, location: '', note: '' }])
    },
  })

  const latestShift: Shift | null = latestGenerateResult?.shift ?? shifts[0] ?? null
  const shiftMetrics = latestGenerateResult?.metrics ?? null
  const shiftWarnings = latestGenerateResult?.warnings ?? []
  const visibleTabs = useMemo(() => {
    if (canManageGroupWorkspace) {
      return ['overview', 'teams', 'tasks', 'slots', 'shifts', 'settings'] as const
    }

    if (canManageEventWorkspace) {
      return ['overview', 'teams', 'tasks', 'slots', 'shifts'] as const
    }

    return ['overview', 'teams', 'shifts'] as const
  }, [canManageEventWorkspace, canManageGroupWorkspace])

  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab(visibleTabs[0])
    }
  }, [activeTab, visibleTabs])

  const assignmentsBySlot = useMemo(() => {
    if (!latestShift) return []

    const grouped = latestShift.assignments.reduce<Record<string, Shift['assignments']>>((acc, assignment) => {
      const key = assignment.eventSlotId
      acc[key] = [...(acc[key] ?? []), assignment]
      return acc
    }, {})

    return (slotsQuery.data ?? []).map((slot) => ({
      slot,
      assignments: grouped[slot.id] ?? [],
    }))
  }, [latestShift, slotsQuery.data])
  const bulkPreviewCount = useMemo(() => {
    if (!bulkTaskId || !bulkStartDate || !bulkEndDate || bulkWeekdays.length === 0 || bulkTimeBlocks.length === 0) {
      return 0
    }

    const start = new Date(`${bulkStartDate}T00:00:00`)
    const end = new Date(`${bulkEndDate}T00:00:00`)
    const excluded = new Set(bulkExcludedDates)
    const existing = new Set(
      slots
        .filter((slot) => slot.taskId === bulkTaskId)
        .map((slot) => `${slot.date}|${slot.startTime}|${slot.endTime}`),
    )

    let count = 0
    for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
      const weekday = current.getDay()
      if (!bulkWeekdays.includes(weekday)) continue
      const date = formatLocalDate(current)
      if (excluded.has(date)) continue

      for (const block of bulkTimeBlocks) {
        if (!block.startTime || !block.endTime || Number(block.requiredPeople) < 1) continue
        if (existing.has(`${date}|${block.startTime}|${block.endTime}`)) continue
        count += 1
      }
    }

    return count
  }, [bulkEndDate, bulkExcludedDates, bulkStartDate, bulkTaskId, bulkTimeBlocks, bulkWeekdays, slots])
  const slotGroups = useMemo(() => {
    const grouped = tasks.map((task) => ({
      task,
      slots: slots.filter((slot) => slot.taskId === task.id),
    }))
    const unassigned = slots.filter((slot) => !slot.taskId)

    return unassigned.length
      ? [
          ...grouped,
          {
            task: null,
            slots: unassigned,
          },
        ]
      : grouped
  }, [slots, tasks])
  const recentSlots = useMemo(() => slots.slice(0, 3), [slots])
  useEffect(() => {
    if (!selectedTaskId && tasks.length) {
      setSelectedTaskId(tasks[0].id)
    }
  }, [selectedTaskId, tasks])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && ['overview', 'teams', 'tasks', 'slots', 'settings', 'shifts'].includes(tab)) {
      setActiveTab(tab as typeof activeTab)
    }
  }, [searchParams])

  useEffect(() => {
    if (searchParams.get('open') === 'availability-set') {
      setActiveTab('slots')
      setAvailabilitySetOpen(true)
    }
  }, [searchParams])

  useEffect(() => {
    if (guideHidden) {
      setGuideOpen(false)
    } else {
      setGuideOpen(true)
    }
  }, [guideHidden, eventId])

  if (!eventId) {
    return <EmptyState title="イベントが見つかりません" description="URLを確認してください。" />
  }

  const openCreateSlotModalForTask = (taskId: string) => {
    setEditingSlot(null)
    setSelectedTaskId(taskId)
    setSlotModalOpen(true)
  }

  const openEditSlotModal = (slot: EventSlot) => {
    setEditingSlot(slot)
    setSelectedTaskId(slot.taskId ?? tasks[0]?.id ?? '')
    setSlotModalOpen(true)
  }

  const openBulkSlotModal = (taskId?: string) => {
    setBulkTaskId(taskId ?? tasks[0]?.id ?? '')
    setBulkSlotModalOpen(true)
  }

  useEffect(() => {
    if (slotModalOpen) {
      if (editingSlot) {
        slotForm.reset({
          taskId: editingSlot.taskId ?? '',
          date: editingSlot.date,
          startTime: editingSlot.startTime.slice(0, 5),
          endTime: editingSlot.endTime.slice(0, 5),
          requiredPeople: editingSlot.requiredPeople,
          location: editingSlot.location ?? '',
          note: editingSlot.note ?? '',
        })
      } else {
        slotForm.reset({
          ...emptySlotValues,
          taskId: selectedTaskId || tasks[0]?.id || '',
        })
      }
    }
  }, [editingSlot, selectedTaskId, slotForm, slotModalOpen, tasks])

  const guideContext = useMemo(() => {
    if (isOwner) {
      if (teams.length === 0) {
        return {
          title: 'まず班を作る',
          description: '装飾班や受付班を追加すると、あとが整理しやすくなります。',
          primaryLabel: '班を作成',
          primaryAction: () => setTeamModalOpen(true),
          tone: 'amber',
          actionHint: '班を追加して、作業のまとまりを作ります。',
        } as const
      }

      if (availabilitySets.length === 0) {
        return {
          title: '期間を作る',
          description: 'このイベントで使う参加確認の期間を先に決めます。',
          primaryLabel: '期間を作る',
          primaryAction: () => setAvailabilitySetOpen(true),
          tone: 'violet',
          actionHint: '参加確認の期間を先に用意します。',
        } as const
      }

      if (shifts.length === 0) {
        return {
          title: 'シフトを作る',
          description: '班と期間がそろったら、下書きを作れます。',
          primaryLabel: 'シフトを見る',
          primaryAction: () => setActiveTab('shifts'),
          tone: 'emerald',
          actionHint: '作成済みの内容を一覧で見ます。',
        } as const
      }

      return {
        title: 'シフトを見る',
        description: '公開前の内容を確認できます。',
        primaryLabel: 'シフトを見る',
        primaryAction: () => setActiveTab('shifts'),
        tone: 'slate',
        actionHint: '公開前のシフトを確認します。',
      } as const
    }

    if (canManageEventWorkspace) {
      return {
        title: '作業を見る',
        description: '班ごとの作業や日時を見ます。',
        primaryLabel: '作業を見る',
        primaryAction: () => setActiveTab('tasks'),
        tone: 'violet',
        actionHint: '作業の一覧を開きます。',
      } as const
    }

    return {
      title: 'シフトを見る',
      description: '公開された内容を確認します。',
      primaryLabel: 'シフトを見る',
      primaryAction: () => setActiveTab('shifts'),
      tone: 'slate',
      actionHint: '公開済みのシフトを確認します。',
    } as const
  }, [availabilitySets.length, canManageEventWorkspace, isOwner, shifts.length, teams.length])

  const guideToneClass =
    {
      amber: 'border-amber-200 bg-amber-50 text-amber-900',
      violet: 'border-violet-200 bg-violet-50 text-violet-900',
      emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      slate: 'border-slate-200 bg-slate-50 text-slate-900',
    }[guideContext.tone] ?? 'border-slate-200 bg-slate-50 text-slate-900'

  const guideItems = useMemo(() => {
    if (isOwner) {
      return [
        {
          title: teams.length === 0 ? '班を追加' : '班を見る',
          description: teams.length === 0 ? '受付班や装飾班を先に分けます。' : '班一覧を確認します。',
        },
        {
          title: availabilitySets.length === 0 ? '期間を作る' : '期間を見る',
          description: availabilitySets.length === 0 ? '参加確認の期間を準備します。' : '使っている期間を確認します。',
        },
        {
          title: shifts.length === 0 ? 'シフトを作る' : 'シフトを見る',
          description: shifts.length === 0 ? '下書きを作成します。' : '作成済みのシフトを確認します。',
        },
      ]
    }

    if (canManageEventWorkspace) {
      return [
        { title: '作業を見る', description: '班ごとの作業を確認します。' },
        { title: '期間を見る', description: 'イベントの期間を確認します。' },
        { title: 'シフトを見る', description: '作成済みの内容を確認します。' },
      ]
    }

    return [
      { title: 'シフトを見る', description: '公開された内容だけ確認します。' },
      { title: '必要な情報を見る', description: '自分に関係する内容だけ表示します。' },
      { title: '閉じる', description: '案内はいつでも閉じられます。' },
    ]
  }, [availabilitySets.length, canManageEventWorkspace, isOwner, shifts.length, teams.length])

  const menuItems = [
    { label: 'イベントを編集', onClick: () => setEventEditOpen(true) },
    { label: '班を作成', onClick: () => setTeamModalOpen(true) },
    ...(isOwner
      ? [
          { label: 'シフトを作成', onClick: () => setShiftGenerateOpen(true) },
        ]
      : []),
    {
      label: 'イベントを削除',
      onClick: () => {
        if (window.confirm('このイベントを削除しますか？作業、期間、シフトも一緒に削除されます。')) {
          deleteEventMutation.mutate()
        }
      },
    },
  ]

  const taskGroups = useMemo(() => {
    const groupedByTeam = teams.map((team) => ({
      team,
      tasks: tasks.filter((task) => task.teamId === team.id),
    }))
    const unassigned = tasks.filter((task) => !task.teamId)

    return unassigned.length
      ? [...groupedByTeam, { team: null, tasks: unassigned }]
      : groupedByTeam
  }, [tasks, teams])
  const hasOwnAvailabilityInput = ownAvailabilityQuery.data?.slots.some(
    (slot) => slot.availabilityStatus === 'available' || slot.availabilityStatus === 'preferred',
  ) ?? false
  const eventPendingAvailabilitySets = currentAvailabilitySet && !hasOwnAvailabilityInput ? [currentAvailabilitySet] : []

  return (
    <div className="space-y-4 pb-32 md:pb-0">
      <PageHeader
        title={event?.name ?? 'イベント詳細'}
        description={event?.description ?? '班・期間・シフトを整理します。'}
        action={
          <div className="hidden items-center gap-3 md:flex">
            {event?.groupId ? (
              <Button variant="secondary" leftIcon={<FolderKanban className="h-4 w-4" />} onClick={() => navigate(`/groups/${event.groupId}`)}>
                グループへ戻る
              </Button>
            ) : null}
            {currentAvailabilitySet ? (
              <Button variant="secondary" onClick={() => navigate(`/availability-sets/${currentAvailabilitySet.id}`)}>
                期間を開く
              </Button>
            ) : null}
            {canManageGroupWorkspace ? (
              <>
                <Button variant="secondary" leftIcon={<CalendarPlus className="h-4 w-4" />} onClick={() => setAvailabilitySetOpen(true)}>
                  期間を作る
                </Button>
                <div className="relative">
                  <Button variant="secondary" onClick={() => setActionMenuOpen((current) => !current)} aria-label="その他の操作">
                    <EllipsisVertical className="h-4 w-4" />
                  </Button>
                  {actionMenuOpen ? (
                    <div className="absolute right-0 top-12 z-40 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                      {menuItems.map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            setActionMenuOpen(false)
                            item.onClick()
                          }}
                          className={[
                            'flex w-full items-center px-4 py-3 text-left text-sm transition hover:bg-slate-50',
                            item.label === 'イベントを削除' ? 'text-rose-600' : 'text-slate-700',
                          ].join(' ')}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        }
      />

      <AvailabilityReminderList
        sets={eventPendingAvailabilitySets}
        loading={ownAvailabilityQuery.isLoading && Boolean(currentAvailabilitySet)}
        compact
      />

      <Card className="space-y-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={event?.status === 'collecting' ? 'warning' : event?.status === 'published' ? 'success' : 'brand'}>
                {event?.status === 'draft'
                  ? '下書き'
                  : event?.status === 'collecting'
                    ? '準備中'
                    : event?.status === 'generated'
                      ? 'シフト作成済み'
                      : event?.status === 'published'
                        ? '公開済み'
                        : '終了'}
              </Badge>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 md:text-2xl">{event?.name ?? 'イベント詳細'}</h2>
              {event?.description ? <p className="mt-2 text-sm leading-6 text-slate-500">{event.description}</p> : null}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[380px]">
            {canManageGroupWorkspace ? (
              <>
                <Card className="bg-slate-50">
                  <p className="text-xs font-medium text-slate-500">班</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{teams.length}件</p>
                </Card>
                <Card className="bg-slate-50">
                  <p className="text-xs font-medium text-slate-500">期間</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{availabilitySets.length}件</p>
                </Card>
                <Card className="bg-slate-50">
                  <p className="text-xs font-medium text-slate-500">作業</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{tasks.length}件</p>
                </Card>
                <Card className="bg-slate-50">
                  <p className="text-xs font-medium text-slate-500">シフト</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{shifts.length}件</p>
                </Card>
              </>
            ) : (
              <>
                <Card className="bg-slate-50">
                  <p className="text-xs font-medium text-slate-500">参加確認</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{availabilitySets.length}件</p>
                </Card>
                <Card className="bg-slate-50">
                  <p className="text-xs font-medium text-slate-500">シフト</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{shifts.length}件</p>
                </Card>
              </>
            )}
          </div>
        </div>

      </Card>

      <TabBar
        value={activeTab}
        onChange={setActiveTab}
        items={
          canManageGroupWorkspace
            ? [
                { key: 'overview', label: '概要' },
                { key: 'teams', label: '班', count: teams.length },
                { key: 'tasks', label: '作業', count: tasks.length },
                { key: 'slots', label: '期間設定', count: availabilitySets.length },
                { key: 'shifts', label: 'シフト', count: shifts.length },
                { key: 'settings', label: '設定' },
              ]
            : canManageEventWorkspace
              ? [
                  { key: 'overview', label: '概要' },
                  { key: 'teams', label: '班', count: teams.length },
                  { key: 'tasks', label: '作業', count: tasks.length },
                  { key: 'slots', label: '期間設定', count: availabilitySets.length },
                  { key: 'shifts', label: 'シフト', count: shifts.length },
                ]
              : [
                  { key: 'overview', label: '概要' },
                  { key: 'teams', label: '班', count: teams.length },
                  { key: 'shifts', label: 'シフト', count: shifts.length },
                ]
        }
      />

      {activeTab === 'overview' ? (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <Card className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">イベント</h2>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setActiveTab('teams')} leftIcon={<ArrowRight className="h-4 w-4" />}>
                  班を見る
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="neutral">
                  {event?.location || '場所未設定'}
                </Badge>
                <Badge variant="brand">
                  {currentAvailabilitySet ? `期間: ${currentAvailabilitySet.name}` : '期間未設定'}
                </Badge>
                <Badge variant={event?.status === 'collecting' ? 'warning' : event?.status === 'published' ? 'success' : 'brand'}>
                  {event?.status === 'draft'
                    ? '下書き'
                    : event?.status === 'collecting'
                      ? '準備中'
                      : event?.status === 'generated'
                        ? 'シフト作成済み'
                        : event?.status === 'published'
                          ? '公開済み'
                          : '終了'}
                </Badge>
                {canManageGroupWorkspace ? <Badge variant="neutral">{teams.length}班</Badge> : null}
              </div>
              {event?.description ? <p className="text-sm leading-7 text-slate-700">{event.description}</p> : null}
            </Card>
          </div>

          <Card className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">直近の日時</h2>
              </div>
              <Badge variant="info">{recentSlots.length}件</Badge>
            </div>
            {recentSlots.length ? (
              <div className="space-y-3">
                {recentSlots.map((slot) => (
                  <Card key={slot.id} className="bg-slate-50">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{slot.date}</p>
                        <p className="text-sm text-slate-500">
                          {slot.startTime.slice(0, 5)} - {slot.endTime.slice(0, 5)}
                          {slot.location ? ` / ${slot.location}` : ''}
                        </p>
                      </div>
                      <Badge variant="neutral">{slot.requiredPeople}人</Badge>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <EmptyState
                title={tasks.length === 0 ? 'まず班を開きましょう' : 'このイベントの作業はまだ少なめです'}
                description={
                  tasks.length === 0
                    ? '作業は班のページで管理します。まず班を開いて、役割を整理しましょう。'
                    : '作業は班ページで追加します。まず班を開いて、役割を整理しましょう。'
                }
                actionLabel="班ページを見る"
                onAction={() => setActiveTab('teams')}
              />
            )}
          </Card>
        </div>
      ) : null}

      {activeTab === 'teams' ? (
        <Card className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-violet-600" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">班一覧</h2>
              </div>
            </div>
            {canManageGroupWorkspace ? (
              <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setTeamModalOpen(true)}>
                班を作成
              </Button>
            ) : null}
          </div>
          {teamsLoading ? (
            <p className="text-sm text-slate-500">読み込み中...</p>
          ) : teams.length ? (
            <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {teams.map((team: Team) => (
                  <Link key={team.id} to={`/teams/${team.id}`} className="flex flex-col gap-3 p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: team.color ?? '#7c3aed' }} />
                        <p className="truncate font-semibold text-slate-900">{team.name}</p>
                        <Badge variant="neutral">{team.memberCount}人</Badge>
                        {team.leader ? <Badge variant="brand">{team.leader.displayName ?? 'リーダー'}</Badge> : null}
                      </div>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <Badge variant="neutral">詳細を見る</Badge>
                    </div>
                  </Link>
                ))}
              </div>
          ) : (
            <EmptyState
              title="班がまだありません"
              description={canManageGroupWorkspace ? '必要ならここから追加できます。' : 'このイベントに班はまだありません。'}
              actionLabel={canManageGroupWorkspace ? '班を作成' : undefined}
              onAction={canManageGroupWorkspace ? () => setTeamModalOpen(true) : undefined}
            />
          )}
        </Card>
      ) : null}

      {activeTab === 'tasks' ? (
        <Card className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-violet-600" />
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">作業一覧</h2>
                </div>
              </div>
              <Button
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => setActiveTab('teams')}
              disabled={teams.length === 0}
            >
              班を開く
            </Button>
          </div>

          {tasksQuery.isLoading ? (
            <p className="text-sm text-slate-500">読み込み中...</p>
          ) : teams.length === 0 ? (
            <EmptyState
              title="先に班を作りましょう"
              description="まず班を作ると進めやすくなります。"
              actionLabel="班を作成"
              onAction={() => setTeamModalOpen(true)}
            />
          ) : taskGroups.length ? (
            <div className="space-y-5">
              {taskGroups.map((group) => (
                <section key={group.team?.id ?? 'unassigned'} className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold text-slate-900">{group.team?.name ?? '班未設定の作業'}</h3>
                        {group.team?.isDefault ? <Badge variant="brand">全体班</Badge> : null}
                        {group.team ? <Badge variant="neutral">{group.tasks.length}件</Badge> : <Badge variant="warning">{group.tasks.length}件</Badge>}
                      </div>
                    </div>
                    {group.team ? (
                      <Link
                        to={`/teams/${group.team.id}`}
                        className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      >
                        班を開く
                      </Link>
                    ) : null}
                  </div>

                  {group.tasks.length ? (
                    <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      {group.tasks.map((task) => (
                        <div key={task.id} className="flex flex-col gap-4 p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:px-5">
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <div className="h-11 w-11 shrink-0 rounded-2xl" style={{ backgroundColor: task.color ?? '#7c3aed' }} />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate font-semibold text-slate-900">{task.name}</p>
                                {task.team ? <Badge variant="neutral">{task.team.name}</Badge> : <Badge variant="warning">班未設定</Badge>}
                                {task.allowCrossTeamHelp ? <Badge variant="info">ヘルプ可</Badge> : null}
                        {task.requiredMemberIds?.length ? <Badge variant="warning">担当 {task.requiredMemberIds.length}人</Badge> : null}
                                {task.workStartDate || task.workEndDate ? (
                                  <Badge variant="brand">
                                    {task.workStartDate ?? '未設定'} 〜 {task.workEndDate ?? '未設定'}
                                  </Badge>
                                ) : null}
                              </div>
                              {task.description ? <p className="mt-1 line-clamp-1 text-sm text-slate-500">{task.description}</p> : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 sm:justify-end">
                            <Badge variant="neutral">並び順 {task.sortOrder}</Badge>
                            {task.team ? (
                              <Link
                                to={`/teams/${task.team.id}`}
                                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                              >
                                班を開く
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="この班の作業はまだありません"
                      description="班を開くと追加できます。"
                      actionLabel="班を開く"
                      onAction={() => group.team && navigate(`/teams/${group.team.id}`)}
                    />
                  )}
                </section>
              ))}
            </div>
          ) : <EmptyState title="作業がまだありません" description="班を作ったら追加できます。" actionLabel="班を開く" onAction={() => setActiveTab('teams')} />}
        </Card>
      ) : null}

      {activeTab === 'slots' ? (
        <Card className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">参加確認</h2>
            </div>
            {canManageGroupWorkspace ? (
              <Button
                leftIcon={<CalendarPlus className="h-4 w-4" />}
                onClick={() => setAvailabilitySetOpen(true)}
              >
                期間を作る
              </Button>
            ) : null}
          </div>

          {availabilitySetsQuery.isLoading ? (
            <p className="text-sm text-slate-500">読み込み中...</p>
          ) : (
            <div className="space-y-5">
              <Card className="border-slate-200 bg-white">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-400">このイベントで使う期間</p>
                    <h3 className="mt-1 truncate text-lg font-semibold text-slate-950">
                      {currentAvailabilitySet?.name ?? '未設定'}
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {currentAvailabilitySet
                        ? `${currentAvailabilitySet.startDate ?? '未設定'} 〜 ${currentAvailabilitySet.endDate ?? '未設定'}`
                        : 'グループで作った期間を選びます。'}
                    </p>
                  </div>
                  {currentAvailabilitySet ? (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => navigate(`/availability-sets/${currentAvailabilitySet.id}`)}
                      >
                        入力を見る
                      </Button>
                      {canManageGroupWorkspace ? (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={assignAvailabilitySetMutation.isPending}
                          onClick={() => assignAvailabilitySetMutation.mutate(null)}
                        >
                          解除
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </Card>

              <Card className="space-y-4 bg-slate-50/70">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">グループの期間</h3>
                  </div>
                  <Badge variant="brand">{availabilitySets.length}件</Badge>
                </div>

                {availabilitySets.length ? (
                  <div className="grid gap-2">
                    {availabilitySets.map((set) => {
                      const isCurrent = set.id === currentAvailabilitySet?.id
                      return (
                        <div
                          key={set.id}
                          className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:-translate-y-[1px] hover:border-slate-300 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="truncate text-sm font-semibold text-slate-900">{set.name}</h4>
                              {isCurrent ? <Badge variant="success">このイベントで使用中</Badge> : null}
                              {set.deadline ? <Badge variant="warning">期限 {set.deadline}</Badge> : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span>
                                {set.startDate ?? '未設定'} 〜 {set.endDate ?? '未設定'}
                              </span>
                              <span>・提出 {set.availabilityCount}件</span>
                            </div>
                            {set.description ? <p className="text-sm leading-6 text-slate-600">{set.description}</p> : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {canManageGroupWorkspace ? (
                              <Button
                                type="button"
                                size="sm"
                                disabled={isCurrent || assignAvailabilitySetMutation.isPending}
                                onClick={() => assignAvailabilitySetMutation.mutate(set.id)}
                              >
                                {isCurrent ? '設定中' : 'この期間を使う'}
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => navigate(`/availability-sets/${set.id}`)}
                            >
                              開く
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <EmptyState
                    title="期間はまだありません"
                    description="グループに期間を作ると、ここで選べます。"
                    actionLabel={canManageGroupWorkspace ? '期間を作る' : undefined}
                    onAction={canManageGroupWorkspace ? () => setAvailabilitySetOpen(true) : undefined}
                  />
                )}
              </Card>
              {assignAvailabilitySetMutation.error instanceof Error ? (
                <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{assignAvailabilitySetMutation.error.message}</p>
              ) : null}
            </div>
          )}
        </Card>
      ) : null}

      <Modal
        title={selectedBulkTask ? `${selectedBulkTask.name}の日時をまとめて作成` : '日時をまとめて作成'}
        open={bulkSlotModalOpen}
        onClose={() => setBulkSlotModalOpen(false)}
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-500">
            選択した作業に対して、期間・曜日・時間帯をまとめて指定しながら日時を作成できます。
          </p>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">作業</span>
            <Select value={bulkTaskId} onChange={(event) => setBulkTaskId(event.target.value)}>
              <option value="">作業を選択してください</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.name}
                </option>
              ))}
            </Select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">開始日</span>
              <DateField value={bulkStartDate} onChange={(event) => setBulkStartDate(event.target.value)} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">終了日</span>
              <DateField value={bulkEndDate} onChange={(event) => setBulkEndDate(event.target.value)} />
            </label>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-medium text-slate-700">曜日</span>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {weekdayOptions.map((weekday) => {
                const checked = bulkWeekdays.includes(weekday.value)
                return (
                  <button
                    key={weekday.value}
                    type="button"
                    onClick={() =>
                      setBulkWeekdays((current) =>
                        current.includes(weekday.value)
                          ? current.filter((value) => value !== weekday.value)
                          : [...current, weekday.value],
                      )
                    }
                    className={[
                      'rounded-xl border px-3 py-2 text-sm font-medium transition',
                      checked ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-slate-200 bg-white text-slate-600',
                    ].join(' ')}
                  >
                    {weekday.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">時間帯</span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() =>
                  setBulkTimeBlocks((current) => [
                    ...current,
                    { startTime: '09:00', endTime: '12:00', requiredPeople: 1, location: '', note: '' },
                  ])
                }
              >
                追加
              </Button>
            </div>

            <div className="space-y-3">
              {bulkTimeBlocks.map((block, index) => (
                <Card key={`${index}-${block.startTime}-${block.endTime}`} className="bg-slate-50">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">開始時刻</span>
                      <Input
                        type="time"
                        value={block.startTime}
                        onChange={(event) =>
                          setBulkTimeBlocks((current) =>
                            current.map((item, itemIndex) => (itemIndex === index ? { ...item, startTime: event.target.value } : item)),
                          )
                        }
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">終了時刻</span>
                      <Input
                        type="time"
                        value={block.endTime}
                        onChange={(event) =>
                          setBulkTimeBlocks((current) =>
                            current.map((item, itemIndex) => (itemIndex === index ? { ...item, endTime: event.target.value } : item)),
                          )
                        }
                      />
                    </label>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">必要人数</span>
                      <Input
                        type="number"
                        min={1}
                        value={block.requiredPeople}
                        onChange={(event) =>
                          setBulkTimeBlocks((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, requiredPeople: Number(event.target.value) || 1 } : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">場所</span>
                      <Input
                        value={block.location}
                        onChange={(event) =>
                          setBulkTimeBlocks((current) =>
                            current.map((item, itemIndex) => (itemIndex === index ? { ...item, location: event.target.value } : item)),
                          )
                        }
                      />
                    </label>
                  </div>

                  <div className="mt-3 space-y-2">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">メモ</span>
                      <Textarea
                        value={block.note}
                        onChange={(event) =>
                          setBulkTimeBlocks((current) =>
                            current.map((item, itemIndex) => (itemIndex === index ? { ...item, note: event.target.value } : item)),
                          )
                        }
                      />
                    </label>
                    {bulkTimeBlocks.length > 1 ? (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          size="sm"
                          variant="danger"
                          onClick={() => setBulkTimeBlocks((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        >
                          この時間帯を削除
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">除外日</span>
            <div className="flex gap-2">
              <DateField value={bulkExcludedDateInput} onChange={(event) => setBulkExcludedDateInput(event.target.value)} />
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  if (!bulkExcludedDateInput) return
                  setBulkExcludedDates((current) => (current.includes(bulkExcludedDateInput) ? current : [...current, bulkExcludedDateInput]))
                  setBulkExcludedDateInput('')
                }}
              >
                追加
              </Button>
            </div>
            {bulkExcludedDates.length ? (
              <div className="flex flex-wrap gap-2">
                {bulkExcludedDates.map((date) => (
                  <button
                    key={date}
                    type="button"
                    className="rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-700"
                    onClick={() => setBulkExcludedDates((current) => current.filter((item) => item !== date))}
                  >
                    {date} ×
                  </button>
                ))}
              </div>
            ) : null}
          </label>

          <div className="rounded-2xl bg-violet-50 px-4 py-3 text-sm font-medium text-violet-700">
            作成見込み件数: {bulkPreviewCount}件
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setBulkSlotModalOpen(false)}>
              キャンセル
            </Button>
            <Button
              type="button"
              disabled={!bulkTaskId || !bulkStartDate || !bulkEndDate || bulkWeekdays.length === 0 || bulkPreviewCount === 0 || bulkCreateMutation.isPending}
              onClick={() => bulkCreateMutation.mutate()}
            >
              {bulkCreateMutation.isPending ? '作成中...' : 'まとめて作成する'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        title="シフトを作成"
        open={shiftGenerateOpen}
        onClose={() => setShiftGenerateOpen(false)}
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-500">
            班・期間・希望をもとに、シフトの下書きを作成します。先に設定を確認してから進められます。
          </p>

          <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">基本条件</p>
              <p className="text-xs text-slate-500">作成時だけ調整できます。</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">1枠の長さ</span>
                <Input
                  type="number"
                  min={15}
                  step={15}
                  value={shiftRuleDraft.slotMinutes}
                  onChange={(event) => setShiftRuleDraft((current) => ({ ...current, slotMinutes: Number(event.target.value) || 60 }))}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">最大勤務</span>
                <Input
                  type="number"
                  min={0}
                  step={30}
                  value={shiftRuleDraft.maxWorkMinutes}
                  onChange={(event) => setShiftRuleDraft((current) => ({ ...current, maxWorkMinutes: Number(event.target.value) || 0 }))}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-600">休憩</span>
                <Input
                  type="number"
                  min={0}
                  step={5}
                  value={shiftRuleDraft.breakMinutes}
                  onChange={(event) => setShiftRuleDraft((current) => ({ ...current, breakMinutes: Number(event.target.value) || 0 }))}
                />
              </label>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">優先度</p>
              <p className="text-xs text-slate-500">迷ったらそのままで大丈夫です。</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['preferenceWeight', '希望を優先'],
                ['fairnessWeight', '公平性'],
                ['leaderAssignmentWeight', '班長を優先'],
                ['requiredPeopleWeight', '不足を減らす'],
              ].map(([key, label]) => (
                <label key={key} className="block space-y-1">
                  <span className="flex items-center justify-between text-xs font-medium text-slate-600">
                    {label}
                    <span>{generationDraft[key as keyof typeof generationDraft]}%</span>
                  </span>
                  <Input
                    type="range"
                    min={0}
                    max={100}
                    value={generationDraft[key as keyof typeof generationDraft]}
                    onChange={(event) =>
                      setGenerationDraft((current) => ({
                        ...current,
                        [key]: Number(event.target.value),
                      }))
                    }
                  />
                </label>
              ))}
            </div>
          </section>

          {!event?.commonAvailabilitySetId ? (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              期間は未設定です。先に期間を作ると、希望をもとに作成しやすくなります。
            </p>
          ) : null}

          {generateShiftsMutation.error instanceof Error ? (
            <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{generateShiftsMutation.error.message}</p>
          ) : null}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setShiftGenerateOpen(false)}>
              キャンセル
            </Button>
            <Button
              type="button"
              onClick={() => generateShiftsMutation.mutate()}
              disabled={generateShiftsMutation.isPending}
            >
              {generateShiftsMutation.isPending ? '作成中...' : 'この設定で作成'}
            </Button>
          </div>
        </div>
      </Modal>

      {activeTab === 'shifts' ? (
        <div className="space-y-4">
          {isOwner ? (
            <>
              <Card className="space-y-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">シフトを作成</h2>
                    <p className="text-sm text-slate-500">班・期間・設定を確認してから、基本のシフトを作ります。</p>
                  </div>
                  <Button
                    variant="primary"
                    onClick={() => setShiftGenerateOpen(true)}
                  >
                    シフトを作成
                  </Button>
                </div>
                {!event?.commonAvailabilitySetId ? (
                  <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    期間はまだ準備中ですが、班と作業があれば仮のシフトを作成できます。
                  </p>
                ) : null}
                <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">作成前に設定を確認して、必要なら調整してから進めましょう。</p>
                {generateShiftsMutation.error instanceof Error ? (
                  <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{generateShiftsMutation.error.message}</p>
                ) : null}
              </Card>

              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Card className="bg-violet-50">
                  <p className="text-sm text-violet-700">希望反映率</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{shiftMetrics?.preferenceReflectionRate ?? 0}%</p>
                  <p className="mt-2 text-sm text-slate-500">{shiftMetrics?.preferredAssignments ?? 0}件の割り当てが「できれば参加」でした</p>
                </Card>
                <Card className="bg-emerald-50">
                  <p className="text-sm text-emerald-700">必要人数達成率</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{shiftMetrics?.fillRate ?? 0}%</p>
                  <p className="mt-2 text-sm text-slate-500">
                    {shiftMetrics?.assignedPeopleTotal ?? 0}/{shiftMetrics?.requiredPeopleTotal ?? 0}人を割り当て済み
                  </p>
                </Card>
                <Card className="bg-sky-50">
                  <p className="text-sm text-sky-700">生成済みシフト</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{shifts.length}件</p>
                  <p className="mt-2 text-sm text-slate-500">作成した履歴を残せます</p>
                </Card>
                <Card className="bg-amber-50">
                  <p className="text-sm text-amber-700">不足人数</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{shiftMetrics?.missingPeopleTotal ?? 0}人</p>
                  <p className="mt-2 text-sm text-slate-500">{shiftWarnings.length}件の枠で不足があります</p>
                </Card>
              </section>

              {shiftWarnings.length ? (
                <Card className="space-y-3 border-amber-200 bg-amber-50">
                  <h3 className="text-base font-semibold text-amber-800">不足警告</h3>
                  <div className="space-y-2">
                    {shiftWarnings.map((warning) => (
                      <div key={warning.slotId} className="rounded-xl bg-white px-4 py-3 text-sm text-slate-700">
                        {warning.date} {warning.startTime?.slice(0, 5)} - {warning.endTime?.slice(0, 5)}: {warning.message}
                        <span className="ml-2 text-slate-500">
                          {warning.assignedPeople}/{warning.requiredPeople}人
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : null}

              <Card className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">シフト履歴</h3>
                    <p className="text-sm text-slate-500">作成済みのシフトを確認して、公開できます。</p>
                  </div>
                  <Button variant="secondary" onClick={() => generateShiftsMutation.mutate()} disabled={generateShiftsMutation.isPending}>
                    {generateShiftsMutation.isPending ? '作成中...' : 'もう一度作成'}
                  </Button>
                </div>

                {shifts.length ? (
                  <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {shifts.map((shift) => (
                      <div key={shift.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={shift.status === 'published' ? 'success' : shift.status === 'generated' ? 'warning' : 'neutral'}>
                              {shift.status}
                            </Badge>
                            <Badge variant="neutral">{shift.generatedAt ? new Date(shift.generatedAt).toLocaleString('ja-JP') : '生成日時未設定'}</Badge>
                          </div>
                          <p className="text-sm text-slate-600">
                            達成率 {shift.metrics?.fillRate ?? 0}% / 割り当て {shift.assignments.length}件 / 不足人数 {shift.metrics?.missingPeopleTotal ?? 0}人
                          </p>
                        </div>
                        <Link
                          to={`/shifts/${shift.id}`}
                          className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          開く
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="シフトがまだありません" description="シフトを作成すると、ここに表示されます。" />
                )}
              </Card>

              <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                <Card className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">日付別 / 作業別の割り当て</h3>
                    <p className="text-sm text-slate-500">日時ごとの割り当てを確認できます。</p>
                  </div>
                  {latestShift ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-slate-500">最新のシフトを表示しています。</p>
                        <Link
                          to={`/shifts/${latestShift.id}`}
                          className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          開く
                        </Link>
                      </div>
                      {assignmentsBySlot.map(({ slot, assignments }) => (
                        <div key={slot.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="brand">{slot.date}</Badge>
                                <Badge variant="neutral">
                                  {slot.startTime.slice(0, 5)} - {slot.endTime.slice(0, 5)}
                                </Badge>
                                <Badge variant="success">{slot.requiredPeople}人必要</Badge>
                              </div>
                              <p className="mt-2 font-semibold text-slate-900">{slot.task?.name ?? '作業未設定'}</p>
                              <p className="text-sm text-slate-500">{slot.location || '場所未設定'}</p>
                            </div>
                            <Badge variant={assignments.length >= slot.requiredPeople ? 'success' : 'warning'}>
                              {assignments.length}/{slot.requiredPeople}人
                            </Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {assignments.length ? (
                              assignments.map((assignment) => (
                                <Badge key={assignment.id} variant={assignment.isLeader ? 'brand' : 'neutral'}>
                                  {assignment.user?.displayName ?? assignment.user?.email ?? '未設定'}
                                  {assignment.isLeader ? '・リーダー' : ''}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-sm text-slate-500">割り当てなし</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="まだシフトがありません" description="生成ボタンから最初のシフトを作成してください。" />
                  )}
                </Card>

                <Card className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">メンバー別勤務時間</h3>
                    <p className="text-sm text-slate-500">長さの偏りをざっくり確認できます。</p>
                  </div>
                  {shiftMetrics?.memberWorkload?.length ? (
                    <div className="space-y-3">
                      {shiftMetrics.memberWorkload.map((member) => (
                        <div key={member.userId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-medium text-slate-900">{member.displayName ?? member.userId}</p>
                            <Badge variant="neutral">{Math.round(member.minutes)}分</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState title="勤務時間のデータがありません" description="シフトを作成すると表示されます。" />
                  )}
                </Card>
              </div>
            </>
          ) : (
            <Card className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">最新のシフト</h2>
                  <p className="text-sm text-slate-500">自分に関係する割り当てだけを表示します。</p>
                </div>
                {latestShift ? (
                  <Link
                    to={`/shifts/${latestShift.id}`}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    開く
                  </Link>
                ) : null}
              </div>

              {latestShift ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={latestShift.status === 'published' ? 'success' : latestShift.status === 'generated' ? 'warning' : 'neutral'}>
                      {latestShift.status === 'published' ? '公開済み' : latestShift.status === 'generated' ? '下書き' : latestShift.status}
                    </Badge>
                    <Badge variant="neutral">{latestShift.generatedAt ? new Date(latestShift.generatedAt).toLocaleString('ja-JP') : '生成日時未設定'}</Badge>
                  </div>

                  <div className="space-y-3">
                    {assignmentsBySlot.length ? (
                      assignmentsBySlot.map(({ slot, assignments }) => {
                        return (
                          <div key={slot.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge variant="brand">{slot.date}</Badge>
                                  <Badge variant="neutral">
                                    {slot.startTime.slice(0, 5)} - {slot.endTime.slice(0, 5)}
                                  </Badge>
                                  <Badge variant="success">{slot.requiredPeople}人必要</Badge>
                                </div>
                                <p className="mt-2 font-semibold text-slate-900">{slot.task?.name ?? '作業未設定'}</p>
                                <p className="text-sm text-slate-500">{slot.task?.team?.name ?? '班未設定'}</p>
                              </div>
                              <Badge variant={assignments.length >= slot.requiredPeople ? 'success' : 'warning'}>
                                {assignments.length}/{slot.requiredPeople}人
                              </Badge>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {assignments.length ? (
                                assignments.map((assignment) => (
                                  <Badge key={assignment.id} variant={assignment.isLeader ? 'brand' : 'neutral'}>
                                    {assignment.user?.displayName ?? assignment.user?.email ?? '未設定'}
                                    {assignment.isLeader ? '・リーダー' : ''}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-sm text-slate-500">割り当てなし</span>
                              )}
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <EmptyState title="シフトの割り当てはまだありません" description="最新のシフトができると、ここに表示されます。" />
                    )}
                  </div>
                </div>
              ) : (
                <EmptyState title="まだシフトがありません" description="公開後にここへ表示されます。" />
              )}
            </Card>
          )}
        </div>
      ) : null}

      {activeTab === 'settings' ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">シフト設定</h2>
              <p className="text-sm text-slate-500">シフトを作成するときに、必要な条件を確認できます。</p>
            </div>
          </Card>

          <Card className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">イベント編集</h2>
              <p className="text-sm text-slate-500">タイトルや期間を変更できます。</p>
            </div>
            <Button variant="secondary" leftIcon={<Edit3 className="h-4 w-4" />} onClick={() => setEventEditOpen(true)}>
              イベントを編集
            </Button>
          </Card>

          <Card className="space-y-4 border-rose-100 bg-rose-50/60">
            <div>
              <h2 className="text-lg font-semibold text-rose-900">削除</h2>
              <p className="text-sm text-rose-700">このイベントを削除すると、作業・日時・シフトも一緒に削除されます。</p>
            </div>
            <Button
              variant="danger"
              leftIcon={<Trash2 className="h-4 w-4" />}
              onClick={() => {
                if (window.confirm('このイベントを削除しますか？作業、期間、シフトも一緒に削除されます。')) {
                  deleteEventMutation.mutate()
                }
              }}
              disabled={deleteEventMutation.isPending}
            >
              イベントを削除
            </Button>
          </Card>
        </div>
      ) : null}

      <Modal title="かんたんナビ" open={guideOpen} onClose={() => setGuideOpen(false)}>
        <div className="space-y-4">
          <div className={`rounded-3xl border px-5 py-4 ${guideToneClass}`}>
            <Badge variant="neutral">{guideRoleLabel}</Badge>
            <h3 className="mt-3 text-lg font-semibold">{guideContext.title}</h3>
            <p className="mt-2 text-sm leading-6 opacity-80">{guideContext.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  setGuideOpen(false)
                  guideContext.primaryAction()
                }}
              >
                {guideContext.primaryLabel}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setGuideHidden(true)
                  hideEventGuideLocally()
                  setGuideOpen(false)
                }}
              >
                今後は表示しない
              </Button>
              <Button variant="secondary" onClick={() => setGuideOpen(false)}>
                閉じる
              </Button>
            </div>
          </div>

          {guideHidden ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-500">
              かんたんナビは非表示になっています。必要なときはページを開き直してください。
            </div>
          ) : null}

          <div className="grid gap-3">
            {guideItems.map((item) => (
              <div
                key={item.title}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-700">
                  {String(guideItems.indexOf(item) + 1)}
                </div>
                <div className="min-w-0">
                  <span className="block font-medium text-slate-900">{item.title}</span>
                  <span className="mt-1 block text-xs text-slate-500">{item.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <Modal title="期間を作る" open={availabilitySetOpen} onClose={() => setAvailabilitySetOpen(false)}>
        <form className="space-y-4" onSubmit={availabilitySetForm.handleSubmit((values) => createAvailabilitySetMutation.mutate(values))}>
          <PeriodPreview
            name={availabilitySetPreview.name}
            startDate={availabilitySetPreview.startDate}
            endDate={availabilitySetPreview.endDate}
            deadline={availabilitySetPreview.deadline}
          />

          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '1週間', days: 6 },
              { label: '2週間', days: 13 },
              { label: '1か月', days: 29 },
            ].map((preset) => (
              <Button
                key={preset.label}
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  availabilitySetForm.setValue('startDate', todayDateInput(), { shouldValidate: true })
                  availabilitySetForm.setValue('endDate', dateInputAfter(preset.days), { shouldValidate: true })
                  if (!availabilitySetForm.getValues('name')) {
                    availabilitySetForm.setValue('name', `${preset.label}の参加確認`, { shouldValidate: true })
                  }
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">名前</span>
            <Input {...availabilitySetForm.register('name')} placeholder="夏休み期間の参加確認" />
            {availabilitySetForm.formState.errors.name ? <p className="text-sm text-rose-600">{availabilitySetForm.formState.errors.name.message}</p> : null}
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">開始日</span>
              <DateField {...availabilitySetForm.register('startDate')} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">終了日</span>
              <DateField {...availabilitySetForm.register('endDate')} />
              {availabilitySetForm.formState.errors.endDate ? <p className="text-sm text-rose-600">{availabilitySetForm.formState.errors.endDate.message}</p> : null}
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">提出期限</span>
            <DateField {...availabilitySetForm.register('deadline')} />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">メモ</span>
            <Textarea {...availabilitySetForm.register('description')} placeholder="例: 平日は放課後、休日は午前から確認" />
          </label>

          <ActivityRulesFields value={availabilityActivityRules} onChange={setAvailabilityActivityRules} />

          {createAvailabilitySetMutation.error instanceof Error ? (
            <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{createAvailabilitySetMutation.error.message}</p>
          ) : null}

          <div className="sticky bottom-0 -mx-4 grid grid-cols-2 gap-2 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:flex sm:items-center sm:justify-end sm:px-5">
            <Button type="button" variant="secondary" onClick={() => setAvailabilitySetOpen(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={createAvailabilitySetMutation.isPending} leftIcon={<CalendarPlus className="h-4 w-4" />}>
              期間を作る
            </Button>
          </div>
        </form>
      </Modal>

      <Modal title="イベント編集" open={eventEditOpen} onClose={() => setEventEditOpen(false)}>
        <form className="space-y-4" onSubmit={eventForm.handleSubmit((values) => updateEventMutation.mutate(values))}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">イベント名</span>
            <Input {...eventForm.register('name')} />
            {eventForm.formState.errors.name ? <p className="text-sm text-rose-600">{eventForm.formState.errors.name.message}</p> : null}
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">説明</span>
            <Textarea {...eventForm.register('description')} />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">場所</span>
            <Input {...eventForm.register('location')} />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">期間</span>
            <Select {...eventForm.register('commonAvailabilitySetId')}>
              <option value="">あとで選ぶ</option>
              {availabilitySets.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.name}
                </option>
              ))}
            </Select>
            <p className="text-xs text-slate-500">未選択でも作成できます。イベントで作った期間を選べます。</p>
          </label>

          <p className="text-sm leading-6 text-slate-500">先に期間を決めると、あとから班の作業やシフトを整理しやすくなります。</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">開始日</span>
              <DateField {...eventForm.register('startDate')} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">終了日</span>
              <DateField {...eventForm.register('endDate')} />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">状態</span>
              <Select {...eventForm.register('status')}>
                <option value="draft">下書き</option>
                <option value="collecting">準備中</option>
                <option value="generated">シフト作成済み</option>
                <option value="published">公開済み</option>
                <option value="closed">終了</option>
              </Select>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setEventEditOpen(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={updateEventMutation.isPending}>
              保存する
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        title="班を作成"
        open={teamModalOpen}
        onClose={() => {
          setTeamModalOpen(false)
          teamForm.reset({ name: '', description: '', color: '#7c3aed' })
        }}
      >
        <form className="space-y-4" onSubmit={teamForm.handleSubmit((values) => createTeamMutation.mutate(values))}>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
            まずは受付班や装飾班のように、役割ごとに班を分けましょう。
          </div>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">班名</span>
            <Input {...teamForm.register('name')} placeholder="装飾班" />
            {teamForm.formState.errors.name ? <p className="text-sm text-rose-600">{teamForm.formState.errors.name.message}</p> : null}
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">説明</span>
            <Textarea {...teamForm.register('description')} placeholder="このイベントで使う班です" />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">色</span>
            <Input type="color" className="h-11 w-full px-2" {...teamForm.register('color')} />
          </label>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setTeamModalOpen(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={createTeamMutation.isPending}>
              作成
            </Button>
          </div>
          {createTeamMutation.error instanceof Error ? (
            <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{createTeamMutation.error.message}</p>
          ) : null}
        </form>
      </Modal>

      <Modal
        title={editingSlot ? '日時を編集' : '日時を作成'}
        open={slotModalOpen}
        onClose={() => {
          setSlotModalOpen(false)
          setEditingSlot(null)
        }}
        >
        <form
          className="space-y-4"
          onSubmit={slotForm.handleSubmit((values) => {
            if (editingSlot) {
              updateSlotMutation.mutate(values)
              return
            }

            createSlotMutation.mutate(values)
          })}
        >
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">作業</span>
            <Select
              value={slotForm.watch('taskId') ?? ''}
              onChange={(event) => slotForm.setValue('taskId', event.target.value)}
            >
              <option value="">作業を選択してください</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.team?.name ? `${task.team.name} / ${task.name}` : task.name}
                </option>
              ))}
            </Select>
            {slotForm.formState.errors.taskId ? <p className="text-sm text-rose-600">{slotForm.formState.errors.taskId.message}</p> : null}
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">日付</span>
              <DateField {...slotForm.register('date')} />
              {slotForm.formState.errors.date ? <p className="text-sm text-rose-600">{slotForm.formState.errors.date.message}</p> : null}
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">必要人数</span>
              <Input type="number" min={1} {...slotForm.register('requiredPeople', { valueAsNumber: true })} />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">開始時刻</span>
              <Input type="time" {...slotForm.register('startTime')} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">終了時刻</span>
              <Input type="time" {...slotForm.register('endTime')} />
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">場所</span>
            <Input {...slotForm.register('location')} placeholder="体育館" />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">メモ</span>
            <Textarea {...slotForm.register('note')} placeholder="補足があれば入力してください" />
          </label>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSlotModalOpen(false)
                setEditingSlot(null)
                setSelectedTaskId('')
              }}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={createSlotMutation.isPending || updateSlotMutation.isPending}>
              {editingSlot ? '更新' : '作成'}
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  )
}
