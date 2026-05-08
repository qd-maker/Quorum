/**
 * 全局错误边界 — 捕获 React 渲染异常，避免白屏
 * 提供「重试」和「回到首页」两个恢复路径
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
    children: ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        // eslint-disable-next-line no-console
        console.error('[ErrorBoundary]', error, info)
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null })
    }

    handleGoHome = () => {
        window.location.href = '/'
    }

    render() {
        if (!this.state.hasError) return this.props.children

        return (
            <div className="min-h-screen flex items-center justify-center bg-bg-0 p-6">
                <div className="max-w-md w-full bg-bg-2/80 backdrop-blur-md rounded-2xl border border-white/8 p-8 text-center shadow-2xl">
                    <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-500/15 flex items-center justify-center">
                        <AlertTriangle className="w-7 h-7 text-red-400" />
                    </div>
                    <h2 className="text-xl font-semibold text-text-1 mb-2">
                        哎呀，出了点小意外
                    </h2>
                    <p className="text-sm text-text-3 mb-6">
                        界面渲染时遇到了错误。你可以重试或返回首页继续使用。
                    </p>
                    {this.state.error && (
                        <pre className="text-xs text-left text-text-4 bg-bg-1/60 rounded-lg p-3 mb-5 overflow-auto max-h-40 font-mono">
                            {this.state.error.message}
                        </pre>
                    )}
                    <div className="flex gap-3 justify-center">
                        <button
                            onClick={this.handleRetry}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium transition-colors"
                        >
                            <RefreshCw size={14} /> 重试
                        </button>
                        <button
                            onClick={this.handleGoHome}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-3 hover:bg-bg-4 text-text-2 text-sm font-medium transition-colors border border-white/8"
                        >
                            <Home size={14} /> 回到首页
                        </button>
                    </div>
                </div>
            </div>
        )
    }
}

export default ErrorBoundary
