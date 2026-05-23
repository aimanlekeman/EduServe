import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, User, Menu, X, Bell, Megaphone, CheckCheck, AlertTriangle, Info, Search, Settings } from 'lucide-react';
import itcLogo from '/assets/itc-logo.webp';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { CommandMenu } from '../CommandMenu';
import { ProfileSettings } from '../ProfileSettings';

interface NotifRow {
  id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

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
  const [cmdOpen, setCmdOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotifRow[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const fetchNotifications = () => {
    if (!user) return;
    supabase.from('notifications').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(25)
      .then(({ data }) => { if (data) setNotifications(data as NotifRow[]); });
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const ch = supabase.channel(`notif-bell-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => { fetchNotifications(); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllAsRead = async () => {
    if (!user || unreadCount === 0) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    toast.success('All notifications marked as read');
  };

  const handleSignOut = async () => {
    await signOut();
    toast.success('Signed out');
  };

  const handleTabChange = (tab: string) => {
    onTabChange(tab);
    setMobileOpen(false);
    setShowSettings(false);
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
          <img
            src={itcLogo}
            alt="EduServe"
            style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0, borderRadius: 6 }}
          />
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.875rem', color: '#fff', lineHeight: 1.1 }}>
              EduServe
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
        <button className="nav-item" onClick={() => { setShowSettings(true); setMobileOpen(false); }} style={{ width: '100%' }}>
          <Settings size={15} /> Account Settings
        </button>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            {/* Command Palette hint */}
            <button
              onClick={() => setCmdOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.3rem 0.65rem', borderRadius: 'var(--radius-md)',
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.18)',
                color: 'rgba(255,255,255,0.65)', cursor: 'pointer',
                fontSize: '0.72rem', fontFamily: 'var(--font-body)',
                transition: 'background 0.15s',
              }}
              title="Open command palette (Ctrl+K)"
            >
              <Search size={12} />
              <span style={{ display: 'none' }} className="cmd-hint-label">Search</span>
              <kbd style={{
                fontSize: '0.6rem', padding: '0.1rem 0.35rem',
                borderRadius: 4, background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: 'rgba(255,255,255,0.55)',
                fontFamily: 'inherit', lineHeight: 1.4,
              }}>Ctrl K</kbd>
            </button>

            {/* Bell */}
            <div ref={bellRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setBellOpen(o => !o)}
                style={{ position: 'relative', width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', transition: 'background 0.15s' }}
                title="Notifications"
              >
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 999, background: '#ef4444', color: '#fff', fontSize: '0.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', border: '1.5px solid var(--bg-topbar, #1e293b)' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {bellOpen && (
                <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 340, maxHeight: 460, display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: '0 12px 40px rgba(0,0,0,0.25)', zIndex: 9999, overflow: 'hidden' }}>

                  {/* Dropdown header */}
                  <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      Notifications {unreadCount > 0 && <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>({unreadCount})</span>}
                    </span>
                    {unreadCount > 0 && (
                      <button onClick={markAllAsRead} style={{ fontSize: '0.72rem', color: 'var(--blue-400)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                        <CheckCheck size={13} /> Mark all read
                      </button>
                    )}
                  </div>

                  {/* Notification list */}
                  <div style={{ overflowY: 'auto', flex: 1 }}>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                        <Bell size={28} style={{ margin: '0 auto 0.5rem', opacity: 0.3, display: 'block' }} />
                        No notifications yet
                      </div>
                    ) : notifications.map(n => {
                      const icons: Record<string, React.ReactNode> = {
                        success:       <CheckCheck size={14} style={{ color: '#10b981', flexShrink: 0 }} />,
                        warning:       <AlertTriangle size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />,
                        broadcast:     <Megaphone size={14} style={{ color: '#3b82f6', flexShrink: 0 }} />,
                        program_alert: <AlertTriangle size={14} style={{ color: '#8b5cf6', flexShrink: 0 }} />,
                        info:          <Info size={14} style={{ color: 'var(--blue-400)', flexShrink: 0 }} />,
                      };
                      const icon = icons[n.type] ?? icons.info;
                      const timeAgo = (() => {
                        const diff = Date.now() - new Date(n.created_at).getTime();
                        if (diff < 60000) return 'just now';
                        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
                        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
                        return new Date(n.created_at).toLocaleDateString('en-MY');
                      })();
                      return (
                        <div
                          key={n.id}
                          onClick={() => markAsRead(n.id)}
                          style={{ padding: '0.75rem 1rem', display: 'flex', gap: '0.625rem', alignItems: 'flex-start', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: n.is_read ? 'transparent' : 'rgba(37,99,235,0.05)', transition: 'background 0.1s' }}
                        >
                          <div style={{ marginTop: 2 }}>{icon}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.8rem', fontWeight: n.is_read ? 500 : 700, color: 'var(--text-primary)', marginBottom: 2 }}>{n.title}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: 3 }}>{n.body}</div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{timeAgo}</div>
                          </div>
                          {!n.is_read && (
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#3b82f6', flexShrink: 0, marginTop: 5 }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Profile avatar + dropdown */}
            <div ref={profileRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setProfileOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.25rem 0.5rem 0.25rem 0.25rem',
                  borderRadius: 999, cursor: 'pointer',
                  background: profileOpen ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  transition: 'background 0.15s',
                }}
                aria-label="Account menu"
              >
                {/* Initials avatar */}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0.15))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.65rem', color: '#fff',
                  flexShrink: 0, userSelect: 'none',
                }}>
                  {(user?.name ?? 'U').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)', fontFamily: 'var(--font-display)', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.name?.split(' ')[0]}
                </span>
              </button>

              {profileOpen && (
                <div style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                  width: 220, background: 'var(--bg-card)',
                  border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.25)', zIndex: 9999, overflow: 'hidden',
                }}>
                  {/* Header */}
                  <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user?.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
                      {user?.email}
                    </div>
                  </div>

                  {/* Menu items */}
                  <div style={{ padding: '0.375rem' }}>
                    <button
                      onClick={() => { setShowSettings(true); setProfileOpen(false); }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '0.625rem',
                        padding: '0.575rem 0.75rem', borderRadius: 'var(--radius-md)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '0.875rem', color: 'var(--text-secondary)',
                        fontFamily: 'var(--font-body)', textAlign: 'left',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      <Settings size={14} /> Account Settings
                    </button>

                    <div style={{ margin: '0.25rem 0', borderTop: '1px solid var(--border)' }} />

                    <button
                      onClick={() => { setProfileOpen(false); handleSignOut(); }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: '0.625rem',
                        padding: '0.575rem 0.75rem', borderRadius: 'var(--radius-md)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '0.875rem', color: 'var(--danger)',
                        fontFamily: 'var(--font-body)', textAlign: 'left',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--danger-bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      <LogOut size={14} /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="dashboard-content">
          {showSettings
            ? <ProfileSettings onClose={() => setShowSettings(false)} />
            : children
          }
        </main>
      </div>

      <CommandMenu
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        navItems={navItems}
        onTabChange={(tab) => { onTabChange(tab); setMobileOpen(false); }}
        roleLabel={roleLabel}
        onSignOut={handleSignOut}
      />
    </div>
  );
}
