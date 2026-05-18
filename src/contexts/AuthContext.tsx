import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile, UserRole } from '../lib/supabase';

interface AuthContextType {
  user: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string, role: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string): Promise<void> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data && !error) {
      setUser(data as Profile);
    } else {
      setUser(null);
    }
  };

  const refreshUser = async (): Promise<void> => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      await fetchProfile(authUser.id);
    }
  };

  useEffect(() => {
    const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
      Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Auth timeout')), ms)
        ),
      ]);

    let initialised = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        try {
          if (session?.user) {
            await withTimeout(fetchProfile(session.user.id), 8000);
          } else {
            setUser(null);
          }
        } catch (err) {
          console.error('Auth error:', err);
          setUser(null);
        } finally {
          if (!initialised) {
            initialised = true;
            setLoading(false);
          }
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<void> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (
    email: string,
    password: string,
    name: string,
    role: UserRole
  ): Promise<void> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, role },
      },
    });
    if (error) throw error;

    // If email confirmation is disabled, the profile trigger fires immediately.
    // If confirmation is enabled, user must verify email first.
    if (data.user && !data.user.email_confirmed_at) {
      // Profile will be created by trigger when email is confirmed.
      // For dev, Supabase auto-confirms unless you enable email confirmations.
    }
  };

  const signOut = async (): Promise<void> => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
