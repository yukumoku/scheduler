import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Settings2, SlidersHorizontal } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '@/lib/api'
import type { ShiftGenerationSetting, ShiftRule } from '@/types/api'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'

const shiftRuleSchema = z.object({
  slotMinutes: z.coerce.number().int().min(15).max(1440),
  minWorkMinutes: z.coerce.number().int().min(0).max(1440),
  maxWorkMinutes: z.coerce.number().int().min(0).max(1440),
  maxContinuousMinutes: z.coerce.number().int().min(0).max(1440),
  breakMinutes: z.coerce.number().int().min(0).max(1440),
  leaderRequiredPerSlot: z.coerce.number().int().min(0).max(100),
})

const generationSchema = z.object({
  preferenceWeight: z.coerce.number().int().min(0).max(100),
  fairnessWeight: z.coerce.number().int().min(0).max(100),
  balanceWorkloadWeight: z.coerce.number().int().min(0).max(100),
  avoidContinuousWorkWeight: z.coerce.number().int().min(0).max(100),
  leaderAssignmentWeight: z.coerce.number().int().min(0).max(100),
  requiredPeopleWeight: z.coerce.number().int().min(0).max(100),
})

type ShiftRuleFormValues = z.infer<typeof shiftRuleSchema>
type GenerationFormValues = z.infer<typeof generationSchema>

const defaultShiftRule: ShiftRuleFormValues = {
  slotMinutes: 60,
  minWorkMinutes: 0,
  maxWorkMinutes: 0,
  maxContinuousMinutes: 0,
  breakMinutes: 0,
  leaderRequiredPerSlot: 0,
}

const defaultGeneration: GenerationFormValues = {
  preferenceWeight: 50,
  fairnessWeight: 50,
  balanceWorkloadWeight: 50,
  avoidContinuousWorkWeight: 50,
  leaderAssignmentWeight: 50,
  requiredPeopleWeight: 50,
}

const weightFields: Array<{ name: keyof GenerationFormValues; label: string; description: string }> = [
  { name: 'preferenceWeight', label: '希望提出重み', description: '参加希望をどの程度優先するか' },
  { name: 'fairnessWeight', label: '公平性重み', description: '偏りをどの程度抑えるか' },
  { name: 'balanceWorkloadWeight', label: '負荷分散重み', description: '担当数のばらつきをどの程度抑えるか' },
  { name: 'avoidContinuousWorkWeight', label: '連続勤務回避重み', description: '連続勤務の回避をどの程度優先するか' },
  { name: 'leaderAssignmentWeight', label: 'リーダー配置重み', description: 'リーダー条件をどの程度優先するか' },
  { name: 'requiredPeopleWeight', label: '必要人数重み', description: '必要人数充足をどの程度優先するか' },
]

