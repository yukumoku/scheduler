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
    <div className={cn('alloca-fade-up sticky top-16 z-20 rounded-[1.35rem] border border-slate-200/80 bg-white/95 p-2 shadow-sm backdrop-blur', className)}>
      <div className="flex gap-2 overflow-x-auto scrollbar-none md:flex-wrap md:overflow-visible">
        {items.map((item) => {
          const active = value === item.key

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={cn(
                'relative inline-flex min-w-max items-center justify-center gap-2 overflow-hidden rounded-full px-3.5 py-2 text-sm font-medium transition-all duration-300 md:px-4 md:py-2.5',
                active
                  ? 'bg-violet-600 text-white shadow-sm shadow-violet-200'
                  : 'text-slate-600 hover:-translate-y-[1px] hover:bg-slate-50 hover:text-slate-950',
              )}
            >
              {active ? <span className="alloca-shimmer absolute inset-0 opacity-30" /> : null}
              {item.icon ? <span className={cn('shrink-0', active ? 'text-white' : 'text-violet-500')}>{item.icon}</span> : null}
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
