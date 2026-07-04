import type { ReactNode } from 'react'
import { Card } from './Card'
import { Button } from './Button'

type EmptyStateProps = {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
  icon?: ReactNode
}

export function EmptyState({ title, description, actionLabel, onAction, icon }: EmptyStateProps) {
  return (
    <Card className="border-dashed border-slate-300/80 bg-slate-50/50 text-center">
      {icon ? <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-violet-600 shadow-sm ring-1 ring-slate-200">{icon}</div> : null}
      <h3 className="text-base font-semibold tracking-tight text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      {actionLabel && onAction ? (
        <Button className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </Card>
  )
}
