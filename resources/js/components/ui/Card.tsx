import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type CardProps = {
  children: ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return <div className={cn('alloca-fade-up rounded-[1.35rem] border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)]', className)}>{children}</div>
}
