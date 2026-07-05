import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, Filter, FolderKanban, MapPin } from 'lucide-react'
import { api } from '@/lib/api'
import type { CalendarShiftItem } from '@/types/api'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { UserAvatar } from '@/components/ui/UserAvatar'

function toLocalDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null
  }

  const date = new Date(`${value}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function formatMonthLabel(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
}

function formatShortDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function sameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate()
}

function getMonthCells(month: Date): Array<Date | null> {
  const firstDay = startOfMonth(month)
  const startOffset = firstDay.getDay()
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cells: Array<Date | null> = []

  for (let index = 0; index < startOffset; index += 1) {
    cells.push(null)
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day))
  }

  while (cells.length % 7 !== 0) {
    cells.push(null)
  }

  return cells
}

function sortByDateTime(items: CalendarShiftItem[]): CalendarShiftItem[] {
  return [...items].sort((left, right) => {
    const leftValue = `${left.date ?? ''} ${left.startTime ?? ''}`
    const rightValue = `${right.date ?? ''} ${right.startTime ?? ''}`
    return leftValue.localeCompare(rightValue)
  })
}

function formatClock(value: string | null | undefined): string {
  return value ? value.slice(0, 5) : '--:--'
}

function getStatusLabel(status: CalendarShiftItem['shiftStatus']): string {
  switch (status) {
    case 'published':
      return '公開済み'
    case 'generated':
      return '生成済み'
    case 'closed':
      return '終了'
    default:
      return '下書き'
  }
}

type CalendarGroupedEvents = {
  groupId: string
  groupName: string
  events: Array<{
    id: string
    name: string
  }>
}

export function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))
  const [selectedDateKey, setSelectedDateKey] = useState(() => formatDateKey(new Date()))
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([])
  const [expandedGroupIds, setExpandedGroupIds] = useState<string[]>([])
  const [filtersReady, setFiltersReady] = useState(false)

  const calendarQuery = useQuery({
    queryKey: ['calendar', 'shifts'],
    queryFn: api.calendar.shifts,
  })

  const items = useMemo(() => calendarQuery.data ?? [], [calendarQuery.data])

  useEffect(() => {
    if (filtersReady || !calendarQuery.isSuccess) {
      return
    }

    const groupIds = Array.from(new Set(items.map((item) => item.groupId).filter((value): value is string => Boolean(value))))
    const eventIds = Array.from(new Set(items.map((item) => item.eventId).filter((value): value is string => Boolean(value))))

    setSelectedGroupIds(groupIds)
    setSelectedEventIds(eventIds)
    setExpandedGroupIds(groupIds)
    setFiltersReady(true)
  }, [calendarQuery.isSuccess, filtersReady, items])

  const groupOptions = useMemo(
    () =>
      Array.from(
        new Map(
          items
            .filter((item) => item.groupId)
            .map((item) => [
              item.groupId as string,
              {
                id: item.groupId as string,
                name: item.groupName ?? 'グループ',
              },
            ]),
        ).values(),
      ),
    [items],
  )

  const eventOptions = useMemo(
    () =>
      Array.from(
        new Map(
          items
            .filter((item) => item.eventId)
            .map((item) => [
              item.eventId as string,
              {
                id: item.eventId as string,
                name: item.eventName ?? 'イベント',
                groupId: item.groupId,
                groupName: item.groupName,
              },
            ]),
        ).values(),
      ),
    [items],
  )

  const eventsByGroup = useMemo<CalendarGroupedEvents[]>(() => {
    return groupOptions
      .map((group) => ({
        groupId: group.id,
        groupName: group.name,
        events: eventOptions.filter((event) => event.groupId === group.id).map((event) => ({ id: event.id, name: event.name })),
      }))
      .filter((entry) => entry.events.length > 0)
  }, [eventOptions, groupOptions])

  const eventIdsByGroup = useMemo(() => {
    return new Map(eventsByGroup.map((entry) => [entry.groupId, entry.events.map((event) => event.id)]))
  }, [eventsByGroup])

  const filteredItems = useMemo(() => {
    return sortByDateTime(
      items.filter((item) => {
        const groupAllowed = item.groupId ? selectedGroupIds.includes(item.groupId) : true
        const eventAllowed = item.eventId ? selectedEventIds.includes(item.eventId) : true
        return groupAllowed && eventAllowed
      }),
    )
  }, [items, selectedEventIds, selectedGroupIds])

  const monthItems = useMemo(
    () =>
      filteredItems.filter((item) => {
        const date = toLocalDate(item.date)
        return date ? sameDay(startOfMonth(date), currentMonth) : false
      }),
    [currentMonth, filteredItems],
  )

  const monthCells = useMemo(() => getMonthCells(currentMonth), [currentMonth])
  const today = new Date()
  const itemsByDate = useMemo(() => {
    return monthItems.reduce<Record<string, CalendarShiftItem[]>>((groups, item) => {
      const key = item.date ?? '未設定'
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(item)
      return groups
    }, {})
  }, [monthItems])
  const selectedDayItems = itemsByDate[selectedDateKey] ?? []

  const toggleSelectedGroup = (groupId: string) => {
    const childEventIds = eventIdsByGroup.get(groupId) ?? []
    const hasSelectedChild = childEventIds.some((eventId) => selectedEventIds.includes(eventId))

    setSelectedGroupIds((current) =>
      hasSelectedChild || current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId],
    )
    setSelectedEventIds((current) =>
      hasSelectedChild
        ? current.filter((eventId) => !childEventIds.includes(eventId))
        : Array.from(new Set([...current, ...childEventIds])),
    )
  }

  const toggleSelectedEvent = (eventId: string) => {
    const group = eventsByGroup.find((entry) => entry.events.some((event) => event.id === eventId))

    setSelectedEventIds((current) => {
      const next = current.includes(eventId) ? current.filter((id) => id !== eventId) : [...current, eventId]

      if (group) {
        const groupEventIds = eventIdsByGroup.get(group.groupId) ?? []
        const hasSelectedChild = groupEventIds.some((id) => next.includes(id))
        setSelectedGroupIds((groups) =>
          hasSelectedChild ? Array.from(new Set([...groups, group.groupId])) : groups.filter((id) => id !== group.groupId),
        )
      }

      return next
    })
  }

  const toggleExpandedGroup = (groupId: string) => {
    setExpandedGroupIds((current) =>
      current.includes(groupId) ? current.filter((id) => id !== groupId) : [...current, groupId],
    )
  }

  if (calendarQuery.isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="カレンダー" description="読み込み中です。" />
        <Card>
          <p className="text-sm text-slate-500">シフトを読み込んでいます...</p>
        </Card>
      </div>
    )
  }

  if (calendarQuery.error instanceof Error) {
    return <EmptyState title="カレンダーを表示できません" description={calendarQuery.error.message} />
  }

  const upcomingItems = filteredItems.slice(0, 12)

  const renderGroupTree = (dense: boolean) => {
    const groupRowClass = dense
      ? 'rounded-2xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-700'
      : 'rounded-2xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-700 sm:text-sm'
    const eventRowClass = dense
      ? 'rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] text-slate-700'
      : 'rounded-2xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 sm:text-sm'

    return (
      <div className="space-y-3">
        {groupOptions.length ? (
          groupOptions.map((group) => {
            const groupEventIds = eventIdsByGroup.get(group.id) ?? []
            const selectedEventCount = groupEventIds.filter((eventId) => selectedEventIds.includes(eventId)).length
            const isExpanded = expandedGroupIds.includes(group.id)
            const isSelected = selectedGroupIds.includes(group.id)
            const isIndeterminate = selectedEventCount > 0 && selectedEventCount < groupEventIds.length

            return (
              <div key={group.id} className="space-y-1.5">
                <div className={`flex items-center gap-2 ${groupRowClass}`}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    aria-checked={isIndeterminate ? 'mixed' : isSelected}
                    onChange={() => toggleSelectedGroup(group.id)}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => toggleExpandedGroup(group.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <ChevronRight className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                    <FolderKanban className="h-4 w-4 shrink-0 text-slate-700" />
                    <span className="min-w-0 truncate font-medium text-slate-900">{group.name}</span>
                    <Badge variant="neutral" className="ml-auto px-2 py-0.5 text-[10px]">
                      {selectedEventCount}/{groupEventIds.length}
                    </Badge>
                  </button>
                </div>

                {isExpanded ? (
                  <div className="space-y-1.5 border-l border-slate-200 pl-4">
                    {eventsByGroup
                      .find((entry) => entry.groupId === group.id)
                      ?.events.map((event) => (
                        <label key={event.id} className={`${eventRowClass} flex items-start gap-2`}>
                          <input
                            type="checkbox"
                            checked={selectedEventIds.includes(event.id)}
                            onChange={() => toggleSelectedEvent(event.id)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-200"
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-900">{event.name}</span>
                          </span>
                        </label>
                      ))}
                  </div>
                ) : null}
              </div>
            )
          })
        ) : (
          <p className={dense ? 'text-[11px] text-slate-500' : 'text-sm text-slate-500'}>グループの予定がありません。</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="カレンダー"
        description="グループ内のシフトを月ごとに見られます。グループやイベントのチェックで表示を切り替えられます。"
      />

      <section className="hidden gap-3 sm:grid sm:grid-cols-2 xl:grid xl:grid-cols-3">
        <Card className="bg-slate-50">
          <p className="text-sm text-slate-500">表示中のシフト</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{filteredItems.length}件</p>
        </Card>
        <Card className="bg-slate-50">
              <p className="text-sm text-slate-500">今月のシフト</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{monthItems.length}件</p>
        </Card>
        <Card className="bg-slate-50">
          <p className="text-sm text-slate-500">表示中のグループ / イベント</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {selectedGroupIds.length}/{groupOptions.length} / {selectedEventIds.length}/{eventOptions.length}
          </p>
        </Card>
      </section>

      <details className="xl:hidden">
        <summary className="list-none">
          <Button variant="secondary" size="sm" className="w-full justify-center">
            絞り込みを表示
          </Button>
        </summary>
        <div className="mt-3">
          <Card className="space-y-3 p-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-700" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">表示する予定</h2>
                <p className="text-[11px] text-slate-500">グループの下にイベントが並びます。</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="inline-flex items-center gap-2 text-xs font-semibold text-slate-900">
                    <FolderKanban className="h-4 w-4 text-slate-700" />
                    グループ / イベント
                  </p>
                  <Badge variant="neutral" className="px-2 py-0.5 text-[10px]">
                    {selectedEventIds.length}
                  </Badge>
                </div>
                {renderGroupTree(true)}
              </div>
            </div>
          </Card>
        </div>
      </details>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="hidden space-y-4 p-3 sm:p-4 xl:sticky xl:top-24 xl:self-start xl:block">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-violet-600" />
            <div>
              <h2 className="text-base font-semibold text-slate-900">表示する予定</h2>
              <p className="text-xs text-slate-500">グループを開くと、その下にイベントが並びます。</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <FolderKanban className="h-4 w-4 text-slate-700" />
                  グループ / イベント
                </p>
                <Badge variant="neutral">{selectedEventIds.length}</Badge>
              </div>
              {renderGroupTree(false)}
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 sm:text-lg">{formatMonthLabel(currentMonth)}</h2>
                <p className="text-xs text-slate-500 sm:text-sm">月ごとに確認できます。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => setCurrentMonth(startOfMonth(new Date()))}>
                  今月
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<ChevronLeft className="h-4 w-4" />}
                  onClick={() => setCurrentMonth((value) => addMonths(value, -1))}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<ChevronRight className="h-4 w-4" />}
                  onClick={() => setCurrentMonth((value) => addMonths(value, 1))}
                />
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-semibold text-slate-400 sm:gap-2 sm:text-xs">
              {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
                <div key={day} className="py-0.5">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {monthCells.map((cell, index) => {
                  if (!cell) {
                    return <div key={`empty-${index}`} className="aspect-square rounded-xl bg-slate-50/60" />
                  }

                  const dateKey = formatDateKey(cell)
                  const dayItems = itemsByDate[dateKey] ?? []
                  const selected = dateKey === selectedDateKey

                  return (
                    <button
                      type="button"
                      key={dateKey}
                      onClick={() => setSelectedDateKey(dateKey)}
                      className={[
                        'aspect-square rounded-xl border p-1 text-left transition sm:rounded-2xl sm:p-2',
                        selected ? 'border-slate-950 bg-slate-950 text-white shadow-sm' : sameDay(cell, today) ? 'border-slate-300 bg-slate-100 text-slate-950' : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      <div className="flex h-full flex-col justify-between">
                        <span className={['text-[10px] font-semibold sm:text-sm', selected ? 'text-white' : 'text-slate-900'].join(' ')}>
                          {cell.getDate()}
                        </span>
                        {dayItems.length ? (
                          <div className="flex flex-wrap gap-0.5">
                            {dayItems.slice(0, 4).map((item) => (
                              <span
                                key={item.id}
                                className={['h-1.5 w-1.5 rounded-full', selected ? 'bg-white' : item.shiftStatus === 'published' ? 'bg-emerald-500' : 'bg-slate-400'].join(' ')}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </button>
                  )
                })}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">{selectedDateKey}</h3>
                  <p className="text-xs text-slate-500">{selectedDayItems.length ? `${selectedDayItems.length}件` : '予定なし'}</p>
                </div>
              </div>
              {selectedDayItems.length ? (
                <div className="divide-y divide-slate-100">
                  {selectedDayItems.map((item) => (
                    <Link key={item.id} to={`/shifts/${item.shiftId}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50">
                      <div className="w-14 shrink-0 text-xs font-semibold text-slate-500">
                        {formatClock(item.startTime)}
                      </div>
                      <div className="h-10 w-1 shrink-0 rounded-full bg-slate-900" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-950">{item.taskName ?? item.eventName ?? '予定'}</p>
                        <p className="truncate text-xs text-slate-500">{item.eventName ?? 'イベント未設定'}</p>
                      </div>
                      <UserAvatar src={item.userAvatarUrl} name={item.userName} className="h-8 w-8 rounded-full bg-slate-100 text-slate-500" />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-6 text-sm text-slate-500">この日のシフトはありません。</p>
              )}
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 sm:text-lg">今月の予定一覧</h2>
                <p className="text-xs text-slate-500 sm:text-sm">一覧でも確認できます。</p>
              </div>
              <Badge variant="neutral">{monthItems.length}件</Badge>
            </div>

            {monthItems.length ? (
              <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {monthItems.map((item) => (
                  <Link key={item.id} to={`/shifts/${item.shiftId}`} className="block p-4 transition hover:bg-slate-50">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="brand">{item.date}</Badge>
                          <Badge variant="neutral">
                            {item.startTime?.slice(0, 5)} - {item.endTime?.slice(0, 5)}
                          </Badge>
                          <Badge variant={item.shiftStatus === 'published' ? 'success' : item.shiftStatus === 'generated' ? 'brand' : 'warning'}>
                            {getStatusLabel(item.shiftStatus)}
                          </Badge>
                        </div>
                        <p className="mt-2 truncate font-semibold text-slate-900">{item.eventName}</p>
                        <p className="mt-1 truncate text-sm text-slate-500">{item.taskName}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        {item.groupName ? <Badge variant="neutral">{item.groupName}</Badge> : null}
                        {item.teamName ? <Badge variant="info">{item.teamName}</Badge> : null}
                        {item.location ? (
                          <span className="inline-flex items-center gap-1 text-sm text-slate-500">
                            <MapPin className="h-4 w-4" />
                            {item.location}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                title="今月の予定はありません"
                description="チェックを変えると表示が増える場合があります。"
              />
            )}
          </Card>

          {upcomingItems.length ? (
            <Card className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">次に来る予定</h2>
                <p className="text-sm text-slate-500">直近の予定を先に見られます。</p>
              </div>
              <div className="space-y-2">
                {upcomingItems.map((item) => (
                  <Link
                    key={item.id}
                    to={`/shifts/${item.shiftId}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 transition hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{item.eventName}</p>
                      <p className="mt-1 truncate text-sm text-slate-500">
                        {item.date} {formatClock(item.startTime)} - {formatClock(item.endTime)} / {item.taskName}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-400">
                        {item.userName ?? 'メンバー'}
                        {item.isLeader ? '・リーダー' : ''}
                      </p>
                    </div>
                    <Badge variant="neutral">{item.groupName ?? 'グループなし'}</Badge>
                  </Link>
                ))}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}
