import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  CalendarRange,
  ChevronRight,
  FolderKanban,
  Home,
  LogOut,
  PanelLeft,
  Settings,
  WandSparkles,
} from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { api } from '@/lib/api'
import { clearTutorialCompletedLocally, isTutorialCompletedLocally } from '@/lib/onboarding'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { UserAvatar } from '@/components/ui/UserAvatar'

const navItems = [
  { to: '/dashboard', label: 'ホーム', icon: Home },
  { to: '/calendar', label: 'カレンダー', icon: CalendarDays },
  { to: '/groups', label: 'グループ', icon: FolderKanban },
  { to: '/events', label: 'イベント', icon: CalendarRange },
  { to: '/shifts/create', label: 'シフト', icon: WandSparkles },
]

export function AppLayout() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: api.auth.me,
    retry: false,
  })
  const groupsQuery = useQuery({
    queryKey: ['groups'],
    queryFn: api.groups.list,
    enabled: Boolean(meQuery.data),
    staleTime: 60_000,
  })
  const logoutMutation = useMutation({
    mutationFn: api.auth.logout,
    onSuccess: async () => {
      clearTutorialCompletedLocally()
      queryClient.clear()
      navigate('/', { replace: true })
    },
  })
  const logoutErrorMessage = logoutMutation.error instanceof Error ? logoutMutation.error.message : null

  useEffect(() => {
    if (meQuery.isLoading) {
      return
    }

    if (!meQuery.data) {
      navigate('/', { replace: true })
      return
    }

    if (!meQuery.data.tutorialCompletedAt && !isTutorialCompletedLocally()) {
      navigate('/signup', { replace: true })
    }
  }, [meQuery.data, meQuery.isLoading, navigate])

  if (meQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-slate-900">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
          <LoadingSpinner />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent text-slate-900 md:flex">
      <aside className="hidden w-72 border-r border-slate-200/80 bg-white/92 px-4 py-5 backdrop-blur md:flex md:flex-col">
        <div className="alloca-fade-up mb-7 flex items-center gap-3 px-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-sm font-semibold text-white shadow-sm">
            A
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight text-slate-950">Alloca</p>
            <p className="text-xs font-medium text-slate-500">Shift workspace</p>
          </div>
        </div>

        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    'group flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm font-semibold transition-all duration-200',
                    isActive
                      ? 'bg-slate-950 text-white shadow-sm'
                      : 'text-slate-600 hover:-translate-y-[1px] hover:bg-slate-100 hover:text-slate-950',
                  ].join(' ')
                }
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm ring-1 ring-slate-100 group-hover:text-slate-950">
                    <Icon className="h-4 w-4" />
                  </span>
                  {item.label}
                </span>
                <ChevronRight className="h-4 w-4 opacity-35" />
              </NavLink>
            )
          })}
        </nav>

        <div className="mt-7 flex items-center justify-between px-3">
          <p className="text-[11px] font-bold tracking-[0.12em] text-slate-400">グループ</p>
          <NavLink to="/groups" className="text-xs font-semibold text-slate-600 hover:text-slate-950">
            管理
          </NavLink>
        </div>
        <div className="mt-3 space-y-1.5">
          {groupsQuery.data?.slice(0, 5).map((group) => (
            <NavLink
              key={group.id}
              to={`/groups/${group.id}`}
              className={({ isActive }) =>
                [
                  'group flex items-center justify-between rounded-2xl px-3 py-2.5 text-sm transition-all duration-200',
                  isActive
                    ? 'bg-slate-950 text-white shadow-sm'
                    : 'text-slate-600 hover:-translate-y-[1px] hover:bg-slate-100 hover:text-slate-950',
                ].join(' ')
              }
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
                  {group.name.slice(0, 1)}
                </span>
                <span className="truncate font-medium">{group.name}</span>
              </span>
              <Badge variant={group.myRole === 'owner' ? 'brand' : 'neutral'}>
                {group.myRole === 'owner' ? 'オーナー' : 'メンバー'}
              </Badge>
            </NavLink>
          ))}
          {groupsQuery.data?.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
              まだグループがありません。
            </div>
          ) : null}
        </div>

        <div className="alloca-fade-up mt-auto space-y-4 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <UserAvatar
              src={meQuery.data?.avatarUrl}
              name={meQuery.data?.displayName}
              className="h-10 w-10 rounded-2xl bg-white text-slate-700 ring-1 ring-slate-200"
              iconClassName="h-5 w-5"
            />
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{meQuery.data?.displayName ?? '未ログイン'}</p>
              <p className="truncate text-sm text-slate-500">{meQuery.data?.email ?? 'アカウント情報を取得中'}</p>
            </div>
          </div>
          {meQuery.data ? (
            <div className="grid gap-2">
              <Link
                to="/settings/account"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-all duration-200 hover:-translate-y-[1px] hover:bg-slate-50"
              >
                <Settings className="h-4 w-4" />
                アカウント設定
              </Link>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => logoutMutation.mutate()}
                leftIcon={<LogOut className="h-4 w-4" />}
                disabled={logoutMutation.isPending}
              >
                {logoutMutation.isPending ? 'ログアウト中...' : 'ログアウト'}
              </Button>
              {logoutErrorMessage ? <p className="text-sm text-rose-600">ログアウトに失敗しました。もう一度お試しください。</p> : null}
            </div>
          ) : (
            <EmptyState title="ログインしてください" description="ログインするとグループやイベントが表示されます。" />
          )}
        </div>
      </aside>

      <main className="flex-1">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/86 backdrop-blur">
          <div className="flex items-center justify-between gap-4 px-4 py-3 md:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 shadow-sm md:hidden">
                <PanelLeft className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-600">Alloca</p>
              </div>
            </div>

            <Link
              to="/settings/account"
              className="flex max-w-[240px] items-center gap-3 rounded-2xl bg-slate-50 px-3 py-2 text-left ring-1 ring-slate-200 transition-all duration-200 hover:-translate-y-[1px] hover:bg-slate-100"
            >
              <UserAvatar
                src={meQuery.data?.avatarUrl}
                name={meQuery.data?.displayName}
                className="h-9 w-9 shrink-0 rounded-xl bg-white text-slate-700 ring-1 ring-slate-200"
                iconClassName="h-4 w-4"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-900">{meQuery.data?.displayName ?? '未ログイン'}</span>
                <span className="block truncate text-xs text-slate-500">{meQuery.data ? 'アカウント設定' : 'ログインしてください'}</span>
              </span>
            </Link>
          </div>
        </header>

        <div className="mx-auto max-w-7xl p-4 pb-24 md:p-7 md:pb-7">
          <Outlet />
        </div>

        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/95 px-2 py-2 backdrop-blur md:hidden">
          <div className="grid grid-cols-5 gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    [
                      'flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-[11px] font-semibold transition-all duration-200',
                      isActive ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100',
                    ].join(' ')
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              )
            })}
          </div>
        </nav>
      </main>
    </div>
  )
}
