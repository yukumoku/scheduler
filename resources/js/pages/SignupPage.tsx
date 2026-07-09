import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ImagePlus, Sparkles } from 'lucide-react'
import { api, authRedirectUrl } from '@/lib/api'
import { resizeAvatarFile } from '@/lib/image'
import { isTutorialCompletedLocally } from '@/lib/onboarding'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { UserAvatar } from '@/components/ui/UserAvatar'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.6c-.2 1.2-.9 2.2-1.8 2.9v2.4h2.9c1.7-1.6 3.1-4 3.1-7.1Z" />
      <path fill="#34A853" d="M12 22c2.4 0 4.4-.8 5.9-2.2l-2.9-2.4c-.8.5-1.8.8-3 .8-2.3 0-4.2-1.5-4.9-3.5H4.1v2.5C5.5 20 8.5 22 12 22Z" />
      <path fill="#FBBC05" d="M7.1 14.7c-.2-.7-.4-1.4-.4-2.2s.1-1.5.4-2.2V7.8H4.1C3.4 9.2 3 10.6 3 12s.4 2.8 1.1 4.2l3-1.5Z" />
      <path fill="#EA4335" d="M12 6.1c1.3 0 2.4.5 3.4 1.3l2.5-2.5C16.4 3.5 14.4 2.5 12 2.5 8.5 2.5 5.5 4.5 4.1 7.8l3 2.5C7.8 7.6 9.7 6.1 12 6.1Z" />
    </svg>
  )
}

function LineIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" focusable="false">
      <path
        fill="#06C755"
        d="M12 3C6.486 3 2 6.613 2 11.066c0 2.51 1.56 4.82 4.06 6.33l-.68 2.514a.68.68 0 0 0 1.006.77l2.998-1.87c.48.07.97.105 1.616.105 5.514 0 10-3.613 10-8.066C22 6.613 17.514 3 12 3Zm-3.2 9.8H7.1a.4.4 0 0 1-.4-.4V9a.9.9 0 1 1 1.8 0v2.8a.4.4 0 0 1-.4.4Zm4.1 0h-1.7a.4.4 0 0 1-.4-.4V9a.9.9 0 1 1 1.8 0v2.8a.4.4 0 0 1-.4.4Zm4.1 0h-1.7a.4.4 0 0 1-.4-.4V9a.9.9 0 1 1 1.8 0v2.8a.4.4 0 0 1-.4.4Z"
      />
    </svg>
  )
}

export function SignupPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
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

  const saveProfileMutation = useMutation({
    mutationFn: () =>
      api.auth.updateProfile({
        displayName: displayName.trim(),
        avatar: avatarFile,
      }),
    onSuccess: async (user) => {
      queryClient.setQueryData(['auth', 'me'], user)
      navigate('/tutorial?step=invite', { replace: true })
    },
  })

  const avatarPreview = useMemo(() => {
    if (avatarFile) {
      return URL.createObjectURL(avatarFile)
    }

    return meQuery.data?.avatarUrl ?? null
  }, [avatarFile, meQuery.data?.avatarUrl])

  const handleAvatarChange = async (file: File | null) => {
    setAvatarError(null)
    if (!file) {
      setAvatarFile(null)
      return
    }

    try {
      setAvatarFile(await resizeAvatarFile(file))
    } catch (error) {
      setAvatarFile(null)
      setAvatarError(error instanceof Error ? error.message : '画像を読み込めませんでした。')
    }
  }

  if (meQuery.data) {
    if (meQuery.data.tutorialCompletedAt || isTutorialCompletedLocally()) {
      return <Navigate to="/dashboard" replace />
    }
  }

  if (!meQuery.data) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center">
          <div className="w-full space-y-4">
            <Card className="space-y-6 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Allocaを始める</p>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-950">アカウント作成</h1>
                </div>
              </div>

              <p className="text-sm leading-7 text-slate-600">
                まずはログイン方法を選びます。ログインが終わったら、名前とアイコンを整えて、チュートリアルへ進みます。
              </p>

              <div className="grid gap-3">
                <a href={authRedirectUrl('google')}>
                  <Button className="w-full" leftIcon={<GoogleIcon />}>
                    Googleで始める
                  </Button>
                </a>
                <a href={authRedirectUrl('line')}>
                  <Button variant="secondary" className="w-full" leftIcon={<LineIcon />}>
                    LINEで始める
                  </Button>
                </a>
                <Link to="/" className="text-center text-sm font-medium text-violet-700 hover:text-violet-800">
                  ログイン画面に戻る
                </Link>
              </div>
            </Card>

            <Card className="space-y-3 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">流れ</p>
                  <h2 className="text-lg font-semibold text-slate-900">1つずつ、静かに進みます</h2>
                </div>
                <Badge variant="brand">1 / 2</Badge>
              </div>
              <div className="grid gap-2">
                {['ログイン方法を選ぶ', '次の画面で名前とアイコンを決める', 'チュートリアルを進める'].map((item) => (
                  <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    {item}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center">
        <Card className="w-full space-y-5 p-5">
          <div>
            <p className="text-sm font-semibold text-slate-700">最初の設定</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">プロフィールを決めましょう</h1>
            <p className="mt-2 text-sm leading-7 text-slate-600">グループやシフトで表示される名前とアイコンです。あとから変更できます。</p>
          </div>

          <div className="grid gap-5 lg:grid-cols-[auto_1fr] lg:items-center">
            <div className="flex flex-col items-center gap-3">
              <UserAvatar
                src={avatarPreview}
                name={displayName || meQuery.data.displayName}
                className="h-28 w-28 rounded-[2rem] bg-white text-slate-700 shadow-lg shadow-slate-200/60 ring-1 ring-slate-200"
                iconClassName="h-10 w-10"
              />
              <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:bg-slate-50">
                <ImagePlus className="h-4 w-4" />
                画像を選ぶ
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(event) => void handleAvatarChange(event.target.files?.[0] ?? null)}
                />
              </label>
              {avatarError ? <p className="text-sm text-rose-600">{avatarError}</p> : null}
              {avatarFile ? <p className="text-sm text-slate-500">保存しやすいサイズに調整しました。</p> : null}
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

          <Button onClick={() => saveProfileMutation.mutate()} className="w-full" disabled={!displayName.trim() || saveProfileMutation.isPending}>
            {saveProfileMutation.isPending ? '保存中...' : '保存して次へ'}
          </Button>
        </Card>
      </div>
    </div>
  )
}
