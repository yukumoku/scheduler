import { ArrowRight, Users } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Group } from '@/types/api'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'

type GroupCardProps = {
  group: Group
}

export function GroupCard({ group }: GroupCardProps) {
  return (
    <Link to={`/groups/${group.id}`} className="block transition hover:-translate-y-0.5">
      <Card className="h-full bg-white">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-lg font-semibold text-slate-700 ring-1 ring-slate-200">
            {group.name.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold tracking-tight text-slate-950">{group.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{group.description || '説明はまだありません'}</p>
              </div>
              {group.myRole ? <Badge variant={group.myRole === 'owner' ? 'brand' : 'neutral'}>{group.myRole === 'owner' ? 'オーナー' : 'メンバー'}</Badge> : null}
            </div>
            <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Users className="h-4 w-4" />
                {group.memberCount}人
              </span>
              <span className="inline-flex items-center gap-1">
                詳細
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  )
}
