import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';
import { highestRole, type StaffRole } from '@/lib/permissions';

interface AdminAuthState {
  user: User | null;
  session: Session | null;
  // Highest clinic role (admin, staff or doctor), or null for everyone else
  role: StaffRole | null;
  loading: boolean;
  error: string | null;
}

export const useAdminAuth = () => {
  const [authState, setAuthState] = useState<AdminAuthState>({
    user: null,
    session: null,
    role: null,
    loading: true,
    error: null,
  });

  // RLS only returns the signed-in user's own role rows
  const fetchStaffRole = async (userId: string): Promise<StaffRole | null> => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (error) return null;
    return highestRole((data ?? []).map((row) => row.role));
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const user = session?.user ?? null;
        let role: StaffRole | null = null;

        if (user) {
          // Use setTimeout to avoid deadlock
          setTimeout(async () => {
            role = await fetchStaffRole(user.id);
            setAuthState({
              user,
              session,
              role,
              loading: false,
              error: null,
            });
          }, 0);
        } else {
          setAuthState({
            user: null,
            session: null,
            role: null,
            loading: false,
            error: null,
          });
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const user = session?.user ?? null;
      let role: StaffRole | null = null;

      if (user) {
        role = await fetchStaffRole(user.id);
      }

      setAuthState({
        user,
        session,
        role,
        loading: false,
        error: null,
      });
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setAuthState(prev => ({
          ...prev,
          loading: false,
          error: error.message,
        }));
        return { success: false, error: error.message };
      }

      if (data.user) {
        const role = await fetchStaffRole(data.user.id);
        
        if (!role) {
          await supabase.auth.signOut();
          setAuthState(prev => ({
            ...prev,
            loading: false,
            error: "This account doesn't have clinic staff access.",
          }));
          return { success: false, error: "This account doesn't have clinic staff access." };
        }

        setAuthState({
          user: data.user,
          session: data.session,
          role,
          loading: false,
          error: null,
        });

        return { success: true };
      }

      return { success: false, error: 'Login failed' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      return { success: false, error: errorMessage };
    }
  };

  const signOut = async () => {
    setAuthState(prev => ({ ...prev, loading: true }));
    
    try {
      await supabase.auth.signOut();
      setAuthState({
        user: null,
        session: null,
        role: null,
        loading: false,
        error: null,
      });
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Logout failed';
      setAuthState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
      }));
      return { success: false, error: errorMessage };
    }
  };

  return {
    ...authState,
    signIn,
    signOut,
  };
};
