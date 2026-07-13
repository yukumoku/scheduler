import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertTriangle, ArrowLeft, Edit3, Plus, Settings2, Trash2, UserRound, UserRoundCheck, Users } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import type { EventTask } from '@/types/api'
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
import { canCreateTask, canEditTeam } from '@/lib/permissions'

const teamSchema = z.object({
  name: z.string().min(1, '班名を入力してください').max(255),
  description: z.string().max(1000).optional().transform((value) => value?.trim() || ''),
  color: z.string().max(32).optional().transform((value) => value?.trim() || ''),
})

const memberSchema = z.object({
  userId: z.string().min(1, 'グループメンバーを選択してください'),
  role: z.enum(['leader', 'member']),
})

const taskSchema = z.object({
  name: z.string().min(1, '作業名を入力してください').max(255),
  description: z.string().max(2000).optional().transform((value) => value?.trim() || ''),
  desiredTotalHours: z.preprocess((value) => (value === '' || value === null ? undefined : value), z.coerce.number().positive('必要な作業時間は0より大きくしてください').optional()),
  requiredPeoplePerSlot: z.preprocess(
    (value) => (value === '' || value === null || value === 'auto' ? null : value),
    z.coerce.number().int().min(1, '同時に入る人数は1人以上で入力してください').max(999, '同時人数が大きすぎます').nullable(),
  ),
  workStartDate: z.string().optional().transform((value) => value?.trim() || ''),
  workEndDate: z.string().optional().transform((value) => value?.trim() || ''),
  requiredMemberIds: z.array(z.string()).default([]),
  allowCrossTeamHelp: z.boolean(),
  color: z.string().max(32).optional().transform((value) => value?.trim() || ''),
  sortOrder: z.coerce.number().int().min(0, '並び順は0以上で入力してください'),
})

type DesiredPeriodDraft = {
  date: string
  startTime: string
  endTime: string
  requiredPeople: number
  location: string
  note: string
}

type TeamFormValues = z.infer<typeof teamSchema>
type MemberFormValues = z.infer<typeof memberSchema>
type TaskFormValues = z.infer<typeof taskSchema>

