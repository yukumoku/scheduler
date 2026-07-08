import { CalendarDays, Clock3, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'

type PeriodPreviewProps = {
  name?: string
  startDate?: string
  endDate?: string
  deadline?: string
}

function formatDate(value?: string) {
  if (!value) {
    return '未設定'
  }

  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
  }).format(date)
}

function countDays(startDate?: string, endDate?: string) {
  if (!startDate || !endDate || startDate > endDate) {
    return null
  }

  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  const diff = end.getTime() - start.getTime()

  return Math.floor(diff / 86_400_000) + 1
}

export function PeriodPreview({ name, startDate, endDate, deadline }: PeriodPreviewProps) {
  const days = countDays(startDate, endDate)

  return (
    <Card className="overflow-hidden border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-100/60 p-0">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm ring-1 ring-slate-200">
                <CalendarDays className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-slate-950">{name?.trim() || '新しい参加確認'}</p>
                <p className="text-xs text-slate-500">この範囲で参加できる時間を集めます</p>
              </div>
            </div>
          </div>
          <Badge variant={days ? 'brand' : 'neutral'}>{days ? `${days}日` : '未設定'}</Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/80 px-3 py-3 ring-1 ring-slate-200">
            <p className="text-[11px] font-semibold text-slate-400">開始</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatDate(startDate)}</p>
          </div>
          <div className="rounded-2xl bg-white/80 px-3 py-3 ring-1 ring-slate-200">
            <p className="text-[11px] font-semibold text-slate-400">終了</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{formatDate(endDate)}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-3 py-3 ring-1 ring-slate-200">
          <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Clock3 className="h-4 w-4 text-slate-500" />
            締切
          </span>
          <span className="text-sm font-semibold text-slate-900">{formatDate(deadline)}</span>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white/60 px-4 py-3">
        <p className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <Sparkles className="h-3.5 w-3.5 text-slate-500" />
          作成後、メンバーはカレンダーから行ける日だけ入力します。
        </p>
      </div>
    </Card>
  )
}
