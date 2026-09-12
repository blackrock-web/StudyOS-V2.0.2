import React, { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LogOut, Terminal, Download, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { authService } from '../../services/auth';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class DesktopErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      showDetails: false,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('CRITICAL UNHANDLED DESKTOP RENDERER ERROR:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  private handleResetState = () => {
    try {
      authService.logout();
    } catch {
      // Ignore
    }
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    window.location.reload();
  };

  private handleExportLog = () => {
    const dump = {
      timestamp: new Date().toISOString(),
      errorName: this.state.error?.name,
      errorMessage: this.state.error?.message,
      errorStack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
      userAgent: navigator.userAgent,
    };
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AManager_CrashLog_${Date.now()}.json`;
    a.click();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f172a] text-slate-100 font-sans p-6 select-none overflow-hidden">
          {/* Subtle error background glow */}
          <div className="absolute w-[500px] h-[500px] bg-rose-900/20 rounded-full blur-3xl pointer-events-none" />

          <div className="w-full max-w-2xl bg-slate-900/90 border border-rose-500/30 rounded-3xl p-8 shadow-2xl relative z-10 space-y-6">
            {/* Header */}
            <div className="flex items-start space-x-4">
              <div className="p-3.5 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-400 bg-rose-950/80 px-2.5 py-0.5 rounded-full border border-rose-500/30">
                    Desktop Diagnostic Dialog
                  </span>
                  <span className="text-xs text-slate-400 font-mono">Process ID: #ERR-804</span>
                </div>
                <h1 className="text-xl font-black text-white mt-1">Application Renderer Exception Intercepted</h1>
                <p className="text-xs text-slate-300 font-medium mt-0.5">
                  The application caught a runtime error. The desktop error boundary prevented a blank screen.
                </p>
              </div>
            </div>

            {/* Error Message Box */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
              <div className="text-xs font-bold text-rose-400 font-mono">
                {this.state.error?.name || 'Error'}: {this.state.error?.message || 'Unknown runtime error'}
              </div>
              <p className="text-[11px] text-slate-400">
                Don't worry — your offline SQLite database and study notes remain safe on disk.
              </p>
            </div>

            {/* Expandable Technical Diagnostics Stack Trace */}
            <div className="space-y-2">
              <button
                onClick={() => this.setState({ showDetails: !this.state.showDetails })}
                className="text-xs font-extrabold text-slate-300 hover:text-white flex items-center gap-1.5 underline"
              >
                <Terminal className="w-3.5 h-3.5 text-purple-400" />
                {this.state.showDetails ? 'Hide Stack Trace' : 'View Full Technical Diagnostics'}
              </button>

              {this.state.showDetails && (
                <div className="bg-slate-950/90 border border-slate-800 p-3.5 rounded-2xl text-[10px] font-mono text-slate-300 max-h-48 overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                  {this.state.error?.stack || 'No stack trace available.'}
                  {'\n\nComponent Stack:\n'}
                  {this.state.errorInfo?.componentStack || 'N/A'}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
              >
                <RefreshCw className="w-4 h-4" /> Reload Window
              </button>

              <button
                onClick={this.handleResetState}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs flex items-center justify-center gap-2 transition-all border border-slate-700"
              >
                <LogOut className="w-4 h-4 text-amber-400" /> Fallback to Login Screen
              </button>

              <button
                onClick={this.handleExportLog}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs flex items-center justify-center gap-2 transition-all border border-slate-700"
              >
                <Download className="w-4 h-4 text-emerald-400" /> Export Crash Log
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
