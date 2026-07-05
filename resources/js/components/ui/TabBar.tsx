import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type TabBarItem<T extends string> = {
  key: T
  label: string
  icon?: ReactNode
  count?: number | null
}

type TabBarProps<T extends string> = {
  items: Array<TabBarItem<T>>
  value: T
  onChange: (value: T) => void
  className?: string
}

export function TabBar<T extends string>({ items, value, onChange, className }: TabBarProps<T>) {
  return (
    <div className={cn('alloca-fade-up sticky top-16 z-20 rounded-2xl border border-slate-200/80 bg-white/90 p-1.5 shadow-[0_8px_30px_rgba(15,23,42,0.05)] backdrop-blur', className)}>
      <div className="flex gap-1 overflow-x-auto scrollbar-none md:flex-wrap md:overflow-visible">
        {items.map((item) => {
          const active = value === item.key

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={cn(
                'relative inline-flex min-w-max items-center justify-center gap-2 overflow-hidden rounded-xl px-3.5 py-2 text-sm font-medium transition-all duration-200 md:px-4 md:py-2.5',
                active
                  ? 'bg-slate-950 text-white shadow-sm shadow-slate-200'
                  : 'text-slate-600 hover:-translate-y-[1px] hover:bg-slate-50 hover:text-slate-950',
              )}
            >
              {item.icon ? <span className={cn('shrink-0', active ? 'text-white' : 'text-slate-500')}>{item.icon}</span> : null}
              <span className="whitespace-nowrap">{item.label}</span>
              {typeof item.count === 'number' ? (
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500')}>
                  {item.count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
