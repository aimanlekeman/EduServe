# UTHM Volunteer Program Management System v2.0

A rebuilt, minimalist dark-blue/silver themed web app for managing volunteer programs at Universiti Tun Hussein Onn Malaysia.

---

## What Changed From v1

| Before | After |
|--------|-------|
| 5 roles (Admin, Committee, Patron, Lecturer, Student) | 3 roles (Admin, **Program Director**, Student) |
| KV Store database (not proper SQL) | Proper Supabase PostgreSQL tables |
| No public homepage | **Homepage** with achievements & upcoming events |
| Light default theme | **Dark blue / silver minimalist** design |
| Hono/Deno backend server | Direct Supabase client (no server needed) |

### New Program Approval Flow
```
Program Director creates program
        ↓
   Admin approves
        ↓
 Students see & register
        ↓
Program Director approves registrations
        ↓
Students scan QR → Attendance recorded
        ↓
Certificate auto-generated
```

---

## Quick Setup (Step by Step)

### Step 1 — Set up Supabase Database

1. Go to [supabase.com](https://supabase.com) and open your project
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open `supabase_schema.sql` from this folder and paste the entire content
5. Click **Run**

You should see tables created: `profiles`, `programs`, `registrations`, `attendance`, `certificates`, `achievements`

### Step 2 — Get Your API Keys

1. In Supabase Dashboard → **Settings** → **API**
2. Copy **Project URL** and **anon/public key**

### Step 3 — Configure Environment

```bash
# In your project folder:
cp .env.example .env
```

Then open `.env` and fill in:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Step 4 — Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

---

## Creating Your First Admin Account

Since admin accounts cannot be self-registered:

1. Register normally at `/register` — choose **Student** role
2. Go to Supabase → **Table Editor** → `profiles`
3. Find your row and change `role` from `student` to `admin`
4. Refresh your browser — you'll now have Admin access

---

## File Structure

```
src/
├── App.tsx                          ← Main entry + routing
├── styles/globals.css               ← Design system (CSS vars)
├── lib/supabase.ts                  ← Supabase client + types
├── contexts/AuthContext.tsx         ← Auth state management
└── components/
    ├── HomePage.tsx                 ← Public homepage
    ├── auth/
    │   ├── LoginPage.tsx
    │   └── RegisterPage.tsx
    ├── layout/
    │   └── DashboardLayout.tsx      ← Sidebar layout
    └── dashboards/
        ├── AdminDashboard.tsx
        ├── ProgramDirectorDashboard.tsx
        └── StudentDashboard.tsx

supabase_schema.sql                  ← Run this first in Supabase!
.env.example                         ← Copy to .env with your keys
```

---

## User Roles

### Admin
- View all programs, users, registrations
- Approve / reject programs submitted by Program Directors
- Manage achievements shown on homepage
- Delete users and programs

### Program Director (formerly Committee)
- Create volunteer programs (submitted for Admin approval)
- View QR codes for approved programs
- Approve / reject student registrations
- View program statistics

### Student
- Browse approved upcoming programs
- Register for programs
- Record attendance via QR code entry
- View and collect certificates

---

## Design System

Colors are defined as CSS variables in `src/styles/globals.css`:

```css
--bg-primary:    #060C18   /* Deep navy background */
--bg-card:       #0E1C30   /* Card surface */
--blue-600:      #2563EB   /* Primary blue */
--blue-400:      #60A5FA   /* Accent blue */
--silver-400:    #94A3B8   /* Silver text */
--text-primary:  #EFF6FF   /* Near white */
```

Fonts: **Sora** (headings) + **DM Sans** (body) — loaded from Google Fonts

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS + CSS Variables |
| Icons | Lucide React |
| Notifications | Sonner |
| Backend / DB | Supabase (PostgreSQL + Auth) |
| Build | Vite |

---

## Troubleshooting

**"Missing Supabase environment variables"**
→ Make sure `.env` file exists with correct keys (not `.env.example`)

**User registered but sees wrong dashboard**
→ Check `profiles` table in Supabase — the role might not have been saved. Update manually if needed.

**RLS policy errors**
→ Re-run `supabase_schema.sql` to ensure all policies are applied

**Programs not showing on homepage**
→ Programs must have `status = 'approved'` and a future `date` to appear

---

*UTHM Final Year Project — Volunteer Program Management System v2.0*
