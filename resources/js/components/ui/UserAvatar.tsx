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

  useEffect(() => {
    setFailed(false)
  }, [src])

  const initials = useMemo(() => getInitials(name), [name])
  const imageSrc = useMemo(() => {
    if (!src) {
      return null
    }

    if (typeof window === 'undefined') {
      return src
    }

    try {
      const resolved = new URL(src, window.location.origin)
      const isSameOrigin = resolved.origin === window.location.origin

      if (isSameOrigin) {
        return resolved.toString()
      }

      return `${window.location.origin}/api/avatar-proxy?url=${encodeURIComponent(src)}`
    } catch {
      return src
    }
  }, [src])

  const showImage = Boolean(imageSrc) && !failed

  return (
    <div className={cn('relative inline-flex items-center justify-center overflow-hidden bg-slate-100 text-slate-500', className)}>
      {showImage ? (
        <img
          src={imageSrc ?? undefined}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : initials !== '?' ? (
        <span className="select-none font-semibold text-current">{initials}</span>
      ) : (
        <CircleUserRound className={cn('h-1/2 w-1/2', iconClassName)} />
      )}
    </div>
  )
}
