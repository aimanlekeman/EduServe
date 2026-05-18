import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { GraduationCap, LogOut, User, Menu, X } from 'lucide-react';
import { toast } from 'sonner';

interface NavItem {
  id: string;
  icon: React.FC<{ size?: number | string }>;
  label: string;
  section?: string;
}

interface DashboardLayoutProps {
  title: string;
  subtitle?: string;
  navItems: NavItem[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
  roleLabel: string;
}

export function DashboardLayout({
  title,
  subtitle,
  navItems,
  activeTab,
  onTabChange,
  children,
  roleLabel,
}: DashboardLayoutProps) {
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out');
  };

  const handleTabChange = (tab: string) => {
    onTabChange(tab);
    setMobileOpen(false);
  };

  // Group nav items by section
  const sections: Record<string, NavItem[]> = {};
  const noSection: NavItem[] = [];
  navItems.forEach((item) => {
    if (item.section) {
      if (!sections[item.section]) sections[item.section] = [];
      sections[item.section].push(item);
    } else {
      noSection.push(item);
    }
  });

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="sidebar-logo">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--blue-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <GraduationCap size={18} color="#fff" />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.875rem', color: '#fff', lineHeight: 1.1 }}>
              UTHM Volunteer
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.55)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {roleLabel}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {noSection.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => handleTabChange(item.id)}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}

        {Object.entries(sections).map(([section, items]) => (
          <div key={section}>
            <div className="nav-section-label">{section}</div>
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
                  onClick={() => handleTabChange(item.id)}
                >
                  <Icon size={16} />
                  {item.label}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User profile at bottom */}
      <div style={{ padding: '1rem 0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem', borderRadius: 'var(--radius-md)', marginBottom: '0.25rem' }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <User size={16} style={{ color: '#fff' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#fff', fontFamily: 'var(--font-display)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </div>
          </div>
        </div>
        <button className="nav-item" onClick={handleSignOut} style={{ color: 'var(--danger)', width: '100%' }}>
          <LogOut size={15} /> Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>

      {/* ── Mobile overlay backdrop ── */}
      {mobileOpen && (
        <div className="mobile-nav-overlay" onClick={() => setMobileOpen(false)} />
      )}

      {/* ── Sidebar (desktop fixed | mobile drawer) ── */}
      <aside className={`sidebar${mobileOpen ? ' mobile-open' : ''}`}>
        {sidebarContent}
      </aside>

      {/* ── Main Content ── */}
      <div className="dashboard-main">
        {/* Topbar */}
        <header className="dashboard-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Hamburger — visible only on mobile via CSS */}
            <button
              className="mobile-menu-btn"
              onClick={() => setMobileOpen(o => !o)}
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div>
              <h1 className="page-title" style={{ fontSize: '1.125rem', marginBottom: 0, color: '#fff' }}>
                {title}
              </h1>
              {subtitle && (
                <p className="page-subtitle" style={{ color: 'rgba(255,255,255,0.55)' }}>{subtitle}</p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.25rem 0.65rem', borderRadius: 999, background: 'rgba(255,255,255,0.15)', color: '#fff', fontFamily: 'var(--font-display)', letterSpacing: '0.03em' }}>
              {roleLabel}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}
