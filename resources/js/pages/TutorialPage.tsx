import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { CircleHelp, ImagePlus, Sparkles, Users } from 'lucide-react'
import { api } from '@/lib/api'
import { isTutorialCompletedLocally, markTutorialCompletedLocally } from '@/lib/onboarding'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { UserAvatar } from '@/components/ui/UserAvatar'

function getStepLabel(step: string): string {
  switch (step) {
    case 'profile':
      return 'プロフィール'
    case 'invite':
      return '参加確認'
    default:
      return 'はじめる'
  }
}

export function TutorialPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [displayName, setDisplayName] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [inviteCode, setInviteCode] = useState('')
  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: api.auth.me,
    retry: false,
  })

  useEffect(() => {
    if (meQuery.data) {
      setDisplayName(meQuery.data.displayName ?? '')
    }
  }, [meQuery.data])

  const tutorialStep = searchParams.get('step') ?? (meQuery.data?.displayName ? 'invite' : 'profile')
  const stepIndex = tutorialStep === 'profile' ? 0 : tutorialStep === 'invite' ? 1 : 2

  useEffect(() => {
    if (!meQuery.data) {
      return
    }

    if (!meQuery.data.displayName && tutorialStep !== 'profile') {
      setSearchParams({ step: 'profile' })
    }
  }, [meQuery.data, setSearchParams, tutorialStep])

  const avatarPreview = useMemo(() => {
    if (avatarFile) {
      return URL.createObjectURL(avatarFile)
    }

    return meQuery.data?.avatarUrl ?? null
  }, [avatarFile, meQuery.data?.avatarUrl])

  const saveProfileMutation = useMutation({
    mutationFn: () =>
      api.auth.updateProfile({
        displayName: displayName.trim(),
        avatar: avatarFile,
      }),
    onSuccess: async (user) => {
      queryClient.setQueryData(['auth', 'me'], user)
      setSearchParams({ step: 'invite' })
    },
  })

  const acceptInviteMutation = useMutation({
    mutationFn: async () => {
      const trimmed = inviteCode.trim().toUpperCase()

      if (!trimmed) {
        return null
      }

      const result = await api.invitations.acceptByCode(trimmed)

      try {
        const user = await api.auth.completeTutorial()
        queryClient.setQueryData(['auth', 'me'], user)
      } catch {
        markTutorialCompletedLocally()
      }

      return result
    },
    onSuccess: async (result) => {
      if (result) {
        await queryClient.invalidateQueries({ queryKey: ['groups'] })
        navigate(`/groups/${result.groupId}`, { replace: true })
        return
      }

      setSearchParams({ step: 'guide' }, { replace: true })
    },
  })

  const finishMutation = useMutation({
    mutationFn: async () => {
      try {
        const user = await api.auth.completeTutorial()
        queryClient.setQueryData(['auth', 'me'], user)
        return user
      } catch {
        markTutorialCompletedLocally()
        return meQuery.data
      }
    },
    onSuccess: async (user) => {
      if (user) {
        queryClient.setQueryData(['auth', 'me'], user)
      }

      navigate('/dashboard', { replace: true })
    },
  })

  if (meQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f7ff] px-4 text-slate-900">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-sm">
          <LoadingSpinner />
        </div>
      </div>
    )
  }

  if (!meQuery.data) {
    return <Navigate to="/" replace />
  }

  if (meQuery.data.tutorialCompletedAt || isTutorialCompletedLocally()) {
    return <Navigate to="/dashboard" replace />
  }

  const stepTitle =
    tutorialStep === 'profile'
      ? '表示名とアイコンを整える'
      : tutorialStep === 'invite'
        ? '招待コードを入れる'
        : 'はじめる'

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-3xl items-center">
        <div className="w-full space-y-4">
          <div className="space-y-2">
            <Badge variant="brand" className="inline-flex w-fit">
              初回ガイド
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">まずは、ひとつずつ進めましょう。</h1>
            <p className="max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
              アカウントの見た目を整えたあと、招待コードがある人は参加し、ない人はそのまま次へ進めます。
            </p>
          </div>

          <Card className="space-y-5 bg-white shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-700">チュートリアル</p>
                <h2 className="text-lg font-semibold text-slate-900">{stepTitle}</h2>
                <p className="text-sm leading-6 text-slate-500">
                  {tutorialStep === 'profile'
                    ? '表示名とアイコンを決めて、次へ進みます。'
                    : tutorialStep === 'invite'
                      ? '招待コードがある人は入力して参加します。'
                      : 'ここまで来たら、ダッシュボードへ進みます。'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {['プロフィール', '参加確認', '開始'].map((label, index) => (
                  <Badge key={label} variant={index === stepIndex ? 'brand' : 'neutral'}>
                    {index + 1}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-slate-950 transition-all duration-500"
                style={{ width: `${((stepIndex + 1) / 3) * 100}%` }}
              />
            </div>

            <div key={tutorialStep} className="alloca-scale-in space-y-5">
              {tutorialStep === 'profile' ? (
                <>
                  <div className="grid gap-5 lg:grid-cols-[auto_1fr] lg:items-center">
                    <div className="flex flex-col items-center gap-3">
                      <UserAvatar
                        src={avatarPreview}
                        name={displayName || meQuery.data.displayName}
                        className="h-24 w-24 rounded-[2rem] bg-white text-slate-700 ring-1 ring-slate-200 shadow-sm"
                        iconClassName="h-10 w-10"
                      />
                      <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                        <ImagePlus className="h-4 w-4" />
                        画像を選ぶ
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="hidden"
                          onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
                        />
                      </label>
                    </div>

                    <div className="space-y-3">
                      <label className="block space-y-2">
                        <span className="text-sm font-medium text-slate-700">表示名</span>
                        <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="文化祭 太郎" />
                      </label>
                      <p className="text-sm leading-6 text-slate-500">この名前はグループ、班、シフトに表示されます。あとから変更できます。</p>
                    </div>
                  </div>

                  {saveProfileMutation.error instanceof Error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{saveProfileMutation.error.message}</p> : null}

                  <div className="flex justify-end">
                    <Button onClick={() => saveProfileMutation.mutate()} disabled={!displayName.trim() || saveProfileMutation.isPending}>
                      {saveProfileMutation.isPending ? '保存中...' : '保存して次へ'}
                    </Button>
                  </div>
                </>
              ) : null}

              {tutorialStep === 'invite' ? (
                <>
                  <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">招待コード</span>
                      <Input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="ABC12345" />
                    </label>
                    <Button
                      onClick={() => acceptInviteMutation.mutate()}
                      disabled={acceptInviteMutation.isPending}
                      leftIcon={<Users className="h-4 w-4" />}
                    >
                      {acceptInviteMutation.isPending ? '確認中...' : 'コードで参加'}
                    </Button>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">コードがない場合</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      あとでグループのオーナーから招待コードを受け取れます。今は入力せず、案内だけ先に進めます。
                    </p>
                    <div className="mt-3 flex justify-end">
                      <Button variant="secondary" onClick={() => setSearchParams({ step: 'guide' })}>
                        コードはあとで入力
                      </Button>
                    </div>
                  </div>

                  {acceptInviteMutation.error instanceof Error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{acceptInviteMutation.error.message}</p> : null}
                </>
              ) : null}

              {tutorialStep === 'guide' ? (
                <>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-700 ring-1 ring-slate-200">
                        <CircleHelp className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-700">つかいかた</p>
                        <h3 className="text-base font-semibold text-slate-950">グループ → イベント → 班 → 作業</h3>
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      まずグループを作り、イベントを開きます。次に班を整理して、作業と予定を順番に整えると、シフトまで自然につながります。
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={() => finishMutation.mutate()} disabled={finishMutation.isPending}>
                      {finishMutation.isPending ? '準備中...' : 'ダッシュボードへ進む'}
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