export function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [memberOpen, setMemberOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<EventTask | null>(null)
  const [selectedWorkPeriodId, setSelectedWorkPeriodId] = useState('')
  const [desiredPeriods, setDesiredPeriods] = useState<DesiredPeriodDraft[]>([])

  const teamForm = useForm<TeamFormValues>({
    resolver: zodResolver(teamSchema),
    defaultValues: { name: '', description: '', color: '#7c3aed' },
  })
  const memberForm = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: { userId: '', role: 'member' },
  })
  const taskForm = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      name: '',
      description: '',
      desiredTotalHours: undefined,
      requiredPeoplePerSlot: null,
      workStartDate: '',
      workEndDate: '',
      requiredMemberIds: [],
      allowCrossTeamHelp: false,
      color: '#7c3aed',
      sortOrder: 0,
    },
  })

  const teamQuery = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => api.teams.show(teamId ?? ''),
    enabled: Boolean(teamId),
  })

  const groupQuery = useQuery({
    queryKey: ['group', teamQuery.data?.groupId],
    queryFn: () => api.groups.show(teamQuery.data?.groupId ?? ''),
    enabled: Boolean(teamQuery.data?.groupId),
  })

  const eventTasksQuery = useQuery({
    queryKey: ['event', teamQuery.data?.eventId, 'tasks'],
    queryFn: () => api.events.tasks(teamQuery.data?.eventId ?? ''),
    enabled: Boolean(teamQuery.data?.eventId),
  })
  const availabilitySetsQuery = useQuery({
    queryKey: ['event', teamQuery.data?.eventId, 'availability-sets'],
    queryFn: () => api.events.availabilitySets(teamQuery.data?.eventId ?? ''),
    enabled: Boolean(teamQuery.data?.eventId),
  })

  const membersQuery = useQuery({
    queryKey: ['team', teamId, 'members'],
    queryFn: () => api.teams.members(teamId ?? ''),
    enabled: Boolean(teamId),
  })
  const groupMembersQuery = useQuery({
    queryKey: ['group', teamQuery.data?.groupId, 'members'],
    queryFn: () => api.groups.members(teamQuery.data?.groupId ?? ''),
    enabled: Boolean(teamQuery.data?.groupId),
  })

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: api.auth.me,
    retry: false,
  })

  const canManage = useMemo(
    () => canEditTeam(teamQuery.data, groupQuery.data?.myRole, meQuery.data?.id),
    [groupQuery.data?.myRole, meQuery.data?.id, teamQuery.data],
  )
  const canAddTask = useMemo(
    () => canCreateTask(teamQuery.data, groupQuery.data?.myRole, meQuery.data?.id),
    [groupQuery.data?.myRole, meQuery.data?.id, teamQuery.data],
  )

  const teamTasks = useMemo(() => {
    const tasks = eventTasksQuery.data ?? []
    return tasks.filter((task) => task.teamId === teamId)
  }, [eventTasksQuery.data, teamId])
  const availabilitySets = useMemo(
    () => (Array.isArray(availabilitySetsQuery.data) ? availabilitySetsQuery.data : []),
    [availabilitySetsQuery.data],
  )

  useEffect(() => {
    if (teamQuery.data) {
      teamForm.reset({
        name: teamQuery.data.name,
        description: teamQuery.data.description ?? '',
        color: teamQuery.data.color ?? '#7c3aed',
      })
    }
  }, [teamQuery.data, teamForm])

  useEffect(() => {
    if (!taskOpen) {
      return
    }

    if (editingTask) {
      taskForm.reset({
        name: editingTask.name,
        description: editingTask.description ?? '',
        desiredTotalHours: editingTask.desiredTotalHours && editingTask.desiredTotalHours > 0 ? editingTask.desiredTotalHours : undefined,
        requiredPeoplePerSlot: editingTask.requiredPeoplePerSlot,
        workStartDate: editingTask.workStartDate ?? '',
        workEndDate: editingTask.workEndDate ?? '',
        requiredMemberIds: editingTask.requiredMemberIds ?? [],
        allowCrossTeamHelp: editingTask.allowCrossTeamHelp,
        color: editingTask.color ?? '#7c3aed',
        sortOrder: editingTask.sortOrder,
      })
      setDesiredPeriods(
        editingTask.desiredPeriods.length
          ? editingTask.desiredPeriods.map((period) => ({
              date: period.date,
              startTime: period.startTime,
              endTime: period.endTime,
              requiredPeople: period.requiredPeople,
              location: period.location ?? '',
              note: period.note ?? '',
            }))
          : [{ date: '', startTime: '09:00', endTime: '12:00', requiredPeople: editingTask.requiredPeoplePerSlot ?? 1, location: '', note: '' }],
      )
      const matchedPeriod = availabilitySets.find(
        (set) => set.startDate === editingTask.workStartDate && set.endDate === editingTask.workEndDate,
      )
      setSelectedWorkPeriodId(matchedPeriod?.id ?? '')
      return
    }

    taskForm.reset({
      name: '',
      description: '',
      desiredTotalHours: undefined,
      requiredPeoplePerSlot: null,
      workStartDate: '',
      workEndDate: '',
      requiredMemberIds: [],
      allowCrossTeamHelp: false,
      color: '#7c3aed',
      sortOrder: teamTasks.length,
    })
    setDesiredPeriods([])
    setSelectedWorkPeriodId(availabilitySets[0]?.id ?? '')
  }, [availabilitySets, editingTask, taskForm, taskOpen, teamTasks.length])

  const updateMutation = useMutation({
    mutationFn: (values: TeamFormValues) =>
      api.teams.update(teamId ?? '', {
        name: values.name,
        description: values.description || null,
        color: values.color || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['team', teamId] })
      await queryClient.invalidateQueries({ queryKey: ['group', teamQuery.data?.groupId, 'teams'] })
      setEditOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.teams.delete(teamId ?? ''),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['group', teamQuery.data?.groupId, 'teams'] })
      navigate(`/groups/${teamQuery.data?.groupId}`)
    },
  })

  const addMemberMutation = useMutation({
    mutationFn: (values: MemberFormValues) =>
      api.teams.addMember(teamId ?? '', {
        userId: values.userId,
        role: values.role,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['team', teamId, 'members'] })
      await queryClient.invalidateQueries({ queryKey: ['team', teamId] })
      await queryClient.invalidateQueries({ queryKey: ['group', teamQuery.data?.groupId, 'members'] })
      setMemberOpen(false)
      memberForm.reset({ userId: '', role: 'member' })
    },
  })

  const updateMemberRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: 'leader' | 'member' }) =>
      api.teams.updateMember(teamId ?? '', memberId, { role }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['team', teamId, 'members'] })
      await queryClient.invalidateQueries({ queryKey: ['team', teamId] })
    },
  })

  const deleteMemberMutation = useMutation({
    mutationFn: (memberId: string) => api.teams.deleteMember(teamId ?? '', memberId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['team', teamId, 'members'] })
      await queryClient.invalidateQueries({ queryKey: ['team', teamId] })
    },
  })

  const createTaskMutation = useMutation({
    mutationFn: (values: TaskFormValues) => {
      if (!teamQuery.data?.eventId) {
        throw new Error('この班はイベントに紐づいていないため、作業を追加できません。')
      }

      const selectedPeriod = availabilitySets.find((set) => set.id === selectedWorkPeriodId) ?? null

      return api.events.createTask(teamQuery.data.eventId, {
        name: values.name,
        description: values.description || null,
        desiredTotalHours: values.desiredTotalHours ?? null,
        requiredPeoplePerSlot: values.requiredPeoplePerSlot ?? null,
        workStartDate: selectedPeriod?.startDate ?? null,
        workEndDate: selectedPeriod?.endDate ?? null,
        desiredPeriods: desiredPeriods
          .filter((period) => period.date && period.startTime && period.endTime)
          .map((period) => ({
            date: period.date,
            startTime: period.startTime,
            endTime: period.endTime,
            requiredPeople: period.requiredPeople,
            location: period.location || null,
            note: period.note || null,
          })),
        requiredMemberIds: values.requiredMemberIds,
        teamId: teamId ?? null,
        allowCrossTeamHelp: values.allowCrossTeamHelp,
        color: values.color || null,
        sortOrder: values.sortOrder,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['event', teamQuery.data?.eventId, 'tasks'] })
      setTaskOpen(false)
      setEditingTask(null)
      setSelectedWorkPeriodId('')
      taskForm.reset({
        name: '',
        description: '',
        desiredTotalHours: undefined,
        requiredPeoplePerSlot: null,
        workStartDate: '',
        workEndDate: '',
        requiredMemberIds: [],
        allowCrossTeamHelp: false,
        color: '#7c3aed',
        sortOrder: 0,
      })
      setDesiredPeriods([])
    },
  })

  const updateTaskMutation = useMutation({
    mutationFn: (values: TaskFormValues) => {
      if (!editingTask) {
        throw new Error('編集対象の作業が見つかりません。')
      }

      const selectedPeriod = availabilitySets.find((set) => set.id === selectedWorkPeriodId) ?? null

      return api.events.updateTask(editingTask.id, {
        name: values.name,
        description: values.description || null,
        desiredTotalHours: values.desiredTotalHours ?? null,
        requiredPeoplePerSlot: values.requiredPeoplePerSlot ?? null,
        workStartDate: (selectedPeriod?.startDate ?? values.workStartDate) || null,
        workEndDate: (selectedPeriod?.endDate ?? values.workEndDate) || null,
        desiredPeriods: desiredPeriods
          .filter((period) => period.date && period.startTime && period.endTime)
          .map((period) => ({
            date: period.date,
            startTime: period.startTime,
            endTime: period.endTime,
            requiredPeople: period.requiredPeople,
            location: period.location || null,
            note: period.note || null,
          })),
        requiredMemberIds: values.requiredMemberIds,
        teamId: teamId ?? null,
        allowCrossTeamHelp: values.allowCrossTeamHelp,
        color: values.color || null,
        sortOrder: values.sortOrder,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['event', teamQuery.data?.eventId, 'tasks'] })
      setTaskOpen(false)
      setEditingTask(null)
      setSelectedWorkPeriodId('')
      taskForm.reset({
        name: '',
        description: '',
        desiredTotalHours: undefined,
        requiredPeoplePerSlot: null,
        workStartDate: '',
        workEndDate: '',
        requiredMemberIds: [],
        allowCrossTeamHelp: false,
        color: '#7c3aed',
        sortOrder: 0,
      })
      setDesiredPeriods([])
    },
  })

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => api.events.deleteTask(taskId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['event', teamQuery.data?.eventId, 'tasks'] })
    },
  })

  if (!teamId) {
    return <EmptyState title="班が見つかりません" description="URLを確認してください。" />
  }

  const team = teamQuery.data
  const isDefaultTeam = Boolean(team?.isDefault)
  const ownerId = groupQuery.data?.owner?.id ?? null
  const members = membersQuery.data ?? team?.members ?? []
  const groupMembers = groupMembersQuery.data ?? []
  const selectedWorkPeriod = availabilitySets.find((set) => set.id === selectedWorkPeriodId) ?? null
  const taskRequiredMemberIds = taskForm.watch('requiredMemberIds') ?? []
  const taskDesiredTotalHours = taskForm.watch('desiredTotalHours')
  const taskRequiredPeoplePerSlot = taskForm.watch('requiredPeoplePerSlot')
  const taskRequiredMembers = useMemo(
    () =>
      taskRequiredMemberIds
        .map((memberId) => groupMembers.find((member) => member.userId === memberId))
        .filter((member): member is (typeof groupMembers)[number] => Boolean(member)),
    [groupMembers, taskRequiredMemberIds],
  )
  const memberOptions = groupMembers.filter((groupMember) => !members.some((member) => member.userId === groupMember.userId))
  const addMemberError = addMemberMutation.error instanceof Error ? addMemberMutation.error.message : null
  const deleteTeamError = deleteMutation.error instanceof Error ? deleteMutation.error.message : null
  const taskMutationError =
    createTaskMutation.error instanceof Error
      ? createTaskMutation.error.message
      : updateTaskMutation.error instanceof Error
        ? updateTaskMutation.error.message
      : null
  const invalidDesiredPeriod = desiredPeriods.find((period) => period.date && period.startTime && period.endTime && period.startTime >= period.endTime)
  const partialDesiredPeriod = desiredPeriods.find(
    (period) => Boolean(period.date || period.location || period.note) && !(period.date && period.startTime && period.endTime),
  )
  const completeDesiredPeriodCount = desiredPeriods.filter((period) => period.date && period.startTime && period.endTime).length
  const taskPlanError =
    !taskDesiredTotalHours && completeDesiredPeriodCount === 0
      ? '作業に必要な時間を入力してください。日時が決まっている作業は、日時候補を追加してください。'
      : null

  return (
    <div className="space-y-4">
      <PageHeader
        title={team?.name ?? '班詳細'}
        description={team?.description ?? '班のメンバーと役割を管理できます。'}
        action={
          <div className="flex items-center gap-3">
            <Button variant="secondary" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate(`/groups/${team?.groupId ?? ''}`)}>
              グループへ戻る
            </Button>
            {canManage ? (
              <ActionMenu
                triggerLabel="班のその他の操作"
                items={[
                  {
                    label: '班を編集',
                    icon: <Edit3 className="h-4 w-4" />,
                    onClick: () => setEditOpen(true),
                  },
                  {
                    label: '班を削除',
                    icon: <Trash2 className="h-4 w-4" />,
                    danger: true,
                    onClick: () => setDeleteOpen(true),
                  },
                ]}
              />
            ) : null}
          </div>
        }
      />

      {isDefaultTeam ? (
        <Card className="border-violet-200 bg-violet-50/70">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="brand">全体班</Badge>
                <Badge variant="neutral">自動参加</Badge>
              </div>
              <h2 className="text-xl font-semibold text-slate-900">全員が入る、基本の班です</h2>
              <p className="max-w-2xl text-sm leading-6 text-slate-600">
                グループに入った人は、まずここに自動で入ります。編集はせず、全員の土台として使います。
              </p>
            </div>
            <div className="rounded-2xl border border-violet-200 bg-white/70 px-4 py-3 text-sm leading-6 text-slate-700">
              <p className="font-medium text-slate-900">ここでできること</p>
              <ul className="mt-2 space-y-1.5">
                <li>・全体班を確認する</li>
                <li>・参加状況を見る</li>
                <li>・イベントの班へ進む</li>
              </ul>
            </div>
          </div>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        <Card className="bg-slate-50">
          <p className="text-sm text-slate-500">色</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl" style={{ backgroundColor: team?.color ?? '#7c3aed' }} />
            <p className="font-semibold text-slate-900">{team?.color ?? '#7c3aed'}</p>
          </div>
        </Card>
        <Card className="bg-slate-50">
          <p className="text-sm text-slate-500">メンバー数</p>
          <p className="mt-2 text-3xl font-semibold">{team?.memberCount ?? members.length}</p>
        </Card>
        <Card className="bg-slate-50">
          <p className="text-sm text-slate-500">リーダー</p>
          <p className="mt-2 text-base font-semibold text-slate-900">{team?.leader?.displayName ?? '未設定'}</p>
        </Card>
        <Card className="bg-slate-50">
          <p className="text-sm text-slate-500">作業</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{teamTasks.length}</p>
          <p className="mt-2 text-sm text-slate-500">{teamQuery.data?.eventId ? 'この班に紐づく作業を管理できます。' : '全体班はイベントに紐づいていないため、作業は作れません。'}</p>
        </Card>
      </section>

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-violet-600" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">この班の作業</h2>
              <p className="text-sm text-slate-500">作業はこの班のページで作成・編集します。参加確認や日時は作業の下に並びます。</p>
            </div>
          </div>
          {canAddTask && teamQuery.data?.eventId && !isDefaultTeam ? (
            <Button
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => {
                setEditingTask(null)
                setTaskOpen(true)
              }}
            >
              作業を追加
            </Button>
          ) : null}
        </div>

        {teamQuery.data?.eventId ? (
          eventTasksQuery.isLoading ? (
            <p className="text-sm text-slate-500">作業を読み込み中です。</p>
          ) : teamTasks.length ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="hidden grid-cols-[1.6fr_0.8fr_0.8fr_auto] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500 sm:grid">
                <span>名前</span>
                <span>状態</span>
                <span>参加確認</span>
                <span className="text-right">操作</span>
              </div>
              {teamTasks.map((task) => (
                <div key={task.id} className="grid gap-4 border-t border-slate-200 px-4 py-4 transition hover:bg-slate-50 sm:grid-cols-[1.6fr_0.8fr_0.8fr_auto] sm:items-center sm:px-5">
                  <div className="min-w-0">
                    <div className="flex items-start gap-4">
                      <div className="mt-1 h-9 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: task.color ?? '#7c3aed' }} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-slate-900">{task.name}</p>
                          {task.team ? <Badge variant="neutral">{task.team.name}</Badge> : null}
                        </div>
                        {task.workStartDate || task.workEndDate ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant="brand">
                              {task.workStartDate ?? '未設定'} 〜 {task.workEndDate ?? '未設定'}
                            </Badge>
                          </div>
                        ) : null}
                        {task.description ? <p className="mt-1 text-sm leading-6 text-slate-500">{task.description}</p> : null}
                        {task.requiredMemberIds?.length ? (
                          <div className="mt-2 space-y-2">
                            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">担当メンバー</p>
                            <div className="flex flex-wrap gap-2">
                            {task.requiredMemberIds.slice(0, 3).map((memberId) => {
                              const member = groupMembers.find((item) => item.userId === memberId)
                              return (
                                <Badge key={memberId} variant="warning">
                                  {member?.displayName ?? '必須メンバー'}
                                </Badge>
                              )
                            })}
                            {task.requiredMemberIds.length > 3 ? <Badge variant="neutral">ほか{task.requiredMemberIds.length - 3}件</Badge> : null}
                            </div>
                          </div>
                        ) : null}
                        {task.desiredPeriods?.length ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {task.desiredPeriods.slice(0, 2).map((period) => (
                              <Badge key={`${period.date}-${period.startTime}`} variant="brand">
                                {period.date} {period.startTime.slice(0, 5)}-{period.endTime.slice(0, 5)}
                              </Badge>
                            ))}
                            {task.desiredPeriods.length > 2 ? <Badge variant="neutral">ほか{task.desiredPeriods.length - 2}件</Badge> : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-start">
                    {task.allowCrossTeamHelp ? <Badge variant="info">ヘルプ可</Badge> : <Badge variant="neutral">通常</Badge>}
                    <Badge variant="neutral">{task.requiredPeoplePerSlot ? `1回 ${task.requiredPeoplePerSlot}人` : '人数は自動'}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm text-slate-600">
                      <p>{task.desiredTotalHours ? `合計 ${task.desiredTotalHours}h` : '必要時間未設定'}</p>
                      <Badge variant={task.slotCount ? 'brand' : 'neutral'}>{task.slotCount ? `${task.slotCount}候補` : '0候補'}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    {canManage && !isDefaultTeam ? (
                      <ActionMenu
                        triggerLabel={`${task.name}の操作`}
                        items={[
                          {
                            label: '作業を編集',
                            icon: <Edit3 className="h-4 w-4" />,
                            onClick: () => {
                              setEditingTask(task)
                              setTaskOpen(true)
                            },
                          },
                          {
                            label: '作業を削除',
                            icon: <Trash2 className="h-4 w-4" />,
                            danger: true,
                            onClick: () => {
                              if (window.confirm(`「${task.name}」を削除しますか？`)) {
                                deleteTaskMutation.mutate(task.id)
                              }
                            },
                          },
                        ]}
                      />
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="この班の作業はまだありません"
              description="班のページから作業を追加すると、参加確認と必要時間を先に整理しやすくなります。"
              actionLabel={canAddTask && !isDefaultTeam ? '作業を追加' : '班の説明を見る'}
              onAction={
                canAddTask && !isDefaultTeam
                  ? () => {
                      setEditingTask(null)
                      setTaskOpen(true)
                    }
                  : undefined
              }
            />
          )
        ) : (
          <EmptyState
            title="全体班です"
            description="グループ全員が入る基本の班です。イベントに紐づく作業は、必要な班で作成してください。"
          />
        )}
        {taskMutationError ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{taskMutationError}</p> : null}
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-violet-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">所属メンバー一覧</h2>
            <p className="text-sm text-slate-500">メンバーは一覧で見やすく、操作は右端のメニューにまとめています。</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            操作はメニューにまとめています。
            {isDefaultTeam ? ' 全体班は自動同期されるため、メンバーの追加・削除はできません。' : ''}
          </p>
          {canManage && !isDefaultTeam ? (
            <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => setMemberOpen(true)}>
              メンバーを追加
            </Button>
          ) : null}
        </div>

        {members.length ? (
          <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {members.map((member) => (
              <div key={member.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-sm font-semibold text-violet-700">
                    {(member.displayName ?? '?').slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-slate-900">{member.displayName ?? '名前未設定'}</p>
                      <Badge variant={member.role === 'leader' ? 'success' : 'brand'}>{member.role === 'leader' ? 'リーダー' : '班員'}</Badge>
                      {ownerId && member.userId === ownerId ? <Badge variant="brand">オーナー</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{member.role === 'leader' ? '班の管理を担当します。' : '班のメンバーです。'}</p>
                  </div>
                </div>
                {canManage && !isDefaultTeam ? (
                  <ActionMenu
                    triggerLabel={`${member.displayName ?? 'メンバー'}の操作`}
                    items={[
                      {
                        label: 'リーダーにする',
                        icon: <UserRoundCheck className="h-4 w-4" />,
                        disabled: member.role === 'leader' || member.userId === ownerId,
                        onClick: () => updateMemberRoleMutation.mutate({ memberId: member.id, role: 'leader' }),
                      },
                      {
                        label: '班員にする',
                        icon: <UserRound className="h-4 w-4" />,
                        disabled: member.role === 'member' || member.userId === ownerId,
                        onClick: () => updateMemberRoleMutation.mutate({ memberId: member.id, role: 'member' }),
                      },
                      {
                        label: '班から外す',
                        icon: <Trash2 className="h-4 w-4" />,
                        danger: true,
                        disabled: member.userId === ownerId,
                        onClick: () => deleteMemberMutation.mutate(member.id),
                      },
                    ]}
                  />
                ) : (
                  <div className="text-sm text-slate-400">{isDefaultTeam ? '全体班のため操作なし' : '閲覧のみ'}</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="メンバーがいません" description="班にメンバーを追加するとここに表示されます。" />
        )}
      </Card>

      <Card className="space-y-4 border-dashed bg-rose-50/40">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-rose-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">危険な操作</h2>
            <p className="text-sm text-slate-500">班を削除すると元に戻せません。</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">班の削除は確認モーダルで実行します。</p>
          {canManage && !isDefaultTeam ? (
            <Button variant="danger" onClick={() => setDeleteOpen(true)}>
              班を削除
            </Button>
          ) : null}
        </div>
      </Card>

      <Modal title="班編集" open={editOpen} onClose={() => setEditOpen(false)}>
        <form className="space-y-4" onSubmit={teamForm.handleSubmit((values) => updateMutation.mutate(values))}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">班名</span>
            <Input {...teamForm.register('name')} />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">説明</span>
            <Textarea {...teamForm.register('description')} />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">色</span>
            <Input type="color" className="h-11 w-full px-2" {...teamForm.register('color')} />
          </label>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              保存する
            </Button>
          </div>
        </form>
      </Modal>

      <Modal title="メンバー追加" open={memberOpen} onClose={() => setMemberOpen(false)}>
        <form className="space-y-4" onSubmit={memberForm.handleSubmit((values) => addMemberMutation.mutate(values))}>
          {addMemberError ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{addMemberError}</p> : null}
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">グループメンバー</span>
            <Select {...memberForm.register('userId')}>
              <option value="">選択してください</option>
              {memberOptions.map((groupMember) => (
                <option key={groupMember.id} value={groupMember.userId}>
                  {groupMember.displayName ?? '名前未設定'}
                </option>
              ))}
            </Select>
            {memberForm.formState.errors.userId ? <p className="text-sm text-rose-600">{memberForm.formState.errors.userId.message}</p> : null}
            {groupMembersQuery.isLoading ? <p className="text-sm text-slate-500">グループメンバーを読み込み中です。</p> : null}
            {!groupMembersQuery.isLoading && !memberOptions.length ? <p className="text-sm text-slate-500">追加できるグループメンバーがいません。</p> : null}
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">役割</span>
            <Select {...memberForm.register('role')}>
              <option value="member">班員</option>
              <option value="leader">リーダー</option>
            </Select>
          </label>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setMemberOpen(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={addMemberMutation.isPending || groupMembersQuery.isLoading || memberOptions.length === 0}>
              追加する
            </Button>
          </div>
        </form>
      </Modal>

      <Modal title="作業を追加" open={taskOpen} onClose={() => {
        setTaskOpen(false)
        setEditingTask(null)
        setDesiredPeriods([])
        setSelectedWorkPeriodId('')
        taskForm.reset({
          name: '',
          description: '',
          desiredTotalHours: undefined,
          requiredPeoplePerSlot: null,
          workStartDate: '',
          workEndDate: '',
          requiredMemberIds: [],
          allowCrossTeamHelp: false,
          color: '#7c3aed',
          sortOrder: 0,
        })
      }}>
        <form
          className="space-y-4"
          onSubmit={taskForm.handleSubmit((values) => (editingTask ? updateTaskMutation.mutate(values) : createTaskMutation.mutate(values)))}
        >
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">作業名</span>
            <Input {...taskForm.register('name')} placeholder="受付" />
            {taskForm.formState.errors.name ? <p className="text-sm text-rose-600">{taskForm.formState.errors.name.message}</p> : null}
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">説明</span>
            <Textarea {...taskForm.register('description')} placeholder="来場者対応と案内" />
          </label>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-700">イベントの参加確認</p>
                <p className="text-xs leading-6 text-slate-500">
                  作業の日付は、イベントで作った参加確認を選んで使えます。未選択でも保存できます。
                </p>
              </div>
              {teamQuery.data?.eventId ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => navigate(`/events/${teamQuery.data.eventId}?open=availability-set`)}
                >
                  参加確認を作る
                </Button>
              ) : null}
            </div>
            <Select
              value={selectedWorkPeriodId}
              onChange={(event) => {
                const nextPeriodId = event.target.value
                setSelectedWorkPeriodId(nextPeriodId)
                const period = availabilitySets.find((set) => set.id === nextPeriodId)
                if (period) {
                  taskForm.setValue('workStartDate', period.startDate ?? '', { shouldDirty: true })
                  taskForm.setValue('workEndDate', period.endDate ?? '', { shouldDirty: true })
                }
              }}
            >
              <option value="">参加確認を選ばない</option>
              {availabilitySets.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.name} {set.startDate ?? '未設定'} 〜 {set.endDate ?? '未設定'}
                </option>
              ))}
            </Select>
            {availabilitySets.length ? (
              <p className="text-xs leading-6 text-slate-500">
                選択中: {selectedWorkPeriod?.name ?? '未選択'}
                {selectedWorkPeriod ? `（${selectedWorkPeriod.startDate ?? '未設定'} 〜 ${selectedWorkPeriod.endDate ?? '未設定'}）` : ''}
              </p>
            ) : (
              <p className="text-xs leading-6 text-slate-500">先にイベントで参加確認を作ると、ここで選べます。</p>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-700">担当メンバー</p>
              <p className="text-xs leading-6 text-slate-500">
                この作業で優先したい人を選びます。シフト作成時に優先され、必要なら複数選べます。
              </p>
            </div>
            {taskRequiredMembers.length ? (
              <div className="flex flex-wrap gap-2">
                {taskRequiredMembers.map((member) => (
                  <Badge key={member.userId} variant="warning">
                    {member.displayName ?? '名前未設定'}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs leading-6 text-slate-500">まだ選ばれていません。必要な人だけ選びましょう。</p>
            )}
            {groupMembersQuery.isLoading ? (
              <p className="text-sm text-slate-500">グループメンバーを読み込み中です。</p>
            ) : groupMembers.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {groupMembers.map((member) => {
                  const checked = taskRequiredMemberIds.includes(member.userId)
                  return (
                    <label
                      key={member.userId}
                      className={[
                        'flex items-center gap-3 rounded-2xl border px-4 py-3 transition',
                        checked ? 'border-violet-200 bg-violet-50' : 'border-slate-200 bg-white',
                      ].join(' ')}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-violet-600"
                        checked={checked}
                        onChange={(event) => {
                          const next = event.target.checked
                            ? [...taskRequiredMemberIds, member.userId]
                            : taskRequiredMemberIds.filter((id) => id !== member.userId)
                          taskForm.setValue('requiredMemberIds', next, { shouldDirty: true })
                        }}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{member.displayName ?? '名前未設定'}</p>
                        <p className="truncate text-xs text-slate-500">{member.role === 'leader' ? '班長' : '班員'}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            ) : (
              <EmptyState title="選べるメンバーがいません" description="先にグループへメンバーを追加すると、ここで選べるようになります。" />
            )}
          </div>

          <div className="grid gap-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">合計で必要な作業時間</span>
              <Input type="number" min={0.5} step="0.5" {...taskForm.register('desiredTotalHours')} placeholder="例: 4" />
              <p className="text-xs leading-6 text-slate-500">作業そのものに必要な時間です。2人で1時間入っても、ここでは1時間として扱います。</p>
              {taskForm.formState.errors.desiredTotalHours ? (
                <p className="text-sm text-rose-600">{taskForm.formState.errors.desiredTotalHours.message}</p>
              ) : null}
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">人数</span>
              <Select
                value={taskRequiredPeoplePerSlot ? 'manual' : 'auto'}
                onChange={(event) => {
                  taskForm.setValue('requiredPeoplePerSlot', event.target.value === 'auto' ? null : 1, { shouldDirty: true, shouldValidate: true })
                }}
              >
                <option value="auto">自動で割り振る</option>
                <option value="manual">人数を指定する</option>
              </Select>
              <p className="text-xs leading-6 text-slate-500">通常は自動で大丈夫です。総作業時間に合わせて、行ける人へ割り振ります。</p>
            </label>
            {taskRequiredPeoplePerSlot ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">一度に入る人数</span>
                <Input type="number" min={1} step={1} {...taskForm.register('requiredPeoplePerSlot')} />
                <p className="text-xs leading-6 text-slate-500">同じ時間に必ず複数人ほしい場合だけ指定します。</p>
                {taskForm.formState.errors.requiredPeoplePerSlot ? (
                  <p className="text-sm text-rose-600">{taskForm.formState.errors.requiredPeoplePerSlot.message}</p>
                ) : null}
              </label>
            ) : null}
          </div>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-violet-600" {...taskForm.register('allowCrossTeamHelp')} />
            <span className="text-sm text-slate-700">他班ヘルプを許可する</span>
          </label>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-700">日時の候補</p>
                <p className="text-xs text-slate-500">買い出しなど、日時が決まっている作業だけ入れます。参加確認で調整できる作業は空でもかまいません。</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() =>
                  setDesiredPeriods((current) => [
                    ...current,
                    { date: '', startTime: '09:00', endTime: '12:00', requiredPeople: taskRequiredPeoplePerSlot ?? 1, location: '', note: '' },
                  ])
                }
              >
                追加
              </Button>
            </div>

            <div className="space-y-3">
              {desiredPeriods.map((period, index) => (
                <Card key={`${index}-${period.date}-${period.startTime}`} className="bg-slate-50">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">日付</span>
                      <DateField
                        value={period.date}
                        onChange={(event) =>
                          setDesiredPeriods((current) =>
                            current.map((item, itemIndex) => (itemIndex === index ? { ...item, date: event.target.value } : item)),
                          )
                        }
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">必要人数</span>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={period.requiredPeople}
                        onChange={(event) =>
                          setDesiredPeriods((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, requiredPeople: Number(event.target.value) || 1 } : item,
                            ),
                          )
                        }
                      />
                    </label>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">開始時刻</span>
                      <Input
                        type="time"
                        value={period.startTime}
                        onChange={(event) =>
                          setDesiredPeriods((current) =>
                            current.map((item, itemIndex) => (itemIndex === index ? { ...item, startTime: event.target.value } : item)),
                          )
                        }
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">終了時刻</span>
                      <Input
                        type="time"
                        value={period.endTime}
                        onChange={(event) =>
                          setDesiredPeriods((current) =>
                            current.map((item, itemIndex) => (itemIndex === index ? { ...item, endTime: event.target.value } : item)),
                          )
                        }
                      />
                    </label>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">場所</span>
                      <Input
                        value={period.location}
                        onChange={(event) =>
                          setDesiredPeriods((current) =>
                            current.map((item, itemIndex) => (itemIndex === index ? { ...item, location: event.target.value } : item)),
                          )
                        }
                        placeholder="体育館"
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">メモ</span>
                      <Input
                        value={period.note}
                        onChange={(event) =>
                          setDesiredPeriods((current) =>
                            current.map((item, itemIndex) => (itemIndex === index ? { ...item, note: event.target.value } : item)),
                          )
                        }
                        placeholder="補足があれば入力"
                      />
                    </label>
                  </div>
                  {desiredPeriods.length > 1 ? (
                    <div className="mt-3 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() => setDesiredPeriods((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                      >
                        この候補を削除
                      </Button>
                    </div>
                  ) : null}
                  {period.date && period.startTime && period.endTime && period.startTime >= period.endTime ? (
                    <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      終了時刻は開始時刻よりあとにしてください。
                    </p>
                  ) : null}
                  {period.date && !period.startTime ? (
                    <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      開始時刻を入れると、その日時を候補として使えます。
                    </p>
                  ) : null}
                </Card>
              ))}
            </div>
          </div>

          {taskMutationError ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{taskMutationError}</p> : null}
          {invalidDesiredPeriod ? <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">入力された時間の中に、終わりが先になっているものがあります。</p> : null}
          {partialDesiredPeriod ? <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">日時候補は、日付・開始・終了をすべて入れてください。</p> : null}
          {taskPlanError ? <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{taskPlanError}</p> : null}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setTaskOpen(false)
                setEditingTask(null)
                setDesiredPeriods([])
                taskForm.reset({
                  name: '',
                  description: '',
                  desiredTotalHours: undefined,
                  requiredPeoplePerSlot: null,
                  workStartDate: '',
                  workEndDate: '',
                  requiredMemberIds: [],
                  allowCrossTeamHelp: false,
                  color: '#7c3aed',
                  sortOrder: 0,
                })
              }}
            >
              キャンセル
            </Button>
            <Button
              type="submit"
              disabled={
                createTaskMutation.isPending ||
                updateTaskMutation.isPending ||
                Boolean(invalidDesiredPeriod) ||
                Boolean(partialDesiredPeriod) ||
                Boolean(taskPlanError)
              }
            >
              {editingTask ? '保存' : '作成'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal title="班を削除" open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-600">
            この操作は取り消せません。班を削除すると、メンバーや関連データの参照先が失われる可能性があります。
          </p>
          {deleteTeamError ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{deleteTeamError}</p> : null}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setDeleteOpen(false)}>
              キャンセル
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              削除する
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
