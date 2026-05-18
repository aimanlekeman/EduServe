-- ============================================================
-- UTHM Volunteer Program Management System
-- Supabase Database Schema (Proper SQL Tables)
-- ============================================================
-- Run this entire file in Supabase SQL Editor
-- Dashboard > SQL Editor > New Query > Paste > Run
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: profiles
-- Links to Supabase auth.users
-- ============================================================
CREATE TABLE public.profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email       TEXT NOT NULL,
  name        TEXT NOT NULL,
  role        TEXT CHECK (role IN ('admin', 'program_director', 'student')) NOT NULL DEFAULT 'student',
  volunteer_hours INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: programs
-- ============================================================
CREATE TABLE public.programs (
  id               UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title            TEXT NOT NULL,
  description      TEXT,
  date             DATE NOT NULL,
  time             TIME NOT NULL,
  location         TEXT NOT NULL,
  volunteer_hours  INTEGER NOT NULL DEFAULT 1,
  max_participants INTEGER,
  status           TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  qr_code          TEXT UNIQUE,
  rejection_reason TEXT,
  created_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: registrations
-- ============================================================
CREATE TABLE public.registrations (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  program_id  UUID REFERENCES public.programs(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  status      TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(program_id, user_id)
);

-- ============================================================
-- TABLE: attendance
-- ============================================================
CREATE TABLE public.attendance (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  program_id  UUID REFERENCES public.programs(id) ON DELETE CASCADE NOT NULL,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  scanned_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(program_id, user_id)
);

-- ============================================================
-- TABLE: certificates
-- ============================================================
CREATE TABLE public.certificates (
  id              UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  program_id      UUID REFERENCES public.programs(id) ON DELETE CASCADE NOT NULL,
  user_id         UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  certificate_no  TEXT UNIQUE NOT NULL,
  issued_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(program_id, user_id)
);

-- ============================================================
-- TABLE: achievements  (shown on public homepage)
-- ============================================================
CREATE TABLE public.achievements (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT,
  date        DATE,
  category    TEXT DEFAULT 'general',  -- 'award', 'milestone', 'recognition', 'general'
  icon        TEXT DEFAULT 'trophy',   -- for frontend icon selection
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements   ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- PROGRAMS policies
CREATE POLICY "programs_select_all"
  ON public.programs FOR SELECT
  USING (
    status = 'approved'
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'program_director'))
  );

CREATE POLICY "programs_insert_directors"
  ON public.programs FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'program_director'))
  );

CREATE POLICY "programs_update"
  ON public.programs FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );

CREATE POLICY "programs_delete"
  ON public.programs FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );

-- REGISTRATIONS policies
CREATE POLICY "registrations_select"
  ON public.registrations FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'program_director'))
  );

CREATE POLICY "registrations_insert_own"
  ON public.registrations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "registrations_update_directors"
  ON public.registrations FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'program_director'))
  );

CREATE POLICY "registrations_delete"
  ON public.registrations FOR DELETE
  TO authenticated
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'program_director'))
  );

-- ATTENDANCE policies
CREATE POLICY "attendance_select"
  ON public.attendance FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'program_director'))
  );

CREATE POLICY "attendance_insert_own"
  ON public.attendance FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- CERTIFICATES policies
CREATE POLICY "certificates_select"
  ON public.certificates FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'program_director'))
  );

CREATE POLICY "certificates_insert"
  ON public.certificates FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin', 'program_director'))
  );

-- ACHIEVEMENTS: public read
CREATE POLICY "achievements_select_public"
  ON public.achievements FOR SELECT
  USING (true);

CREATE POLICY "achievements_manage_admin"
  ON public.achievements FOR ALL
  TO authenticated
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin')
  );

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update volunteer hours when attendance recorded
CREATE OR REPLACE FUNCTION public.update_volunteer_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET volunteer_hours = volunteer_hours + COALESCE(
    (SELECT volunteer_hours FROM public.programs WHERE id = NEW.program_id), 0
  )
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_attendance_recorded
  AFTER INSERT ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_volunteer_hours();

-- Auto-generate QR code on program creation
CREATE OR REPLACE FUNCTION public.generate_qr_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.qr_code IS NULL THEN
    NEW.qr_code := 'QR-' || upper(substring(NEW.id::text, 1, 8));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_program_created
  BEFORE INSERT ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.generate_qr_code();

-- Update updated_at timestamps
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER programs_updated_at
  BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- SAMPLE DATA: Achievements for homepage
-- ============================================================
INSERT INTO public.achievements (title, description, date, category, icon) VALUES
  ('Best Volunteer Program 2024', 'UTHM Faculty recognized for outstanding volunteer program management and student engagement.', '2024-11-15', 'award', 'trophy'),
  ('500+ Student Volunteers', 'Reached the milestone of 500 registered student volunteers across all faculties at UTHM.', '2024-09-01', 'milestone', 'users'),
  ('Community Excellence Award', 'Awarded by the Ministry of Education for exceptional community service and social impact.', '2024-07-20', 'recognition', 'star'),
  ('10,000 Volunteer Hours', 'Collective volunteer hours by UTHM students surpassed 10,000 hours in a single academic year.', '2024-05-10', 'milestone', 'clock');

-- ============================================================
-- HOW TO USE
-- ============================================================
-- 1. Go to your Supabase project dashboard
-- 2. Open SQL Editor > New Query
-- 3. Paste this entire file
-- 4. Click Run
-- 5. Update your .env with:
--    VITE_SUPABASE_URL=https://your-project.supabase.co
--    VITE_SUPABASE_ANON_KEY=your-anon-key
--
-- FIRST ADMIN ACCOUNT:
-- Register normally with role 'student', then manually update in:
-- Table Editor > profiles > find your row > change role to 'admin'
-- ============================================================
