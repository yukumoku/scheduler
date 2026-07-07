import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, CalendarDays, CalendarPlus, Copy, Eye, Mail, Pencil, Trash2, UserRound, UserRoundCheck, Users } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { ActionMenu } from '@/components/ui/ActionMenu'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { DateField } from '@/components/ui/DateField'
import { Select } from '@/components/ui/Select'
import { PageGuide } from '@/components/ui/PageGuide'
import { TabBar } from '@/components/ui/TabBar'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { canDeleteGroup, canManageGroup } from '@/lib/permissions'
import { PeriodPreview } from '@/components/availability/PeriodPreview'
import { ActivityRulesFields, createDefaultActivityRules } from '@/components/availability/ActivityRulesFields'
import { AvailabilityReminderList } from '@/components/availability/AvailabilityReminderList'
import type { ActivityRules, CommonAvailabilitySet } from '@/types/api'

const eventSchema = z.object({
  name: z.string().min(1, 'イベント名を入力してください').max(255),
  description: z.string().max(1000).optional().transform((value) => value?.trim() || ''),
  location: z.string().max(255).optional().transform((value) => value?.trim() || ''),
  startDate: z.string().min(1, '開始日を入力してください'),
  endDate: z.string().min(1, '終了日を入力してください'),
  commonAvailabilitySetId: z.string().optional().transform((value) => value?.trim() || ''),
}).refine((value) => value.startDate <= value.endDate, {
  message: '終了日は開始日以降にしてください',
  path: ['endDate'],
})

const invitationSchema = z.object({
  email: z.string().max(255).optional().transform((value) => value?.trim() || ''),
}).refine((value) => !value.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email), {
  message: 'メールアドレスの形式で入力してください',
  path: ['email'],
})

const commonAvailabilitySetSchema = z.object({
  name: z.string().min(1, '期間名を入力してください').max(255),
  description: z.string().max(1000).optional().transform((value) => value?.trim() || ''),
  startDate: z.string().min(1, '開始日を入力してください'),
  endDate: z.string().min(1, '終了日を入力してください'),
  deadline: z.string().optional().transform((value) => value?.trim() || ''),
}).refine((value) => value.startDate <= value.endDate, {
  message: '終了日は開始日以降にしてください',
  path: ['endDate'],
})

type EventFormValues = z.infer<typeof eventSchema>
type InvitationFormValues = z.infer<typeof invitationSchema>
type CommonAvailabilitySetFormValues = z.infer<typeof commonAvailabilitySetSchema>

const eventStatusLabels = {
  draft: '下書き',
  collecting: '準備中',
  generated: '生成済み',
  published: '公開済み',
  closed: '終了',
} as const

