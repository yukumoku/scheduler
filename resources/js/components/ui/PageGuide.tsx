import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowRight, X } from 'lucide-react'
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
        'fixed inset-0 z-50 flex items-start justify-center bg-slate-950/20 px-3 py-4 backdrop-blur-sm sm:items-center',
        open ? 'opacity-100' : 'pointer-events-none opacity-0',
      ].join(' ')}
      aria-hidden={!open}
    >
      <div className="alloca-scale-in w-full max-w-md rounded-[1.35rem] border border-slate-200/80 bg-white/95 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.16)] backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Badge variant="neutral">簡単ステップ</Badge>
            <h2 className="mt-2 text-base font-semibold tracking-tight text-slate-950">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
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

        <div className="mt-4 grid gap-2">
          {items.map((item, index) => (
            <div key={item.title} className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-700 ring-1 ring-slate-200">
                  {item.icon ?? <span className="text-sm font-bold">{index + 1}</span>}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold tracking-tight text-slate-950">{item.title}</p>
                  <p className="mt-1 text-sm leading-5 text-slate-500">{item.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="secondary"
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
          <Button variant="ghost" onClick={() => setOpen(false)}>
            閉じる
          </Button>
        </div>

        <div className="mt-4 flex items-center justify-end text-xs text-slate-400">
          <ArrowRight className="mr-1 h-3.5 w-3.5" />
          いつでも閉じられます
        </div>
      </div>
    </div>
  )
}
