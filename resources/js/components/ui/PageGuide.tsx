import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'
import { Badge } from './Badge'

type PageGuideItem = {
  title: string
  description: string
  icon?: ReactNode
}

type PageGuideProps = {
  title: string
  description: string
  items: PageGuideItem[]
  storageKey?: string
}

function getStorageKey(title: string, storageKey?: string) {
  return storageKey ?? `alloca_page_guide_${title}`
}

export function PageGuide({ title, description, items, storageKey }: PageGuideProps) {
  const key = useMemo(() => getStorageKey(title, storageKey), [storageKey, title])
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(key) === '1')
    } catch {
      setHidden(false)
    }
  }, [key])

  useEffect(() => {
    if (!hidden) {
      setOpen(true)
    }
  }, [hidden])

  if (hidden) {
    return null
  }

  return (
    <div
      className={[
        'fixed inset-0 z-50 flex items-start justify-center bg-slate-950/15 px-3 py-4 backdrop-blur-[2px] sm:items-center',
        open ? 'opacity-100' : 'pointer-events-none opacity-0',
      ].join(' ')}
      aria-hidden={!open}
    >
      <div className="alloca-scale-in w-full max-w-sm rounded-[1.2rem] border border-slate-200/80 bg-white/95 p-3 shadow-[0_20px_60px_rgba(15,23,42,0.14)] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Badge variant="neutral">簡単ステップ</Badge>
            <h2 className="mt-2 text-sm font-semibold tracking-tight text-slate-950">{title}</h2>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            aria-label="閉じる"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid gap-1.5">
          {items.map((item, index) => (
            <div key={item.title} className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-2.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-slate-700 ring-1 ring-slate-200">
                  {item.icon ?? <span className="text-sm font-bold">{index + 1}</span>}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold tracking-tight text-slate-950">{item.title}</p>
                  <p className="line-clamp-1 text-xs text-slate-500">{item.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              try {
                localStorage.setItem(key, '1')
              } catch {
                // Ignore storage errors in private mode.
              }
              setHidden(true)
              setOpen(false)
            }}
          >
            今後は表示しない
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            閉じる
          </Button>
        </div>
      </div>
    </div>
  )
}
