import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { CalendarCheck2, Clock3, Loader2, Save } from 'lucide-react'
import { api } from '@/lib/api'
import type { AvailabilityStatus, EventAvailabilitySlot } from '@/types/api'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { Textarea } from '@/components/ui/Textarea'

type SlotDraft = {
  status: AvailabilityStatus
  comment: string
}

const statusOptions: Array<{ value: AvailabilityStatus; label: string; variant: 'success' | 'danger' | 'warning' }> = [
  { value: 'available', label: '参加できる', variant: 'success' },
  { value: 'unavailable', label: '参加できない', variant: 'danger' },
  { value: 'preferred', label: 'できれば参加したい', variant: 'warning' },
]

function formatTime(value: string) {
  return value.slice(0, 5)
}

export function AvailabilityPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const queryClient = useQueryClient()
  const [drafts, setDrafts] = useState<Record<string, SlotDraft>>({})

  const eventQuery = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api.events.show(eventId ?? ''),
    enabled: Boolean(eventId),
  })
  const slotsQuery = useQuery({
    queryKey: ['event', eventId, 'slots'],
    queryFn: () => api.events.slots(eventId ?? ''),
    enabled: Boolean(eventId),
  })
  const availabilityQuery = useQuery({
    queryKey: ['event', eventId, 'availability', 'me'],
    queryFn: () => api.events.availabilityMe(eventId ?? ''),
    enabled: Boolean(eventId),
  })

  useEffect(() => {
    const nextDrafts: Record<string, SlotDraft> = {}
    const availabilitySlots = availabilityQuery.data?.slots ?? []
    const slotMap = new Map<string, EventAvailabilitySlot>()
    availabilitySlots.forEach((slot) => slotMap.set(slot.id, slot))

    for (const slot of slotsQuery.data ?? []) {
      const existing = slotMap.get(slot.id)
      nextDrafts[slot.id] = {
        status: existing?.availabilityStatus ?? 'available',
        comment: existing?.availabilityComment ?? '',
      }
    }

    setDrafts(nextDrafts)
  }, [availabilityQuery.data?.slots, slotsQuery.data])

  const saveMutation = useMutation({
    mutationFn: () =>
      api.events.saveAvailabilityMe(eventId ?? '', {
        slots: (slotsQuery.data ?? []).map((slot) => ({
          slotId: slot.id,
          status: drafts[slot.id]?.status ?? 'available',
          comment: drafts[slot.id]?.comment?.trim() || null,
        })),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['event', eventId, 'availability', 'me'] })
    },
  })

  const slots = useMemo(() => slotsQuery.data ?? [], [slotsQuery.data])

  if (!eventId) {
    return <EmptyState title="イベントが見つかりません" description="URLを確認してください。" />
  }

  if (eventQuery.isLoading || slotsQuery.isLoading) {
    return <p className="p-6 text-sm text-slate-500">読み込み中...</p>
  }

  return (
    <div className="space-y-4 pb-32">
      <PageHeader
        title={eventQuery.data?.name ?? '希望提出'}
        description="各時間枠ごとに参加可否を選んで、コメントを添えて提出できます。"
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="bg-slate-50">
          <p className="text-sm text-slate-500">イベント</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{eventQuery.data?.name ?? '未取得'}</p>
        </Card>
        <Card className="bg-slate-50">
          <p className="text-sm text-slate-500">時間枠数</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{slots.length}件</p>
        </Card>
        <Card className="bg-slate-50">
          <p className="text-sm text-slate-500">提出状況</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">編集可能</p>
        </Card>
      </section>

      <div className="space-y-4">
        {slots.length ? (
          slots.map((slot) => {
            const draft = drafts[slot.id] ?? { status: 'available' as AvailabilityStatus, comment: '' }
            return (
              <Card key={slot.id} className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="brand">{slot.date}</Badge>
                      <Badge variant="neutral">
                        {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                      </Badge>
                      <Badge variant="info">{slot.requiredPeople}人必要</Badge>
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-slate-900">
                      {slot.location || '場所未設定'}
                    </h3>
                    {slot.note ? <p className="mt-1 text-sm leading-6 text-slate-500">{slot.note}</p> : null}
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl bg-violet-50 px-3 py-2 text-violet-700">
                    <Clock3 className="h-4 w-4" />
                    <span className="text-xs font-medium">時間枠</span>
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  {statusOptions.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={draft.status === option.value ? 'primary' : 'secondary'}
                      className="justify-center"
                      onClick={() =>
                        setDrafts((current) => ({
                          ...current,
                          [slot.id]: {
                            status: option.value,
                            comment: current[slot.id]?.comment ?? '',
                          },
                        }))
                      }
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">コメント</span>
                  <Textarea
                    value={draft.comment}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [slot.id]: {
                          status: current[slot.id]?.status ?? 'available',
                          comment: event.target.value,
                        },
                      }))
                    }
                    placeholder="補足したいことがあれば入力してください"
                  />
                </label>
              </Card>
            )
          })
        ) : (
          <EmptyState
            title="時間枠がありません"
            description="イベントに時間枠が登録されると、ここから希望を提出できます。"
          />
        )}
      </div>

      <div className="fixed inset-x-0 bottom-20 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:bottom-0 md:left-72">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            {saveMutation.isPending ? '保存中...' : '内容を確認して保存してください'}
          </p>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || slots.length === 0} leftIcon={saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}>
            希望を保存
          </Button>
        </div>
      </div>
    </div>
  )
}
