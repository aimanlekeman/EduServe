import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import { TrendingUp, TrendingDown, FileDown, Loader2, Star } from 'lucide-react';
import type { Program, Profile, Registration } from '../../lib/supabase';
import { supabase } from '../../lib/supabase';
import { generateAnalyticsReport } from '../../lib/generateReport';

interface Props {
  programs: Program[];
  users: Profile[];
  registrations: Registration[];
  attendanceHours: Record<string, number>;
}

// ── Palette ────────────────────────────────────────────────────────────────
const C = {
  blue:    '#1D4ED8',
  sky:     '#3B82F6',
  green:   '#059669',
  amber:   '#D97706',
  red:     '#DC2626',
  purple:  '#7C3AED',
  teal:    '#0D9488',
  indigo:  '#4F46E5',
};

const PIE_COLORS: Record<string, string> = {
  approved: C.green,
  pending:  C.amber,
  rejected: C.red,
};

// ── KPI config (targets are placeholder — update with real org values) ─────
const KPI_TARGETS = [
  {
    key: 'volunteerHours',
    label: 'Total Volunteer Hours',
    target: 500,
    unit: 'hrs',
    description: 'Cumulative hours logged by all students',
  },
  {
    key: 'programsCompleted',
    label: 'Programs Completed',
    target: 20,
    unit: 'programs',
    description: 'Number of approved programs run this year',
  },
  {
    key: 'activeStudents',
    label: 'Active Students',
    target: 50,
    unit: 'students',
    description: 'Students registered for at least one program',
  },
  {
    key: 'avgHoursPerStudent',
    label: 'Avg. Hours / Student',
    target: 10,
    unit: 'hrs',
    description: 'Average volunteer hours per enrolled student',
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────
function getMonthLabel(date: string) {
  return new Date(date).toLocaleDateString('en-MY', { month: 'short', year: '2-digit' });
}

function last6Months() {
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(d.toLocaleDateString('en-MY', { month: 'short', year: '2-digit' }));
  }
  return months;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontFamily: 'var(--font-display)',
      fontWeight: 700,
      fontSize: '0.95rem',
      color: 'var(--text-primary)',
      marginBottom: '1.25rem',
    }}>
      {children}
    </h3>
  );
}

function ChartCard({ title, children, span = 1, id }: { title: string; children: React.ReactNode; span?: number; id?: string }) {
  return (
    <div
      id={id}
      className="card"
      style={{ gridColumn: `span ${span}`, minHeight: 300 }}
    >
      <SectionTitle>{title}</SectionTitle>
      {children}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: '#fff',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '0.625rem 0.875rem',
      fontSize: '0.8125rem',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    }}>
      {label && <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{label}</div>}
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color || 'var(--text-secondary)', display: 'flex', gap: 6 }}>
          <span>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>{p.value}{p.unit ?? ''}</span>
        </div>
      ))}
    </div>
  );
}

// ── KPI Card ───────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  target: number;
  actual: number;
  unit: string;
  description: string;
}

function KpiCard({ label, target, actual, unit, description }: KpiCardProps) {
  const pct = Math.min(Math.round((actual / target) * 100), 100);
  const status = pct >= 100 ? 'achieved' : pct >= 70 ? 'on-track' : 'behind';

  const statusMap = {
    achieved: { label: 'Achieved',  color: C.green,  bg: 'rgba(5,150,105,0.1)',  Icon: TrendingUp },
    'on-track': { label: 'On Track', color: C.blue,   bg: 'rgba(29,78,216,0.1)',  Icon: TrendingUp },
    behind:   { label: 'Behind',    color: C.amber,  bg: 'rgba(217,119,6,0.1)',  Icon: TrendingDown },
  };
  const s = statusMap[status];

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
            {label}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>
        </div>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '0.2rem 0.55rem', borderRadius: 20,
          background: s.bg, color: s.color,
          fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap',
        }}>
          <s.Icon size={11} /> {s.label}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.75rem', fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text-primary)', lineHeight: 1 }}>
          {actual.toLocaleString()}
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', paddingBottom: 3 }}>/ {target.toLocaleString()} {unit}</span>
      </div>

      {/* Progress bar */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 99, height: 7, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: s.color,
          borderRadius: 99,
          transition: 'width 0.6s ease',
        }} />
      </div>

      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <span>{pct}% of target</span>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

interface FeedbackRow { program_id: string; rating: number; }

