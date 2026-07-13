import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, Clock, Download, RefreshCw, Send, Trash2, Users } from 'lucide-react'
import { api } from '@/lib/api'
import type { Shift } from '@/types/api'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { PageHeader } from '@/components/ui/PageHeader'

function groupAssignmentsBySlot(shift: Shift | null) {
  if (!shift) return []

  const fallbackSlots = shift.assignments
    .map((assignment) => assignment.eventSlot)
    .filter((slot): slot is NonNullable<typeof slot> => Boolean(slot))
  const slots = Array.from(new Map((shift.slots?.length ? shift.slots : fallbackSlots).map((slot) => [slot.id, slot])).values())

  return slots
    .map((slot) => {
      const assignments = shift.assignments.filter((assignment) => assignment.eventSlotId === slot.id)
      return {
        slotId: slot.id,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        taskName: slot.task?.name ?? '作業未設定',
        teamName: slot.task?.team?.name ?? null,
        taskColor: slot.task?.color ?? '#7c3aed',
        allowCrossTeamHelp: Boolean(slot.task?.allowCrossTeamHelp),
        requiredPeople: slot.requiredPeople,
        assignments,
      }
    })
    .sort((left, right) => `${left.date ?? ''} ${left.startTime ?? ''}`.localeCompare(`${right.date ?? ''} ${right.startTime ?? ''}`))
}

function groupSlotsByDate(groups: ReturnType<typeof groupAssignmentsBySlot>) {
  return groups.reduce<
    Array<{
      date: string
      groups: ReturnType<typeof groupAssignmentsBySlot>
    }>
  >((dates, group) => {
    const date = group.date ?? '日付未設定'
    const existing = dates.find((item) => item.date === date)

    if (existing) {
      existing.groups.push(group)
      return dates
    }

    dates.push({ date, groups: [group] })

    return dates
  }, [])
}

function formatMinutes(minutes: number | undefined): string {
  const value = Math.max(Number(minutes ?? 0), 0)
  const hours = Math.floor(value / 60)
  const rest = value % 60

  if (hours && rest) return `${hours}時間${rest}分`
  if (hours) return `${hours}時間`
  return `${rest}分`
}

