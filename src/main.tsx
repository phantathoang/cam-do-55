import React, { Component, ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from "./app/App";
import "./index.css";

const queryClient = new QueryClient();

class ErrorBoundary extends Component<{children: ReactNode}, {error: any}> {
  state = { error: null };
  static getDerivedStateFromError(error: any) { return { error }; }
  render() {
    if (this.state.error) return <div style={{padding: 20, color: 'red', background: '#000', height: '100vh', width: '100vw'}}><h1>Lỗi Giao Diện:</h1><pre style={{whiteSpace: 'pre-wrap'}}>{String(this.state.error)}</pre></div>;
    return this.props.children;
  }
}

import { Toaster } from 'sonner';

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster 
          theme="dark" 
          position="bottom-right" 
          className="font-sans" 
          toastOptions={{
            style: {
              background: '#0f172a',
              border: '1px solid #1e293b',
              color: '#f1f5f9',
              borderRadius: '12px',
              padding: '16px',
              boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5)',
            },
            classNames: {
              actionButton: 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 font-medium px-3 py-1.5 rounded-lg border border-emerald-500/20 transition-colors',
            }
          }}
        />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
