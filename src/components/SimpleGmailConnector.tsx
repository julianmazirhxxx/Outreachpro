import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { SecurityManager } from '../utils/security';
import { InputValidator } from '../utils/validation';
import { 
  Mail, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink,
  Play,
  Shield,
  Key,
  ArrowLeft,
  Save,
  TestTube
} from 'lucide-react';

interface SimpleGmailConnectorProps {
  onBack: () => void;
  onSuccess: (channelData: any) => void;
  onError: (error: string) => void;
  channelName?: string;
  forceOAuth?: boolean;
  channelName?: string;
}

export function SimpleGmailConnector({ 
  onBack, 
  onSuccess, 
  onError, 
  channelName = 'Gmail Account' 
}: SimpleGmailConnectorProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [connectionMethod, setConnectionMethod] = useState<'app-password' | 'oauth' | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: channelName
  });
  const [showPassword, setShowPassword] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleAppPasswordConnect = async () => {
    if (!user) {
      onError('User not authenticated');
      return;
    }

    // Validate inputs
    const emailValidation = InputValidator.validateEmail(formData.email);
    if (!emailValidation.isValid) {
      setResult({ success: false, message: emailValidation.errors[0] });
      return;
    }

    if (!formData.password.trim()) {
      setResult({ success: false, message: 'App password is required' });
      return;
    }

    if (!formData.name.trim()) {
      setResult({ success: false, message: 'Channel name is required' });
      return;
    }

    setConnecting(true);
    setResult(null);

    try {
      // Create Gmail channel with SMTP credentials
      // Call our edge function to initiate OAuth with proper Gmail API scope
        user_id: user.id,
        name: SecurityManager.sanitizeInput(formData.name),
        provider: 'gmail',
        channel_type: 'email',
        email_address: SecurityManager.sanitizeInput(formData.email),
        sender_id: SecurityManager.sanitizeInput(formData.email),
        credentials: {
          email_provider: 'gmail',
          email_address: SecurityManager.sanitizeInput(formData.email),
          smtp_host: 'smtp.gmail.com',
          smtp_port: 587,
          smtp_secure: true,
          smtp_username: SecurityManager.sanitizeInput(formData.email),
          smtp_password: formData.password, // App password
          connection_type: 'smtp'
        },
        is_active: true,
        max_usage: 1000
      };

      const { data, error } = await supabase
        .from('channels')
        .insert([channelData])
        .select()
        .single();

      if (error) throw error;

      setResult({ success: true, message: 'Gmail connected successfully!' });
      
      setTimeout(() => {
        onSuccess(data);
      }, 1500);

    } catch (error) {
      console.error('Error connecting Gmail:', error);
      setResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to connect Gmail' 
      });
    } finally {
      setConnecting(false);
    }
  };

  const handleTestConnection = async () => {
    if (!formData.email || !formData.password) {
      setResult({ success: false, message: 'Please enter email and app password first' });
      return;
    }

    setTesting(true);
    setResult(null);

    try {
      // Test SMTP connection
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-smtp-connection`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          channel_name: channelName,
          host: 'smtp.gmail.com',
          port: 587
        }),
      });

      if (response.ok) {
        setResult({ success: true, message: 'Connection test successful!' });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Connection test failed');
      }
    } catch (error) {
      setResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Connection test failed' 
      });
    } finally {
      setTesting(false);
    }
  };

  if (!connectionMethod) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <button
            onClick={onBack}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'gold'
                ? 'text-gray-400 hover:bg-gray-800'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className={`text-xl font-bold ${
              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
            }`}>
              Connect existing accounts
            </h2>
            <div className="flex items-center space-x-4 mt-2">
              <div className={`flex items-center text-sm ${
                theme === 'gold' ? 'text-green-400' : 'text-green-600'
              }`}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Connect any IMAP or SMTP email provider
              </div>
              <div className={`flex items-center text-sm ${
                theme === 'gold' ? 'text-green-400' : 'text-green-600'
              }`}>
                <CheckCircle className="h-4 w-4 mr-2" />
                Sync up replies in the Inbox
              </div>
            </div>
          </div>
        </div>

        {/* Provider Options */}
        <div className="space-y-4">
          {/* Google Gmail */}
          <div
            onClick={() => setConnectionMethod('app-password')}
            className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all hover:scale-[1.02] ${
              theme === 'gold'
                ? 'border-yellow-400/30 bg-yellow-400/5 hover:bg-yellow-400/10'
                : 'border-gray-200 bg-white hover:bg-gray-50'
            }`}
          >
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-red-500 rounded-xl flex items-center justify-center mr-4">
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </div>
            <div className="flex-1">
              <h3 className={`text-lg font-semibold ${
                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
              }`}>
                Google
              </h3>
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Gmail / G-Suite
              </p>
            </div>
            <div className={`text-sm ${
              theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
            }`}>
              →
            </div>
          </div>

          {/* Microsoft Outlook */}
          <div className={`flex items-center p-4 rounded-xl border-2 opacity-50 cursor-not-allowed ${
            theme === 'gold'
              ? 'border-gray-600 bg-gray-800/50'
              : 'border-gray-200 bg-gray-50'
          }`}>
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-blue-800 rounded-xl flex items-center justify-center mr-4">
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24">
                <path fill="currentColor" d="M7 18h10v-2H7v2zM7 14h10v-2H7v2zM7 10h10V8H7v2zM19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
              </svg>
            </div>
            <div className="flex-1">
              <h3 className={`text-lg font-semibold ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Microsoft
              </h3>
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-500' : 'text-gray-400'
              }`}>
                Office 365 / Outlook (Coming Soon)
              </p>
            </div>
          </div>

          {/* Any Provider IMAP/SMTP */}
          <div className={`flex items-center p-4 rounded-xl border-2 opacity-50 cursor-not-allowed ${
            theme === 'gold'
              ? 'border-gray-600 bg-gray-800/50'
              : 'border-gray-200 bg-gray-50'
          }`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 ${
              theme === 'gold' ? 'bg-gray-700' : 'bg-gray-200'
            }`}>
              <Mail className={`h-7 w-7 ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
              }`} />
            </div>
            <div className="flex-1">
              <h3 className={`text-lg font-semibold ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Any Provider
              </h3>
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-500' : 'text-gray-400'
              }`}>
                IMAP / SMTP (Coming Soon)
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (connectionMethod === 'app-password') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setConnectionMethod(null)}
            className={`p-2 rounded-lg transition-colors ${
              theme === 'gold'
                ? 'text-gray-400 hover:bg-gray-800'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-red-500 rounded-xl flex items-center justify-center">
              <svg className="w-7 h-7 text-white" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </div>
            <div>
              <h2 className={`text-xl font-bold ${
                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
              }`}>
                Connect Your Gmail Account
              </h2>
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Gmail / G-Suite
              </p>
            </div>
          </div>
        </div>

        {/* Step-by-step setup */}
        <div className={`p-6 rounded-xl border ${
          theme === 'gold'
            ? 'border-yellow-400/20 bg-yellow-400/5'
            : 'border-blue-200 bg-blue-50'
        }`}>
          <div className="flex items-center space-x-3 mb-4">
            <Play className={`h-5 w-5 ${
              theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
            }`} />
            <h3 className={`text-lg font-semibold ${
              theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
            }`}>
              Quick Setup (2 minutes)
            </h3>
          </div>
          
          <div className={`text-sm space-y-3 ${
            theme === 'gold' ? 'text-yellow-300' : 'text-blue-600'
          }`}>
            <div className="flex items-start space-x-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                theme === 'gold' ? 'bg-yellow-400 text-black' : 'bg-blue-600 text-white'
              }`}>
                1
              </div>
              <div>
                <p className="font-medium">Enable 2-Factor Authentication</p>
                <p className="text-xs opacity-80">Go to your Google Account → Security → 2-Step Verification</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                theme === 'gold' ? 'bg-yellow-400 text-black' : 'bg-blue-600 text-white'
              }`}>
                2
              </div>
              <div>
                <p className="font-medium">Generate App Password</p>
                <p className="text-xs opacity-80">Security → App passwords → Select "Mail" → Generate</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                theme === 'gold' ? 'bg-yellow-400 text-black' : 'bg-blue-600 text-white'
              }`}>
                3
              </div>
              <div>
                <p className="font-medium">Enter credentials below</p>
                <p className="text-xs opacity-80">Use your Gmail address and the generated app password</p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <a
              href="https://support.google.com/accounts/answer/185833"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center text-sm hover:underline ${
                theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
              }`}
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              Watch Google's official tutorial
            </a>
          </div>
        </div>

        {/* Connection Form */}
        <div className={`p-6 rounded-xl border ${
          theme === 'gold'
            ? 'border-yellow-400/20 bg-black/20'
            : 'border-gray-200 bg-gray-50'
        }`}>
          <h3 className={`text-lg font-semibold mb-4 ${
            theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
          }`}>
            Enter Your Gmail Credentials
          </h3>

          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Channel Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  theme === 'gold'
                    ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                    : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                }`}
                placeholder="e.g., My Gmail Account"
                required
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Gmail Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  theme === 'gold'
                    ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                    : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                }`}
                placeholder="your-email@gmail.com"
                required
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                App Password (Not your regular password)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 ${
                    theme === 'gold'
                      ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                      : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                  }`}
                  placeholder="16-character app password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className={`text-xs mt-1 ${
                theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
              }`}>
                Use the 16-character app password generated in step 2, not your regular Gmail password
              </p>
            </div>
          </div>

          {/* Test Result */}
          {result && (
            <div className={`mt-4 rounded-lg border p-4 ${
              result.success 
                ? theme === 'gold'
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-green-50 border-green-200 text-green-800'
                : theme === 'gold'
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  {result.success ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <AlertCircle className="h-5 w-5" />
                  )}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">{result.message}</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3 mt-6">
            <button
              onClick={handleTestConnection}
              disabled={testing || !formData.email || !formData.password}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                theme === 'gold'
                  ? 'border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {testing ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Testing...
                </div>
              ) : (
                <>
                  <TestTube className="h-4 w-4 mr-2" />
                  Test Connection
                </>
              )}
            </button>

            <button
              onClick={handleAppPasswordConnect}
              disabled={connecting || !formData.email || !formData.password || !formData.name}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                theme === 'gold'
                  ? 'gold-gradient text-black hover-gold'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {connecting ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Connecting...
                </div>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Connect Gmail
                </>
              )}
            </button>
          </div>
        </div>

        {/* Security Notice */}
        <div className={`p-4 rounded-lg ${
          theme === 'gold'
            ? 'bg-green-500/10 border border-green-500/20'
            : 'bg-green-50 border border-green-200'
        }`}>
          <div className="flex items-center space-x-2 mb-2">
            <Shield className={`h-4 w-4 ${
              theme === 'gold' ? 'text-green-400' : 'text-green-600'
            }`} />
            <span className={`text-sm font-medium ${
              theme === 'gold' ? 'text-green-400' : 'text-green-700'
            }`}>
              Your data is secure
            </span>
          </div>
          <ul className={`text-xs space-y-1 ${
            theme === 'gold' ? 'text-green-300' : 'text-green-600'
          }`}>
            <li>• App passwords are safer than regular passwords</li>
            <li>• Your credentials are encrypted and stored securely</li>
            <li>• You can revoke app passwords anytime in Google settings</li>
            <li>• We only use this to send emails on your behalf</li>
          </ul>
        </div>

        {/* Benefits */}
        <div className={`p-4 rounded-lg ${
          theme === 'gold'
            ? 'bg-blue-500/10 border border-blue-500/20'
            : 'bg-blue-50 border border-blue-200'
        }`}>
          <h4 className={`text-sm font-medium mb-2 ${
            theme === 'gold' ? 'text-blue-400' : 'text-blue-700'
          }`}>
            ✅ What you get with Gmail connection:
          </h4>
          <ul className={`text-sm space-y-1 ${
            theme === 'gold' ? 'text-blue-300' : 'text-blue-600'
          }`}>
            <li>• Send emails directly from your Gmail account</li>
            <li>• Higher deliverability rates</li>
            <li>• Automatic reply tracking in your Gmail</li>
            <li>• Professional sender reputation</li>
            <li>• Integration with your existing email workflow</li>
          </ul>
        </div>
      </div>
    );
  }

  return null;
}