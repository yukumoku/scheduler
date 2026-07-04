import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CalendarPlus, FolderKanban } from 'lucide-react'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'

export function ShiftCreatePage() {
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: api.groups.list,
  })
  const activeGroupId = selectedGroupId || groupsQuery.data?.[0]?.id || ''
  const eventsQuery = useQuery({
    queryKey: ['group', activeGroupId, 'events'],
    queryFn: () => api.groups.events(activeGroupId),
    enabled: Boolean(activeGroupId),
  })
  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data])

  return (
    <div className="space-y-6">
      <PageHeader
        title="シフト"
        description="シフトを作りたいイベントを選びます。イベントを開いたら「シフト」タブで作成できます。"
      />

      <Card className="space-y-4">
        <label className="block max-w-sm space-y-2">
          <span className="text-sm font-medium text-slate-700">グループ</span>
          <Select value={activeGroupId} onChange={(event) => setSelectedGroupId(event.target.value)}>
            {groupsQuery.data?.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>
        </label>
      </Card>

      {groupsQuery.isLoading || eventsQuery.isLoading ? (
        <Card>
          <LoadingSpinner />
        </Card>
      ) : !activeGroupId ? (
        <EmptyState title="グループがありません" description="先にグループを作ると、イベントとシフトを管理できます。" />
      ) : events.length ? (
        <Card className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">イベント</h2>
            <p className="text-sm text-slate-500">作業や時間枠がそろっているイベントから、シフト作成へ進めます。</p>
          </div>
          <div className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {events.map((event) => (
              <Link key={event.id} to={`/events/${event.id}?tab=shifts`} className="flex flex-col gap-3 p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                    <FolderKanban className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{event.name}</p>
                    <p className="mt-1 truncate text-sm text-slate-500">{event.location || '場所なし'}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={event.status === 'published' ? 'success' : event.status === 'collecting' ? 'warning' : 'brand'}>
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
                  <Badge variant="brand">
                    <CalendarPlus className="mr-1 h-3 w-3" />
                    シフトへ
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      ) : (
        <EmptyState title="イベントがありません" description="グループを開いてイベントを作ると、ここからシフト作成へ進めます。" />
      )}
    </div>
  )
}
