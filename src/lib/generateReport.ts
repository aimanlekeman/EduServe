import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Program, Profile, Registration } from './supabase';

// ── Colours ──────────────────────────────────────────────────────────────────
const NAVY  = [15, 36, 72]   as [number,number,number];
const BLUE  = [26, 53, 102]  as [number,number,number];
const GOLD  = [184, 150, 46] as [number,number,number];
const WHITE = [255,255,255]  as [number,number,number];
const LIGHT = [240, 245, 255] as [number,number,number];
const MUTED = [148, 163, 184] as [number,number,number];
const GREEN = [5, 150, 105]  as [number,number,number];
const AMBER = [217, 119, 6]  as [number,number,number];
const RED   = [220, 38, 38]  as [number,number,number];

const KPI_TARGETS = [
  { key: 'volunteerHours',    label: 'Total Volunteer Hours',  target: 500, unit: 'hrs'      },
  { key: 'programsCompleted', label: 'Programs Completed',     target: 20,  unit: 'programs' },
  { key: 'activeStudents',    label: 'Active Students',        target: 50,  unit: 'students' },
  { key: 'avgHoursPerStudent',label: 'Avg. Hours / Student',   target: 10,  unit: 'hrs'      },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function hex(rgb: [number,number,number]) {
  return `#${rgb.map(v => v.toString(16).padStart(2,'0')).join('')}`;
}

function setFill(pdf: jsPDF, rgb: [number,number,number]) {
  pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
}
function setStroke(pdf: jsPDF, rgb: [number,number,number]) {
  pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);
}
function setColor(pdf: jsPDF, rgb: [number,number,number]) {
  pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
}

