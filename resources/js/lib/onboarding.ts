const TUTORIAL_COMPLETED_KEY = 'alloca_tutorial_completed'
const EVENT_GUIDE_HIDDEN_KEY = 'alloca_event_guide_hidden'

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function isTutorialCompletedLocally(): boolean {
  if (!canUseStorage()) {
    return false
  }

  return window.localStorage.getItem(TUTORIAL_COMPLETED_KEY) === '1'
}

export function markTutorialCompletedLocally(): void {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.setItem(TUTORIAL_COMPLETED_KEY, '1')
}

export function clearTutorialCompletedLocally(): void {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.removeItem(TUTORIAL_COMPLETED_KEY)
}

export function isEventGuideHiddenLocally(): boolean {
  if (!canUseStorage()) {
    return false
  }

  return window.localStorage.getItem(EVENT_GUIDE_HIDDEN_KEY) === '1'
}

export function hideEventGuideLocally(): void {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.setItem(EVENT_GUIDE_HIDDEN_KEY, '1')
}

export function clearEventGuideHiddenLocally(): void {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.removeItem(EVENT_GUIDE_HIDDEN_KEY)
}
