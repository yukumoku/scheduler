import type { SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        'h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-200',
        className,
      )}
      {...props}
    />
  )
}
