import { useQuery } from '@tanstack/react-query'
import { CalendarDays, CalendarRange, FolderKanban, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '@/lib/api'
import { EmptyState } from '@/components/ui/EmptyState'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { PageGuide } from '@/components/ui/PageGuide'
import { AvailabilityReminderList } from '@/components/availability/AvailabilityReminderList'

export function DashboardPage() {
  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: api.groups.list,
  })
  const primaryGroupId = groupsQuery.data?.[0]?.id
  const eventsQuery = useQuery({
    queryKey: ['dashboard', 'events', primaryGroupId],
    queryFn: () => api.groups.events(primaryGroupId ?? ''),
    enabled: Boolean(primaryGroupId),
  })
  const availabilitySetsQuery = useQuery({
    queryKey: ['dashboard', 'availability-sets', groupsQuery.data?.map((group) => group.id).join(',')],
    queryFn: async () => {
      const groups = groupsQuery.data ?? []
      const allSets = await Promise.all(groups.map((group) => api.groups.commonAvailabilitySets(group.id)))
      const sets = allSets.flat()
      const ownAvailability = await Promise.all(
        sets.map(async (set) => {
          const me = await api.commonAvailabilitySets.me(set.id)
          const hasInput = me.slots.some((slot) => slot.availabilityStatus === 'available' || slot.availabilityStatus === 'preferred')

          return { set, hasInput }
        }),
      )

      return ownAvailability.filter((item) => !item.hasInput).map((item) => item.set)
    },
    enabled: Boolean(groupsQuery.data?.length),
  })

  const upcomingEvents = (eventsQuery.data ?? []).filter((event) => event.status !== 'closed').slice(0, 3)
  const draftEvents = (eventsQuery.data ?? []).filter((event) => event.status === 'draft' || event.status === 'collecting')
  const pendingAvailabilitySets = availabilitySetsQuery.data ?? []

  return (
    <div className="space-y-4">
      <PageHeader
        title="ホーム"
        description="まず見る場所です。グループとイベントの状況をまとめて確認できます。"
      />

      <AvailabilityReminderList sets={pendingAvailabilitySets} loading={availabilitySetsQuery.isLoading && Boolean(groupsQuery.data?.length)} />

      <PageGuide
          title="簡単ステップ"
          description="まずはグループを選び、イベントの確認に進みましょう。"
        items={[
          { title: 'グループを開く', description: '最初に活動したいグループを選びます。', icon: <FolderKanban className="h-4 w-4" /> },
          { title: 'イベントを確認する', description: '次に見たい予定や準備を確認します。', icon: <CalendarDays className="h-4 w-4" /> },
          { title: '準備中を見る', description: '公開前のイベントをチェックします。', icon: <CalendarRange className="h-4 w-4" /> },
          { title: '必要なら新規作成', description: 'グループがなければここから作成できます。', icon: <Sparkles className="h-4 w-4" /> },
        ]}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="所属グループ" value={String(groupsQuery.data?.length ?? 0)} hint="参加中のグループ数" icon={<FolderKanban className="h-5 w-5" />} />
        <StatCard label="今後のイベント" value={String(upcomingEvents.length)} hint="直近で確認したい項目" icon={<CalendarRange className="h-5 w-5" />} />
        <StatCard label="準備中のイベント" value={String(draftEvents.length)} hint="まだ公開していない項目" icon={<Sparkles className="h-5 w-5" />} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-950">グループ</h2>
              <p className="mt-1 text-sm text-slate-500">作業を始めるグループを選びましょう。</p>
            </div>
            <Badge variant="brand">一覧</Badge>
          </div>

          {groupsQuery.isLoading ? (
            <p className="text-sm text-slate-500">読み込み中...</p>
          ) : groupsQuery.data?.length ? (
            <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {groupsQuery.data.map((group) => (
                <Link
                  key={group.id}
                  to={`/groups/${group.id}`}
                  className="block p-4 transition hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{group.name}</p>
                      {group.description ? <p className="mt-1 truncate text-sm text-slate-500">{group.description}</p> : null}
                    </div>
                    <Badge variant="neutral">{group.memberCount}人</Badge>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="所属グループがありません"
              description="グループを作ると、イベントやシフトをまとめて管理できます。"
              actionLabel="グループを作る"
              onAction={() => (window.location.href = '/groups')}
            />
          )}
        </Card>

        <Card>
          <div className="mb-5">
            <h2 className="text-lg font-semibold tracking-tight text-slate-950">今後のイベント</h2>
            <p className="mt-1 text-sm text-slate-500">次に確認したいイベントです。</p>
          </div>

          {upcomingEvents.length ? (
            <div className="space-y-3">
              {upcomingEvents.map((event) => (
                <Link key={event.id} to={`/events/${event.id}`} className="block rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{event.name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {event.location || '場所なし'} / {event.startDate ?? '日付なし'}
                      </p>
                    </div>
                    <Badge variant={event.status === 'collecting' ? 'warning' : event.status === 'published' ? 'success' : 'brand'}>
                      {event.status === 'draft'
                        ? '下書き'
                        : event.status === 'collecting'
                          ? '準備中'
                          : event.status === 'generated'
                            ? 'シフト作成済み'
                            : event.status === 'published'
                              ? '公開済み'
                              : '終了'}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="今後のイベントはまだありません" description="イベントが作成されると、ここに表示されます。" />
          )}
        </Card>
      </div>

    </div>
  )
}
