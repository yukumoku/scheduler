import type { InputHTMLAttributes } from 'react'
import { CalendarDays } from 'lucide-react'
import { cn } from '@/lib/cn'

type DateFieldProps = InputHTMLAttributes<HTMLInputElement>

export function DateField({ className, ...props }: DateFieldProps) {
  return (
    <div className="relative">
      <input
        type="date"
        className={cn(
          'h-11 w-full rounded-xl border border-blue-100 bg-white px-4 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100',
          className,
        )}
        onClick={(event) => {
          const input = event.currentTarget
          if ('showPicker' in input) {
            try {
              input.showPicker()
            } catch {
              // Some browsers only allow opening the picker in specific user gestures.
            }
          }
        }}
        {...props}
      />
      <CalendarDays className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-blue-500" />
    </div>
  )
}
