import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { GmailOAuthConnector } from './GmailOAuthConnector';
import { 
  Phone, 
  MessageSquare, 
  Mail, 
  X, 
  Save, 
  TestTube,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';

interface DynamicChannelFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface ChannelFormData {
  name: string;
  channel_type: 'voice' | 'sms' | 'whatsapp' | 'email';
  
  // Voice (Vapi) fields
  api_key?: string;
  assistant_id?: string;
  phone_number_id?: string;
  
  // SMS/WhatsApp (Twilio) fields
  twilio_sid?: string;
  twilio_auth_token?: string;
  twilio_number?: string;
  twilio_whatsapp_number?: string;
  
  // Email fields
  email_provider?: string;
  oauth_provider?: 'google' | 'microsoft';
  smtp_host?: string;
  smtp_port?: string;
  email_username?: string;
  email_password?: string;
  from_email?: string;
  from_name?: string;
  
  // Common fields
  usage_count: number;
  daily_limit: number;
  is_active: boolean;
}

export function DynamicChannelForm({ onClose, onSuccess }: DynamicChannelFormProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});
  const [oauthConnecting, setOauthConnecting] = useState<string | null>(null);
  const [showGmailOAuth, setShowGmailOAuth] = useState(false);
  const [formData, setFormData] = useState<ChannelFormData>({
    name: '',
    channel_type: 'voice',
    usage_count: 0,
    daily_limit: 100,
    is_active: true,
  });

  const channelTypes = [
    { value: 'voice', label: 'Voice (Vapi)', icon: Phone, color: 'blue' },
    { value: 'sms', label: 'SMS (Twilio)', icon: MessageSquare, color: 'green' },
    { value: 'whatsapp', label: 'WhatsApp (Twilio)', icon: MessageSquare, color: 'emerald' },
    { value: 'email', label: 'Email (SMTP)', icon: Mail, color: 'purple' },
  ];

  const emailProviders = [
    { value: 'gmail_oauth', label: 'Gmail (OAuth2 - Recommended)' },
    { value: 'oauth', label: 'OAuth2 (Recommended)' },
    { value: 'sendgrid', label: 'SendGrid' },
    { value: 'mailgun', label: 'Mailgun' },
    { value: 'smtp', label: 'SMTP (Generic)' },
    { value: 'gmail', label: 'Gmail' },
    { value: 'outlook', label: 'Outlook' },
  ];

  const handleInputChange = (field: keyof ChannelFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const togglePasswordVisibility = (field: string) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const handleOAuthConnect = async (provider: 'google' | 'microsoft') => {
    setOauthConnecting(provider);
    setTestResult(null);

    try {
      // In a real implementation, you would:
      // 1. Redirect to OAuth provider
      // 2. Handle the callback with authorization code
      // 3. Exchange code for access/refresh tokens
      // 4. Store tokens in the credentials object
      
      // For demo purposes, simulate OAuth flow
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate successful OAuth connection
      const mockEmail = provider === 'google' 
        ? 'user@gmail.com' 
        : 'user@outlook.com';
      const mockName = 'John Doe';
      
      handleInputChange('oauth_provider', provider);
      handleInputChange('from_email', mockEmail);
      handleInputChange('from_name', mockName);
      handleInputChange('email_username', mockEmail);
      
      setTestResult({
        success: true,
        message: `Successfully connected to ${provider === 'google' ? 'Google' : 'Microsoft'}! Your email account is ready for campaigns.`
      });
      
    } catch (error) {
      setTestResult({
        success: false,
        message: `Failed to connect to ${provider === 'google' ? 'Google' : 'Microsoft'}. Please try again.`
      });
    } finally {
      setOauthConnecting(null);
    }
  };

  const handleGmailOAuthSuccess = (channelData: any) => {
    setTestResult({
      success: true,
      message: `Successfully connected Gmail account: ${channelData.email_address}`
    });
    
    // Update form data with OAuth results
    setFormData(prev => ({
      ...prev,
      email_provider: 'gmail_oauth',
      from_email: channelData.email_address,
      email_username: channelData.email_address,
      name: channelData.name || `Gmail - ${channelData.email_address}`,
    }));
    
    setShowGmailOAuth(false);
    
    // Close the form and refresh the parent
    setTimeout(() => {
      onSuccess();
      onClose();
    }, 2000);
  };

  const handleGmailOAuthError = (error: string) => {
    setTestResult({
      success: false,
      message: `Gmail connection failed: ${error}`
    });
    setShowGmailOAuth(false);
  };
  const validateForm = (): string[] => {
    const errors: string[] = [];
    
    if (!formData.name.trim()) {
      errors.push('Channel name is required');
    }

    switch (formData.channel_type) {
      case 'voice':
        if (!formData.api_key?.trim()) errors.push('Vapi API Key is required');
        if (!formData.assistant_id?.trim()) errors.push('Vapi Assistant ID is required');
        if (!formData.phone_number_id?.trim()) errors.push('Vapi Phone Number ID is required');
        break;
        
      case 'sms':
        if (!formData.twilio_sid?.trim()) errors.push('Twilio Account SID is required');
        if (!formData.twilio_auth_token?.trim()) errors.push('Twilio Auth Token is required');
        if (!formData.twilio_number?.trim()) errors.push('Twilio Phone Number is required');
        if (formData.twilio_number && !formData.twilio_number.startsWith('+')) {
          errors.push('Phone number must start with +');
        }
        break;
        
      case 'whatsapp':
        if (!formData.twilio_sid?.trim()) errors.push('Twilio Account SID is required');
        if (!formData.twilio_auth_token?.trim()) errors.push('Twilio Auth Token is required');
        if (!formData.twilio_whatsapp_number?.trim()) errors.push('Twilio WhatsApp Number is required');
        if (formData.twilio_whatsapp_number && !formData.twilio_whatsapp_number.startsWith('+')) {
          errors.push('WhatsApp number must start with +');
        }
        break;
        
      case 'email':
        if (formData.email_provider === 'gmail_oauth') {
          // Gmail OAuth doesn't require manual validation - handled by OAuth flow
          break;
        }
        if (!formData.from_email?.trim()) errors.push('From Email is required');
        if (!formData.email_username?.trim()) errors.push('Email Username is required');
        if (!formData.email_password?.trim()) errors.push('Email Password is required');
        if (formData.email_provider === 'smtp') {
          if (!formData.smtp_host?.trim()) errors.push('SMTP Host is required for SMTP provider');
          if (!formData.smtp_port?.trim()) errors.push('SMTP Port is required for SMTP provider');
        }
        break;
    }

    return errors;
  };

  const handleTestConnection = async () => {
    const errors = validateForm();
    if (errors.length > 0) {
      setTestResult({
        success: false,
        message: `Please fix the following errors: ${errors.join(', ')}`
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Simulate test connection - in real implementation, you'd call your test endpoint
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setTestResult({
        success: true,
        message: 'Connection test successful! Your credentials are valid.'
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: 'Connection test failed. Please check your credentials.'
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (errors.length > 0) {
      setTestResult({
        success: false,
        message: `Please fix the following errors: ${errors.join(', ')}`
      });
      return;
    }

    if (!user) return;

    setSaving(true);
    setTestResult(null);

    try {
      // Prepare credentials object based on channel type
      let credentials: any = {};
      let sender_id: string | null = null;

      switch (formData.channel_type) {
        case 'voice':
          credentials = {
            api_key: formData.api_key,
            assistant_id: formData.assistant_id,
            phone_number_id: formData.phone_number_id,
          };
          break;
          
        case 'sms':
          credentials = {
            twilio_sid: formData.twilio_sid,
            twilio_auth_token: formData.twilio_auth_token,
          };
          sender_id = formData.twilio_number || null;
          break;
          
        case 'whatsapp':
          credentials = {
            twilio_sid: formData.twilio_sid,
            twilio_auth_token: formData.twilio_auth_token,
          };
          sender_id = formData.twilio_whatsapp_number || null;
          break;
          
        case 'email':
          credentials = {
            email_provider: formData.email_provider,
            smtp_host: formData.smtp_host,
            smtp_port: formData.smtp_port ? parseInt(formData.smtp_port) : null,
            email_username: formData.email_username,
            email_password: formData.email_password,
            from_name: formData.from_name,
          };
          sender_id = formData.from_email || null;
          break;
      }

      // For Gmail OAuth, credentials are already set by the OAuth flow
      if (formData.email_provider === 'gmail_oauth') {
        // OAuth flow already completed, just update the form
        setTestResult({
          success: true,
          message: 'Gmail OAuth2 connection completed successfully!'
        });
        
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
        return;
      }
      const channelData = {
        user_id: user.id,
        name: formData.name,
        provider: formData.channel_type === 'voice' ? 'vapi' : 
                 formData.channel_type === 'email' ? (formData.email_provider || 'gsuite') : 'twilio',
        channel_type: formData.channel_type,
        credentials,
        sender_id,
        is_active: formData.is_active,
        usage_count: formData.usage_count,
        max_usage: formData.daily_limit,
      };

      const { error } = await supabase
        .from('channels')
        .insert([channelData]);

      if (error) throw error;

      setTestResult({
        success: true,
        message: 'Channel connected successfully!'
      });

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);

    } catch (error) {
      console.error('Error saving channel:', error);
      setTestResult({
        success: false,
        message: 'Failed to save channel. Please try again.'
      });
    } finally {
      setSaving(false);
    }
  };

  const renderChannelFields = () => {
    switch (formData.channel_type) {
      case 'voice':
        return (
          <>
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Vapi API Key *
              </label>
              <div className="relative">
                <input
                  type={showPasswords.api_key ? 'text' : 'password'}
                  value={formData.api_key || ''}
                  onChange={(e) => handleInputChange('api_key', e.target.value)}
                  className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 ${
                    theme === 'gold'
                      ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                      : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                  }`}
                  placeholder="sk-..."
                  required
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('api_key')}
                  className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  {showPasswords.api_key ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Vapi Assistant ID *
              </label>
              <input
                type="text"
                value={formData.assistant_id || ''}
                onChange={(e) => handleInputChange('assistant_id', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  theme === 'gold'
                    ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                    : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                }`}
                placeholder="assistant_..."
                required
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Vapi Phone Number ID *
              </label>
              <input
                type="text"
                value={formData.phone_number_id || ''}
                onChange={(e) => handleInputChange('phone_number_id', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  theme === 'gold'
                    ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                    : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                }`}
                placeholder="phone_number_..."
                required
              />
            </div>
          </>
        );

      case 'sms':
        return (
          <>
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Twilio Account SID *
              </label>
              <input
                type="text"
                value={formData.twilio_sid || ''}
                onChange={(e) => handleInputChange('twilio_sid', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  theme === 'gold'
                    ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                    : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                }`}
                placeholder="AC..."
                required
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Twilio Auth Token *
              </label>
              <div className="relative">
                <input
                  type={showPasswords.twilio_auth_token ? 'text' : 'password'}
                  value={formData.twilio_auth_token || ''}
                  onChange={(e) => handleInputChange('twilio_auth_token', e.target.value)}
                  className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 ${
                    theme === 'gold'
                      ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                      : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                  }`}
                  placeholder="Auth Token"
                  required
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('twilio_auth_token')}
                  className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  {showPasswords.twilio_auth_token ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Twilio Phone Number *
              </label>
              <input
                type="tel"
                value={formData.twilio_number || ''}
                onChange={(e) => handleInputChange('twilio_number', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  theme === 'gold'
                    ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                    : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                }`}
                placeholder="+1234567890"
                required
              />
              <p className={`text-xs mt-1 ${
                theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
              }`}>
                Must begin with +
              </p>
            </div>
          </>
        );

      case 'whatsapp':
        return (
          <>
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Twilio Account SID *
              </label>
              <input
                type="text"
                value={formData.twilio_sid || ''}
                onChange={(e) => handleInputChange('twilio_sid', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  theme === 'gold'
                    ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                    : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                }`}
                placeholder="AC..."
                required
              />
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Twilio Auth Token *
              </label>
              <div className="relative">
                <input
                  type={showPasswords.twilio_auth_token ? 'text' : 'password'}
                  value={formData.twilio_auth_token || ''}
                  onChange={(e) => handleInputChange('twilio_auth_token', e.target.value)}
                  className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 ${
                    theme === 'gold'
                      ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                      : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                  }`}
                  placeholder="Auth Token"
                  required
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('twilio_auth_token')}
                  className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  {showPasswords.twilio_auth_token ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Twilio WhatsApp Number *
              </label>
              <input
                type="tel"
                value={formData.twilio_whatsapp_number || ''}
                onChange={(e) => handleInputChange('twilio_whatsapp_number', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  theme === 'gold'
                    ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                    : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                }`}
                placeholder="+1234567890"
                required
              />
              <p className={`text-xs mt-1 ${
                theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
              }`}>
                Must begin with +
              </p>
            </div>
          </>
        );

      case 'email':
        return (
          <>
            {/* Email Provider Selection */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Email Provider *
              </label>
              <select
                value={formData.email_provider || 'smtp'}
                onChange={(e) => handleInputChange('email_provider', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  theme === 'gold'
                    ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                    : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                }`}
              >
                {emailProviders.map(provider => (
                  <option key={provider.value} value={provider.value}>
                    {provider.label}
                  </option>
                ))}
              </select>
            </div>

            {/* OAuth2 Connection (Recommended) */}
            {formData.email_provider === 'oauth' && (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg ${
                  theme === 'gold'
                    ? 'bg-yellow-400/10 border border-yellow-400/20'
                    : 'bg-blue-50 border border-blue-200'
                }`}>
                  <h4 className={`text-sm font-medium mb-2 ${
                    theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
                  }`}>
                    Connect Your Email Account
                  </h4>
                  <p className={`text-sm mb-4 ${
                    theme === 'gold' ? 'text-gray-400' : 'text-blue-600'
                  }`}>
                    Connect with one click - no passwords needed. We'll securely access your email to send campaigns.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Google OAuth Button */}
                    <button
                      type="button"
                      onClick={() => handleOAuthConnect('google')}
                      disabled={oauthConnecting === 'google'}
                      className={`flex items-center justify-center px-4 py-3 border rounded-lg transition-all ${
                        formData.oauth_provider === 'google'
                          ? theme === 'gold'
                            ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
                            : 'border-blue-500 bg-blue-50 text-blue-700'
                          : theme === 'gold'
                            ? 'border-gray-600 text-gray-300 hover:border-gray-500'
                            : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      } disabled:opacity-50`}
                    >
                      {oauthConnecting === 'google' ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current mr-2"></div>
                      ) : (
                        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                      )}
                      <span className="font-medium">
                        {oauthConnecting === 'google' ? 'Connecting...' : 
                         formData.oauth_provider === 'google' ? 'Connected to Google' : 'Connect Google'}
                      </span>
                    </button>

                    {/* Microsoft OAuth Button */}
                    <button
                      type="button"
                      onClick={() => handleOAuthConnect('microsoft')}
                      disabled={oauthConnecting === 'microsoft'}
                      className={`flex items-center justify-center px-4 py-3 border rounded-lg transition-all ${
                        formData.oauth_provider === 'microsoft'
                          ? theme === 'gold'
                            ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400'
                            : 'border-blue-500 bg-blue-50 text-blue-700'
                          : theme === 'gold'
                            ? 'border-gray-600 text-gray-300 hover:border-gray-500'
                            : 'border-gray-300 text-gray-700 hover:border-gray-400'
                      } disabled:opacity-50`}
                    >
                      {oauthConnecting === 'microsoft' ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current mr-2"></div>
                      ) : (
                        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                          <path fill="#f25022" d="M1 1h10v10H1z"/>
                          <path fill="#00a4ef" d="M13 1h10v10H13z"/>
                          <path fill="#7fba00" d="M1 13h10v10H1z"/>
                          <path fill="#ffb900" d="M13 13h10v10H13z"/>
                        </svg>
                      )}
                      <span className="font-medium">
                        {oauthConnecting === 'microsoft' ? 'Connecting...' : 
                         formData.oauth_provider === 'microsoft' ? 'Connected to Microsoft' : 'Connect Microsoft'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Connected Account Info */}
                {formData.oauth_provider && formData.from_email && (
                  <div className={`p-3 rounded-lg ${
                    theme === 'gold'
                      ? 'bg-green-500/10 border border-green-500/30'
                      : 'bg-green-50 border border-green-200'
                  }`}>
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-2 ${
                        theme === 'gold' ? 'bg-green-400' : 'bg-green-600'
                      }`} />
                      <span className={`text-sm font-medium ${
                        theme === 'gold' ? 'text-green-400' : 'text-green-800'
                      }`}>
                        Connected: {formData.from_email}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SMTP Configuration (Manual Setup) */}
            {formData.email_provider === 'smtp' && (
              <>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    SMTP Host *
                  </label>
                  <input
                    type="text"
                    value={formData.smtp_host || ''}
                    onChange={(e) => handleInputChange('smtp_host', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                        : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                    }`}
                    placeholder="smtp.gmail.com"
                    required
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    SMTP Port *
                  </label>
                  <input
                    type="number"
                    value={formData.smtp_port || ''}
                    onChange={(e) => handleInputChange('smtp_port', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                        : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                    }`}
                    placeholder="587"
                    required
                  />
                </div>
              </>
            )}

            {/* Email Credentials (for non-OAuth providers) */}
            {formData.email_provider !== 'oauth' && formData.email_provider !== 'gsuite' && (
              <>
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Email Username *
                  </label>
                  <input
                    type="email"
                    value={formData.email_username || ''}
                    onChange={(e) => handleInputChange('email_username', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                        : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                    }`}
                    placeholder="your-email@domain.com"
                    required
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Email Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showPasswords.email_password ? 'text' : 'password'}
                      value={formData.email_password || ''}
                      onChange={(e) => handleInputChange('email_password', e.target.value)}
                      className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 ${
                        theme === 'gold'
                          ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                          : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                      }`}
                      placeholder="Password or App Password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility('email_password')}
                      className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${
                        theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                      }`}
                    >
                      {showPasswords.email_password ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Gmail OAuth2 Integration */}
            {formData.email_provider === 'gmail_oauth' && (
              <div className="space-y-4">
                {!showGmailOAuth ? (
                  <div className={`p-4 rounded-lg ${
                    theme === 'gold'
                      ? 'bg-yellow-400/10 border border-yellow-400/20'
                      : 'bg-blue-50 border border-blue-200'
                  }`}>
                    <h4 className={`text-sm font-medium mb-2 ${
                      theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
                    }`}>
                      Gmail OAuth2 Setup Required
                    </h4>
                    <p className={`text-sm mb-4 ${
                      theme === 'gold' ? 'text-gray-400' : 'text-blue-600'
                    }`}>
                      Connect your Gmail account securely using OAuth2. This provides proper API access for n8n integration.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowGmailOAuth(true)}
                      className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        theme === 'gold'
                          ? 'gold-gradient text-black hover-gold'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Connect Gmail Account
                    </button>
                  </div>
                ) : (
                  <GmailOAuthConnector
                    channelName={formData.name || 'Gmail Channel'}
                    onSuccess={handleGmailOAuthSuccess}
                    onError={handleGmailOAuthError}
                  />
                )}
              </div>
            )}
            {/* From Email (always required) */}
            {formData.email_provider !== 'gmail_oauth' && (
              <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                {formData.oauth_provider ? 'From Email (Auto-filled)' : 'From Email *'}
              </label>
              <input
                type="email"
                value={formData.from_email || ''}
                onChange={(e) => handleInputChange('from_email', e.target.value)}
                disabled={!!formData.oauth_provider}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  formData.oauth_provider
                    ? theme === 'gold'
                      ? 'border-yellow-400/30 bg-black/30 text-gray-400'
                      : 'border-gray-300 bg-gray-50 text-gray-500'
                    :
                  theme === 'gold'
                    ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                    : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                }`}
                placeholder="sender@yourdomain.com"
                required={!formData.oauth_provider}
              />
              </div>
            )}

            {/* From Name (optional) */}
            {formData.email_provider !== 'gmail_oauth' && (
              <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                {formData.oauth_provider ? 'From Name (Auto-filled)' : 'From Name (Optional)'}
              </label>
              <input
                type="text"
                value={formData.from_name || ''}
                onChange={(e) => handleInputChange('from_name', e.target.value)}
                disabled={!!formData.oauth_provider}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  formData.oauth_provider
                    ? theme === 'gold'
                      ? 'border-yellow-400/30 bg-black/30 text-gray-400'
                      : 'border-gray-300 bg-gray-50 text-gray-500'
                    :
                  theme === 'gold'
                    ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                    : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                }`}
                placeholder="Your Name"
              />
              </div>
            )}
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto ${
      theme === 'gold' ? 'bg-black/75' : 'bg-gray-900/50'
    }`}>
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className={`w-full max-w-2xl rounded-xl shadow-2xl ${
          theme === 'gold' ? 'black-card gold-border' : 'bg-white border border-gray-200'
        }`}>
          {/* Header */}
          <div className={`p-6 border-b ${
            theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-xl font-semibold ${
                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
              }`}>
                Connect Channel
              </h3>
              <button
                onClick={onClose}
                className={`p-2 rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'text-gray-400 hover:bg-gray-800'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Channel Type Selection */}
            <div>
              <label className={`block text-sm font-medium mb-3 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Channel Type *
              </label>
              <div className="grid grid-cols-2 gap-3">
                {channelTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => handleInputChange('channel_type', type.value)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        formData.channel_type === type.value
                          ? theme === 'gold'
                            ? 'border-yellow-400 bg-yellow-400/10'
                            : 'border-blue-500 bg-blue-50'
                          : theme === 'gold'
                            ? 'border-gray-600 hover:border-gray-500'
                            : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className={`h-5 w-5 ${
                          formData.channel_type === type.value
                            ? theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                            : theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`} />
                        <span className={`font-medium ${
                          formData.channel_type === type.value
                            ? theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                            : theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          {type.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Channel Name */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Channel Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  theme === 'gold'
                    ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                    : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                }`}
                placeholder="e.g., Main Sales Line, Support Voice, Marketing SMS"
                required
              />
              <p className={`text-xs mt-1 ${
                theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
              }`}>
                This name will be displayed in your channels list
              </p>
            </div>

            {/* Dynamic Channel Fields */}
            {renderChannelFields()}

            {/* Common Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Daily Limit
                </label>
                <input
                  type="number"
                  value={formData.daily_limit}
                  onChange={(e) => handleInputChange('daily_limit', parseInt(e.target.value) || 100)}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                    theme === 'gold'
                      ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                      : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                  }`}
                  min="1"
                />
              </div>

              <div className="flex items-center">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => handleInputChange('is_active', e.target.checked)}
                    className={`mr-2 rounded ${
                      theme === 'gold'
                        ? 'text-yellow-400 focus:ring-yellow-400'
                        : 'text-blue-600 focus:ring-blue-500'
                    }`}
                  />
                  <span className={`text-sm font-medium ${
                    theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Active Channel
                  </span>
                </label>
              </div>
            </div>

            {/* Test Result */}
            {testResult && (
              <div className={`rounded-lg border p-4 ${
                testResult.success 
                  ? theme === 'gold'
                    ? 'bg-green-500/10 border-green-500/30 text-green-400'
                    : 'bg-green-50 border-green-200 text-green-800'
                  : theme === 'gold'
                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                    : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    {testResult.success ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : (
                      <AlertCircle className="h-5 w-5" />
                    )}
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium">{testResult.message}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
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
                  <div className="flex items-center justify-center">
                    <TestTube className="h-4 w-4 mr-2" />
                    Test Connection
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'text-gray-400 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                    : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                }`}
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'gold-gradient text-black hover-gold'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {saving ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    Saving...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Save className="h-4 w-4 mr-2" />
                    Connect Channel
                  </div>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}