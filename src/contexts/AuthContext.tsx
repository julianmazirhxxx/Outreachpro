import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { SecurityManager } from '../utils/security';
import { InputValidator } from '../utils/validation';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { handleError } = useErrorHandler();

  useEffect(() => {
    // Check if supabase is properly configured
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        handleError(error, 'Getting initial session');
        setLoading(false);
        return;
      }
      
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdminStatus(session.user.id);
      }
      setLoading(false);
    }).catch((error) => {
      handleError(error, 'Session initialization');
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          checkAdminStatus(session.user.id);
        } else {
          setIsAdmin(false);
        }
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminStatus = async (userId: string) => {
    try {
      if (!supabase) {
        return;
      }

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

    if (!supabase) {
      throw new Error('Authentication not available in demo mode');
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: sanitizedFullName,
          },
        },
      });

      if (error) {
        console.error('Supabase signup error:', error);
        throw new Error(error.message || 'Registration failed');
      }

      // Create user profile and membership
      if (data.user) {
          await supabase.from('users').insert({
            id: data.user.id,
            full_name: sanitizedFullName,
          });

          await supabase.from('memberships').insert({
            user_id: data.user.id,
            role: 'member',
          });
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      throw new Error(error.message || 'Registration failed. Please try again.');
    }
  };

  const signIn = async (email: string, password: string) => {
    // Validate email format
    const emailValidationResult = InputValidator.validateEmail(email);
    if (!emailValidationResult.isValid) {
      throw new Error('Invalid email format');
    }

    if (!supabase) {
      throw new Error('Authentication not available in demo mode');
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) {
      throw error;
    }
  };

  const signOut = async () => {
    if (!supabase) {
      return;
    }
    
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      // Handle case where session is already invalid/expired
      if (error.message?.includes('session_not_found')) {
        console.warn('Session already expired or invalid, proceeding with local sign out');
        return;
      }
      throw error;
    }
  };

  const value = {
    user,
    session,
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