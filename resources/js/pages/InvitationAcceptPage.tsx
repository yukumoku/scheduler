import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, LogIn, Users } from 'lucide-react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'

export function InvitationAcceptPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const invitationQuery = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => api.invitations.show(token ?? ''),
    enabled: Boolean(token),
  })
  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: api.auth.me,
    retry: false,
  })
  const acceptMutation = useMutation({
    mutationFn: () => api.invitations.accept(token ?? ''),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['groups'] })
      await queryClient.invalidateQueries({ queryKey: ['group', result.groupId] })
      await queryClient.invalidateQueries({ queryKey: ['group', result.groupId, 'members'] })
      await queryClient.invalidateQueries({ queryKey: ['group', result.groupId, 'common-availability-sets'] })
      await queryClient.invalidateQueries({ queryKey: ['common-availability-set'] })
      navigate(`/groups/${result.groupId}`)
    },
  })

  if (!token) {
    return <EmptyState title="招待リンクが正しくありません" description="URLを確認してください。" />
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-xl items-center">
        <Card className="w-full space-y-6">
          {invitationQuery.isLoading ? (
            <p className="text-sm text-slate-500">招待を確認しています...</p>
          ) : invitationQuery.isError ? (
            <EmptyState title="招待が見つかりません" description="リンクが間違っているか、招待が削除されています。" />
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-600">Alloca 招待</p>
                  <h1 className="text-2xl font-bold text-slate-900">{invitationQuery.data?.group?.name ?? 'グループ'} に参加</h1>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-sm leading-6 text-slate-600">
                  {invitationQuery.data?.inviter?.displayName ?? 'メンバー'} さんから招待されています。
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="brand">招待コードで参加できます</Badge>
                  {invitationQuery.data?.expiresAt ? <Badge variant="neutral">期限 {new Date(invitationQuery.data.expiresAt).toLocaleDateString('ja-JP')}</Badge> : null}
                </div>
              </div>

              {invitationQuery.data?.acceptedAt ? (
                <EmptyState title="この招待は使用済みです" description="すでに参加済みの場合は、グループ一覧から開いてください。" actionLabel="グループ一覧へ" onAction={() => navigate('/groups')} />
              ) : meQuery.data ? (
                <div className="space-y-3">
                  <Button className="w-full" leftIcon={<CheckCircle2 className="h-4 w-4" />} onClick={() => acceptMutation.mutate()} disabled={acceptMutation.isPending}>
                    {acceptMutation.isPending ? '参加中...' : 'グループに参加'}
                  </Button>
                  {acceptMutation.error instanceof Error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{acceptMutation.error.message}</p> : null}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-slate-500">参加するにはログインが必要です。ログイン後、この招待リンクをもう一度開いてください。</p>
                  <Link to="/login" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-medium text-white transition hover:bg-slate-800">
                    <LogIn className="h-4 w-4" />
                    ログインへ
                  </Link>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
