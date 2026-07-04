import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, Users } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatCard } from '@/components/ui/StatCard'

function formatTime(value: string) {
  return value.slice(0, 5)
}

export function AvailabilityAdminPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()

  const eventQuery = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api.events.show(eventId ?? ''),
    enabled: Boolean(eventId),
  })

  const summaryQuery = useQuery({
    queryKey: ['event', eventId, 'availability', 'summary'],
    queryFn: () => api.events.availabilityAdmin(eventId ?? ''),
    enabled: Boolean(eventId),
  })

  if (!eventId) {
    return <EmptyState title="イベントが見つかりません" description="URLを確認してください。" />
  }

  if (eventQuery.isLoading || summaryQuery.isLoading) {
    return <p className="p-6 text-sm text-slate-500">読み込み中...</p>
  }

  const data = summaryQuery.data
  const slots = data?.slots ?? []
  const members = data?.members ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${eventQuery.data?.name ?? 'イベント'} の希望提出状況`}
        description="提出状況と、足りない枠を確認できます。"
        action={
          <Button variant="ghost" onClick={() => navigate(`/events/${eventId}`)} leftIcon={<ArrowLeft className="h-4 w-4" />}>
            イベント詳細へ戻る
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="希望提出率"
          value={`${data?.summary.submissionRate ?? 0}%`}
          hint={`${data?.summary.submittedMembers ?? 0}/${data?.summary.totalMembers ?? 0}人が提出済み`}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          label="提出済みメンバー"
          value={String(data?.summary.submittedMembers ?? 0)}
          hint="希望を提出した人数"
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="不足時間枠"
          value={String(data?.summary.insufficientSlots ?? 0)}
          hint="必要人数に足りない枠"
          icon={<AlertTriangle className="h-5 w-5" />}
        />
        <StatCard
          label="時間枠総数"
          value={String(data?.summary.totalSlots ?? 0)}
          hint="イベント内の全時間枠"
          icon={<Clock3 className="h-5 w-5" />}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">メンバーごとの提出状況</h2>
              <p className="text-sm text-slate-500">誰が提出済みかをひと目で確認できます。</p>
            </div>
            <Badge variant="brand">{members.length}人</Badge>
          </div>

          {members.length ? (
            <div className="space-y-3">
              {members.map((member) => (
                <Card key={member.id} className="bg-slate-50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{member.displayName ?? member.email ?? '名前未設定'}</p>
                      <p className="mt-1 text-sm text-slate-500">{member.email}</p>
                    </div>
                    <Badge variant={member.hasSubmitted ? 'success' : 'warning'}>
                      {member.hasSubmitted ? '提出済み' : '未提出'}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <Badge variant="info">提出枠: {member.submittedSlots}</Badge>
                    <Badge variant="success">参加可: {member.availableSlots}</Badge>
                    <Badge variant="warning">優先: {member.preferredSlots}</Badge>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState title="メンバーがいません" description="このイベントに参加しているメンバーがまだいません。" />
          )}
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">時間枠ごとの参加可能人数</h2>
              <p className="text-sm text-slate-500">必要人数との比較を確認できます。</p>
            </div>
            <Badge variant="info">{slots.length}件</Badge>
          </div>

          {slots.length ? (
            <div className="space-y-3">
              {slots.map((slot) => {
                const isShort = slot.insufficientPeople > 0
                return (
                  <Card key={slot.id} className={isShort ? 'border-amber-200 bg-amber-50' : 'bg-slate-50'}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="brand">{slot.date}</Badge>
                          <Badge variant="neutral">
                            {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                          </Badge>
                          <Badge variant={isShort ? 'warning' : 'success'}>
                            {slot.availablePeople}/{slot.requiredPeople}人
                          </Badge>
                        </div>
                        <p className="font-semibold text-slate-900">{slot.location || '場所未設定'}</p>
                        {slot.note ? <p className="text-sm leading-6 text-slate-500">{slot.note}</p> : null}
                      </div>
                      {isShort ? <Badge variant="warning">不足 {slot.insufficientPeople}人</Badge> : <Badge variant="success">充足</Badge>}
                    </div>
                  </Card>
                )
              })}
            </div>
          ) : (
            <EmptyState title="時間枠がありません" description="イベントに時間枠が登録されると、ここに表示されます。" />
          )}
        </Card>
      </div>
    </div>
  )
}
