import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './hooks/useAuth.jsx'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  render() {
    if (this.state.error) return (
      <div style={{ minHeight: '100vh', background: '#020817', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ background: '#0a1628', border: '1px solid #ef4444', borderRadius: 12, padding: 24, maxWidth: 600, width: '100%' }}>
          <div style={{ color: '#f87171', fontWeight: 700, fontSize: 16, marginBottom: 8, fontFamily: 'monospace' }}>🔴 Runtime Error</div>
          <pre style={{ color: '#fca5a5', fontSize: 12, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{this.state.error?.message}\n\n{this.state.error?.stack}</pre>
        </div>
      </div>
    );
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