function escapeCsvValue(value: string | number | null | undefined): string {
  const text = String(value ?? '')
  return `"${text.replace(/"/g, '""')}"`
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function downloadBinaryFile(filename: string, content: BlobPart, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function applyWorksheetLayout(
  sheet: XLSX.WorkSheet,
  cols: Array<{ wch: number }>,
  filterRange?: string,
) {
  sheet['!cols'] = cols
  if (filterRange) {
    sheet['!autofilter'] = { ref: filterRange }
  }
}

export function ShiftDetailPage() {
  const { shiftId } = useParams<{ shiftId: string }>()
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const shiftQuery = useQuery({
    queryKey: ['shift', shiftId],
    queryFn: () => api.shifts.show(shiftId ?? ''),
    enabled: Boolean(shiftId),
  })
  const groupQuery = useQuery({
    queryKey: ['group', shiftQuery.data?.event?.groupId],
    queryFn: () => api.groups.show(shiftQuery.data?.event?.groupId ?? ''),
    enabled: Boolean(shiftQuery.data?.event?.groupId),
  })

  const publishMutation = useMutation({
    mutationFn: () => api.shifts.publish(shiftId ?? ''),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['shift', shiftId] })
      await queryClient.invalidateQueries({ queryKey: ['event', shiftQuery.data?.eventId, 'shifts'] })
    },
  })
  const unpublishMutation = useMutation({
    mutationFn: () => api.shifts.unpublish(shiftId ?? ''),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['shift', shiftId] })
      await queryClient.invalidateQueries({ queryKey: ['event', shiftQuery.data?.eventId, 'shifts'] })
    },
  })
  const deleteMutation = useMutation({
    mutationFn: () => api.shifts.delete(shiftId ?? ''),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['event', shiftQuery.data?.eventId, 'shifts'] })
      await queryClient.invalidateQueries({ queryKey: ['shift', shiftId] })
      navigate(`/events/${shiftQuery.data?.eventId ?? ''}?tab=shifts`)
    },
  })

  const shift = shiftQuery.data ?? null
  const canManageShift = groupQuery.data?.myRole === 'owner'
  const groupedAssignments = useMemo(() => groupAssignmentsBySlot(shift), [shift])
  const calendarDays = useMemo(() => groupSlotsByDate(groupedAssignments), [groupedAssignments])
  const metrics = shift?.metrics
  const warnings = shift?.warnings ?? []
  const exportRows = useMemo(() => {
    return groupedAssignments.flatMap((group) => {
      if (group.assignments.length === 0) {
        return [
          {
            date: group.date ?? '',
            time: `${group.startTime?.slice(0, 5) ?? ''}-${group.endTime?.slice(0, 5) ?? ''}`,
            task: group.taskName,
            team: group.teamName ?? '',
            member: '',
            role: '',
            requiredPeople: group.requiredPeople,
          },
        ]
      }

      return group.assignments.map((assignment) => ({
        date: group.date ?? '',
        time: `${group.startTime?.slice(0, 5) ?? ''}-${group.endTime?.slice(0, 5) ?? ''}`,
        task: group.taskName,
        team: group.teamName ?? '',
        member: assignment.user?.displayName ?? '名前未設定',
        role: assignment.isLeader ? 'リーダー' : 'メンバー',
        requiredPeople: group.requiredPeople,
      }))
    })
  }, [groupedAssignments])

  const downloadCsv = () => {
    const headers = ['日付', '時間', '作業', '班', 'メンバー', '役割', '必要人数']
    const csv = [
      headers.map(escapeCsvValue).join(','),
      ...exportRows.map((row) =>
        [row.date, row.time, row.task, row.team, row.member, row.role, row.requiredPeople].map(escapeCsvValue).join(','),
      ),
    ].join('\n')

    downloadTextFile(`shift-${shiftId}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8')
  }

  const downloadExcel = () => {
    const workbook = XLSX.utils.book_new()
    const summaryRows = [
      { 項目: 'イベント', 値: shift.event?.name ?? '' },
      { 項目: '状態', 値: shift.status === 'published' ? '公開済み' : '下書き' },
      { 項目: '割り当て件数', 値: String(exportRows.length) },
      { 項目: '必要人数達成率', 値: `${metrics?.fillRate ?? 0}%` },
      { 項目: '希望反映率', 値: `${metrics?.preferenceReflectionRate ?? 0}%` },
      { 項目: '不足人数', 値: String(metrics?.missingPeopleTotal ?? 0) },
      { 項目: '不足警告数', 値: String(warnings.length) },
      { 項目: '公開日時', 値: shift.publishedAt ? new Date(shift.publishedAt).toLocaleString('ja-JP') : '' },
    ]
    const summarySheet = XLSX.utils.json_to_sheet(summaryRows)
    applyWorksheetLayout(summarySheet, [{ wch: 20 }, { wch: 44 }], 'A1:B8')
    XLSX.utils.book_append_sheet(workbook, summarySheet, '概要')

    const calendarDates = Array.from(new Set(groupedAssignments.map((group) => group.date ?? '未設定')))
    const calendarTimes = Array.from(
      new Set(groupedAssignments.map((group) => `${group.startTime?.slice(0, 5) ?? ''}-${group.endTime?.slice(0, 5) ?? ''}`)),
    ).sort()
    const calendarRows = calendarTimes.map((time) => {
      const row: Record<string, string> = { 時間: time }
      calendarDates.forEach((date) => {
        const entries = groupedAssignments
          .filter((group) => (group.date ?? '未設定') === date && `${group.startTime?.slice(0, 5) ?? ''}-${group.endTime?.slice(0, 5) ?? ''}` === time)
          .map((group) => {
            const members = group.assignments
              .map((assignment) => assignment.user?.displayName ?? '名前未設定')
              .join(' / ')
            const progress = `${group.assignments.length}/${group.requiredPeople}人`

            return [`${group.taskName}${group.teamName ? `（${group.teamName}）` : ''}`, progress, members].filter(Boolean).join('\n')
          })

        row[date] = entries.join('\n\n')
      })

      return row
    })
    const calendarSheet = XLSX.utils.json_to_sheet(calendarRows)
    applyWorksheetLayout(
      calendarSheet,
      [{ wch: 13 }, ...calendarDates.map(() => ({ wch: 30 }))],
      `A1:${XLSX.utils.encode_col(calendarDates.length)}${Math.max(calendarRows.length + 1, 1)}`,
    )
    XLSX.utils.book_append_sheet(workbook, calendarSheet, 'カレンダー')

    const detailSheet = XLSX.utils.json_to_sheet(
      exportRows.map((row) => ({
        日付: row.date,
        時間: row.time,
        作業: row.task,
        班: row.team,
        メンバー: row.member,
        役割: row.role,
        必要人数: row.requiredPeople,
      })),
    )
    applyWorksheetLayout(detailSheet, [
      { wch: 14 },
      { wch: 13 },
      { wch: 24 },
      { wch: 18 },
      { wch: 20 },
      { wch: 12 },
      { wch: 10 },
    ], `A1:G${Math.max(exportRows.length + 1, 1)}`)
    XLSX.utils.book_append_sheet(workbook, detailSheet, '一覧')

    const rowsByDate = exportRows.reduce<Record<string, typeof exportRows>>((groups, row) => {
      const key = row.date || '未設定'
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(row)
      return groups
    }, {})

    Object.entries(rowsByDate).forEach(([date, rows]) => {
      const sheet = XLSX.utils.json_to_sheet(
        rows.map((row) => ({
          時間: row.time,
          作業: row.task,
          班: row.team,
          メンバー: row.member,
          役割: row.role,
          必要人数: row.requiredPeople,
        })),
      )
      applyWorksheetLayout(sheet, [
        { wch: 13 },
        { wch: 24 },
        { wch: 18 },
        { wch: 20 },
        { wch: 12 },
        { wch: 10 },
      ], `A1:F${Math.max(rows.length + 1, 1)}`)
      XLSX.utils.book_append_sheet(workbook, sheet, date.slice(0, 31))
    })

    const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })

    downloadBinaryFile(`shift-${shiftId}.xlsx`, output, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  }

  if (!shiftId) {
    return <EmptyState title="シフトが見つかりません" description="URLを確認してください。" />
  }

  if (shiftQuery.isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="シフト詳細" description="読み込み中です。" />
        <Card>
          <LoadingSpinner />
        </Card>
      </div>
    )
  }

  if (!shift) {
    return <EmptyState title="シフトが見つかりません" description="削除されたか、URLが間違っています。" />
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="シフト詳細"
        description={shift.event?.name ?? 'シフトの割り当てを確認できます。'}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" leftIcon={<ArrowLeft className="h-4 w-4" />} onClick={() => navigate(`/events/${shift.eventId}?tab=shifts`)}>
              シフト一覧へ
            </Button>
            {canManageShift ? (
              <>
                <Button variant="secondary" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={() => navigate(`/events/${shift.eventId}?tab=shifts`)}>
                  再生成へ
                </Button>
                {shift.status === 'published' ? (
                  <Button
                    variant="secondary"
                    leftIcon={<Send className="h-4 w-4" />}
                    onClick={() => unpublishMutation.mutate()}
                    disabled={unpublishMutation.isPending}
                  >
                    {unpublishMutation.isPending ? '取り消し中...' : '公開を取り消す'}
                  </Button>
                ) : (
                  <Button
                    leftIcon={<Send className="h-4 w-4" />}
                    onClick={() => publishMutation.mutate()}
                    disabled={publishMutation.isPending}
                  >
                    {publishMutation.isPending ? '公開中...' : '公開する'}
                  </Button>
                )}
                <Button
                  variant="danger"
                  leftIcon={<Trash2 className="h-4 w-4" />}
                  onClick={() => {
                    if (window.confirm('このシフトを削除しますか？復元できません。')) {
                      deleteMutation.mutate()
                    }
                  }}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? '削除中...' : '削除'}
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      <section className="overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
        <div className="grid divide-y divide-slate-100 md:grid-cols-4 md:divide-x md:divide-y-0">
          <div className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Status</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant={shift.status === 'published' ? 'success' : 'warning'}>
                {shift.status === 'published' ? '公開済み' : '下書き'}
              </Badge>
              <span className="text-xs text-slate-500">{shift.publishedAt ? new Date(shift.publishedAt).toLocaleDateString('ja-JP') : '未公開'}</span>
            </div>
          </div>
          <div className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Work time</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{metrics?.workCoverageRate ?? 0}%</p>
            <p className="mt-1 text-xs text-slate-500">
              {formatMinutes(metrics?.completeWorkMinutes)} / {formatMinutes(metrics?.plannedWorkMinutes)}
            </p>
          </div>
          <div className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">People</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{metrics?.fillRate ?? 0}%</p>
            <p className="mt-1 text-xs text-slate-500">
              {metrics?.assignedPeopleTotal ?? 0}/{metrics?.requiredPeopleTotal ?? 0}人を割り当て
            </p>
          </div>
          <div className="p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Shortage</p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">{metrics?.missingPeopleTotal ?? 0}人</p>
            <p className="mt-1 text-xs text-slate-500">{warnings.length ? `${warnings.length}枠で不足` : '不足なし'}</p>
          </div>
        </div>
      </section>

      {publishMutation.error instanceof Error ? (
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700">{publishMutation.error.message}</Card>
      ) : null}

      {warnings.length ? (
        <Card className="space-y-3 border-amber-200 bg-amber-50/80">
          <div className="flex items-center gap-2 text-amber-900">
            <AlertTriangle className="h-5 w-5" />
            <h2 className="text-base font-semibold">不足している枠</h2>
          </div>
          <div className="divide-y divide-amber-100 overflow-hidden rounded-2xl border border-amber-100 bg-white">
            {warnings.map((warning) => (
              <div key={warning.slotId} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-slate-900">
                    {warning.date} {warning.startTime?.slice(0, 5)} - {warning.endTime?.slice(0, 5)}
                  </p>
                  <p className="text-sm text-slate-500">{warning.message}</p>
                </div>
                <Badge variant="warning">
                  {warning.assignedPeople}/{warning.requiredPeople}人
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="space-y-5 border-slate-200/80 bg-gradient-to-b from-white to-slate-50/80">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-violet-600" />
              <h2 className="text-lg font-semibold text-slate-950">シフトカレンダー</h2>
            </div>
            <p className="mt-1 text-sm text-slate-500">日付ごとに、作業と担当者を小さく確認できます。</p>
          </div>
          <Badge variant={warnings.length ? 'warning' : 'success'}>
            {warnings.length ? '調整が必要' : '割り当て完了'}
          </Badge>
        </div>

        {calendarDays.length ? (
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {calendarDays.map((day) => (
              <section key={day.date} className="overflow-hidden rounded-[1.4rem] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {day.date === '日付未設定' ? '未設定' : new Date(day.date).toLocaleDateString('ja-JP', { weekday: 'short' })}
                    </p>
                    <h3 className="text-base font-semibold text-slate-950">{day.date}</h3>
                  </div>
                  <Badge variant="neutral">{day.groups.length}枠</Badge>
                </div>
                <div className="divide-y divide-slate-100">
                  {day.groups.map((group) => {
                    const filled = group.assignments.length >= group.requiredPeople
                    return (
                      <article key={group.slotId} className="grid grid-cols-[4.7rem_1fr] gap-3 px-4 py-3 transition hover:bg-slate-50">
                        <div className="pt-1 text-xs font-medium text-slate-500">
                          <Clock className="mb-1 h-3.5 w-3.5" />
                          {group.startTime?.slice(0, 5)}
                          <br />
                          {group.endTime?.slice(0, 5)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-start gap-3">
                            <div className="mt-1 h-10 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: group.taskColor }} />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate font-semibold text-slate-950">{group.taskName}</p>
                                {group.teamName ? <Badge variant="neutral">{group.teamName}</Badge> : null}
                                {group.allowCrossTeamHelp ? <Badge variant="info">ヘルプ可</Badge> : null}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <Badge variant={filled ? 'success' : 'warning'}>
                                  {filled ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <AlertTriangle className="mr-1 h-3.5 w-3.5" />}
                                  {group.assignments.length}/{group.requiredPeople}人
                                </Badge>
                                {group.assignments.length === 0 ? <span className="text-xs text-slate-400">未割り当て</span> : null}
                              </div>
                              {group.assignments.length ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {group.assignments.map((assignment) => (
                                    <span
                                      key={assignment.id}
                                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                                    >
                                      <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-100 text-[10px] text-slate-600">
        {(assignment.user?.displayName ?? '?').slice(0, 1)}
                                      </span>
                                      {assignment.user?.displayName ?? '名前未設定'}
                                      {assignment.isLeader ? <span className="text-violet-600">班長</span> : null}
                                    </span>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState title="割り当てがありません" description="シフトを生成すると、ここに表示されます。" />
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-violet-600" />
            <div>
              <h2 className="text-lg font-semibold text-slate-950">メンバー別の活動時間</h2>
              <p className="text-sm text-slate-500">同じ時間帯に複数人いても、個人の活動時間としてはそれぞれに集計します。</p>
            </div>
          </div>
          {metrics?.memberWorkload?.length ? (
            <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {metrics.memberWorkload.map((member) => (
                <div key={member.userId} className="flex items-center justify-between gap-3 p-3">
                  <p className="truncate font-medium text-slate-900">{member.displayName ?? member.userId}</p>
                  <Badge variant="neutral">{formatMinutes(Math.round(member.minutes))}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="活動時間のデータがありません" description="割り当てがあると表示されます。" />
          )}
        </Card>

        <Card className="space-y-4 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-violet-600" />
            <div>
              <h2 className="text-lg font-semibold text-slate-950">出力</h2>
              <p className="text-sm text-slate-500">Excelにはカレンダー形式のシートも含めています。</p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <Button variant="secondary" leftIcon={<Download className="h-4 w-4" />} onClick={downloadCsv} disabled={exportRows.length === 0}>
              CSVで保存
            </Button>
            <Button leftIcon={<Download className="h-4 w-4" />} onClick={downloadExcel} disabled={exportRows.length === 0}>
              Excelカレンダーで保存
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
