import { Link } from 'react-router-dom'
import { CalendarCheck2 } from 'lucide-react'
import type { CommonAvailabilitySet } from '@/types/api'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'

type AvailabilityReminderListProps = {
  sets: CommonAvailabilitySet[]
  loading?: boolean
  compact?: boolean
}

export function AvailabilityReminderList({ sets, loading = false, compact = false }: AvailabilityReminderListProps) {
  if (loading) {
    return (
      <Card className="border-amber-200 bg-amber-50/70">
        <p className="text-sm font-medium text-amber-900">参加確認を確認しています...</p>
      </Card>
    )
  }

  if (!sets.length) {
    return null
  }

  return (
    <Card className="space-y-3 border-amber-200 bg-amber-50/80">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 ring-1 ring-amber-200">
          <CalendarCheck2 className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-amber-950">参加確認を入力してください</p>
          {!compact ? <p className="mt-1 text-sm text-amber-800">未入力の期間があります。押すと入力画面へ移動します。</p> : null}
        </div>
        <Badge variant="warning">{sets.length}件</Badge>
      </div>

      <div className="grid gap-2">
        {sets.slice(0, compact ? 2 : 4).map((set) => (
          <Link
            key={set.id}
            to={`/availability-sets/${set.id}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white/85 px-3 py-3 text-left transition hover:bg-white"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">{set.name}</p>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {set.startDate ?? '未設定'} - {set.endDate ?? '未設定'}
              </p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-amber-800">入力する</span>
          </Link>
        ))}
      </div>
    </Card>
  )
}
