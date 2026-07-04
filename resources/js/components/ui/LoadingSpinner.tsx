export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8" aria-label="読み込み中">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
    </div>
  )
}
