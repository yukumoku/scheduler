import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

type BadgeVariant = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

type BadgeProps = {
  children: ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  brand: 'bg-slate-900 text-white',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-rose-100 text-rose-700',
  info: 'bg-sky-100 text-sky-700',
  neutral: 'bg-slate-100 text-slate-600',
}

export function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  return <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-medium', variantClasses[variant], className)}>{children}</span>
}
