import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/globals.css';
import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { HomePage } from './components/HomePage';
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { AdminDashboard } from './components/dashboards/AdminDashboard';
import { ProgramDirectorDashboard } from './components/dashboards/ProgramDirectorDashboard';
import { StudentDashboard } from './components/dashboards/StudentDashboard';
import { Toaster } from 'sonner';
import { Loader2 } from 'lucide-react';

type PublicView = 'home' | 'login' | 'register';

function AppContent() {
  const { user, loading } = useAuth();
  const [view, setView] = useState<PublicView>('home');

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bg-primary)' }}
      >
        <div className="text-center">
          <Loader2
            className="mx-auto mb-4 animate-spin"
            size={40}
            style={{ color: 'var(--blue-500)' }}
          />
          <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-display)' }}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  // Authenticated users → role dashboard
  if (user) {
    switch (user.role) {
      case 'admin':
        return <AdminDashboard />;
      case 'program_director':
        return <ProgramDirectorDashboard />;
      case 'student':
        return <StudentDashboard />;
      default:
        return <StudentDashboard />;
    }
  }

  // Public pages
  switch (view) {
    case 'login':
      return (
        <LoginPage
          onToggle={() => setView('register')}
          onBack={() => setView('home')}
        />
      );
    case 'register':
      return (
        <RegisterPage
          onToggle={() => setView('login')}
          onBack={() => setView('home')}
        />
      );
    default:
      return (
        <HomePage
          onLogin={() => setView('login')}
          onRegister={() => setView('register')}
        />
      );
  }
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-card)',
            border: '1px solid var(--border-bright)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-body)',
          },
        }}
      />
    </AuthProvider>
  );
}

const root = document.getElementById('root');
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
