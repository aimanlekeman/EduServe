import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Create a .env file with:');
  console.error('VITE_SUPABASE_URL=https://your-project.supabase.co');
  console.error('VITE_SUPABASE_ANON_KEY=your-anon-key');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export type UserRole = 'admin' | 'program_director' | 'student';
export type ProgramStatus = 'pending' | 'approved' | 'rejected';
export type RegistrationStatus = 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  volunteer_hours: number;
  matric_number: string | null;
  phone_number: string | null;
  created_at: string;
  updated_at: string;
}

export interface Program {
  id: string;
  title: string;
  description: string | null;
  date: string;
  time: string;
  location: string;
  volunteer_hours: number;
  max_participants: number | null;
  status: ProgramStatus;
  qr_code: string | null;
  rejection_reason: string | null;
  image_url: string | null;
  organizer: string | null;
  registration_deadline: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joined
  creator?: Pick<Profile, 'name' | 'email'>;
}

export interface Registration {
  id: string;
  program_id: string;
  user_id: string;
  status: RegistrationStatus;
  created_at: string;
  // joined
  program?: Pick<Program, 'title' | 'date' | 'location' | 'volunteer_hours'>;
  user?: Pick<Profile, 'name' | 'email'>;
}

export interface AttendanceRecord {
  id: string;
  program_id: string;
  user_id: string;
  scanned_at: string;
  program?: Pick<Program, 'title' | 'date' | 'volunteer_hours'>;
}

export interface Certificate {
  id: string;
  program_id: string;
  user_id: string;
  certificate_no: string;
  issued_at: string;
  program?: Pick<Program, 'title' | 'date' | 'volunteer_hours'>;
}

export interface Achievement {
  id: string;
  title: string;
  description: string | null;
  date: string | null;
  category: string;
  icon: string;
  image_url: string | null;
  created_at: string;
}
