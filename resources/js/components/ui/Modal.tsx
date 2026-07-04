import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'

type ModalProps = {
  title: string
  open: boolean
  onClose: () => void
  children: ReactNode
}

export function Modal({ title, open, onClose, children }: ModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/35 p-4 backdrop-blur-[2px] sm:items-center">
      <div className="alloca-scale-in flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-[1.6rem] border border-slate-200/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.14)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 pb-4 pt-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">Form</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">{title}</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} leftIcon={<X className="h-4 w-4" />}>
            閉じる
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          {children}
        </div>
      </div>
    </div>
  )
}
