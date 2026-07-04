import { useEffect, useMemo, useState } from 'react'
import { CircleUserRound } from 'lucide-react'
import { cn } from '@/lib/cn'

type UserAvatarProps = {
  src?: string | null
  name?: string | null
  className?: string
  iconClassName?: string
}

function getInitials(name?: string | null): string {
  const normalized = name?.trim()

  if (!normalized) {
    return '?'
  }

  const parts = normalized.split(/\s+/).filter(Boolean)
  if (parts.length === 0) {
    return '?'
  }

  const first = parts[0]?.charAt(0) ?? '?'
  const second = parts[1]?.charAt(0) ?? ''

  return `${first}${second}`.toUpperCase()
}

export function UserAvatar({ src, name, className, iconClassName }: UserAvatarProps) {
  const [failed, setFailed] = useState(false)
  const [displaySrc, setDisplaySrc] = useState<string | null>(src ?? null)

  useEffect(() => {
    setFailed(false)
    setDisplaySrc(src ?? null)
  }, [src])

  const initials = useMemo(() => getInitials(name), [name])
  const isExternalSrc = Boolean(displaySrc && /^https?:\/\//i.test(displaySrc))
  const proxySrc =
    typeof window !== 'undefined' && displaySrc && /^https?:\/\//i.test(displaySrc)
      ? `${window.location.origin}/api/avatar-proxy?url=${encodeURIComponent(displaySrc)}`
      : null
  const showImage = Boolean(displaySrc) && !failed

  return (
    <div className={cn('relative inline-flex items-center justify-center overflow-hidden bg-slate-100 text-slate-500', className)}>
      {showImage ? (
        <img
          src={displaySrc ?? undefined}
          alt=""
          className="h-full w-full object-cover"
          onError={() => {
            if (proxySrc && displaySrc !== proxySrc) {
              setDisplaySrc(proxySrc)
              return
            }

            setFailed(true)
          }}
        />
      ) : initials !== '?' ? (
        <span className="select-none font-semibold text-current">{initials}</span>
      ) : (
        <CircleUserRound className={cn('h-1/2 w-1/2', iconClassName)} />
      )}
    </div>
  )
}
