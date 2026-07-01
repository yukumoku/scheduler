import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/groups', label: 'Groups' },
  { to: '/events', label: 'Events' },
  { to: '/availability', label: 'Availability' },
  { to: '/shifts/create', label: 'Shift Create' },
]

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 md:flex">
      <aside className="hidden w-64 border-r bg-white p-6 md:block">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-600">ScheduleCraft</p>
          <h1 className="mt-2 text-xl font-bold">イベント運営の土台</h1>
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => (
            <NavLink key={item.to} to={item.to} className="block rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-brand-50 hover:text-brand-700">
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1">
        <header className="border-b bg-white px-4 py-3 md:px-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">現在のグループ</p>
              <p className="font-semibold">未選択</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-brand-100" />
          </div>
        </header>
        <div className="mx-auto max-w-6xl p-4 md:p-6">
          <Outlet />
        </div>
        <nav className="sticky bottom-0 border-t bg-white px-2 py-2 md:hidden">
          <div className="grid grid-cols-5 gap-1 text-center text-xs">
            {navItems.slice(0, 5).map((item) => (
              <NavLink key={item.to} to={item.to} className="rounded-lg py-2 text-slate-600 data-[state=active]:bg-brand-50">
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </main>
    </div>
  )
}
