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
    <div className={cn('flex flex-col gap-3 py-1 md:flex-row md:items-end md:justify-between', className)}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 md:text-[1.9rem]">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}
    </div>
  )
}
