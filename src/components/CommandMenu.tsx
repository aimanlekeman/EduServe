import { useEffect, useCallback, useState } from 'react';
import { Command } from 'cmdk';
import { LogOut, Search, BookOpen, Calendar, MapPin, Clock, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface NavItem {
  id: string;
  icon: React.FC<{ size?: number | string }>;
  label: string;
  section?: string;
}

interface ProgramSummary {
  id: string;
  title: string;
  date: string;
  location: string;
  volunteer_hours: number;
}

interface CommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navItems: NavItem[];
  onTabChange: (tab: string) => void;
  roleLabel: string;
  onSignOut: () => void;
}

export function CommandMenu({ open, onOpenChange, navItems, onTabChange, roleLabel, onSignOut }: CommandMenuProps) {
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [programsLoading, setProgramsLoading] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      onOpenChange(true);
    }
    if (e.key === 'Escape') {
      onOpenChange(false);
    }
  }, [onOpenChange]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Fetch programs lazily when palette opens
  useEffect(() => {
    if (!open) return;
    setProgramsLoading(true);
    supabase
      .from('programs')
      .select('id, title, date, location, volunteer_hours')
      .eq('status', 'approved')
      .order('date', { ascending: true })
      .limit(50)
      .then(({ data }) => {
        if (data) setPrograms(data as ProgramSummary[]);
        setProgramsLoading(false);
      });
  }, [open]);

  if (!open) return null;

  const handleNav = (tab: string) => {
    onTabChange(tab);
    onOpenChange(false);
  };

  const handleProgramSelect = (programId: string) => {
    // Navigate to programs tab (all three dashboards have one)
    const programsTab = navItems.find(n => n.id === 'programs');
    onTabChange(programsTab?.id ?? navItems[0]?.id ?? 'programs');
    onOpenChange(false);
    // After the tab switch renders, scroll the card into view
    setTimeout(() => {
      const el = document.getElementById(`program-card-${programId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('cmdk-highlight');
        setTimeout(() => el.classList.remove('cmdk-highlight'), 2000);
      }
    }, 300);
  };

  const handleSignOut = () => {
    onOpenChange(false);
    onSignOut();
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

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => onOpenChange(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(4px)',
          animation: 'cmdk-backdrop-in 0.15s ease',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: '18%', left: '50%', transform: 'translateX(-50%)',
        zIndex: 10001, width: '100%', maxWidth: 580,
        padding: '0 1rem',
        animation: 'cmdk-panel-in 0.15s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <Command
          className="cmdk-root"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-bright)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
            overflow: 'hidden',
            fontFamily: 'var(--font-body)',
          }}
        >
          {/* Search Input */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.875rem 1rem',
            borderBottom: '1px solid var(--border)',
          }}>
            <Search size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <Command.Input
              placeholder="Search pages or programs..."
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                fontSize: '0.9375rem', color: 'var(--text-primary)',
                fontFamily: 'var(--font-body)',
              }}
              autoFocus
            />
            <kbd style={{
              fontSize: '0.65rem', padding: '0.15rem 0.45rem',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)', fontFamily: 'inherit',
            }}>ESC</kbd>
          </div>

          {/* Results */}
          <Command.List style={{ maxHeight: 400, overflowY: 'auto', padding: '0.5rem' }}>
            <Command.Empty style={{
              padding: '2rem 1rem', textAlign: 'center',
              color: 'var(--text-muted)', fontSize: '0.85rem',
            }}>
              No results found.
            </Command.Empty>

            {/* ── Navigation: no-section items ── */}
            {noSection.length > 0 && (
              <Command.Group heading={roleLabel}>
                {noSection.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={item.id}
                      value={`go to ${item.label}`}
                      onSelect={() => handleNav(item.id)}
                      className="cmdk-item"
                    >
                      <Icon size={15} />
                      <span>Go to <strong>{item.label}</strong></span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            )}

            {/* ── Navigation: sectioned items ── */}
            {Object.entries(sections).map(([section, items]) => (
              <Command.Group key={section} heading={section}>
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={item.id}
                      value={`go to ${item.label} ${section}`}
                      onSelect={() => handleNav(item.id)}
                      className="cmdk-item"
                    >
                      <Icon size={15} />
                      <span>Go to <strong>{item.label}</strong></span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            ))}

            {/* ── Dynamic: Volunteer Programs ── */}
            <Command.Group heading="Volunteer Programs">
              {programsLoading ? (
                <div style={{ padding: '0.75rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                  <Loader2 size={13} className="animate-spin" /> Loading programs...
                </div>
              ) : programs.length === 0 ? (
                <div style={{ padding: '0.75rem 0.75rem', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                  No approved programs found.
                </div>
              ) : programs.map(p => (
                <Command.Item
                  key={p.id}
                  value={`program ${p.title} ${p.location}`}
                  onSelect={() => handleProgramSelect(p.id)}
                  className="cmdk-item cmdk-item-program"
                >
                  <BookOpen size={15} style={{ flexShrink: 0, color: 'var(--blue-500)' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                      {p.title}
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.15rem', flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <Calendar size={10} /> {new Date(p.date).toLocaleDateString('en-MY')}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        <MapPin size={10} /> {p.location}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', color: 'var(--blue-500)', fontWeight: 600 }}>
                        <Clock size={10} /> {p.volunteer_hours}h
                      </span>
                    </div>
                  </div>
                </Command.Item>
              ))}
            </Command.Group>

            {/* ── Account ── */}
            <Command.Group heading="Account">
              <Command.Item
                value="sign out log out"
                onSelect={handleSignOut}
                className="cmdk-item cmdk-item-danger"
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </Command.Item>
            </Command.Group>
          </Command.List>

          {/* Footer */}
          <div style={{
            padding: '0.5rem 1rem',
            borderTop: '1px solid var(--border)',
            display: 'flex', gap: '1rem', alignItems: 'center',
            fontSize: '0.7rem', color: 'var(--text-muted)',
          }}>
            <span><kbd style={kbdStyle}>↑</kbd><kbd style={kbdStyle}>↓</kbd> navigate</span>
            <span><kbd style={kbdStyle}>↵</kbd> select</span>
            <span><kbd style={kbdStyle}>ESC</kbd> close</span>
            <span style={{ marginLeft: 'auto' }}>{programs.length > 0 && `${programs.length} programs loaded`}</span>
          </div>
        </Command>
      </div>
    </>
  );
}

const kbdStyle: React.CSSProperties = {
  fontSize: '0.65rem', padding: '0.1rem 0.35rem',
  borderRadius: 4,
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  color: 'var(--text-muted)',
  fontFamily: 'inherit',
  marginRight: 3,
};