async function captureElement(id: string, scale = 2): Promise<string | null> {
  const el = document.getElementById(id);
  if (!el) return null;
  try {
    const canvas = await html2canvas(el, {
      scale,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

function drawPageHeader(pdf: jsPDF, title: string, pageNum: number, total: number) {
  const W = 210;
  setFill(pdf, NAVY);
  pdf.rect(0, 0, W, 18, 'F');
  setColor(pdf, GOLD);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('UTHM VOLUNTEER PROGRAMME', 15, 7);
  setColor(pdf, WHITE);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.text(title, 15, 12.5);
  setColor(pdf, MUTED);
  pdf.setFontSize(7);
  pdf.text(`Page ${pageNum} of ${total}`, W - 15, 12.5, { align: 'right' });
}

function drawPageFooter(pdf: jsPDF, generatedDate: string) {
  const W = 210, H = 297;
  setFill(pdf, LIGHT);
  pdf.rect(0, H - 12, W, 12, 'F');
  setColor(pdf, MUTED);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  pdf.text(`Generated on ${generatedDate}  ·  EduServe Management System  ·  Confidential`, W / 2, H - 5, { align: 'center' });
}

// ── Main export ───────────────────────────────────────────────────────────────
export async function generateAnalyticsReport(
  programs: Program[],
  users: Profile[],
  registrations: Registration[],
) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 15;
  const cW = W - M * 2; // content width

  const now = new Date();
  const generatedDate = now.toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' });
  const students = users.filter(u => u.role === 'student');
  const totalHours     = students.reduce((s, u) => s + (u.volunteer_hours || 0), 0);
  const approvedProgs  = programs.filter(p => p.status === 'approved').length;
  const pendingProgs   = programs.filter(p => p.status === 'pending').length;
  const rejectedProgs  = programs.filter(p => p.status === 'rejected').length;
  const activeStudents = new Set(registrations.map(r => r.user_id)).size;
  const avgHours       = students.length > 0 ? parseFloat((totalHours / students.length).toFixed(1)) : 0;

  const kpiActuals: Record<string, number> = {
    volunteerHours:     totalHours,
    programsCompleted:  approvedProgs,
    activeStudents,
    avgHoursPerStudent: avgHours,
  };

  const TOTAL_PAGES = 4;

  // ══════════════════════════════════════════════════
  // PAGE 1 — COVER
  // ══════════════════════════════════════════════════
  // Hero background
  setFill(pdf, NAVY);
  pdf.rect(0, 0, W, 110, 'F');

  // Gold accent bar
  setFill(pdf, GOLD);
  pdf.rect(0, 106, W, 4, 'F');

  // University name
  setColor(pdf, GOLD);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('UNIVERSITI TUN HUSSAIN ONN MALAYSIA', W / 2, 30, { align: 'center' });

  setColor(pdf, [180, 200, 230] as [number,number,number]);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.text('Pusat Kesukarelaan UTHM  ·  Parit Raja, Johor', W / 2, 37, { align: 'center' });

  // Decorative lines
  setStroke(pdf, GOLD);
  pdf.setLineWidth(0.4);
  pdf.line(M + 20, 41, W - M - 20, 41);
  pdf.line(M + 20, 43, W - M - 20, 43);

  // Report title
  setColor(pdf, WHITE);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.text('ANALYTICS &', W / 2, 58, { align: 'center' });
  pdf.text('KPI REPORT', W / 2, 70, { align: 'center' });

  setColor(pdf, GOLD);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text('Volunteer Programme Performance Summary', W / 2, 79, { align: 'center' });

  setColor(pdf, [160, 185, 220] as [number,number,number]);
  pdf.setFontSize(8);
  pdf.text(`Generated: ${generatedDate}`, W / 2, 88, { align: 'center' });

  // ── Quick stats boxes ────────────────────────────────────────
  const boxes = [
    { label: 'Total Programs', value: String(programs.length) },
    { label: 'Students',       value: String(students.length) },
    { label: 'Volunteer Hrs',  value: `${totalHours}h` },
    { label: 'Registrations',  value: String(registrations.length) },
  ];
  const boxW = cW / boxes.length - 3;
  boxes.forEach((b, i) => {
    const bx = M + i * (boxW + 4);
    const by = 120;
    setFill(pdf, LIGHT);
    setStroke(pdf, [200, 215, 240] as [number,number,number]);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(bx, by, boxW, 28, 3, 3, 'FD');

    setColor(pdf, NAVY);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.text(b.value, bx + boxW / 2, by + 13, { align: 'center' });

    setColor(pdf, MUTED);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text(b.label, bx + boxW / 2, by + 21, { align: 'center' });
  });

  // ── Report info box ────────────────────────────────────────
  const infoY = 165;
  setFill(pdf, LIGHT);
  pdf.rect(M, infoY, cW, 55, 'F');
  setStroke(pdf, [210, 220, 235] as [number,number,number]);
  pdf.setLineWidth(0.3);
  pdf.rect(M, infoY, cW, 55);

  // Left border accent
  setFill(pdf, NAVY);
  pdf.rect(M, infoY, 3, 55, 'F');

  setColor(pdf, NAVY);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.text('Report Information', M + 8, infoY + 9);

  const infoItems = [
    ['Report Type',    'Analytics & KPI Performance Report'],
    ['Programme',      'EduServe Volunteer Programme'],
    ['Data Coverage',  'All recorded programs and student activities'],
    ['Generated By',   'EduServe Management System'],
    ['Date',           generatedDate],
    ['Status',         'Confidential — For Administrative Use Only'],
  ];

  setColor(pdf, MUTED);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  infoItems.forEach(([key, val], i) => {
    const iy = infoY + 17 + i * 6.5;
    setColor(pdf, [80, 100, 130] as [number,number,number]);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${key}:`, M + 8, iy);
    setColor(pdf, [50, 60, 80] as [number,number,number]);
    pdf.setFont('helvetica', 'normal');
    pdf.text(val, M + 45, iy);
  });

  drawPageFooter(pdf, generatedDate);

  // ══════════════════════════════════════════════════
  // PAGE 2 — KPI SUMMARY
  // ══════════════════════════════════════════════════
  pdf.addPage();
  drawPageHeader(pdf, 'KPI Performance Summary', 2, TOTAL_PAGES);

  let y = 28;

  // Section intro
  setColor(pdf, NAVY);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text('Key Performance Indicators', M, y); y += 7;

  setColor(pdf, MUTED);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text('KPI targets below are indicative placeholders. Update them once official targets are confirmed by management.', M, y);
  y += 10;

  // ── KPI table header ────────────────────────────────────────
  const cols = [75, 28, 28, 26, 23]; // column widths
  const headers = ['KPI Indicator', 'Target', 'Actual', 'Achievement', 'Status'];
  setFill(pdf, NAVY);
  pdf.rect(M, y, cW, 9, 'F');
  setColor(pdf, WHITE);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  let cx = M;
  headers.forEach((h, i) => {
    pdf.text(h, cx + 3, y + 6);
    cx += cols[i];
  });
  y += 9;

  // ── KPI rows ────────────────────────────────────────────────
  KPI_TARGETS.forEach((k, idx) => {
    const actual = kpiActuals[k.key];
    const pct = Math.min(Math.round((actual / k.target) * 100), 100);
    const status = pct >= 100 ? 'Achieved' : pct >= 70 ? 'On Track' : 'Behind';
    const statusColor = pct >= 100 ? GREEN : pct >= 70 ? [29, 78, 216] as [number,number,number] : AMBER;
    const rowH = 16;

    // Row background
    setFill(pdf, idx % 2 === 0 ? WHITE : LIGHT);
    pdf.rect(M, y, cW, rowH, 'F');
    setStroke(pdf, [220, 230, 245] as [number,number,number]);
    pdf.setLineWidth(0.2);
    pdf.line(M, y + rowH, M + cW, y + rowH);

    cx = M;
    setColor(pdf, NAVY);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text(k.label, cx + 3, y + 6);
    setColor(pdf, MUTED);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.text(k.unit, cx + 3, y + 11);
    cx += cols[0];

    setColor(pdf, [80, 100, 130] as [number,number,number]);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.text(`${k.target}`, cx + 3, y + 8);
    cx += cols[1];

    setColor(pdf, NAVY);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${actual}`, cx + 3, y + 8);
    cx += cols[2];

    // Progress bar
    const barW = cols[3] - 6;
    const barH = 4;
    setFill(pdf, [220, 230, 245] as [number,number,number]);
    pdf.roundedRect(cx + 3, y + 4, barW, barH, 1, 1, 'F');
    setFill(pdf, statusColor);
    pdf.roundedRect(cx + 3, y + 4, barW * (pct / 100), barH, 1, 1, 'F');
    setColor(pdf, [80, 100, 130] as [number,number,number]);
    pdf.setFontSize(7);
    pdf.text(`${pct}%`, cx + 3, y + 13);
    cx += cols[3];

    // Status badge
    setFill(pdf, statusColor);
    pdf.roundedRect(cx + 1, y + 4, cols[4] - 3, 6, 2, 2, 'F');
    setColor(pdf, WHITE);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.5);
    pdf.text(status, cx + (cols[4] - 3) / 2 + 1, y + 8.5, { align: 'center' });

    y += rowH;
  });

  y += 12;

  // ── Program breakdown table ───────────────────────────────────
  setColor(pdf, NAVY);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('Program Status Breakdown', M, y); y += 8;

  const pCols = [80, 30, 30, 40];
  const pHeaders = ['Program Title', 'Status', 'Hours', 'Registrations'];
  setFill(pdf, NAVY);
  pdf.rect(M, y, cW, 8, 'F');
  setColor(pdf, WHITE);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  cx = M;
  pHeaders.forEach((h, i) => { pdf.text(h, cx + 3, y + 5.5); cx += pCols[i]; });
  y += 8;

  programs.slice(0, 12).forEach((p, idx) => {
    const regCount = registrations.filter(r => r.program_id === p.id).length;
    const rH = 9;
    setFill(pdf, idx % 2 === 0 ? WHITE : LIGHT);
    pdf.rect(M, y, cW, rH, 'F');
    cx = M;

    setColor(pdf, NAVY);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    const title = p.title.length > 38 ? p.title.slice(0, 36) + '…' : p.title;
    pdf.text(title, cx + 3, y + 6); cx += pCols[0];

    const sColor = p.status === 'approved' ? GREEN : p.status === 'pending' ? AMBER : RED;
    setFill(pdf, sColor);
    pdf.roundedRect(cx + 2, y + 2, 22, 5, 1.5, 1.5, 'F');
    setColor(pdf, WHITE);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(6.5);
    pdf.text(p.status, cx + 13, y + 5.8, { align: 'center' }); cx += pCols[1];

    setColor(pdf, [80, 100, 130] as [number,number,number]);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.text(`${p.volunteer_hours}h`, cx + 3, y + 6); cx += pCols[2];
    pdf.text(`${regCount}`, cx + 3, y + 6);
    y += rH;
  });

  drawPageFooter(pdf, generatedDate);

  // ══════════════════════════════════════════════════
  // PAGE 3 — CHARTS
  // ══════════════════════════════════════════════════
  pdf.addPage();
  drawPageHeader(pdf, 'Visual Analytics — Program & Activity Charts', 3, TOTAL_PAGES);
  y = 28;

  setColor(pdf, NAVY);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text('Visual Analytics', M, y); y += 12;

  const chartIds = [
    'chart-programs-status',
    'chart-monthly-activity',
    'chart-volunteer-hours',
    'chart-registrations',
  ];
  const chartTitles = [
    'Programs by Status',
    'Monthly Program Activity',
    'Cumulative Volunteer Hours',
    'Registrations per Program',
  ];

  const chartW = (cW - 8) / 2;
  const chartH = 70;
  let col = 0;

  for (let i = 0; i < chartIds.length; i++) {
    const imgData = await captureElement(chartIds[i], 2);
    const bx = M + col * (chartW + 8);

    // Chart card background
    setFill(pdf, WHITE);
    setStroke(pdf, [210, 220, 240] as [number,number,number]);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(bx, y, chartW, chartH + 14, 3, 3, 'FD');

    // Chart title
    setFill(pdf, NAVY);
    pdf.roundedRect(bx, y, chartW, 9, 3, 3, 'F');
    pdf.rect(bx, y + 5, chartW, 4, 'F'); // square off bottom corners of header
    setColor(pdf, WHITE);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(7.5);
    pdf.text(chartTitles[i], bx + chartW / 2, y + 6, { align: 'center' });

    if (imgData) {
      pdf.addImage(imgData, 'PNG', bx + 2, y + 11, chartW - 4, chartH);
    } else {
      setColor(pdf, MUTED);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.text('No data available', bx + chartW / 2, y + chartH / 2 + 11, { align: 'center' });
    }

    col++;
    if (col === 2) {
      col = 0;
      y += chartH + 18;
    }
  }

  drawPageFooter(pdf, generatedDate);

  // ══════════════════════════════════════════════════
  // PAGE 4 — STUDENTS & SUMMARY
  // ══════════════════════════════════════════════════
  pdf.addPage();
  drawPageHeader(pdf, 'Student Performance & Summary', 4, TOTAL_PAGES);
  y = 28;

  // Top Students table
  setColor(pdf, NAVY);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(13);
  pdf.text('Student Performance', M, y); y += 8;

  const sCols = [70, 45, 35, 30];
  const sHeaders = ['Student Name', 'Email', 'Volunteer Hrs', 'Registrations'];
  setFill(pdf, NAVY);
  pdf.rect(M, y, cW, 8, 'F');
  setColor(pdf, WHITE);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(7.5);
  cx = M;
  sHeaders.forEach((h, i) => { pdf.text(h, cx + 3, y + 5.5); cx += sCols[i]; });
  y += 8;

  const sortedStudents = [...students].sort((a, b) => (b.volunteer_hours || 0) - (a.volunteer_hours || 0));
  sortedStudents.slice(0, 15).forEach((s, idx) => {
    const rCount = registrations.filter(r => r.user_id === s.id).length;
    const rH = 9;
    setFill(pdf, idx % 2 === 0 ? WHITE : LIGHT);
    pdf.rect(M, y, cW, rH, 'F');
    cx = M;

    setColor(pdf, NAVY);
    pdf.setFont('helvetica', idx === 0 ? 'bold' : 'normal');
    pdf.setFontSize(7.5);
    pdf.text(s.name, cx + 3, y + 6); cx += sCols[0];

    setColor(pdf, [80, 100, 130] as [number,number,number]);
    pdf.setFont('helvetica', 'normal');
    const email = s.email.length > 28 ? s.email.slice(0, 26) + '…' : s.email;
    pdf.text(email, cx + 3, y + 6); cx += sCols[1];

    setColor(pdf, (s.volunteer_hours || 0) > 0 ? GREEN : MUTED);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${s.volunteer_hours || 0}h`, cx + 3, y + 6); cx += sCols[2];

    setColor(pdf, [80, 100, 130] as [number,number,number]);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`${rCount}`, cx + 3, y + 6);
    y += rH;
  });

  y += 12;

  // ── Summary grid ─────────────────────────────────────────────
  setColor(pdf, NAVY);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text('Programme Summary Statistics', M, y); y += 8;

  const summaryItems = [
    { label: 'Total Programs',       value: String(programs.length),      color: NAVY  },
    { label: 'Approved Programs',    value: String(approvedProgs),         color: GREEN },
    { label: 'Pending Programs',     value: String(pendingProgs),          color: AMBER },
    { label: 'Rejected Programs',    value: String(rejectedProgs),         color: RED   },
    { label: 'Total Students',       value: String(students.length),       color: NAVY  },
    { label: 'Active Students',      value: String(activeStudents),        color: GREEN },
    { label: 'Total Registrations',  value: String(registrations.length),  color: [79, 70, 229] as [number,number,number] },
    { label: 'Total Volunteer Hrs',  value: `${totalHours}h`,              color: [13, 148, 136] as [number,number,number] },
  ];

  const sBoxW = (cW - 3 * 7) / 4;
  summaryItems.forEach((item, i) => {
    const row = Math.floor(i / 4);
    const col2 = i % 4;
    const bx2 = M + col2 * (sBoxW + 7);
    const by2 = y + row * 30;

    setFill(pdf, LIGHT);
    setStroke(pdf, [210, 220, 240] as [number,number,number]);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(bx2, by2, sBoxW, 24, 2, 2, 'FD');

    // top accent
    setFill(pdf, item.color);
    pdf.roundedRect(bx2, by2, sBoxW, 3, 2, 2, 'F');
    pdf.rect(bx2, by2 + 1, sBoxW, 2, 'F');

    setColor(pdf, item.color);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(13);
    pdf.text(item.value, bx2 + sBoxW / 2, by2 + 14, { align: 'center' });

    setColor(pdf, MUTED);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(6.5);
    pdf.text(item.label, bx2 + sBoxW / 2, by2 + 21, { align: 'center' });
  });

  drawPageFooter(pdf, generatedDate);

  // ── Save ─────────────────────────────────────────────────────
  const filename = `UTHM_Analytics_Report_${now.toISOString().slice(0, 10)}.pdf`;
  pdf.save(filename);
}
