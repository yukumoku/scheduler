import { CalendarDays, Sparkles, Users, WandSparkles } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { authRedirectUrl } from '@/lib/api'
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

const providers = [
  { key: 'google', label: 'Googleでログイン', href: authRedirectUrl('google') },
  { key: 'line', label: 'LINEでログイン', href: authRedirectUrl('line') },
] as const

export function LoginPage() {
  const location = useLocation()
  const errorMessage = new URLSearchParams(location.search).get('error')

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-8 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Alloca</p>
              <p className="text-sm text-slate-500">クラスのシフト管理</p>
            </div>
          </div>

          <div className="space-y-4">
            <Badge variant="brand">文化祭の夏休み管理</Badge>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 md:text-6xl">
              予定を集めて、
              <span className="block">そのまま整える。</span>
            </h1>
            <p className="max-w-xl text-base leading-7 text-slate-600 md:text-lg">
              グループ、イベント、班、シフトをひとつにまとめます。まずはGoogleかLINEで始めてください。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {providers.map((provider) => {
              const icon = provider.key === 'google' ? <GoogleIcon /> : <LineIcon />

              return (
                <a key={provider.key} href={provider.href} className="block w-full">
                  <Button variant="secondary" size="lg" className="w-full justify-center whitespace-nowrap px-5 text-sm sm:text-base" leftIcon={icon}>
                    {provider.label}
                  </Button>
                </a>
              )
            })}
          </div>
          <Link to="/signup" className="inline-flex w-full justify-center text-sm font-semibold text-slate-700 hover:text-slate-950 sm:w-auto sm:justify-start">
            初めて使う方は新規アカウント作成へ
          </Link>

          {errorMessage ? (
            <Card className="border-rose-200 bg-rose-50">
              <p className="text-sm font-medium text-rose-700">{errorMessage}</p>
            </Card>
          ) : null}

          <div className="grid gap-3 md:grid-cols-3">
            {[
              { icon: Users, label: '招待コードで参加' },
              { icon: CalendarDays, label: '予定入力を簡単に' },
              { icon: WandSparkles, label: 'シフトを出力' },
            ].map(({ icon: Icon, label }) => (
              <Card key={label} className="flex items-center gap-3 bg-slate-50">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-slate-700 ring-1 ring-slate-200">
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-sm font-medium text-slate-700">{label}</p>
              </Card>
            ))}
          </div>
        </section>

        <Card className="space-y-5 border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <div className="rounded-3xl bg-slate-50 p-6">
            <p className="text-sm font-semibold text-slate-700">まずできること</p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <li>・グループを見る</li>
              <li>・イベントを作る</li>
              <li>・予定を集める</li>
            </ul>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Card className="bg-slate-50">
              <p className="text-sm text-slate-500">設計の方向性</p>
              <p className="mt-2 text-lg font-semibold tracking-tight text-slate-950">やさしく、整理されたUI</p>
            </Card>
            <Card className="bg-slate-50">
              <p className="text-sm text-slate-500">対応端末</p>
              <p className="mt-2 text-lg font-semibold tracking-tight text-slate-950">スマホファースト</p>
            </Card>
          </div>
        </Card>
      </div>
    </div>
  )
}
