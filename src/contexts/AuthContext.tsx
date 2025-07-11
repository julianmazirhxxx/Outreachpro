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
    // Check if user is logged in from localStorage
    const storedUser = SecurityManager.secureStorage.getItem<User>('currentUser');
    if (storedUser) {
      setUser(storedUser);
      checkAdminStatus(storedUser.id);
    }
    setLoading(false);
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

  // Simple password hashing (in production, use bcrypt or similar)
  const hashPassword = async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
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
      throw new Error('Database connection not available');
    }

    try {
      // Check if user already exists
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('email')
        .eq('email', email.trim().toLowerCase())
        .single();

      if (existingUser) {
        throw new Error('An account with this email already exists. Please sign in instead.');
      }

      // Hash the password
      const hashedPassword = await hashPassword(password);

      // Create new user
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          email: email.trim().toLowerCase(),
          password: hashedPassword,
          full_name: sanitizedFullName,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('An account with this email already exists. Please sign in instead.');
        }
        throw new Error(error.message || 'Registration failed');
      }

      // Create membership record
      await supabase.from('memberships').insert({
        user_id: newUser.id,
        role: 'member'
      });

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

    if (!supabase) {
      throw new Error('Database connection not available');
    }

    try {
      // Hash the password to compare
      const hashedPassword = await hashPassword(password);

      // Find user with matching email and password
      const { data: userData, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .eq('password', hashedPassword)
        .single();

      if (error || !userData) {
        throw new Error('Invalid email or password');
      }

      // Set user in state and localStorage
      const user: User = {
        id: userData.id,
        email: userData.email,
        full_name: userData.full_name,
        created_at: userData.created_at
      };

      setUser(user);
      SecurityManager.secureStorage.setItem('currentUser', user);
      checkAdminStatus(user.id);

    } catch (error) {
      throw new Error('Invalid email or password');
    }
  };

  const signOut = async () => {
    setUser(null);
    setIsAdmin(false);
    SecurityManager.secureStorage.removeItem('currentUser');
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