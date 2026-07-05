import { Plus, Trash2 } from 'lucide-react'
import type { ActivityRules } from '@/types/api'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DateField } from '@/components/ui/DateField'
import { Input } from '@/components/ui/Input'

const weekdays = [
  { key: 'mon', label: '月' },
  { key: 'tue', label: '火' },
  { key: 'wed', label: '水' },
  { key: 'thu', label: '木' },
  { key: 'fri', label: '金' },
  { key: 'sat', label: '土' },
  { key: 'sun', label: '日' },
] as const

const emptyRules: ActivityRules = {
  weekly: {},
  excludedDates: [],
  specialDates: [],
}

type ActivityRulesFieldsProps = {
  value: ActivityRules
  onChange: (value: ActivityRules) => void
}

export function createDefaultActivityRules(): ActivityRules {
  return {
    weekly: {
      mon: { enabled: true, startTime: '09:00', endTime: '16:00' },
      tue: { enabled: true, startTime: '09:00', endTime: '16:00' },
      wed: { enabled: true, startTime: '09:00', endTime: '16:00' },
      thu: { enabled: true, startTime: '09:00', endTime: '16:00' },
      fri: { enabled: true, startTime: '09:00', endTime: '16:00' },
      sat: { enabled: false, startTime: '09:00', endTime: '12:00' },
      sun: { enabled: false, startTime: '09:00', endTime: '12:00' },
    },
    excludedDates: [],
    specialDates: [],
  }
}

export function ActivityRulesFields({ value, onChange }: ActivityRulesFieldsProps) {
  const rules = {
    ...emptyRules,
    ...value,
    weekly: value.weekly ?? {},
    excludedDates: value.excludedDates ?? [],
    specialDates: value.specialDates ?? [],
  }

  const updateWeekly = (key: string, nextValue: Partial<ActivityRules['weekly'][string]>) => {
    const current = rules.weekly[key] ?? { enabled: false, startTime: '09:00', endTime: '16:00' }
    onChange({
      ...rules,
      weekly: {
        ...rules.weekly,
        [key]: { ...current, ...nextValue },
      },
    })
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">曜日ごとの活動時間</p>
        <p className="mt-1 text-xs text-slate-500">ここで指定した範囲だけ、参加できる時間として選びやすくします。</p>
      </div>

      <div className="grid gap-2">
        {weekdays.map((day) => {
          const weekly = rules.weekly[day.key] ?? { enabled: false, startTime: '09:00', endTime: '16:00' }

          return (
            <div key={day.key} className="grid gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 sm:grid-cols-[4.5rem_1fr_1fr] sm:items-center">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-slate-900"
                  checked={weekly.enabled}
                  onChange={(event) => updateWeekly(day.key, { enabled: event.target.checked })}
                />
                {day.label}
              </label>
              <Input type="time" value={weekly.startTime} disabled={!weekly.enabled} onChange={(event) => updateWeekly(day.key, { startTime: event.target.value })} />
              <Input type="time" value={weekly.endTime} disabled={!weekly.enabled} onChange={(event) => updateWeekly(day.key, { endTime: event.target.value })} />
            </div>
          )
        })}
      </div>

      <Card className="space-y-3 bg-slate-50">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">活動しない日</p>
            <p className="text-xs text-slate-500">祝日や休みの日を外します。</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => onChange({ ...rules, excludedDates: [...rules.excludedDates, ''] })}
          >
            追加
          </Button>
        </div>
        {rules.excludedDates.length ? (
          <div className="grid gap-2">
            {rules.excludedDates.map((date, index) => (
              <div key={`${index}-${date}`} className="flex items-center gap-2">
                <DateField value={date} onChange={(event) => onChange({ ...rules, excludedDates: rules.excludedDates.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)) })} />
                <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ ...rules, excludedDates: rules.excludedDates.filter((_, itemIndex) => itemIndex !== index) })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </Card>

      <Card className="space-y-3 bg-slate-50">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">特別な活動時間</p>
            <p className="text-xs text-slate-500">普段と違う日だけ上書きします。</p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => onChange({ ...rules, specialDates: [...rules.specialDates, { date: '', startTime: '09:00', endTime: '12:00', note: '' }] })}
          >
            追加
          </Button>
        </div>
        {rules.specialDates.length ? (
          <div className="grid gap-2">
            {rules.specialDates.map((date, index) => (
              <div key={`${index}-${date.date}`} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_8rem_8rem_auto] sm:items-center">
                <DateField value={date.date} onChange={(event) => onChange({ ...rules, specialDates: rules.specialDates.map((item, itemIndex) => (itemIndex === index ? { ...item, date: event.target.value } : item)) })} />
                <Input type="time" value={date.startTime} onChange={(event) => onChange({ ...rules, specialDates: rules.specialDates.map((item, itemIndex) => (itemIndex === index ? { ...item, startTime: event.target.value } : item)) })} />
                <Input type="time" value={date.endTime} onChange={(event) => onChange({ ...rules, specialDates: rules.specialDates.map((item, itemIndex) => (itemIndex === index ? { ...item, endTime: event.target.value } : item)) })} />
                <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ ...rules, specialDates: rules.specialDates.filter((_, itemIndex) => itemIndex !== index) })}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  )
}
