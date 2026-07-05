import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarCheck2, Plus, Save, Users } from 'lucide-react'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { Modal } from '@/components/ui/Modal'
import { Textarea } from '@/components/ui/Textarea'

type AvailabilityDraft = {
  date: string
  startTime: string
  endTime: string
  status: 'available' | 'unavailable' | 'preferred'
  comment: string
}

const statusOptions = [
  { value: 'available', label: '参加できる', variant: 'success' as const },
  { value: 'preferred', label: 'できれば参加', variant: 'warning' as const },
]

function formatTime(value: string) {
  return value.slice(0, 5)
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

export function CommonAvailabilitySetPage() {
  const { setId } = useParams<{ setId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'input' | 'submissions'>('input')
  const [drafts, setDrafts] = useState<Record<string, AvailabilityDraft>>({})
  const [modalDate, setModalDate] = useState<string | null>(null)
  const [modalDrafts, setModalDrafts] = useState<AvailabilityDraft[]>([])
  const [monthCursor, setMonthCursor] = useState<string>('')

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

  const submissionsQuery = useQuery({
    queryKey: ['common-availability-set', setId, 'submissions'],
    queryFn: () => api.commonAvailabilitySets.submissions(setId ?? ''),
    enabled: Boolean(setId) && activeTab === 'submissions',
  })
  const relatedEventsQuery = useQuery({
    queryKey: ['group', setQuery.data?.groupId, 'events'],
    queryFn: () => api.groups.events(setQuery.data?.groupId ?? ''),
    enabled: Boolean(setQuery.data?.groupId),
  })

  useEffect(() => {
    const nextDrafts: Record<string, AvailabilityDraft> = {}
    for (const slot of meQuery.data?.slots ?? []) {
      const status = slot.availabilityStatus === 'available' || slot.availabilityStatus === 'preferred' ? slot.availabilityStatus : 'unavailable'
      nextDrafts[`${slot.date}|${slot.startTime}|${slot.endTime}`] = {
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        status,
        comment: slot.availabilityComment ?? '',
      }
    }
    setDrafts(nextDrafts)
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

    const start = new Date(`${setData.startDate}T00:00:00`)
    const end = new Date(`${setData.endDate}T00:00:00`)
    const dates: string[] = []

    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      dates.push(formatLocalDate(cursor))
    }

    return dates
  }, [setData?.endDate, setData?.startDate])
  const activeMonthCursor = monthCursor || periodDates[0]?.slice(0, 7) || ''
  const activeMonthDates = useMemo(
    () => periodDates.filter((date) => date.startsWith(activeMonthCursor)),
    [activeMonthCursor, periodDates],
  )
  const savedDrafts = useMemo(
    () =>
      Object.values(drafts).sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`)),
    [drafts],
  )
  const submissions = submissionsQuery.data
  const relatedEvents = useMemo(
    () => (Array.isArray(relatedEventsQuery.data) ? relatedEventsQuery.data.filter((event) => event.commonAvailabilitySetId === setId) : []),
    [relatedEventsQuery.data, setId],
  )
  if (!setId) {
    return <EmptyState title="参加可能日時セットが見つかりません" description="URLを確認してください。" />
  }

  if (setQuery.isLoading || meQuery.isLoading) {
    return <p className="p-6 text-sm text-slate-500">読み込み中...</p>
  }

  const openDateModal = (date: string) => {
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
            status: draft.status === 'available' || draft.status === 'preferred' ? draft.status : 'unavailable',
            comment: draft.comment,
          }))
        : [
            {
              date,
              startTime: '09:00',
              endTime: '12:00',
              status: 'available',
              comment: '',
            },
          ],
    )
  }

  const closeDateModal = () => {
    setModalDate(null)
    setModalDrafts([])
  }

  const saveDateModal = () => {
    if (!modalDate) return

    setDrafts((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([, value]) => value.date !== modalDate))

      for (const draft of modalDrafts) {
        if (!draft.startTime || !draft.endTime || draft.startTime >= draft.endTime) continue
        const key = `${modalDate}|${draft.startTime}|${draft.endTime}`
        next[key] = {
          date: modalDate,
          startTime: draft.startTime,
          endTime: draft.endTime,
          status: draft.status === 'available' || draft.status === 'preferred' ? draft.status : 'unavailable',
          comment: draft.comment,
        }
      }

      return next
    })

    closeDateModal()
  }

  const updateModalDraft = (index: number, patch: Partial<AvailabilityDraft>) => {
    setModalDrafts((current) => current.map((draft, draftIndex) => (draftIndex === index ? { ...draft, ...patch } : draft)))
  }

  const addModalDraft = () => {
    if (!modalDate) return
    setModalDrafts((current) => [
      ...current,
      {
        date: modalDate,
        startTime: '09:00',
        endTime: '12:00',
        status: 'available',
        comment: '',
      },
    ])
  }

  const removeModalDraft = (index: number) => {
    setModalDrafts((current) => current.filter((_, draftIndex) => draftIndex !== index))
  }

  return (
    <div className="space-y-4 pb-44 md:pb-32">
      <PageHeader
        title={setData?.name ?? '参加可能日時'}
        description={setData?.description ?? '行ける時間だけ入力します。'}
        action={
          <Button variant="secondary" onClick={() => navigate(-1)}>
            戻る
          </Button>
        }
      />

      <Card className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
          <Badge variant="neutral">
            {setData?.startDate ?? '未設定'} 〜 {setData?.endDate ?? '未設定'}
          </Badge>
          <Badge variant="brand">期限 {setData?.deadline ?? 'なし'}</Badge>
          <Badge variant="info">{setData?.availabilityCount ?? 0}件提出</Badge>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">関連イベント</h2>
          </div>
          <Badge variant="info">{relatedEvents.length}件</Badge>
        </div>
        {relatedEvents.length ? (
          <div className="space-y-2">
            {relatedEvents.map((event) => (
              <Link
                key={event.id}
                to={`/events/${event.id}`}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:bg-white"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{event.name}</p>
                  <p className="text-sm text-slate-500">{event.location || '場所未設定'}</p>
                </div>
                <Badge variant="neutral">{event.status}</Badge>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="関連イベントはありません" description="イベント側で使うと表示されます。" />
        )}
      </Card>

      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('input')}
            className={[
              'rounded-xl px-4 py-3 text-sm font-medium transition',
              activeTab === 'input' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50',
            ].join(' ')}
          >
            入力
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('submissions')}
            className={[
              'rounded-xl px-4 py-3 text-sm font-medium transition',
              activeTab === 'submissions' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50',
            ].join(' ')}
          >
            提出状況
          </button>
        </div>
      </div>

      {activeTab === 'input' ? (
        <div className="space-y-4">
          <Card className="space-y-4 border-slate-200 bg-slate-50/70">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">カレンダー</h2>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Badge variant="brand">{periodDates.length}日</Badge>
                <Badge variant="neutral">{Object.keys(drafts).length}件入力済み</Badge>
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

                <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                  {Array.from({ length: activeMonthCursor ? new Date(`${activeMonthCursor}-01T00:00:00`).getDay() : 0 }).map((_, index) => (
                    <div key={`blank-${index}`} className="h-12 rounded-xl sm:h-20 sm:rounded-2xl" />
                  ))}
                  {activeMonthDates.map((date) => {
                      const weekdayLabel = new Intl.DateTimeFormat('ja-JP', { weekday: 'short' }).format(new Date(`${date}T00:00:00`))
                      const dayEntries = Object.values(drafts).filter((draft) => draft.date === date)
                      const hasEntries = dayEntries.length > 0
                      return (
                        <button
                          key={date}
                          type="button"
                          onClick={() => openDateModal(date)}
                          className={[
                            'flex h-12 flex-col justify-between rounded-xl border p-1.5 text-left transition sm:h-20 sm:rounded-2xl sm:p-2',
                            hasEntries
                              ? 'border-violet-300 bg-violet-50 text-violet-700 shadow-sm'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                          ].join(' ')}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">{date.slice(8, 10)}</span>
                            <span className="hidden text-[11px] text-slate-400 sm:inline">{weekdayLabel}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="hidden text-[11px] text-slate-400 sm:inline">期間内</span>
                            <Badge variant={hasEntries ? 'brand' : 'neutral'} className="px-2 py-0.5 text-[10px]">
                              {hasEntries ? `${dayEntries.length}件` : '＋'}
                            </Badge>
                          </div>
                        </button>
                      )
                  })}
                </div>
              </div>
            ) : (
              <EmptyState title="期間がまだありません" description="先にイベント側で開始日と終了日を入れてください。" />
            )}
          </Card>

          <Card className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">入力済みの日時</h2>
              </div>
              <Button type="button" variant="secondary" onClick={() => setActiveTab('submissions')}>
                提出状況を見る
              </Button>
            </div>
            {savedDrafts.length ? (
              <div className="space-y-2">
                {savedDrafts.map((draft) => (
                  <button
                    key={`${draft.date}|${draft.startTime}|${draft.endTime}`}
                    type="button"
                    onClick={() => openDateModal(draft.date)}
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:bg-white"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">
                        {draft.date} {formatTime(draft.startTime)} - {formatTime(draft.endTime)}
                      </p>
                      <p className="text-sm text-slate-500">{draft.comment || 'コメントなし'}</p>
                    </div>
                    <Badge variant={draft.status === 'preferred' ? 'warning' : draft.status === 'unavailable' ? 'danger' : 'success'}>
                      {draft.status === 'preferred' ? 'できれば参加' : draft.status === 'unavailable' ? '参加できない' : '参加できる'}
                    </Badge>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState title="まだ入力はありません" description="日付を押して時間を入れます。" />
            )}
          </Card>
        </div>
      ) : null}

      {activeTab === 'submissions' ? (
        <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
          <Card className="space-y-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-violet-600" />
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
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <table className="w-full border-collapse">
                  <thead className="bg-slate-50">
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      <th className="px-4 py-3">メンバー</th>
                      <th className="px-4 py-3">提出</th>
                      <th className="px-4 py-3">参加可</th>
                      <th className="px-4 py-3">状態</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {submissions.members.map((member) => (
                      <tr key={member.id} className="bg-white">
                        <td className="px-4 py-4 align-top">
                          <p className="font-semibold text-slate-900">{member.displayName ?? member.email ?? '名前未設定'}</p>
                          <p className="text-sm text-slate-500">{member.email ?? 'メールアドレスなし'}</p>
                        </td>
                        <td className="px-4 py-4 align-top text-sm text-slate-600">{member.submittedSlots}件</td>
                        <td className="px-4 py-4 align-top text-sm text-slate-600">{member.availableSlots}件</td>
                        <td className="px-4 py-4 align-top">
                          <Badge variant={member.hasSubmitted ? 'success' : 'warning'}>{member.hasSubmitted ? '提出済み' : '未提出'}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="提出状況がありません" description="メンバーが入力するとここに表示されます。" />
            )}
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center gap-2">
              <CalendarCheck2 className="h-5 w-5 text-violet-600" />
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
                <EmptyState title="時間帯がありません" description="セットの期間に応じた集計を表示します。" />
              )}
            </div>
          </Card>
        </div>
      ) : null}

      <Modal
        title={modalDate ? `${modalDate} の時間を入力` : '時間を入力'}
        open={Boolean(modalDate)}
        onClose={closeDateModal}
      >
        <div className="space-y-4">
          <div className="space-y-3">
            {modalDrafts.map((draft, index) => (
              <div key={`${index}-${draft.startTime}-${draft.endTime}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-700">開始</span>
                    <Input
                      type="time"
                      step={300}
                      value={draft.startTime}
                      onChange={(event) => updateModalDraft(index, { startTime: event.target.value })}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-slate-700">終了</span>
                    <Input
                      type="time"
                      step={300}
                      value={draft.endTime}
                      onChange={(event) => updateModalDraft(index, { endTime: event.target.value })}
                    />
                  </label>
                </div>

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

                {modalDrafts.length > 1 ? (
                  <div className="mt-3 flex justify-end">
                    <Button type="button" size="sm" variant="danger" onClick={() => removeModalDraft(index)}>
                      この時間を削除
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="sticky bottom-0 -mx-4 flex flex-col gap-2 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <Button type="button" variant="secondary" className="w-full sm:w-auto" leftIcon={<Plus className="h-4 w-4" />} onClick={addModalDraft}>
              時間を追加
            </Button>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={closeDateModal}>
                キャンセル
              </Button>
              <Button type="button" className="w-full sm:w-auto" onClick={saveDateModal}>
                保存
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur md:bottom-0 md:left-72 md:px-4 md:py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <p className="hidden text-sm text-slate-500 sm:block">{saveMutation.isPending ? '保存中...' : '入力後に保存します'}</p>
          <Button className="w-full sm:w-auto" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || savedDrafts.length === 0} leftIcon={<Save className="h-4 w-4" />}>
            希望を保存
          </Button>
        </div>
      </div>
    </div>
  )
}
