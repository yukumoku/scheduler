import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, Plus, Trash2, Users } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { PageGuide } from '@/components/ui/PageGuide'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ActionMenu } from '@/components/ui/ActionMenu'

const groupSchema = z.object({
  name: z.string().min(1, 'グループ名を入力してください').max(255),
  description: z.string().max(1000).optional().transform((value) => value?.trim() || ''),
})
const joinSchema = z.object({
  code: z.string().min(1, '招待コードを入力してください').max(32).transform((value) => value.trim().toUpperCase()),
})

type GroupFormValues = z.infer<typeof groupSchema>
type JoinFormValues = z.infer<typeof joinSchema>

export function GroupsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: api.groups.list,
  })
  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  })
  const joinForm = useForm<JoinFormValues>({
    resolver: zodResolver(joinSchema),
    defaultValues: {
      code: '',
    },
  })

  const createMutation = useMutation({
    mutationFn: (values: GroupFormValues) =>
      api.groups.create({
        name: values.name,
        description: values.description || null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['groups'] })
      setOpen(false)
      form.reset()
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (groupId: string) => api.groups.delete(groupId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['groups'] })
    },
  })
  const joinMutation = useMutation({
    mutationFn: (values: JoinFormValues) => api.invitations.acceptByCode(values.code),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['groups'] })
      await queryClient.invalidateQueries({ queryKey: ['group', result.groupId] })
      await queryClient.invalidateQueries({ queryKey: ['group', result.groupId, 'members'] })
      await queryClient.invalidateQueries({ queryKey: ['group', result.groupId, 'common-availability-sets'] })
      await queryClient.invalidateQueries({ queryKey: ['common-availability-set'] })
      setJoinOpen(false)
      joinForm.reset()
      navigate(`/groups/${result.groupId}`)
    },
  })

  const groups = groupsQuery.data ?? []

  return (
    <div className="space-y-4">
      <PageHeader
        title="グループ"
        description="活動スペースを選びます。"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setJoinOpen(true)}>
              招待コードで参加
            </Button>
            <Button onClick={() => setOpen(true)} leftIcon={<Plus className="h-4 w-4" />}>
              グループを作成
            </Button>
          </div>
        }
      />

      <PageGuide
        title="簡単ステップ"
        description="まずは参加する場所を選びます。"
        items={[
          { title: '作る', description: '新しい活動スペースを作成します。' },
          { title: '参加', description: '招待コードで入ります。' },
          { title: '開く', description: 'イベントへ進みます。' },
        ]}
      />

      <Card className="space-y-4">
        {groups.length ? (
          <div className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {groups.map((group) => (
              <div key={group.id} className="flex flex-col gap-4 p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center">
                <Link to={`/groups/${group.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-base font-bold text-violet-700 ring-1 ring-slate-200">
                    {group.name.slice(0, 1)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold tracking-tight text-slate-950">{group.name}</p>
                    {group.description ? <p className="mt-1 line-clamp-1 text-sm text-slate-500">{group.description}</p> : null}
                  </div>
                </Link>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <Badge variant={group.myRole === 'owner' ? 'brand' : 'neutral'}>
                    {group.myRole === 'owner' ? 'オーナー' : 'メンバー'}
                  </Badge>
                  <Badge variant="neutral">
                    <Users className="mr-1 h-3.5 w-3.5" />
                    {group.memberCount}人
                  </Badge>
                  <ActionMenu
                    triggerLabel={`${group.name}の操作`}
                    items={[
                      {
                        label: 'グループを開く',
                        icon: <Eye className="h-4 w-4" />,
                        onClick: () => navigate(`/groups/${group.id}`),
                      },
                      {
                        label: 'グループを削除',
                        icon: <Trash2 className="h-4 w-4" />,
                        danger: true,
                        disabled: group.myRole !== 'owner',
                        onClick: () => {
                          if (window.confirm(`「${group.name}」を削除しますか？イベントなどの関連データも一緒に削除されます。`)) {
                            deleteMutation.mutate(group.id)
                          }
                        },
                      },
                    ]}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="グループがまだありません"
            description="作成するか、招待コードで参加します。"
            actionLabel="グループを作成"
            onAction={() => setOpen(true)}
          />
        )}
        {deleteMutation.error ? <p className="text-sm text-rose-600">グループを削除できませんでした。権限を確認してください。</p> : null}
      </Card>

      <Modal title="グループを作成" open={open} onClose={() => setOpen(false)}>
        <form className="space-y-4" onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">グループ名</span>
            <Input {...form.register('name')} placeholder="文化祭実行委員会" />
            {form.formState.errors.name ? <p className="text-sm text-rose-600">{form.formState.errors.name.message}</p> : null}
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">説明</span>
            <Textarea {...form.register('description')} placeholder="2026年度文化祭の準備グループ" />
          </label>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              作成
            </Button>
          </div>
          {createMutation.error ? (
            <p className="text-sm text-rose-600">グループの作成に失敗しました。認証状態を確認してください。</p>
          ) : null}
        </form>
      </Modal>

      <Modal title="招待コードで参加" open={joinOpen} onClose={() => setJoinOpen(false)}>
        <form className="space-y-4" onSubmit={joinForm.handleSubmit((values) => joinMutation.mutate(values))}>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="text-sm font-semibold text-slate-900">コードで参加</p>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">招待コード</span>
            <Input
              {...joinForm.register('code')}
              placeholder="例: A1B2C3D4"
              className="font-mono text-base tracking-[0.2em] uppercase"
            />
            {joinForm.formState.errors.code ? <p className="text-sm text-rose-600">{joinForm.formState.errors.code.message}</p> : null}
          </label>

          {joinMutation.error instanceof Error ? (
            <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {joinMutation.error.message || '参加できませんでした。コードや期限を確認してください。'}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setJoinOpen(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={joinMutation.isPending}>
              {joinMutation.isPending ? '参加中...' : '参加する'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
