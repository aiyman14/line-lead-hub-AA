import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from '@/lib/constants';

interface Profile {
  id: string;
  factory_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  department: string | null;
}

interface UserRole {
  role: AppRole;
  factory_id: string | null;
}

interface Factory {
  id: string;
  name: string;
  slug: string;
  subscription_tier: string;
  cutoff_time: string;
  timezone: string;
  logo_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: UserRole[];
  factory: Factory | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isAdminOrHigher: () => boolean;
  isSuperAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [factory, setFactory] = useState<Factory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer data fetching to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setFactory(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchUserData(userId: string) {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData as Profile);

        // Fetch roles
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role, factory_id')
          .eq('user_id', userId);

        if (rolesData) {
          setRoles(rolesData as UserRole[]);
        }

        // Fetch factory if user has one
        if (profileData.factory_id) {
          const { data: factoryData } = await supabase
            .from('factory_accounts')
            .select('*')
            .eq('id', profileData.factory_id)
            .maybeSingle();

          if (factoryData) {
            setFactory(factoryData as Factory);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  }

  async function signUp(email: string, password: string, fullName: string) {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setRoles([]);
    setFactory(null);
  }

  function hasRole(role: AppRole): boolean {
    return roles.some(r => r.role === role);
  }

  function isAdminOrHigher(): boolean {
    return roles.some(r => ['admin', 'owner', 'superadmin'].includes(r.role));
  }

  function isSuperAdmin(): boolean {
    return roles.some(r => r.role === 'superadmin');
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        factory,
        loading,
        signIn,
        signUp,
        signOut,
        hasRole,
        isAdminOrHigher,
        isSuperAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