function todayDateInput(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function dateInputAfter(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'events' | 'availability'>('overview')
  const [open, setOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [availabilitySetOpen, setAvailabilitySetOpen] = useState(false)
  const [editingAvailabilitySet, setEditingAvailabilitySet] = useState<CommonAvailabilitySet | null>(null)
  const [availabilityActivityRules, setAvailabilityActivityRules] = useState<ActivityRules>(() => createDefaultActivityRules())
  const [copiedInvitationId, setCopiedInvitationId] = useState<string | null>(null)
  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: '',
      description: '',
      location: '',
      startDate: todayDateInput(),
      endDate: todayDateInput(),
      commonAvailabilitySetId: '',
    },
  })
  const inviteForm = useForm<InvitationFormValues>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      email: '',
    },
  })
  const availabilitySetForm = useForm<CommonAvailabilitySetFormValues>({
    resolver: zodResolver(commonAvailabilitySetSchema),
    defaultValues: {
      name: '',
      description: '',
      startDate: todayDateInput(),
      endDate: todayDateInput(),
      deadline: '',
    },
  })
  const groupQuery = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => api.groups.show(groupId ?? ''),
    enabled: Boolean(groupId),
  })
  const membersQuery = useQuery({
    queryKey: ['group', groupId, 'members'],
    queryFn: () => api.groups.members(groupId ?? ''),
    enabled: Boolean(groupId),
  })
  const eventsQuery = useQuery({
    queryKey: ['group', groupId, 'events'],
    queryFn: () => api.groups.events(groupId ?? ''),
    enabled: Boolean(groupId),
  })
  const commonAvailabilitySetsQuery = useQuery({
    queryKey: ['group', groupId, 'common-availability-sets'],
    queryFn: () => api.groups.commonAvailabilitySets(groupId ?? ''),
    enabled: Boolean(groupId),
  })
  const pendingAvailabilitySetsQuery = useQuery({
    queryKey: ['group', groupId, 'pending-availability-sets'],
    queryFn: async () => {
      const sets = commonAvailabilitySetsQuery.data ?? []
      const ownAvailability = await Promise.all(
        sets.map(async (set) => {
          const me = await api.commonAvailabilitySets.me(set.id)
          const hasInput = me.slots.some((slot) => slot.availabilityStatus === 'available' || slot.availabilityStatus === 'preferred')

          return { set, hasInput }
        }),
      )

      return ownAvailability.filter((item) => !item.hasInput).map((item) => item.set)
    },
    enabled: Boolean(commonAvailabilitySetsQuery.data?.length),
  })
  const invitationsQuery = useQuery({
    queryKey: ['group', groupId, 'invitations'],
    queryFn: () => api.groups.invitations(groupId ?? ''),
    enabled: Boolean(groupId && groupQuery.data?.myRole === 'owner'),
  })

  const createEventMutation = useMutation({
    mutationFn: (values: EventFormValues) =>
      api.groups.createEvent(groupId ?? '', {
        name: values.name,
        description: values.description || null,
        location: values.location || null,
        startDate: values.startDate,
        endDate: values.endDate,
        commonAvailabilitySetId: values.commonAvailabilitySetId || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['group', groupId, 'events'] })
      setOpen(false)
      form.reset({
        name: '',
        description: '',
        location: '',
        startDate: todayDateInput(),
        endDate: todayDateInput(),
        commonAvailabilitySetId: '',
      })
    },
  })

  const deleteEventMutation = useMutation({
    mutationFn: (eventId: string) => api.events.delete(eventId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['group', groupId, 'events'] })
    },
  })
  const deleteGroupMutation = useMutation({
    mutationFn: () => api.groups.delete(groupId ?? ''),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['groups'] })
      navigate('/groups')
    },
  })
  const createInvitationMutation = useMutation({
    mutationFn: (values: InvitationFormValues) =>
      api.groups.createInvitation(groupId ?? '', {
        email: values.email || null,
      }),
    onSuccess: async (invitation) => {
      await queryClient.invalidateQueries({ queryKey: ['group', groupId, 'invitations'] })
      setInviteOpen(false)
      setCopiedInvitationId(invitation.id)
      inviteForm.reset({ email: '' })
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(invitation.code ?? invitation.inviteUrl).catch(() => undefined)
      }
    },
  })
  const deleteInvitationMutation = useMutation({
    mutationFn: (invitationId: string) => api.invitations.delete(invitationId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['group', groupId, 'invitations'] })
    },
  })
  const createCommonAvailabilitySetMutation = useMutation({
    mutationFn: (values: CommonAvailabilitySetFormValues) =>
      api.groups.createCommonAvailabilitySet(groupId ?? '', {
        name: values.name,
        description: values.description || null,
        startDate: values.startDate,
        endDate: values.endDate,
        deadline: values.deadline || null,
        activityRules: availabilityActivityRules,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['group', groupId, 'common-availability-sets'] })
      setAvailabilitySetOpen(false)
      availabilitySetForm.reset({
        name: '',
        description: '',
        startDate: todayDateInput(),
        endDate: todayDateInput(),
        deadline: '',
      })
      setAvailabilityActivityRules(createDefaultActivityRules())
      setActiveTab('availability')
    },
  })
  const updateCommonAvailabilitySetMutation = useMutation({
    mutationFn: (values: CommonAvailabilitySetFormValues) => {
      if (!editingAvailabilitySet) {
        throw new Error('編集する期間が見つかりません。')
      }

      return api.commonAvailabilitySets.update(editingAvailabilitySet.id, {
        name: values.name,
        description: values.description || null,
        startDate: values.startDate,
        endDate: values.endDate,
        deadline: values.deadline || null,
        activityRules: availabilityActivityRules,
      })
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['group', groupId, 'common-availability-sets'] })
      if (editingAvailabilitySet) {
        await queryClient.invalidateQueries({ queryKey: ['common-availability-set', editingAvailabilitySet.id] })
        await queryClient.invalidateQueries({ queryKey: ['common-availability-set', editingAvailabilitySet.id, 'me'] })
        await queryClient.invalidateQueries({ queryKey: ['common-availability-set', editingAvailabilitySet.id, 'submissions'] })
      }
      setAvailabilitySetOpen(false)
      setEditingAvailabilitySet(null)
      availabilitySetForm.reset({
        name: '',
        description: '',
        startDate: todayDateInput(),
        endDate: todayDateInput(),
        deadline: '',
      })
      setAvailabilityActivityRules(createDefaultActivityRules())
      setActiveTab('availability')
    },
  })
  const updateMemberRoleMutation = useMutation({
    mutationFn: (input: { memberId: string; role: 'owner' | 'member' }) =>
      api.groups.updateMember(groupId ?? '', input.memberId, { role: input.role }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['group', groupId, 'members'] })
      await queryClient.invalidateQueries({ queryKey: ['group', groupId] })
    },
  })

  const group = groupQuery.data ?? null
  const members = useMemo(() => (Array.isArray(membersQuery.data) ? membersQuery.data : []), [membersQuery.data])
  const invitations = useMemo(() => (Array.isArray(invitationsQuery.data) ? invitationsQuery.data : []), [invitationsQuery.data])
  const events = useMemo(() => (Array.isArray(eventsQuery.data) ? eventsQuery.data : []), [eventsQuery.data])
  const commonAvailabilitySets = useMemo(
    () => (Array.isArray(commonAvailabilitySetsQuery.data) ? commonAvailabilitySetsQuery.data : []),
    [commonAvailabilitySetsQuery.data],
  )
  const availabilitySetPreview = availabilitySetForm.watch()
  const deleteEventErrorMessage = deleteEventMutation.error instanceof Error ? deleteEventMutation.error.message : null
  const deleteGroupErrorMessage = deleteGroupMutation.error instanceof Error ? deleteGroupMutation.error.message : null
  const createInvitationErrorMessage = createInvitationMutation.error instanceof Error ? createInvitationMutation.error.message : null
  const deleteInvitationErrorMessage = deleteInvitationMutation.error instanceof Error ? deleteInvitationMutation.error.message : null
  const allowGroupManagement = canManageGroup(group)
  const allowGroupDelete = canDeleteGroup(group)
  const ownerCount = members.filter((member) => member.role === 'owner').length
  const openCreateAvailabilitySet = () => {
    setEditingAvailabilitySet(null)
    availabilitySetForm.reset({
      name: '',
      description: '',
      startDate: todayDateInput(),
      endDate: todayDateInput(),
      deadline: '',
    })
    setAvailabilityActivityRules(createDefaultActivityRules())
    setAvailabilitySetOpen(true)
  }
  const openEditAvailabilitySet = (set: CommonAvailabilitySet) => {
    setEditingAvailabilitySet(set)
    availabilitySetForm.reset({
      name: set.name,
      description: set.description ?? '',
      startDate: set.startDate ?? todayDateInput(),
      endDate: set.endDate ?? todayDateInput(),
      deadline: set.deadline ? set.deadline.slice(0, 10) : '',
    })
    setAvailabilityActivityRules(set.activityRules ?? createDefaultActivityRules())
    setAvailabilitySetOpen(true)
  }
  const guideItems = useMemo(() => {
    if (!allowGroupManagement) {
      switch (activeTab) {
        case 'members':
          return [
            { title: 'メンバーを見る', description: '参加者だけを静かに確認します。' },
            { title: '役割を確認', description: 'owner / member を見分けます。' },
            { title: '必要なら相談', description: '招待や削除はオーナーに依頼します。' },
          ]
        case 'events':
          return [
            { title: 'イベントを開く', description: '公開されたイベントだけを見ます。' },
            { title: 'シフトを見る', description: '必要な情報だけを確認します。' },
            { title: '設定はオーナーへ', description: '作成や削除は表示されません。' },
          ]
        default:
          return [
            { title: '概要だけ確認', description: '必要な情報を静かに見られます。' },
            { title: 'イベントを見る', description: '詳細はイベント側で開きます。' },
            { title: '管理操作は非表示', description: '作成や削除は出しません。' },
          ]
      }
    }

    switch (activeTab) {
      case 'members':
        return [
          { title: 'メンバーを見る', description: '参加者だけをすばやく確認します。' },
          { title: '必要なときだけ招待', description: '招待はオーナーだけが行えます。' },
          { title: '役割を確認', description: 'owner / member のみを表示します。' },
        ]
      case 'events':
        return [
          { title: 'イベントを作る', description: '必要な活動だけを登録します。' },
          { title: '期間はイベントで管理', description: '参加確認はイベント側にまとめます。' },
          { title: '詳細を開く', description: '作業やシフトへ進みます。' },
        ]
      case 'availability':
        return [
          { title: '期間を作る', description: 'イベントで使う確認期間を先に作ります。' },
          { title: '日付を選ぶ', description: '期間内の日だけ入力できます。' },
          { title: '時間を複数入れる', description: '同じ日に何件でも追加できます。' },
        ]
      default:
        return [
          { title: 'イベントを作る', description: '必要な活動をひとつずつ入れます。' },
          { title: 'メンバーを見る', description: '参加者を静かに確認できます。' },
          { title: '参加可能日時へ進む', description: '必要な場所へすぐ移動できます。' },
        ]
    }
  }, [activeTab, allowGroupManagement])
  const primaryAction =
    activeTab === 'members' && allowGroupManagement ? (
      <Button leftIcon={<Mail className="h-4 w-4" />} onClick={() => setInviteOpen(true)}>
        メンバーを招待
      </Button>
    ) : activeTab === 'availability' && allowGroupManagement ? (
      <Button onClick={openCreateAvailabilitySet} leftIcon={<CalendarPlus className="h-4 w-4" />}>
        期間を作る
      </Button>
    ) : allowGroupManagement ? (
      <Button onClick={() => setOpen(true)} leftIcon={<CalendarPlus className="h-4 w-4" />}>
        イベントを作成
      </Button>
    ) : null
  const headerAction = allowGroupManagement ? (
    <div className="flex items-center gap-2">
      {primaryAction}
      <ActionMenu
        triggerLabel="グループの操作"
        items={[
          {
            label: 'グループを削除',
            icon: <Trash2 className="h-4 w-4" />,
            danger: true,
            disabled: !allowGroupDelete,
            onClick: () => {
              if (window.confirm(`「${group?.name ?? 'このグループ'}」を削除しますか？イベントなどの関連データも一緒に削除されます。`)) {
                deleteGroupMutation.mutate()
              }
            },
          },
        ]}
      />
    </div>
  ) : null

  if (!groupId) {
    return <EmptyState title="グループが見つかりません" description="URLを確認してください。" />
  }

  const isLoading =
    groupQuery.isLoading ||
    membersQuery.isLoading ||
    eventsQuery.isLoading ||
    commonAvailabilitySetsQuery.isLoading ||
    false

  const queryError =
    groupQuery.error instanceof Error
      ? groupQuery.error.message
      : membersQuery.error instanceof Error
        ? membersQuery.error.message
      : eventsQuery.error instanceof Error
          ? eventsQuery.error.message
          : commonAvailabilitySetsQuery.error instanceof Error
            ? commonAvailabilitySetsQuery.error.message
          : null

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="グループを読み込み中" description="少しお待ちください。" />
        <Card>
          <LoadingSpinner />
        </Card>
      </div>
    )
  }

  if (queryError) {
    return <EmptyState title="グループを表示できません" description={queryError} />
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={group?.name ?? 'グループ詳細'}
        description={group?.description}
        action={headerAction}
      />

      <AvailabilityReminderList
        sets={pendingAvailabilitySetsQuery.data ?? []}
        loading={pendingAvailabilitySetsQuery.isLoading && Boolean(commonAvailabilitySets.length)}
        compact
      />

      <PageGuide
        title="簡単ステップ"
        description="次の操作だけ表示します。"
        items={guideItems}
      />

      <TabBar
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'overview', label: '概要' },
          { key: 'members', label: 'メンバー', count: members.length },
          { key: 'events', label: 'イベント', count: events.length },
          { key: 'availability', label: '期間', count: commonAvailabilitySets.length },
        ]}
      />

      {activeTab === 'overview' ? (
        <>
          <Card className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">イベント</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setActiveTab('availability')}>
                  参加可能日時を見る
                </Button>
                {commonAvailabilitySets[0] ? (
                  <Button variant="secondary" onClick={() => navigate(`/availability-sets/${commonAvailabilitySets[0].id}`)}>
                    いま入力する
                  </Button>
                ) : null}
                <Button variant="secondary" onClick={() => setActiveTab('events')}>
                  イベントを見る
                </Button>
                {allowGroupManagement ? <Button onClick={() => setOpen(true)}>イベントを作る</Button> : null}
              </div>
            </div>
            <EmptyState
              title="イベント"
              description="必要な活動を、ここから開きます。"
              actionLabel={allowGroupManagement ? 'イベントを作る' : 'イベントを見る'}
              onAction={allowGroupManagement ? () => setOpen(true) : () => setActiveTab('events')}
            />
          </Card>
          {deleteGroupErrorMessage ? <p className="text-sm text-rose-600">{deleteGroupErrorMessage}</p> : null}

          <Card className="space-y-4">
            <div className="mb-1">
              <h2 className="text-lg font-semibold text-slate-900">最近のイベント</h2>
            </div>

            {events.length ? (
              <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {events.slice(0, 4).map((event) => (
                  <Link key={event.id} to={`/events/${event.id}`} className="block bg-white p-4 transition hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate font-semibold text-slate-900">{event.name}</p>
                      <Badge variant={event.status === 'collecting' ? 'warning' : event.status === 'published' ? 'success' : 'brand'}>
                        {eventStatusLabels[event.status]}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState title="イベントがありません" description="必要になったら、ここから追加できます。" />
            )}
            {events.length > 4 ? (
              <Button variant="secondary" className="mt-4" onClick={() => setActiveTab('events')}>
                すべて見る
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : null}
          </Card>
        </>
      ) : null}

      {activeTab === 'members' ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <Card className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-slate-700" />
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">メンバー</h2>
                </div>
              </div>
              {allowGroupManagement ? (
                <Button leftIcon={<Mail className="h-4 w-4" />} onClick={() => setInviteOpen(true)}>
                  メンバーを招待
                </Button>
              ) : null}
            </div>

            {members.length ? (
              <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {members.map((member) => (
                  <div key={member.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar
                        src={member.avatarUrl}
                        name={member.displayName}
                        className="h-10 w-10 shrink-0 rounded-2xl bg-slate-100 text-slate-700"
                        iconClassName="h-4 w-4"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{member.displayName ?? '名前未設定'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={member.role === 'owner' ? 'brand' : 'neutral'}>
                        {member.role === 'owner' ? 'オーナー' : 'メンバー'}
                      </Badge>
                      {allowGroupManagement ? (
                        <ActionMenu
                          triggerLabel={`${member.displayName ?? 'メンバー'}の役割変更`}
                          items={[
                            {
                              label: 'オーナーにする',
                              icon: <UserRoundCheck className="h-4 w-4" />,
                              disabled: member.role === 'owner',
                              onClick: () => updateMemberRoleMutation.mutate({ memberId: member.id, role: 'owner' }),
                            },
                            {
                              label: 'メンバーにする',
                              icon: <UserRound className="h-4 w-4" />,
                              disabled: member.role === 'member' || (member.role === 'owner' && ownerCount <= 1),
                              onClick: () => updateMemberRoleMutation.mutate({ memberId: member.id, role: 'member' }),
                            },
                          ]}
                        />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="メンバーがいません" description="招待したメンバーがここに表示されます。" />
            )}
          </Card>

          <Card className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">招待コード</h2>
            </div>

            {!allowGroupManagement ? (
              <EmptyState title="招待はオーナーのみ" description="必要なときだけ使います。" />
            ) : invitationsQuery.isLoading ? (
              <p className="text-sm text-slate-500">招待を読み込み中...</p>
            ) : invitations.length ? (
              <div className="space-y-3">
                {invitations.map((invitation) => (
                  <div key={invitation.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">{invitation.email || '共有用コード'}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          期限 {invitation.expiresAt ? new Date(invitation.expiresAt).toLocaleDateString('ja-JP') : 'なし'}
                        </p>
                        <p className="mt-3 inline-flex rounded-2xl bg-white px-4 py-2 font-mono text-lg font-bold tracking-[0.22em] text-slate-700 ring-1 ring-slate-200">
                          {invitation.code ?? '未発行'}
                        </p>
                      </div>
                      <Badge variant={invitation.acceptedAt ? 'success' : 'warning'}>{invitation.acceptedAt ? '参加済み' : '招待中'}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        leftIcon={<Copy className="h-4 w-4" />}
                        onClick={async () => {
                          if (navigator.clipboard) {
                            await navigator.clipboard.writeText(invitation.code ?? invitation.inviteUrl)
                            setCopiedInvitationId(invitation.id)
                          }
                        }}
                      >
                        {copiedInvitationId === invitation.id ? 'コピー済み' : 'コードをコピー'}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={async () => {
                          if (navigator.clipboard) {
                            await navigator.clipboard.writeText(invitation.inviteUrl)
                            setCopiedInvitationId(invitation.id)
                          }
                        }}
                      >
                        URLをコピー
                      </Button>
                      {!invitation.acceptedAt ? (
                        <Button
                          size="sm"
                          variant="danger"
                          leftIcon={<Trash2 className="h-4 w-4" />}
                          onClick={() => {
                            if (window.confirm('この招待リンクを取り消しますか？')) {
                              deleteInvitationMutation.mutate(invitation.id)
                            }
                          }}
                        >
                          取り消す
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="招待コードはまだありません"
                description="メンバーを招待すると、ここに参加用コードが表示されます。"
                actionLabel="メンバーを招待"
                onAction={() => setInviteOpen(true)}
              />
            )}
            {createInvitationErrorMessage ? <p className="text-sm text-rose-600">{createInvitationErrorMessage}</p> : null}
            {deleteInvitationErrorMessage ? <p className="text-sm text-rose-600">{deleteInvitationErrorMessage}</p> : null}
            {updateMemberRoleMutation.error instanceof Error ? <p className="text-sm text-rose-600">{updateMemberRoleMutation.error.message}</p> : null}
          </Card>
        </div>
      ) : null}

      {activeTab === 'events' ? (
        <Card className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-slate-700" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">イベント</h2>
              </div>
            </div>
            {allowGroupManagement ? (
              <Button leftIcon={<CalendarPlus className="h-4 w-4" />} onClick={() => setOpen(true)}>
                イベントを作成
              </Button>
            ) : null}
          </div>

          {events.length ? (
            <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {events.map((event) => {
                return (
                  <div key={event.id} className="flex flex-col gap-4 p-4 transition hover:bg-slate-50 md:flex-row md:items-center">
                    <Link to={`/events/${event.id}`} className="min-w-0 flex-1">
                      <div className="flex items-start gap-3">
                        <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                          <CalendarDays className="h-5 w-5" />
                        </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{event.name}</p>
                          {event.description || event.location ? (
                            <p className="mt-1 line-clamp-1 text-sm text-slate-500">{event.description || event.location}</p>
                          ) : null}
                        </div>
                      </div>
                    </Link>

                    <div className="flex flex-wrap items-center gap-2 md:justify-end">
                      <Badge variant={event.status === 'collecting' ? 'warning' : event.status === 'published' ? 'success' : 'brand'}>
                        {eventStatusLabels[event.status]}
                      </Badge>
                      <Badge variant="neutral">
                        {event.startDate ?? '未設定'} 〜 {event.endDate ?? '未設定'}
                      </Badge>
                      {allowGroupManagement ? (
                        <ActionMenu
                          triggerLabel={`${event.name}の操作`}
                          items={[
                            {
                              label: 'イベントを開く',
                              icon: <Eye className="h-4 w-4" />,
                              onClick: () => navigate(`/events/${event.id}`),
                            },
                            {
                              label: 'シフトを作成',
                              icon: <CalendarPlus className="h-4 w-4" />,
                              onClick: () => navigate(`/events/${event.id}?tab=shifts`),
                            },
                            {
                              label: 'イベントを削除',
                              icon: <Trash2 className="h-4 w-4" />,
                              danger: true,
                              onClick: () => {
                                if (window.confirm(`「${event.name}」を削除しますか？作業、日時、シフトも一緒に削除されます。`)) {
                                  deleteEventMutation.mutate(event.id)
                                }
                              },
                            },
                          ]}
                        />
                      ) : (
                        <Button size="sm" variant="secondary" onClick={() => navigate(`/events/${event.id}`)}>
                          開く
                        </Button>
                      )}
                </div>
              </div>
                )
              })}
            </div>
          ) : (
          <EmptyState
            title="イベントがまだありません"
            description="必要ならここから追加できます。"
            actionLabel="イベントを作成"
            onAction={() => setOpen(true)}
          />
          )}
          {deleteEventErrorMessage ? <p className="text-sm text-rose-600">{deleteEventErrorMessage}</p> : null}
        </Card>
      ) : null}

      {activeTab === 'availability' ? (
        <Card className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-slate-700" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">参加確認</h2>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {allowGroupManagement ? (
                <Button onClick={openCreateAvailabilitySet}>
                  新しく作る
                </Button>
              ) : null}
              {commonAvailabilitySets[0] ? (
                <Button variant="secondary" onClick={() => navigate(`/availability-sets/${commonAvailabilitySets[0].id}`)}>
                  入力する
                </Button>
              ) : null}
            </div>
          </div>

          {commonAvailabilitySets.length ? (
            <div className="grid gap-3">
              {commonAvailabilitySets.map((set) => (
                <div
                  key={set.id}
                  className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-[1px] hover:border-slate-300 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <Link to={`/availability-sets/${set.id}`} className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-slate-900">{set.name}</p>
                      <Badge variant="neutral">
                        {set.startDate} 〜 {set.endDate}
                      </Badge>
                    </div>
                    {set.description ? <p className="mt-1 text-sm text-slate-500">{set.description}</p> : null}
                  </Link>
                  <div className="flex items-center gap-2">
                    <Badge variant="brand">{set.availabilityCount}件</Badge>
                    <Badge variant="info">入力</Badge>
                    {allowGroupManagement ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        leftIcon={<Pencil className="h-4 w-4" />}
                        onClick={() => openEditAvailabilitySet(set)}
                      >
                        編集
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="期間はまだありません"
              description="オーナーが作成すると、ここから入力できます。"
            />
          )}
        </Card>
      ) : null}

      <Modal title="メンバーを招待" open={inviteOpen} onClose={() => setInviteOpen(false)}>
        <form className="space-y-4" onSubmit={inviteForm.handleSubmit((values) => createInvitationMutation.mutate(values))}>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-sm font-semibold text-slate-900">招待コードを作成</p>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">メールアドレス</span>
            <Input type="email" {...inviteForm.register('email')} placeholder="任意: member@example.com" />
            {inviteForm.formState.errors.email ? <p className="text-sm text-rose-600">{inviteForm.formState.errors.email.message}</p> : null}
          </label>

          {createInvitationErrorMessage ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{createInvitationErrorMessage}</p> : null}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setInviteOpen(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={createInvitationMutation.isPending} leftIcon={<Mail className="h-4 w-4" />}>
              招待コードを作成
            </Button>
          </div>
        </form>
      </Modal>

      <Modal title="イベントを作成" open={open} onClose={() => setOpen(false)}>
        <form className="space-y-4" onSubmit={form.handleSubmit((values) => createEventMutation.mutate(values))}>
          <p className="text-sm leading-6 text-slate-500">イベント名と日付を入れて作成します。確認期間はあとで選べます。</p>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">イベント名</span>
            <Input {...form.register('name')} placeholder="文化祭準備ミーティング" />
            {form.formState.errors.name ? <p className="text-sm text-rose-600">{form.formState.errors.name.message}</p> : null}
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">説明</span>
            <Textarea {...form.register('description')} placeholder="活動の目的や概要" />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">場所</span>
            <Input {...form.register('location')} placeholder="体育館" />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">共通希望</span>
            <Select {...form.register('commonAvailabilitySetId')}>
              <option value="">あとで選ぶ</option>
              {commonAvailabilitySets.map((set) => (
                <option key={set.id} value={set.id}>
                  {set.name}
                </option>
              ))}
            </Select>
            <p className="text-xs text-slate-500">あとでイベント画面から変更もできます。</p>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">開始日</span>
              <DateField {...form.register('startDate')} />
              {form.formState.errors.startDate ? <p className="text-sm text-rose-600">{form.formState.errors.startDate.message}</p> : null}
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">終了日</span>
              <DateField {...form.register('endDate')} />
              {form.formState.errors.endDate ? <p className="text-sm text-rose-600">{form.formState.errors.endDate.message}</p> : null}
            </label>
          </div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={createEventMutation.isPending}>
              作成
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        title={editingAvailabilitySet ? '期間を編集' : '期間を作る'}
        open={availabilitySetOpen}
        onClose={() => {
          setAvailabilitySetOpen(false)
          setEditingAvailabilitySet(null)
        }}
      >
        <form
          className="space-y-4"
          onSubmit={availabilitySetForm.handleSubmit((values) => {
            if (editingAvailabilitySet) {
              updateCommonAvailabilitySetMutation.mutate(values)
            } else {
              createCommonAvailabilitySetMutation.mutate(values)
            }
          })}
        >
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
            <Input {...availabilitySetForm.register('name')} placeholder="夏休みの参加確認" />
            {availabilitySetForm.formState.errors.name ? <p className="text-sm text-rose-600">{availabilitySetForm.formState.errors.name.message}</p> : null}
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">開始日</span>
              <DateField {...availabilitySetForm.register('startDate')} />
              {availabilitySetForm.formState.errors.startDate ? <p className="text-sm text-rose-600">{availabilitySetForm.formState.errors.startDate.message}</p> : null}
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">終了日</span>
              <DateField {...availabilitySetForm.register('endDate')} />
              {availabilitySetForm.formState.errors.endDate ? <p className="text-sm text-rose-600">{availabilitySetForm.formState.errors.endDate.message}</p> : null}
            </label>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">締切</span>
            <DateField {...availabilitySetForm.register('deadline')} />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">メモ</span>
            <Textarea {...availabilitySetForm.register('description')} placeholder="例: 平日は放課後、休日は午前から確認" />
          </label>

          <ActivityRulesFields value={availabilityActivityRules} onChange={setAvailabilityActivityRules} />

          {createCommonAvailabilitySetMutation.error instanceof Error ? (
            <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{createCommonAvailabilitySetMutation.error.message}</p>
          ) : null}
          {updateCommonAvailabilitySetMutation.error instanceof Error ? (
            <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{updateCommonAvailabilitySetMutation.error.message}</p>
          ) : null}

          <div className="sticky bottom-0 -mx-4 grid grid-cols-2 gap-2 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:flex sm:items-center sm:justify-end sm:px-5">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setAvailabilitySetOpen(false)
                setEditingAvailabilitySet(null)
              }}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={createCommonAvailabilitySetMutation.isPending || updateCommonAvailabilitySetMutation.isPending}>
              {createCommonAvailabilitySetMutation.isPending || updateCommonAvailabilitySetMutation.isPending
                ? '保存中...'
                : editingAvailabilitySet
                  ? '保存'
                  : '期間を作る'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