export function ShiftSettingsPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const eventQuery = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => api.events.show(eventId ?? ''),
    enabled: Boolean(eventId),
  })

  const shiftRuleQuery = useQuery({
    queryKey: ['event', eventId, 'shift-rule'],
    queryFn: () => api.events.shiftRule(eventId ?? ''),
    enabled: Boolean(eventId),
  })

  const generationQuery = useQuery({
    queryKey: ['event', eventId, 'generation-settings'],
    queryFn: () => api.events.generationSettings(eventId ?? ''),
    enabled: Boolean(eventId),
  })

  const shiftRuleForm = useForm<ShiftRuleFormValues>({
    resolver: zodResolver(shiftRuleSchema),
    defaultValues: defaultShiftRule,
  })

  const generationForm = useForm<GenerationFormValues>({
    resolver: zodResolver(generationSchema),
    defaultValues: defaultGeneration,
  })

  useEffect(() => {
    if (shiftRuleQuery.data) {
      shiftRuleForm.reset({
        slotMinutes: shiftRuleQuery.data.slotMinutes,
        minWorkMinutes: shiftRuleQuery.data.minWorkMinutes,
        maxWorkMinutes: shiftRuleQuery.data.maxWorkMinutes,
        maxContinuousMinutes: shiftRuleQuery.data.maxContinuousMinutes,
        breakMinutes: shiftRuleQuery.data.breakMinutes,
        leaderRequiredPerSlot: shiftRuleQuery.data.leaderRequiredPerSlot,
      })
    }
  }, [shiftRuleQuery.data, shiftRuleForm])

  useEffect(() => {
    if (generationQuery.data) {
      generationForm.reset({
        preferenceWeight: generationQuery.data.preferenceWeight,
        fairnessWeight: generationQuery.data.fairnessWeight,
        balanceWorkloadWeight: generationQuery.data.balanceWorkloadWeight,
        avoidContinuousWorkWeight: generationQuery.data.avoidContinuousWorkWeight,
        leaderAssignmentWeight: generationQuery.data.leaderAssignmentWeight,
        requiredPeopleWeight: generationQuery.data.requiredPeopleWeight,
      })
    }
  }, [generationQuery.data, generationForm])

  const updateShiftRuleMutation = useMutation({
    mutationFn: (values: ShiftRuleFormValues) => api.events.updateShiftRule(eventId ?? '', values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['event', eventId, 'shift-rule'] })
    },
  })

  const updateGenerationMutation = useMutation({
    mutationFn: (values: GenerationFormValues) => api.events.updateGenerationSettings(eventId ?? '', values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['event', eventId, 'generation-settings'] })
    },
  })

  if (!eventId) {
    return <EmptyState title="イベントが見つかりません" description="URLを確認してください。" />
  }

  if (eventQuery.isLoading || shiftRuleQuery.isLoading || generationQuery.isLoading) {
    return <p className="p-6 text-sm text-slate-500">読み込み中...</p>
  }

  const errorMessage =
    eventQuery.error instanceof Error
      ? eventQuery.error.message
      : shiftRuleQuery.error instanceof Error
        ? shiftRuleQuery.error.message
        : generationQuery.error instanceof Error
          ? generationQuery.error.message
          : null

  if (errorMessage) {
    return <EmptyState title="シフト設定を表示できません" description={errorMessage} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${eventQuery.data?.name ?? 'イベント'} のシフト設定`}
        description="シフトの基本条件と最適化重みを設定できます。"
        action={
          <Button variant="ghost" onClick={() => navigate(`/events/${eventId}`)} leftIcon={<ArrowLeft className="h-4 w-4" />}>
            イベント詳細へ戻る
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-3">
        <Card className="bg-slate-50">
          <p className="text-sm text-slate-500">設定状態</p>
          <div className="mt-2">
            <Badge variant="brand">編集可能</Badge>
          </div>
        </Card>
        <Card className="bg-slate-50">
          <p className="text-sm text-slate-500">基本条件</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{shiftRuleForm.watch('slotMinutes')}分単位</p>
        </Card>
        <Card className="bg-slate-50">
          <p className="text-sm text-slate-500">重み設定</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">6項目</p>
        </Card>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card className="space-y-5">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-violet-600" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">シフト基本条件</h2>
              <p className="text-sm text-slate-500">シフトの時間と勤務条件を設定します。</p>
            </div>
          </div>

          <form
            className="space-y-4"
            onSubmit={shiftRuleForm.handleSubmit((values) => updateShiftRuleMutation.mutate(values))}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">枠の長さ（分）</span>
                <Input type="number" min={15} {...shiftRuleForm.register('slotMinutes', { valueAsNumber: true })} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">休憩時間（分）</span>
                <Input type="number" min={0} {...shiftRuleForm.register('breakMinutes', { valueAsNumber: true })} />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">最小勤務時間（分）</span>
                <Input type="number" min={0} {...shiftRuleForm.register('minWorkMinutes', { valueAsNumber: true })} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">最大勤務時間（分）</span>
                <Input type="number" min={0} {...shiftRuleForm.register('maxWorkMinutes', { valueAsNumber: true })} />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">最大連続勤務時間（分）</span>
                <Input type="number" min={0} {...shiftRuleForm.register('maxContinuousMinutes', { valueAsNumber: true })} />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">1枠あたり必要リーダー人数</span>
                <Input type="number" min={0} {...shiftRuleForm.register('leaderRequiredPerSlot', { valueAsNumber: true })} />
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="submit" disabled={updateShiftRuleMutation.isPending}>
                {updateShiftRuleMutation.isPending ? '保存中...' : '基本条件を保存'}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="space-y-5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-5 w-5 text-violet-600" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">最適化重み設定</h2>
              <p className="text-sm text-slate-500">優先したい考え方を数値で調整します。</p>
            </div>
          </div>

          <form
            className="space-y-4"
            onSubmit={generationForm.handleSubmit((values) => updateGenerationMutation.mutate(values))}
          >
            {weightFields.map((field) => (
              <label key={field.name} className="block space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-slate-700">{field.label}</span>
                  <Badge variant="neutral">{generationForm.watch(field.name)}%</Badge>
                </div>
                <Input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  {...generationForm.register(field.name, { valueAsNumber: true })}
                />
                <p className="text-xs text-slate-500">{field.description}</p>
              </label>
            ))}

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="submit" disabled={updateGenerationMutation.isPending}>
                {updateGenerationMutation.isPending ? '保存中...' : '重みを保存'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
