import { Component, type ErrorInfo, type ReactNode } from 'react'
import { EmptyState } from '@/components/ui/EmptyState'

type AppErrorBoundaryProps = {
  children: ReactNode
}

type AppErrorBoundaryState = {
  hasError: boolean
  message: string
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      message: '予期しないエラーが発生しました。',
    }
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || '予期しないエラーが発生しました。',
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return <EmptyState title="画面を表示できません" description={this.state.message} />
    }

    return this.props.children
  }
}
