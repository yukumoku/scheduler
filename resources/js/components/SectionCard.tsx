import type { ReactNode } from 'react'

type SectionCardProps = {
  title: string
  subtitle?: string
  children: ReactNode
  action?: ReactNode
}

export function SectionCard({ title, subtitle, children, action }: SectionCardProps) {
  return (
    <section className="rounded-[1.35rem] border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-950">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
