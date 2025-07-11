import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { SecurityManager } from '../utils/security';
import { InputValidator } from '../utils/validation';

interface User {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { handleError } = useErrorHandler();

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await loadUserProfile(session.user);
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await loadUserProfile(session.user);
      } else {
        setUser(null);
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (authUser: any) => {
    try {
      // Get user profile from public.users table
      const { data: profile, error } = await supabase
        .from('users')
        .select('full_name, created_at')
        .eq('id', authUser.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      const user: User = {
        id: authUser.id,
        email: authUser.email,
        full_name: profile?.full_name || null,
        created_at: profile?.created_at || authUser.created_at
      };

      setUser(user);
      await checkAdminStatus(authUser.id);
    } catch (error) {
      handleError(error, 'Loading user profile');
    }
  };

  const checkAdminStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('memberships')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (!error && data) {
        setIsAdmin(data.role === 'admin');
      }
    } catch (error) {
      handleError(error, 'Checking admin status');
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const emailValidationResult = InputValidator.validateEmail(email || '');
    if (!emailValidationResult.isValid) {
      throw new Error(emailValidationResult.errors[0]);
    }

    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    const sanitizedFullName = SecurityManager.sanitizeInput(fullName || '');
    
    if (!sanitizedFullName.trim()) {
      throw new Error('Full name is required');
    }

    try {
      // Use Supabase Auth to create user
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
      });

      if (error) {
        if (error.message?.includes('User already registered')) {
          throw new Error('An account with this email already exists. Please sign in instead.');
        }
        throw new Error(error.message || 'Registration failed');
      }

      if (data.user) {
        // Create profile in public.users table
        const { error: profileError } = await supabase
          .from('users')
          .upsert({
            id: data.user.id,
            full_name: sanitizedFullName,
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
        }

        // Create membership record
        const { error: membershipError } = await supabase
          .from('memberships')
          .upsert({
            user_id: data.user.id,
            role: 'member'
          });

        if (membershipError) {
          console.error('Membership creation error:', membershipError);
        }
      }

    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    // Validate email format
    const emailValidationResult = InputValidator.validateEmail(email);
    if (!emailValidationResult.isValid) {
      throw new Error('Invalid email format');
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password,
      });

      if (error) {
        throw new Error('Invalid email or password');
      }

      // User profile will be loaded automatically by the auth state change listener
    } catch (error) {
      throw new Error('Invalid email or password');
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setIsAdmin(false);
    } catch (error) {
      handleError(error, 'Sign out failed');
    }
  };

  const value = {
    user,
    loading,
    signUp,
    signIn,
    signOut,
    isAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}