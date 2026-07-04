import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './layouts/AppLayout'
import { HomePage } from './pages/HomePage'
import { SignupPage } from './pages/SignupPage'
import { TutorialPage } from './pages/TutorialPage'
import { DashboardPage } from './pages/DashboardPage'
import { GroupsPage } from './pages/GroupsPage'
import { GroupDetailPage } from './pages/GroupDetailPage'
import { TeamDetailPage } from './pages/TeamDetailPage'
import { EventsPage } from './pages/EventsPage'
import { CalendarPage } from './pages/CalendarPage'
import { EventDetailPage } from './pages/EventDetailPage'
import { ShiftSettingsPage } from './pages/ShiftSettingsPage'
import { ShiftCreatePage } from './pages/ShiftCreatePage'
import { ShiftDetailPage } from './pages/ShiftDetailPage'
import { AccountSettingsPage } from './pages/AccountSettingsPage'
import { InvitationAcceptPage } from './pages/InvitationAcceptPage'
import { CommonAvailabilitySetPage } from './pages/CommonAvailabilitySetPage'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import '../css/app.css'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<HomePage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/tutorial" element={<TutorialPage />} />
      <Route path="/invite/:token" element={<InvitationAcceptPage />} />
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/groups/:groupId" element={<GroupDetailPage />} />
        <Route path="/teams/:teamId" element={<TeamDetailPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/events/:eventId" element={<EventDetailPage />} />
        <Route path="/events/:eventId/shift-settings" element={<ShiftSettingsPage />} />
        <Route path="/shifts/create" element={<ShiftCreatePage />} />
        <Route path="/shifts/:shiftId" element={<ShiftDetailPage />} />
        <Route path="/availability-sets/:setId" element={<CommonAvailabilitySetPage />} />
        <Route path="/settings/account" element={<AccountSettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

const queryClient = new QueryClient()
const root = document.getElementById('root')

if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </AppErrorBoundary>
    </React.StrictMode>,
  )
}
