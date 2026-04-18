import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-lg mx-auto mt-20 animate-fade-in">
          <Card>
            <div className="text-center space-y-4 py-4">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <span className="text-2xl text-red-400">!</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-200 mb-1">Something went wrong</h2>
                <p className="text-sm text-gray-500">An unexpected error occurred.</p>
              </div>
              {this.state.error && (
                <pre className="text-xs text-gray-600 bg-wow-darker/80 rounded-lg px-4 py-3 text-left overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              )}
              <Button
                variant="secondary"
                onClick={() => {
                  this.setState({ hasError: false, error: undefined })
                  window.location.href = '/'
                }}
              >
                Back to Home
              </Button>
            </div>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
