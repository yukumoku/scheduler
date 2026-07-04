import type { ReactNode } from 'react'
import { Card } from './Card'

type StatCardProps = {
  label: string
  value: string
  hint?: string
  icon?: ReactNode
}

export function StatCard({ label, value, hint, icon }: StatCardProps) {
  return (
    <Card className="bg-gradient-to-br from-white to-slate-50">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
          {hint ? <p className="mt-2 text-sm text-slate-500">{hint}</p> : null}
        </div>
        {icon ? <div className="rounded-2xl bg-white p-3 text-violet-600 shadow-sm ring-1 ring-slate-200">{icon}</div> : null}
      </div>
    </Card>
  )
}
