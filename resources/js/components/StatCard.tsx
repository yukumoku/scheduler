type StatCardProps = {
  label: string
  value: string
  hint?: string
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-3xl bg-gradient-to-br from-white to-brand-50 p-5 shadow-sm ring-1 ring-brand-100">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
      {hint ? <p className="mt-2 text-sm text-slate-500">{hint}</p> : null}
    </div>
  )
}

