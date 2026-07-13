import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CalendarCheck2, Clock3, Plus, RotateCcw, Save, Trash2, Users } from 'lucide-react'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'
import { UserAvatar } from '@/components/ui/UserAvatar'
import type { ActivityRules } from '@/types/api'

type AvailabilityDraft = {
  date: string
  startTime: string
  endTime: string
  status: 'available' | 'preferred'
  comment: string
}

const statusOptions = [
  { value: 'available', label: '参加できる', variant: 'success' as const },
  { value: 'preferred', label: 'できれば参加', variant: 'warning' as const },
] as const

const submissionStatusLabel = {
  available: '参加できる',
  preferred: 'できれば参加',
  unavailable: '参加できない',
} as const

function formatTime(value: string) {
  return value.slice(0, 5)
}

function addMinutes(time: string, minutes: number): string {
  const [hourPart, minutePart] = time.split(':')
  const date = new Date(2000, 0, 1, Number(hourPart), Number(minutePart))
  date.setMinutes(date.getMinutes() + minutes)
  return `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function shiftMonthKey(value: string, offset: number): string {
  const [yearPart, monthPart] = value.split('-')
  const year = Number(yearPart)
  const month = Number(monthPart)
  const next = new Date(year, month - 1 + offset, 1)
  return `${next.getFullYear()}-${`${next.getMonth() + 1}`.padStart(2, '0')}`
}

const weekdayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

function parseLocalDate(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

function getActivityWindow(date: string, rules?: ActivityRules | null): { startTime: string; endTime: string; note?: string | null } | null {
  const normalizedRules = rules ?? { weekly: {}, excludedDates: [], specialDates: [] }

  if (normalizedRules.excludedDates?.includes(date)) {
    return null
  }

  const specialDate = normalizedRules.specialDates?.find((item) => item.date === date)
  if (specialDate?.startTime && specialDate.endTime && specialDate.startTime < specialDate.endTime) {
    return {
      startTime: specialDate.startTime,
      endTime: specialDate.endTime,
      note: specialDate.note,
    }
  }

  const weekday = weekdayKeys[parseLocalDate(date).getDay()]
  const weekly = normalizedRules.weekly?.[weekday]
  if (!weekly) {
    return {
      startTime: '09:00',
      endTime: '12:00',
    }
  }

  if (weekly.enabled === false || !weekly.startTime || !weekly.endTime || weekly.startTime >= weekly.endTime) {
    return null
  }

  return {
    startTime: weekly.startTime,
    endTime: weekly.endTime,
  }
}

function getMonthCells(monthKey: string): string[] {
  if (!monthKey) {
    return []
  }

  const [yearPart, monthPart] = monthKey.split('-')
  const year = Number(yearPart)
  const monthIndex = Number(monthPart) - 1
  const firstDay = new Date(year, monthIndex, 1)
  const lastDay = new Date(year, monthIndex + 1, 0)
  const cells: string[] = []

  for (let index = 0; index < firstDay.getDay(); index += 1) {
    cells.push('')
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    cells.push(formatLocalDate(new Date(year, monthIndex, day)))
  }

  return cells
}

export function CommonAvailabilitySetPage() {
  const { setId } = useParams<{ setId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'input' | 'submissions'>(() =>
    searchParams.get('tab') === 'submissions' ? 'submissions' : 'input',
  )
  const [drafts, setDrafts] = useState<Record<string, AvailabilityDraft>>({})
  const [modalDate, setModalDate] = useState<string | null>(null)
  const [modalDrafts, setModalDrafts] = useState<AvailabilityDraft[]>([])
  const [monthCursor, setMonthCursor] = useState<string>('')
  const [hasLocalChanges, setHasLocalChanges] = useState(false)

  useEffect(() => {
    setModalDate(null)
    setModalDrafts([])
  }, [setId])

  const setQuery = useQuery({
    queryKey: ['common-availability-set', setId],
    queryFn: () => api.commonAvailabilitySets.show(setId ?? ''),
    enabled: Boolean(setId),
  })

  const meQuery = useQuery({
    queryKey: ['common-availability-set', setId, 'me'],
    queryFn: () => api.commonAvailabilitySets.me(setId ?? ''),
    enabled: Boolean(setId),
  })

  const groupQuery = useQuery({
    queryKey: ['group', setQuery.data?.groupId],
    queryFn: () => api.groups.show(setQuery.data?.groupId ?? ''),
    enabled: Boolean(setQuery.data?.groupId),
  })
  const canViewSubmissions = groupQuery.data?.myRole === 'owner'
  const submissionsQuery = useQuery({
    queryKey: ['common-availability-set', setId, 'submissions'],
    queryFn: () => api.commonAvailabilitySets.submissions(setId ?? ''),
    enabled: Boolean(setId) && canViewSubmissions && activeTab === 'submissions',
  })

  useEffect(() => {
    if (!groupQuery.isLoading && !canViewSubmissions && activeTab === 'submissions') {
      setActiveTab('input')
    }
  }, [activeTab, canViewSubmissions, groupQuery.isLoading])

  useEffect(() => {
    const nextDrafts: Record<string, AvailabilityDraft> = {}
    for (const slot of meQuery.data?.slots ?? []) {
      if (slot.availabilityStatus !== 'available' && slot.availabilityStatus !== 'preferred') {
        continue
      }

      nextDrafts[`${slot.date}|${slot.startTime}|${slot.endTime}`] = {
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status: slot.availabilityStatus,
        comment: slot.availabilityComment ?? '',
      }
    }
    setDrafts(nextDrafts)
    setHasLocalChanges(false)
  }, [meQuery.data?.slots])

  const saveMutation = useMutation({
    mutationFn: () =>
      api.commonAvailabilitySets.updateMe(setId ?? '', {
        availabilities: Object.values(drafts),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['common-availability-set', setId, 'me'] })
      await queryClient.invalidateQueries({ queryKey: ['common-availability-set', setId, 'submissions'] })
      await queryClient.invalidateQueries({ queryKey: ['common-availability-set', setId] })
      await queryClient.invalidateQueries({ queryKey: ['group', setQuery.data?.groupId, 'common-availability-sets'] })
      await queryClient.invalidateQueries({ queryKey: ['group', setQuery.data?.groupId, 'members'] })
      await queryClient.invalidateQueries({ queryKey: ['group', setQuery.data?.groupId, 'events'] })
      setHasLocalChanges(false)
    },
  })

  const setData = setQuery.data
  useEffect(() => {
    if (setData?.startDate) {
      setMonthCursor(setData.startDate.slice(0, 7))
    }
  }, [setData?.startDate])

  const periodDates = useMemo(() => {
    if (!setData?.startDate || !setData?.endDate) {
      return []
    }

    const start = parseLocalDate(setData.startDate)
    const end = parseLocalDate(setData.endDate)
    const dates: string[] = []

    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      dates.push(formatLocalDate(cursor))
    }

    return dates
  }, [setData?.endDate, setData?.startDate])
  const activeMonthCursor = monthCursor || periodDates[0]?.slice(0, 7) || ''
  const periodDateSet = useMemo(() => new Set(periodDates), [periodDates])
  const activeMonthCells = useMemo(() => getMonthCells(activeMonthCursor), [activeMonthCursor])
  const savedDrafts = useMemo(
    () =>
      Object.values(drafts).sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`)),
    [drafts],
  )
  const submissions = submissionsQuery.data
  const submissionCalendarByDate = useMemo(() => {
    const rows: Record<
      string,
      Array<{
        id: string
        memberName: string | null
        avatarUrl: string | null
        startTime: string | null
        endTime: string | null
        status: 'available' | 'preferred' | 'unavailable' | null
      }>
    > = {}

    for (const member of submissions?.members ?? []) {
      for (const detail of member.details) {
        if (!detail.date || !detail.startTime || !detail.endTime) {
          continue
        }

        rows[detail.date] ??= []
        rows[detail.date].push({
          id: `${member.userId}-${detail.id}`,
          memberName: member.displayName,
          avatarUrl: member.avatarUrl,
          startTime: detail.startTime,
          endTime: detail.endTime,
          status: detail.status,
        })
      }
    }

    for (const items of Object.values(rows)) {
      items.sort((a, b) => `${a.startTime} ${a.memberName ?? ''}`.localeCompare(`${b.startTime} ${b.memberName ?? ''}`))
    }

    return rows
  }, [submissions?.members])
  const filledDateCount = useMemo(() => new Set(savedDrafts.map((draft) => draft.date)).size, [savedDrafts])
  if (!setId) {
    return <EmptyState title="参加確認が見つかりません" description="URLを確認してください。" />
  }

  if (setQuery.isLoading || meQuery.isLoading) {
    return <p className="p-6 text-sm text-slate-500">読み込み中...</p>
  }

  const openDateModal = (date: string) => {
    const activityWindow = getActivityWindow(date, setData?.activityRules)
    if (!activityWindow) {
      return
    }

    const existingDrafts = Object.values(drafts)
      .filter((draft) => draft.date === date)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))

    setModalDate(date)
    setModalDrafts(
      existingDrafts.length
        ? existingDrafts.map((draft) => ({
            date,
            startTime: draft.startTime,
            endTime: draft.endTime,
            status: draft.status === 'preferred' ? 'preferred' : 'available',
            comment: draft.comment,
          }))
        : [],
    )
  }

  const closeDateModal = () => {
    setModalDate(null)
    setModalDrafts([])
  }

  const saveDateModal = () => {
    if (!modalDate) return
    const activityWindow = getActivityWindow(modalDate, setData?.activityRules)
    if (!activityWindow) return

    setDrafts((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([, value]) => value.date !== modalDate))

      for (const draft of modalDrafts) {
        if (!draft.startTime || !draft.endTime || draft.startTime >= draft.endTime) {
          continue
        }
        if (draft.startTime < activityWindow.startTime || draft.endTime > activityWindow.endTime) {
          continue
        }
        const key = `${modalDate}|${draft.startTime}|${draft.endTime}`
        next[key] = {
          date: modalDate,
          startTime: draft.startTime,
          endTime: draft.endTime,
          status: draft.status === 'preferred' ? 'preferred' : 'available',
          comment: draft.comment,
        }
      }

      return next
    })

    setHasLocalChanges(true)
    closeDateModal()
  }

  const updateModalDraft = (index: number, patch: Partial<AvailabilityDraft>) => {
    setModalDrafts((current) => current.map((draft, draftIndex) => (draftIndex === index ? { ...draft, ...patch } : draft)))
  }

  const addModalDraft = () => {
    if (!modalDate) return
    const activityWindow = getActivityWindow(modalDate, setData?.activityRules)
    if (!activityWindow) return
    const lastDraft = [...modalDrafts].sort((a, b) => a.endTime.localeCompare(b.endTime)).at(-1)
    const startTime = lastDraft?.endTime && lastDraft.endTime < activityWindow.endTime ? lastDraft.endTime : activityWindow.startTime
    const endTime = addMinutes(startTime, 60) <= activityWindow.endTime ? addMinutes(startTime, 60) : activityWindow.endTime

    setModalDrafts((current) => [
      ...current,
      {
        date: modalDate,
        startTime,
        endTime,
        status: 'available',
        comment: '',
      },
    ])
  }

  const removeModalDraft = (index: number) => {
    setModalDrafts((current) => current.filter((_, draftIndex) => draftIndex !== index))
  }

  const clearModalDate = () => {
    if (!modalDate) return

    setDrafts((current) => Object.fromEntries(Object.entries(current).filter(([, value]) => value.date !== modalDate)))
    setHasLocalChanges(true)
    closeDateModal()
  }

  const removeSavedDraft = (draft: AvailabilityDraft) => {
    setDrafts((current) => {
      const next = { ...current }
      delete next[`${draft.date}|${draft.startTime}|${draft.endTime}`]
      return next
    })
    setHasLocalChanges(true)
  }

  const clearAllDrafts = () => {
    if (!savedDrafts.length) return
    if (!window.confirm('入力済みの参加確認をすべて取り消しますか？')) return

    setDrafts({})
    setHasLocalChanges(true)
  }

  const modalActivityWindow = modalDate ? getActivityWindow(modalDate, setData?.activityRules) : null
  const modalDraftKeys = modalDrafts.map((draft) => `${draft.startTime}|${draft.endTime}`)
  const hasDuplicateModalDraft = modalDraftKeys.length !== new Set(modalDraftKeys).size
  const modalValidationError = (() => {
    if (!modalActivityWindow) {
      return null
    }

    for (const draft of modalDrafts) {
      if (!draft.startTime || !draft.endTime) {
        return '開始と終了を入力してください。'
      }
      if (draft.startTime >= draft.endTime) {
        return '終了は開始より後にしてください。'
      }
      if (draft.startTime < modalActivityWindow.startTime || draft.endTime > modalActivityWindow.endTime) {
        return `入力できるのは ${modalActivityWindow.startTime} - ${modalActivityWindow.endTime} の間です。`
      }
    }

    if (hasDuplicateModalDraft) {
      return '同じ時間帯が重複しています。'
    }

    return null
  })()
  const canAddModalDraft = Boolean(
    modalActivityWindow && (!modalDrafts.length || modalDrafts.some((draft) => draft.endTime < modalActivityWindow.endTime)),
  )

  return (
    <div className="space-y-4 pb-44 md:pb-32">
      <PageHeader
        title={setData?.name ?? '参加確認'}
        description={setData?.description ?? '日付を選んで、行ける時間だけ入力します。'}
        action={
          <Button variant="secondary" onClick={() => navigate(-1)}>
            戻る
          </Button>
        }
      />

      <div className="rounded-[1.35rem] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-slate-50 px-3 py-3">
            <p className="text-[11px] font-medium text-slate-500">日数</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-950">{periodDates.length}日</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-3">
            <p className="text-[11px] font-medium text-slate-500">入力日</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-950">{filledDateCount}日</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-3">
            <p className="text-[11px] font-medium text-slate-500">時間</p>
            <p className="mt-1 truncate text-sm font-semibold text-slate-950">{savedDrafts.length}件</p>
          </div>
        </div>
      </div>

      {canViewSubmissions ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('input')}
            className={[
              'rounded-xl px-4 py-3 text-sm font-medium transition',
              activeTab === 'input' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50',
            ].join(' ')}
          >
            入力
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('submissions')}
            className={[
              'rounded-xl px-4 py-3 text-sm font-medium transition',
              activeTab === 'submissions' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50',
            ].join(' ')}
          >
            提出状況
          </button>
          </div>
        </div>
      ) : null}

      {activeTab === 'input' ? (
        <div className="space-y-4">
          <Card className="space-y-4 border-slate-200 bg-white">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">行ける日</h2>
                <p className="text-sm text-slate-500">入力がない日は参加できない扱いです。</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                {hasLocalChanges ? <Badge variant="warning">未保存</Badge> : <Badge variant="neutral">保存済み</Badge>}
                {savedDrafts.length ? (
                  <Button type="button" size="sm" variant="ghost" leftIcon={<RotateCcw className="h-4 w-4" />} onClick={clearAllDrafts}>
                    すべて取り消す
                  </Button>
                ) : null}
              </div>
            </div>

            {periodDates.length ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setMonthCursor(shiftMonthKey(activeMonthCursor, -1))
                      }}
                      disabled={!activeMonthCursor || activeMonthCursor <= periodDates[0].slice(0, 7)}
                    >
                      前
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setMonthCursor(shiftMonthKey(activeMonthCursor, 1))
                      }}
                      disabled={!activeMonthCursor || activeMonthCursor >= periodDates[periodDates.length - 1].slice(0, 7)}
                    >
                      次
                    </Button>
                  </div>
                  <p className="text-sm font-medium text-slate-600">
                    {activeMonthCursor
                      ? new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long' }).format(new Date(`${activeMonthCursor}-01T00:00:00`))
                      : ''}
                  </p>
                </div>

                <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-slate-500 sm:gap-2">
                  {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
                    <div key={day} className="py-1">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1.5 rounded-3xl bg-slate-50 p-2 sm:gap-2">
                  {activeMonthCells.map((date, index) => {
                      if (!date) {
                        return <div key={`blank-${index}`} className="aspect-square rounded-xl sm:rounded-2xl" />
                      }

                      const activityWindow = getActivityWindow(date, setData?.activityRules)
                      const isInPeriod = periodDateSet.has(date)
                      const isActive = isInPeriod && Boolean(activityWindow)
                      const weekdayLabel = new Intl.DateTimeFormat('ja-JP', { weekday: 'short' }).format(parseLocalDate(date))
                      const dayEntries = Object.values(drafts).filter((draft) => draft.date === date)
                      const hasEntries = dayEntries.length > 0
                      return (
                        <button
                          key={date}
                          type="button"
                          onClick={() => openDateModal(date)}
                          disabled={!isActive}
                          className={[
                            'flex aspect-square flex-col justify-between rounded-xl border p-1.5 text-left transition sm:rounded-2xl sm:p-2',
                            hasEntries
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-950 shadow-sm'
                              : isActive
                                ? 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                                : isInPeriod
                                  ? 'border-slate-100 bg-slate-100/70 text-slate-300'
                                  : 'border-transparent bg-transparent text-slate-200',
                          ].join(' ')}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">{date.slice(8, 10)}</span>
                            <span className={['hidden text-[11px] sm:inline', hasEntries ? 'text-emerald-700' : 'text-slate-400'].join(' ')}>{weekdayLabel}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={['hidden text-[11px] sm:inline', hasEntries ? 'text-emerald-700' : 'text-slate-400'].join(' ')}>
                              {hasEntries ? '入力済み' : isActive ? '未入力' : isInPeriod ? '休み' : ''}
                            </span>
                            <span className={['rounded-full px-2 py-0.5 text-[10px] font-semibold', hasEntries ? 'bg-emerald-600 text-white' : isActive ? 'bg-slate-100 text-slate-500' : 'bg-transparent text-slate-300'].join(' ')}>
                              {hasEntries ? `${dayEntries.length}` : isActive ? '＋' : ''}
                            </span>
                          </div>
                        </button>
                      )
                  })}
                </div>
              </div>
            ) : (
              <EmptyState title="参加確認がまだありません" description="先に確認する日程を作成してください。" />
            )}
          </Card>

          <Card className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">入力済み</h2>
              </div>
              {canViewSubmissions ? (
                <Button type="button" variant="secondary" onClick={() => setActiveTab('submissions')}>
                提出状況を見る
                </Button>
              ) : null}
            </div>
            {savedDrafts.length ? (
              <div className="space-y-2">
                {savedDrafts.map((draft) => (
                  <div
                    key={`${draft.date}|${draft.startTime}|${draft.endTime}`}
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 transition hover:bg-white"
                  >
                    <button type="button" onClick={() => openDateModal(draft.date)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-700 ring-1 ring-slate-200">
                        <Clock3 className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-slate-900">
                          {draft.date} {formatTime(draft.startTime)} - {formatTime(draft.endTime)}
                        </span>
                        <span className="block truncate text-sm text-slate-500">{draft.comment || (draft.status === 'preferred' ? 'できれば参加' : '参加できる')}</span>
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge variant={draft.status === 'preferred' ? 'warning' : 'success'}>
                        {draft.status === 'preferred' ? 'できれば' : '参加'}
                      </Badge>
                      <Button type="button" size="sm" variant="ghost" aria-label="取り消す" onClick={() => removeSavedDraft(draft)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="まだ入力はありません" description="日付を押して時間を入れます。" />
            )}
          </Card>
        </div>
      ) : null}

      {canViewSubmissions && activeTab === 'submissions' ? (
        <div className="space-y-4">
          <Card className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-center gap-2">
                <CalendarCheck2 className="h-5 w-5 text-slate-700" />
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">みんなの活動日</h2>
                  <p className="text-sm text-slate-500">日付ごとに、参加できる人を確認できます。</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setMonthCursor(shiftMonthKey(activeMonthCursor, -1))}
                  disabled={!activeMonthCursor || activeMonthCursor <= periodDates[0]?.slice(0, 7)}
                >
                  前
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setMonthCursor(shiftMonthKey(activeMonthCursor, 1))}
                  disabled={!activeMonthCursor || activeMonthCursor >= periodDates[periodDates.length - 1]?.slice(0, 7)}
                >
                  次
                </Button>
              </div>
            </div>

            <p className="text-sm font-medium text-slate-600">
              {activeMonthCursor
                ? new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long' }).format(new Date(`${activeMonthCursor}-01T00:00:00`))
                : ''}
            </p>

            <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-slate-500 sm:gap-2">
              {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
                <div key={day} className="py-1">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5 rounded-3xl bg-slate-50 p-2 sm:gap-2">
              {activeMonthCells.map((date, index) => {
                if (!date) {
                  return <div key={`submission-blank-${index}`} className="min-h-24 rounded-xl sm:rounded-2xl" />
                }

                const activityWindow = getActivityWindow(date, setData?.activityRules)
                const isInPeriod = periodDateSet.has(date)
                const isActive = isInPeriod && Boolean(activityWindow)
                const entries = submissionCalendarByDate[date] ?? []
                const visibleEntries = entries.slice(0, 3)

                return (
                  <div
                    key={`submission-${date}`}
                    className={[
                      'min-h-24 rounded-xl border p-1.5 text-left sm:rounded-2xl sm:p-2',
                      entries.length
                        ? 'border-emerald-200 bg-white shadow-sm'
                        : isActive
                          ? 'border-slate-200 bg-white'
                          : isInPeriod
                            ? 'border-slate-100 bg-slate-100/70 text-slate-300'
                            : 'border-transparent bg-transparent text-slate-200',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{date.slice(8, 10)}</span>
                      {entries.length ? <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">{entries.length}</span> : null}
                    </div>
                    <div className="mt-2 space-y-1">
                      {visibleEntries.map((entry) => (
                        <div key={entry.id} className="min-w-0 rounded-lg bg-emerald-50 px-1.5 py-1 text-[10px] leading-tight text-emerald-900">
                          <p className="truncate font-semibold">{entry.memberName ?? '名前未設定'}</p>
                          <p className="truncate">
                            {formatTime(entry.startTime ?? '')}-{formatTime(entry.endTime ?? '')}
                          </p>
                        </div>
                      ))}
                      {entries.length > visibleEntries.length ? (
                        <p className="px-1 text-[10px] text-slate-500">+{entries.length - visibleEntries.length}件</p>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
          <Card className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-slate-700" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">提出状況</h2>
                <p className="text-sm text-slate-500">オーナー向けの確認画面です。</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Badge variant="brand">提出率 {submissions?.summary.submissionRate ?? 0}%</Badge>
              <Badge variant="warning">不足 {submissions?.summary.insufficientSlots ?? 0}件</Badge>
            </div>
            {submissions?.members?.length ? (
              <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {submissions.members.map((member) => (
                  <div key={member.id} className="space-y-3 px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar src={member.avatarUrl} name={member.displayName} className="h-10 w-10 rounded-2xl bg-slate-100 text-slate-500" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{member.displayName ?? '名前未設定'}</p>
                          <p className="text-sm text-slate-500">
                            {member.hasSubmitted ? `${member.availableSlots}件入力` : 'まだ入力なし'}
                          </p>
                        </div>
                      </div>
                      <Badge variant={member.hasSubmitted ? 'success' : 'warning'}>{member.hasSubmitted ? '提出済み' : '未提出'}</Badge>
                    </div>

                    {member.details.length ? (
                      <div className="flex flex-wrap gap-2 pl-0 sm:pl-[52px]">
                        {member.details.map((detail) => {
                          const status = detail.status ?? 'available'

                          return (
                            <div
                              key={detail.id}
                              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-slate-900">{detail.date ?? '日付未設定'}</span>
                                <span>
                                  {formatTime(detail.startTime ?? '')} - {formatTime(detail.endTime ?? '')}
                                </span>
                                <Badge variant={status === 'preferred' ? 'warning' : status === 'available' ? 'success' : 'neutral'}>
                                  {submissionStatusLabel[status] ?? '入力あり'}
                                </Badge>
                              </div>
                              {detail.comment ? <p className="mt-1 text-xs text-slate-500">{detail.comment}</p> : null}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-500">入力された時間はまだありません。</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="提出状況がありません" description="メンバーが入力するとここに表示されます。" />
            )}
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center gap-2">
              <CalendarCheck2 className="h-5 w-5 text-slate-700" />
              <div>
                <h2 className="text-lg font-semibold text-slate-900">時間帯ごとの集計</h2>
                <p className="text-sm text-slate-500">参加可能人数を確認できます。</p>
              </div>
            </div>
            <div className="space-y-3">
              {submissions?.slots?.length ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <table className="w-full border-collapse">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                        <th className="px-4 py-3">日付 / 時間</th>
                        <th className="px-4 py-3">場所</th>
                        <th className="px-4 py-3">参加</th>
                        <th className="px-4 py-3">状態</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {submissions.slots.map((slot) => (
                        <tr key={`${slot.date}-${slot.startTime}-${slot.endTime}`} className={slot.insufficientPeople > 0 ? 'bg-amber-50' : 'bg-white'}>
                          <td className="px-4 py-4 align-top">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="brand">{slot.date}</Badge>
                                <Badge variant="neutral">
                                  {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-500">{slot.note || 'メモなし'}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top text-sm font-medium text-slate-900">{slot.location || '場所未設定'}</td>
                          <td className="px-4 py-4 align-top">
                            <Badge variant={slot.insufficientPeople > 0 ? 'warning' : 'success'}>
                              {slot.availablePeople}/{slot.requiredPeople}人
                            </Badge>
                          </td>
                          <td className="px-4 py-4 align-top">
                            <Badge variant={slot.insufficientPeople > 0 ? 'warning' : 'success'}>
                              {slot.insufficientPeople > 0 ? `不足 ${slot.insufficientPeople}人` : '充足'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="時間帯がありません" description="参加確認に応じた集計を表示します。" />
              )}
            </div>
          </Card>
          </div>
        </div>
      ) : null}

      <Modal
        title={modalDate ? `${modalDate} の入力` : '時間を入力'}
        open={Boolean(modalDate)}
        onClose={closeDateModal}
      >
        <div className="space-y-4">
          {modalDate && modalActivityWindow ? (
            <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              入力できる時間: {modalActivityWindow.startTime} - {modalActivityWindow.endTime}
            </p>
          ) : null}
          <div className="space-y-3">
            {modalDrafts.map((draft, index) => (
              <div key={`${index}-${draft.startTime}-${draft.endTime}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">時間 {index + 1}</p>
                  <Button type="button" size="sm" variant="ghost" leftIcon={<Trash2 className="h-4 w-4" />} onClick={() => removeModalDraft(index)}>
                    取り消す
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-700">開始</span>
                    <Input
                      type="time"
                      step={300}
                      min={modalActivityWindow?.startTime}
                      max={modalActivityWindow?.endTime}
                      value={draft.startTime}
                      onChange={(event) => updateModalDraft(index, { startTime: event.target.value })}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-700">終了</span>
                    <Input
                      type="time"
                      step={300}
                      min={modalActivityWindow?.startTime}
                      max={modalActivityWindow?.endTime}
                      value={draft.endTime}
                      onChange={(event) => updateModalDraft(index, { endTime: event.target.value })}
                    />
                  </label>
                </div>
                <p className="mt-2 text-xs text-slate-500">5分単位で入力できます。範囲外の時間は保存できません。</p>

                <div className="mt-3 space-y-2">
                  <span className="text-sm font-medium text-slate-700">参加しやすさ</span>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {statusOptions.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        size="sm"
                        variant={draft.status === option.value ? 'primary' : 'secondary'}
                        onClick={() => updateModalDraft(index, { status: option.value })}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <label className="mt-3 block space-y-2">
                  <span className="text-sm font-medium text-slate-700">コメント</span>
                  <Textarea
                    value={draft.comment}
                    onChange={(event) => updateModalDraft(index, { comment: event.target.value })}
                    placeholder="補足があれば入力"
                  />
                </label>

              </div>
            ))}
          </div>

          {modalDrafts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center">
              <p className="text-sm font-semibold text-slate-900">この日は未入力です</p>
              <p className="mt-1 text-sm text-slate-500">時間を追加するか、このまま保存して未入力に戻せます。</p>
            </div>
          ) : null}
          {modalValidationError ? (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{modalValidationError}</p>
          ) : null}

          <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <Button type="button" variant="secondary" className="w-full sm:w-auto" leftIcon={<Plus className="h-4 w-4" />} onClick={addModalDraft} disabled={!canAddModalDraft}>
                時間を追加
              </Button>
              <Button type="button" variant="ghost" className="w-full sm:w-auto" leftIcon={<Trash2 className="h-4 w-4" />} onClick={clearModalDate}>
                この日を取り消す
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={closeDateModal}>
                キャンセル
              </Button>
              <Button type="button" className="w-full sm:w-auto" onClick={saveDateModal} disabled={Boolean(modalValidationError)}>
                保存
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur md:bottom-0 md:left-72 md:px-4 md:py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <p className="hidden text-sm text-slate-500 sm:block">
            {saveMutation.isPending ? '保存中...' : hasLocalChanges ? '変更があります' : '最新です'}
          </p>
          {saveMutation.error instanceof Error ? (
            <p className="hidden rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 md:block">{saveMutation.error.message}</p>
          ) : null}
          <Button className="w-full sm:w-auto" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !hasLocalChanges} leftIcon={<Save className="h-4 w-4" />}>
            変更を保存
          </Button>
        </div>
      </div>
    </div>
  )
}
