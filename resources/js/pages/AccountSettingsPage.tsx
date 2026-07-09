import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ImagePlus, Save, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { resizeAvatarFile } from '@/lib/image'
import { clearTutorialCompletedLocally } from '@/lib/onboarding'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { UserAvatar } from '@/components/ui/UserAvatar'

const accountSchema = z.object({
  displayName: z.string().min(1, '表示名を入力してください').max(255),
  avatarUrl: z.string().optional().transform((value) => value?.trim() || ''),
})

type AccountFormValues = z.infer<typeof accountSchema>

export function AccountSettingsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: api.auth.me,
    retry: false,
  })
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      displayName: '',
      avatarUrl: '',
    },
  })

  useEffect(() => {
    if (meQuery.data) {
      form.reset({
        displayName: meQuery.data.displayName ?? '',
        avatarUrl: meQuery.data.avatarUrl ?? '',
      })
    }
  }, [form, meQuery.data])

  const updateMutation = useMutation({
    mutationFn: (values: AccountFormValues) =>
      api.auth.updateProfile({
        displayName: values.displayName,
        avatarUrl: values.avatarUrl || null,
        avatar: avatarFile,
      }),
    onSuccess: async (user) => {
      setAvatarFile(null)
      queryClient.setQueryData(['auth', 'me'], user)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: () => api.auth.deleteMe(),
    onSuccess: async () => {
      clearTutorialCompletedLocally()
      queryClient.clear()
      navigate('/', { replace: true })
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

  if (meQuery.isError) {
    return <EmptyState title="ログインが必要です" description="アカウント設定を開くにはログインしてください。" />
  }

  return (
    <div className="space-y-6">
      <PageHeader title="アカウント設定" description="表示名とアイコンを変更できます。" />

      <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
        <Card>
          <form className="space-y-4" onSubmit={form.handleSubmit((values) => updateMutation.mutate(values))}>
            <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-slate-50/70 p-4 sm:flex-row sm:items-center">
              <UserAvatar
                src={avatarPreview}
                name={meQuery.data?.displayName}
                className="h-20 w-20 shrink-0 rounded-3xl bg-white text-slate-700 ring-1 ring-slate-200"
                iconClassName="h-9 w-9"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="font-semibold text-slate-900">プロフィール画像</p>
                <p className="text-sm text-slate-500">JPG / PNG / WebP / GIF をアップロードできます。</p>
                <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                  <ImagePlus className="h-4 w-4" />
                  画像を選択
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
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">表示名</span>
              <Input {...form.register('displayName')} placeholder="山田 太郎" />
              {form.formState.errors.displayName ? <p className="text-sm text-rose-600">{form.formState.errors.displayName.message}</p> : null}
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">アイコンURL</span>
              <Input {...form.register('avatarUrl')} placeholder="https://example.com/avatar.png" />
              <p className="text-sm text-slate-500">URL指定もできます。画像を選択した場合はアップロード画像が優先されます。</p>
            </label>

            {updateMutation.isSuccess ? <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">保存しました。</p> : null}
            {updateMutation.error instanceof Error ? <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{updateMutation.error.message}</p> : null}

            <div className="flex justify-end">
              <Button type="submit" leftIcon={<Save className="h-4 w-4" />} disabled={updateMutation.isPending || meQuery.isLoading}>
                保存
              </Button>
            </div>
          </form>
        </Card>

        <Card className="space-y-4 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <UserAvatar
              src={meQuery.data?.avatarUrl}
              name={meQuery.data?.displayName}
              className="h-12 w-12 rounded-2xl bg-white text-slate-700 ring-1 ring-slate-200"
              iconClassName="h-6 w-6"
            />
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{meQuery.data?.displayName ?? '読み込み中'}</p>
              <p className="truncate text-sm text-slate-500">プロフィール</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="brand">{meQuery.data?.provider ?? 'ログイン'}</Badge>
            <Badge variant="neutral">プロフィール</Badge>
          </div>
          <p className="text-sm leading-6 text-slate-600">ここで変更した表示名は、グループやシフトのメンバー表示に使われます。</p>
        </Card>

        <Card className="space-y-4 border-rose-100 bg-rose-50/60 lg:col-span-2">
          <div>
            <p className="text-sm font-semibold text-rose-700">危険な操作</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">アカウントを削除</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              アカウントを削除すると、プロフィール、所属情報、シフト関連データへの参照が消えます。元に戻せません。
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              迷っている場合は、先に表示名やアイコンだけを整えるのがおすすめです。
            </p>
            <Button
              variant="danger"
              leftIcon={<Trash2 className="h-4 w-4" />}
              onClick={() => {
                if (window.confirm('本当にアカウントを削除しますか？この操作は取り消せません。')) {
                  deleteMutation.mutate()
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? '削除中...' : 'アカウントを削除'}
            </Button>
          </div>
          {deleteMutation.error instanceof Error ? (
            <p className="rounded-xl bg-rose-100 px-4 py-3 text-sm text-rose-700">
              アカウントを削除できませんでした。しばらくしてからもう一度お試しください。
            </p>
          ) : null}
        </Card>
      </div>
    </div>
  )
}
