import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLoadingState } from '../hooks/useLoadingState';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { SecurityManager } from '../utils/security';
import { InputValidator } from '../utils/validation';
import { ErrorMessage } from './common/ErrorMessage';
import { LoadingSpinner } from './common/LoadingSpinner';
import { Mail, Lock, User, Eye, EyeOff, Crown, Star, Zap, CheckCircle } from 'lucide-react';

export function Auth() {
  const { user, signIn, signUp, loading } = useAuth();
  const { theme } = useTheme();
  const { handleError } = useErrorHandler();
  const { isLoading, error, setError, executeAsync } = useLoadingState();
  const [successMessage, setSuccessMessage] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      setError('Email and password are required');
      return;
    }

    // Validate inputs before submission
    const emailValidation = InputValidator.validateEmail(formData.email);
    if (!emailValidation.isValid) {
      setError(emailValidation.errors[0]);
      return;
    }

    if (isSignUp && !formData.fullName) {
      setError('Full name is required for registration');
      return;
    }

    await executeAsync(async () => {
      if (isSignUp) {
        try {
          await signUp(formData.email, formData.password, formData.fullName);
          // If signup is successful, show success message and switch to login
          setSuccessMessage('Account created successfully! Please sign in with your credentials.');
          setIsSignUp(false);
          setFormData({ email: formData.email, password: '', fullName: '' }); // Keep email, clear password
        } catch (error) {
          // Handle specific signup errors
          if (error instanceof Error) {
            if (error.message?.includes('User already registered') || 
                error.message?.includes('already exists')) {
              setError('An account with this email already exists. Please sign in instead.');
              setIsSignUp(false);
              setFormData({ email: formData.email, password: '', fullName: '' }); // Keep email, clear password
              return;
            }
            if (error.message?.includes('Supabase is not configured')) {
              setError('Demo mode: Authentication is not available. Please set up Supabase to enable authentication.');
              return;
            }
            throw new Error(error.message);
          }
          throw new Error('Registration failed');
        }
      } else {
        try {
          await signIn(formData.email, formData.password);
        } catch (error) {
          if (error instanceof Error && error.message?.includes('Supabase is not configured')) {
            setError('Demo mode: Authentication is not available. Please set up Supabase to enable authentication.');
            return;
          }
          throw error;
        }
      }
    }, {
      errorMessage: 'Authentication failed. Please check your credentials and try again.'
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const sanitizedValue = SecurityManager.sanitizeInput(e.target.value);
    setFormData({
      ...formData,
      [e.target.name]: sanitizedValue,
    });
    // Clear messages when user starts typing
    if (error) setError('');
    if (successMessage) setSuccessMessage('');
  };

  const handleToggleMode = () => {
    setIsSignUp(!isSignUp);
    setError('');
    setSuccessMessage('');
    setFormData({ email: '', password: '', fullName: '' });
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        theme === 'gold' 
          ? 'bg-gradient-to-br from-black via-gray-900 to-black'
          : 'bg-gray-50'
      }`}>
        <LoadingSpinner size="lg" message="Loading authentication..." />
      </div>
    );
  }

  if (theme === 'gold') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-black via-gray-900 to-black py-12 px-4 sm:px-6 lg:px-8">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-yellow-400/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-yellow-600/5 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-md w-full space-y-8 relative z-10">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 gold-gradient rounded-xl flex items-center justify-center shadow-2xl mb-6">
              <Crown className="h-8 w-8 text-black" />
            </div>
            <h2 className="mt-6 text-4xl font-bold gold-text-gradient">
              {isSignUp ? 'Join the Elite' : 'Welcome Back'}
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              {isSignUp
                ? 'Start your premium outreach journey'
                : 'Access your elite dashboard'}
            </p>
            
            {/* Premium features showcase */}
            <div className="mt-6 flex justify-center space-x-6">
              <div className="flex items-center text-xs text-gray-400">
                <Star className="h-3 w-3 text-yellow-400 mr-1" />
                Premium AI
              </div>
              <div className="flex items-center text-xs text-gray-400">
                <Zap className="h-3 w-3 text-yellow-400 mr-1" />
                Elite Results
              </div>
              <div className="flex items-center text-xs text-gray-400">
                <Crown className="h-3 w-3 text-yellow-400 mr-1" />
                VIP Support
              </div>
            </div>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              {isSignUp && (
                <div>
                  <label htmlFor="fullName" className="sr-only">
                    Full Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-yellow-400" />
                    </div>
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      required={isSignUp}
                      value={formData.fullName}
                      onChange={handleInputChange}
                      className="appearance-none relative block w-full pl-10 pr-3 py-3 border border-yellow-400/30 placeholder-gray-500 text-gray-200 rounded-lg bg-black/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent focus:z-10 sm:text-sm"
                      placeholder="Full Name"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="email" className="sr-only">
                  Email address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-yellow-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={handleInputChange}
                    className="appearance-none relative block w-full pl-10 pr-3 py-3 border border-yellow-400/30 placeholder-gray-500 text-gray-200 rounded-lg bg-black/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent focus:z-10 sm:text-sm"
                    placeholder="Email address"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="sr-only">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-yellow-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={handleInputChange}
                    className="appearance-none relative block w-full pl-10 pr-10 py-3 border border-yellow-400/30 placeholder-gray-500 text-gray-200 rounded-lg bg-black/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent focus:z-10 sm:text-sm"
                    placeholder="Password"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-yellow-400 hover:text-yellow-300"
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <ErrorMessage 
                message={error} 
                onDismiss={() => setError('')}
              />
            )}

            {successMessage && (
              <div className={`rounded-lg border p-4 ${
                theme === 'gold'
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-green-50 border-green-200 text-green-800'
              }`}>
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <CheckCircle className="h-5 w-5" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium">{successMessage}</p>
                  </div>
                  <button
                    onClick={() => setSuccessMessage('')}
                    className="ml-auto text-current hover:opacity-70"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-black gold-gradient hover-gold focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
                ) : isSignUp ? (
                  <>
                    <Crown className="h-4 w-4 mr-2" />
                    Join Elite
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Access Dashboard
                  </>
                )}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={handleToggleMode}
                className="text-sm text-yellow-400 hover:text-yellow-300 transition-colors"
              >
                {isSignUp
                  ? 'Already elite? Sign in'
                  : "Ready to join the elite? Sign up"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Blue theme (original design)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-blue-600 rounded-xl flex items-center justify-center">
            <Mail className="h-6 w-6 text-white" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {isSignUp
              ? 'Start your cold outreach journey'
              : 'Sign in to your account'}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {isSignUp && (
              <div>
                <label htmlFor="fullName" className="sr-only">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    required={isSignUp}
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className="appearance-none relative block w-full pl-10 pr-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:z-10 sm:text-sm"
                    placeholder="Full Name"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleInputChange}
                  className="appearance-none relative block w-full pl-10 pr-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:z-10 sm:text-sm"
                  placeholder="Email address"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  className="appearance-none relative block w-full pl-10 pr-10 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:z-10 sm:text-sm"
                  placeholder="Password"
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <ErrorMessage 
              message={error} 
              onDismiss={() => setError('')}
            />
          )}

          {successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm flex items-start">
              <CheckCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                {successMessage}
              </div>
              <button
                onClick={() => setSuccessMessage('')}
                className="ml-2 text-green-600 hover:text-green-800"
              >
                ×
              </button>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : isSignUp ? (
                'Create Account'
              ) : (
                'Sign In'
              )}
            </button>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={handleToggleMode}
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              {isSignUp
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}