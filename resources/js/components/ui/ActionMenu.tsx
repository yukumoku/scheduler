import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { EllipsisVertical } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from './Button'

export type ActionMenuItem = {
  label: string
  icon?: ReactNode
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

type ActionMenuProps = {
  items: ActionMenuItem[]
  triggerLabel?: string
  className?: string
}

export function ActionMenu({ items, triggerLabel = 'その他の操作', className }: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<{
    top: number
    left?: number
    right?: number
    maxHeight?: number
  } | null>(null)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const menuWidth = 256
  const viewportPadding = 12

  function computePosition() {
    const trigger = menuRef.current?.querySelector('button')
    if (!trigger) {
      return
    }

    const rect = trigger.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const openBelow = spaceBelow >= 240 || spaceBelow >= spaceAbove
    const top = openBelow ? rect.bottom + 8 : Math.max(viewportPadding, rect.top - 8 - 240)
    const right = window.innerWidth - rect.right
    const leftCandidate = rect.right - menuWidth
    const left = Math.min(Math.max(viewportPadding, leftCandidate), Math.max(viewportPadding, window.innerWidth - menuWidth - viewportPadding))
    const useRight = right + menuWidth <= window.innerWidth - viewportPadding
    const maxHeight = Math.max(160, openBelow ? window.innerHeight - rect.bottom - viewportPadding : rect.top - viewportPadding)

    setMenuStyle({
      top: Math.max(viewportPadding, top),
      ...(useRight ? { right: Math.max(viewportPadding, right) } : { left }),
      maxHeight,
    })
  }

  useEffect(() => {
    function handleDocumentClick(event: MouseEvent) {
      if (!menuRef.current) {
        return
      }

      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('click', handleDocumentClick)
    window.addEventListener('scroll', handleDocumentClick, true)
    window.addEventListener('resize', handleDocumentClick)

    return () => {
      document.removeEventListener('click', handleDocumentClick)
      window.removeEventListener('scroll', handleDocumentClick, true)
      window.removeEventListener('resize', handleDocumentClick)
    }
  }, [])

  useLayoutEffect(() => {
    if (open) {
      computePosition()
    } else {
      setMenuStyle(null)
    }
  }, [open, items.length])

  return (
    <div ref={menuRef} className={cn('relative inline-flex', className)}>
      <Button variant="secondary" size="sm" onClick={() => setOpen((current) => !current)} aria-label={triggerLabel}>
        <EllipsisVertical className="h-4 w-4" />
      </Button>

      {open && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed z-[1000] w-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl"
              style={menuStyle ?? { top: 0, right: 0, opacity: 0, pointerEvents: 'none' }}
            >
              {items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    if (item.disabled) {
                      return
                    }

                    item.onClick()
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm transition',
                    'min-h-12',
                    item.disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-slate-50',
                    item.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700',
                  )}
                >
                  {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
                  <span className="min-w-0 flex-1">{item.label}</span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
