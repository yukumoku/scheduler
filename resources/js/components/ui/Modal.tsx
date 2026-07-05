import type { ReactNode } from 'react'
import { X } from 'lucide-react'

type ModalProps = {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
}

export function Modal({ title, open, onClose, children }: ModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div className="alloca-scale-in flex max-h-[min(92dvh,calc(100vh-1rem))] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.4rem] border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.14)] sm:rounded-[1.4rem]">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
          <h2 className="truncate text-base font-semibold tracking-tight text-slate-950 sm:text-lg">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-5 sm:pb-5">
          {children}
        </div>
      </div>
    </div>
  )
}
