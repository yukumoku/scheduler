import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type PageHeaderProps = {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 rounded-[1.5rem] border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] md:flex-row md:items-end md:justify-between', className)}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Alloca</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 md:text-[2rem]">{title}</h1>
        {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      {action ? <div className="flex items-center gap-3">{action}</div> : null}
    </div>
  )
}