export function AnalyticsTab({ programs, users, registrations, attendanceHours }: Props) {
  const [generating, setGenerating] = useState(false);
  const [allFeedback, setAllFeedback] = useState<FeedbackRow[]>([]);

  useEffect(() => {
    supabase.from('feedback').select('program_id, rating')
      .then(({ data }) => { if (data) setAllFeedback(data as FeedbackRow[]); });
  }, []);

  const students = users.filter(u => u.role === 'student');

  // ── Feedback-derived metrics ───────────────────────────────────────────
  const avgUniversityRating = allFeedback.length > 0
    ? (allFeedback.reduce((s, f) => s + f.rating, 0) / allFeedback.length)
    : null;

  const topRatedPrograms = (() => {
    const byProgram: Record<string, number[]> = {};
    allFeedback.forEach(f => {
      if (!byProgram[f.program_id]) byProgram[f.program_id] = [];
      byProgram[f.program_id].push(f.rating);
    });
    return Object.entries(byProgram)
      .map(([id, ratings]) => ({
        id,
        title: programs.find(p => p.id === id)?.title ?? 'Unknown',
        avg: ratings.reduce((s, r) => s + r, 0) / ratings.length,
        count: ratings.length,
      }))
      .sort((a, b) => b.avg - a.avg || b.count - a.count)
      .slice(0, 3);
  })();

  // ── Derived KPI actuals ────────────────────────────────────────────────
  const totalHours    = students.reduce((s, u) => s + (attendanceHours[u.id] ?? 0), 0);
  const approvedProgs = programs.filter(p => p.status === 'approved').length;
  const activeStudents = new Set(registrations.map(r => r.user_id)).size;
  const avgHours = students.length > 0 ? parseFloat((totalHours / students.length).toFixed(1)) : 0;

  const kpiActuals: Record<string, number> = {
    volunteerHours:    totalHours,
    programsCompleted: approvedProgs,
    activeStudents,
    avgHoursPerStudent: avgHours,
  };

  // ── Programs by status (pie) ───────────────────────────────────────────
  const byStatus = ['approved', 'pending', 'rejected'].map(s => ({
    name: s.charAt(0).toUpperCase() + s.slice(1),
    value: programs.filter(p => p.status === s).length,
    color: PIE_COLORS[s],
  })).filter(d => d.value > 0);

  // ── Programs created per month (bar) ──────────────────────────────────
  const months = last6Months();
  const monthlyPrograms = months.map(m => ({
    month: m,
    Programs: programs.filter(p => getMonthLabel(p.created_at) === m).length,
    Approved: programs.filter(p => p.status === 'approved' && getMonthLabel(p.created_at) === m).length,
  }));

  // ── Cumulative volunteer hours over last 6 months (area) ──────────────
  const hoursByMonth = months.map((m, i) => {
    // sum hours of students who joined by this month
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    d.setDate(1);
    const eligible = students.filter(u => new Date(u.created_at) <= d);
    return {
      month: m,
      Hours: eligible.reduce((s, u) => s + (attendanceHours[u.id] ?? 0), 0),
    };
  });

  // ── Top 10 students by volunteer hours (bar) ──────────────────────────
  const topStudents = [...students]
    .sort((a, b) => (attendanceHours[b.id] ?? 0) - (attendanceHours[a.id] ?? 0))
    .slice(0, 10)
    .map(u => ({ name: u.name.split(' ')[0], Hours: attendanceHours[u.id] ?? 0 }));

  // ── Registrations per program (bar) ───────────────────────────────────
  const regByProgram = programs
    .filter(p => p.status === 'approved')
    .map(p => ({
      name: p.title.length > 18 ? p.title.slice(0, 16) + '…' : p.title,
      Registrations: registrations.filter(r => r.program_id === p.id).length,
    }))
    .sort((a, b) => b.Registrations - a.Registrations)
    .slice(0, 6);

  const axisStyle = { fontSize: 11, fill: '#94A3B8' };

  return (
    <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* ── Top bar: generate button ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          disabled={generating}
          onClick={async () => {
            setGenerating(true);
            try { await generateAnalyticsReport(programs, users, registrations); }
            finally { setGenerating(false); }
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.65rem 1.25rem',
            borderRadius: 'var(--radius-md)',
            background: generating ? 'var(--bg-secondary)' : 'var(--blue-600)',
            color: generating ? 'var(--text-muted)' : '#fff',
            border: 'none',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            fontSize: '0.8125rem',
            cursor: generating ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
            boxShadow: generating ? 'none' : '0 2px 8px rgba(29,78,216,0.3)',
            transition: 'all 0.15s',
            flexShrink: 0,
          }}
        >
          {generating
            ? <><Loader2 size={15} className="animate-spin" /> Generating…</>
            : <><FileDown size={15} /> Generate Report</>}
        </button>
      </div>

      {/* ── Quality Rating Summary ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>

        {/* Average university rating card */}
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', background: 'linear-gradient(135deg, rgba(212,175,90,0.08), var(--bg-card))', border: '1px solid rgba(212,175,90,0.25)' }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(212,175,90,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Star size={26} style={{ color: '#D4AF5A' }} />
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B8962E', marginBottom: 2 }}>Avg University Rating</div>
            {avgUniversityRating !== null ? (
              <>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.75rem', color: '#D4AF5A', lineHeight: 1 }}>
                  {avgUniversityRating.toFixed(1)}<span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)', marginLeft: 2 }}>/5.0</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 3 }}>from {allFeedback.length} review{allFeedback.length !== 1 ? 's' : ''}</div>
              </>
            ) : (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>No reviews yet</div>
            )}
          </div>
        </div>

        {/* Top rated programs */}
        {topRatedPrograms.length > 0 && (
          <div className="card" style={{ gridColumn: 'span 1' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Top Rated Programs</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {topRatedPrograms.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.8rem', color: '#D4AF5A', width: 16 }}>#{i + 1}</span>
                  <span style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                  <span style={{ fontSize: '0.8rem', color: '#D4AF5A', fontWeight: 700, flexShrink: 0 }}>★ {p.avg.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div>
        <SectionTitle>Key Performance Indicators</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '1rem' }}>
          {KPI_TARGETS.map(k => (
            <KpiCard
              key={k.key}
              label={k.label}
              target={k.target}
              actual={kpiActuals[k.key]}
              unit={k.unit}
              description={k.description}
            />
          ))}
        </div>
      </div>

      {/* ── Charts row 1 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>

        {/* Programs by Status */}
        <ChartCard title="Programs by Status" id="chart-programs-status">
          {byStatus.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={byStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {byStatus.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Monthly Program Activity */}
        <ChartCard title="Monthly Program Activity" id="chart-monthly-activity">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyPrograms} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,64,175,0.08)" vertical={false} />
              <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(29,78,216,0.05)' }} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Programs" fill={C.sky} radius={[4, 4, 0, 0]} />
              <Bar dataKey="Approved" fill={C.green} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* ── Charts row 2 ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>

        {/* Cumulative Volunteer Hours */}
        <ChartCard title="Cumulative Volunteer Hours" id="chart-volunteer-hours">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={hoursByMonth}>
              <defs>
                <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.blue} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,64,175,0.08)" vertical={false} />
              <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: C.blue, strokeWidth: 1.5 }} />
              <Area
                type="monotone"
                dataKey="Hours"
                stroke={C.blue}
                strokeWidth={2.5}
                fill="url(#hoursGrad)"
                dot={{ r: 4, fill: C.blue, strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Registrations per Program */}
        <ChartCard title="Registrations per Program" id="chart-registrations">
          {regByProgram.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={regByProgram} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,64,175,0.08)" horizontal={false} />
                <XAxis type="number" tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} width={80} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(29,78,216,0.05)' }} />
                <Bar dataKey="Registrations" fill={C.indigo} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

      </div>

      {/* ── Top Students ── */}
      <ChartCard title="Top Students by Volunteer Hours">
        {topStudents.length === 0 ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={topStudents} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,64,175,0.08)" vertical={false} />
              <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisStyle} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(29,78,216,0.05)' }} />
              <Bar dataKey="Hours" fill={C.teal} radius={[6, 6, 0, 0]} label={{ position: 'top', fontSize: 11, fill: '#94A3B8' }} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* ── Summary Stats Strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.875rem' }}>
        {[
          { label: 'Total Programs',    value: programs.length,                     color: C.blue   },
          { label: 'Approved',          value: approvedProgs,                       color: C.green  },
          { label: 'Pending',           value: programs.filter(p => p.status === 'pending').length, color: C.amber },
          { label: 'Total Students',    value: students.length,                     color: C.indigo },
          { label: 'Registrations',     value: registrations.length,                color: C.sky    },
          { label: 'Volunteer Hours',   value: `${totalHours}h`,                    color: C.teal   },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="card"
            style={{ textAlign: 'center', padding: '1rem', borderTop: `3px solid ${color}` }}
          >
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.5rem', color, lineHeight: 1 }}>
              {value}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 6 }}>{label}</div>
          </div>
        ))}
      </div>

    </div>
  );
}

function EmptyChart() {
  return (
    <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
      No data yet
    </div>
  );
}
