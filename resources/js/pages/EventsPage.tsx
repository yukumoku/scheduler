import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, FolderKanban } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'

export function EventsPage() {
  const navigate = useNavigate()
  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: api.groups.list,
  })
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const initialGroupId = groupsQuery.data?.[0]?.id ?? ''
  const activeGroupId = selectedGroupId || initialGroupId

  const eventsQuery = useQuery({
    queryKey: ['group', activeGroupId, 'events'],
    queryFn: () => api.groups.events(activeGroupId),
    enabled: Boolean(activeGroupId),
  })

  const events = useMemo(() => eventsQuery.data ?? [], [eventsQuery.data])

  return (
    <div className="space-y-4">
      <PageHeader
        title="イベント"
        description="所属グループのイベントをまとめて確認できます。新しく作るときは、先にグループを開くと迷いにくいです。"
        action={
          <Button onClick={() => navigate(activeGroupId ? `/groups/${activeGroupId}` : '/groups')} leftIcon={<FolderKanban className="h-4 w-4" />}>
            グループを開く
          </Button>
        }
      />

      <Card className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">選択中のグループ</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">
              {groupsQuery.data?.find((group) => group.id === activeGroupId)?.name ?? 'グループを選択してください'}
            </h2>
          </div>
          <div className="w-full md:w-80">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">グループを切り替える</span>
              <Select value={activeGroupId} onChange={(event) => setSelectedGroupId(event.target.value)}>
                <option value="">グループを選択</option>
                {groupsQuery.data?.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </div>

        {!activeGroupId ? (
          <EmptyState
            title="グループがありません"
            description="先にグループを作ると、イベントやシフトをまとめて管理できます。"
            actionLabel="グループを作る"
            onAction={() => navigate('/groups')}
          />
        ) : eventsQuery.isLoading ? (
          <p className="text-sm text-slate-500">読み込み中...</p>
        ) : events.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {events.map((event) => (
              <Link key={event.id} to={`/events/${event.id}`} className="block transition hover:-translate-y-0.5">
                <Card className="h-full bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold tracking-tight text-slate-950">{event.name}</p>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-500">{event.description || '説明はまだありません'}</p>
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
                  <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <FolderKanban className="h-4 w-4" />
                      {event.location || '未設定'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      開く
                      <ChevronDown className="h-4 w-4 -rotate-90" />
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="イベントがまだありません"
            description="イベントはグループ詳細から作成すると、班や作業との関係が分かりやすくなります。"
            actionLabel="グループを開く"
            onAction={() => navigate(activeGroupId ? `/groups/${activeGroupId}` : '/groups')}
          />
        )}
      </Card>
    </div>
  )
}
