import { useQuery } from '@tanstack/react-query'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { CalendarDays, CheckCircle2, Sparkles, Users, WandSparkles } from 'lucide-react'
import { api, authRedirectUrl } from '@/lib/api'
import { isTutorialCompletedLocally } from '@/lib/onboarding'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

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

const steps = [
  'グループを作る',
  'イベントを作る',
  '班と作業を整理する',
  'シフトを作成して共有する',
]

export function HomePage() {
  const location = useLocation()
  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: api.auth.me,
    retry: false,
  })
  const errorMessage = new URLSearchParams(location.search).get('error')

  if (meQuery.data) {
    return <Navigate to={meQuery.data.tutorialCompletedAt || isTutorialCompletedLocally() ? '/dashboard' : '/signup'} replace />
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl items-center gap-6 lg:grid-cols-[1fr_0.92fr]">
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-slate-950">Alloca</p>
              <p className="text-sm text-slate-500">クラスのシフト管理</p>
            </div>
          </div>

          <div className="space-y-4">
            <Badge variant="brand">文化祭・部活・団体運営向け</Badge>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-950 md:text-6xl">
              予定集めからシフト作成まで、
              <span className="block">迷わず進める管理画面。</span>
            </h1>
            <p className="max-w-2xl text-base leading-8 text-slate-600 md:text-lg">
              Allocaは、イベントごとに班・作業を整理して、シフトを作れるサービスです。
              次にやることが見えるように、画面をできるだけシンプルにしています。
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/signup">
              <Button size="lg" className="w-full sm:w-auto">
                新規アカウント作成
              </Button>
            </Link>
            <a href={authRedirectUrl('google')}>
              <Button variant="secondary" size="lg" className="w-full sm:w-auto" leftIcon={<GoogleIcon />}>
                Googleでログイン
              </Button>
            </a>
            <a href={authRedirectUrl('line')}>
              <Button variant="secondary" size="lg" className="w-full sm:w-auto" leftIcon={<LineIcon />}>
                LINEでログイン
              </Button>
            </a>
          </div>

          {errorMessage ? (
            <Card className="border-rose-200 bg-rose-50">
              <p className="text-sm font-medium text-rose-700">{errorMessage}</p>
            </Card>
          ) : null}
        </section>

        <Card className="space-y-5 bg-white p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="rounded-[2rem] bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-700">使い方はシンプル</p>
            <div className="mt-4 space-y-3">
              {steps.map((step) => (
                <div key={step} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
                  <CheckCircle2 className="h-4 w-4 text-slate-700" />
                  <span className="text-sm font-medium text-slate-700">{step}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { icon: Users, label: '招待コードで参加' },
              { icon: CalendarDays, label: '予定入力を簡単に' },
              { icon: WandSparkles, label: 'シフトを出力' },
            ].map(({ icon: Icon, label }) => (
              <Card key={label} className="bg-slate-50">
                <Icon className="h-5 w-5 text-slate-700" />
                <p className="mt-3 text-sm font-semibold text-slate-800">{label}</p>
              </Card>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
