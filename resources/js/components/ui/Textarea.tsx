import type { TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'min-h-28 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-300 focus:ring-4 focus:ring-violet-200',
        className,
      )}
      {...props}
    />
  )
}
