import { Component } from 'react'
import { TriangleAlert } from 'lucide-react'
import { recoverFromChunkError, looksLikeChunkError } from '../lib/recovery'
import { Button } from './ui/Button'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
    this.autoRecoverTimer = null
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('App crash:', error, info.componentStack)
    if (looksLikeChunkError(error?.message)) {
      this.autoRecoverTimer = setTimeout(() => {
        recoverFromChunkError()
      }, 800)
    }
  }

  componentWillUnmount() {
    if (this.autoRecoverTimer) clearTimeout(this.autoRecoverTimer)
  }

  // A plain reload, always. recoverFromChunkError is capped (3 resets per
  // window) and fires once per page, so routing the button through it left a
  // button that did nothing once that budget was spent.
  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-ground px-5">
          <div className="flex w-full max-w-sm flex-col items-center text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-danger-tile">
              <TriangleAlert size={30} aria-hidden="true" className="text-danger-ink" />
            </div>
            <h1 className="font-heading text-xl font-bold text-ink">Something went wrong</h1>
            <p className="mt-1.5 text-sm text-ink-2">
              {this.state.error?.message || 'The app hit an error it could not recover from.'}
            </p>
            <Button onClick={this.handleReload} className="mt-5 bg-ink">Reload the app</Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
