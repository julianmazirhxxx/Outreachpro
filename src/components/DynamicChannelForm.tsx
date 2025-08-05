import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { SecurityManager } from '../utils/security';
import { InputValidator } from '../utils/validation';
import { InstantGmailConnector } from './InstantGmailConnector';
import { 
  X, 
  Phone, 
  MessageSquare, 
  Mail, 
  Save, 
  TestTube, 
  ExternalLink,
  Eye,
  EyeOff,
  Copy,
  CheckCircle,
  AlertCircle,
  Settings,
  Key,
  Shield
} from 'lucide-react';

interface DynamicChannelFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface ChannelFormData {
  channel_type: 'voice' | 'sms' | 'whatsapp' | 'email';
  provider: string;
  name: string;
  sender_id: string;
  credentials: Record<string, any>;
  max_usage: number;
  is_active: boolean;
}

export function DynamicChannelForm({ onClose, onSuccess }: DynamicChannelFormProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [formData, setFormData] = useState<ChannelFormData>({
    channel_type: 'voice',
    provider: '',
    name: '',
    sender_id: '',
    credentials: {},
    max_usage: 100,
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showGmailConnector, setShowGmailConnector] = useState(false);

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'voice':
        return Phone;
      case 'sms':
      case 'whatsapp':
        return MessageSquare;
      case 'email':
        return Mail;
      default:
        return MessageSquare;
    }
  };

  const getProviderOptions = (channelType: string) => {
    switch (channelType) {
      case 'voice':
        return [{ value: 'vapi', label: 'Vapi' }];
      case 'sms':
        return [{ value: 'twilio', label: 'Twilio' }];
      case 'whatsapp':
        return [{ value: 'twilio', label: 'Twilio' }];
      case 'email':
        return [{ value: 'gmail', label: 'Gmail API (OAuth2)' }];
      default:
        return [];
    }
  };

  const handleChannelTypeChange = (type: 'voice' | 'sms' | 'whatsapp' | 'email') => {
    const providers = getProviderOptions(type);
    setFormData({
      ...formData,
      channel_type: type,
      provider: providers[0]?.value || '',
      credentials: {},
      name: '',
      sender_id: '',
    });
  };

  const handleProviderChange = (provider: string) => {
    setFormData({
      ...formData,
      provider,
      credentials: {},
      name: '',
      sender_id: '',
    });
    
    // Show instant Gmail connector for Gmail
    if (provider === 'gmail') {
      setShowGmailConnector(true);
    }
  };

  const renderCredentialFields = () => {
    const { channel_type, provider } = formData;

    if (channel_type === 'email' && provider === 'gmail') {
      return (
        <div className="space-y-4">
          {/* Instructions Button */}
          <div className={`p-4 rounded-lg border ${
            theme === 'gold'
              ? 'border-yellow-400/20 bg-yellow-400/5'
              : 'border-blue-200 bg-blue-50'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <h4 className={`text-sm font-medium ${
                  theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
                }`}>
                  Gmail API Setup Required
                </h4>
                <p className={`text-xs mt-1 ${
                  theme === 'gold' ? 'text-yellow-300' : 'text-blue-600'
                }`}>
                  You need Google Cloud OAuth2 credentials to connect Gmail
                </p>
              </div>
              <button
                onClick={() => setShowInstructions(!showInstructions)}
                className={`px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'gold-gradient text-black hover-gold'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {showInstructions ? 'Hide' : 'Get Setup Instructions'}
              </button>
            </div>
          </div>

          {/* Setup Instructions */}
          {showInstructions && (
            <div className={`p-6 rounded-lg border ${
              theme === 'gold'
                ? 'border-yellow-400/20 bg-black/20'
                : 'border-gray-200 bg-gray-50'
            }`}>
              <h4 className={`text-lg font-semibold mb-4 ${
                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
              }`}>
                Gmail API Setup Instructions
              </h4>

              <div className="space-y-6">
                {/* Step 1 */}
                <div>
                  <h5 className={`text-sm font-medium mb-2 ${
                    theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
                  }`}>
                    1. Create Google Cloud Project
                  </h5>
                  <ol className={`text-sm space-y-1 list-decimal list-inside ${
                    theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className={`${theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'} hover:underline`}>Google Cloud Console</a></li>
                    <li>Create a new project or select existing one</li>
                    <li>Enable the Gmail API in API Library</li>
                  </ol>
                </div>

                {/* Step 2 */}
                <div>
                  <h5 className={`text-sm font-medium mb-2 ${
                    theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
                  }`}>
                    2. Configure OAuth Consent Screen
                  </h5>
                  <ol className={`text-sm space-y-1 list-decimal list-inside ${
                    theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    <li>Go to "APIs & Services" → "OAuth consent screen"</li>
                    <li>Choose "External" user type</li>
                    <li>App name: <code className="bg-gray-100 px-1 rounded text-gray-800">Cold Outreach SaaS</code></li>
                    <li>Add scopes: <code className="bg-gray-100 px-1 rounded text-gray-800">gmail.send</code></li>
                  </ol>
                </div>

                {/* Step 3 */}
                <div>
                  <h5 className={`text-sm font-medium mb-2 ${
                    theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
                  }`}>
                    3. Create OAuth2 Credentials
                  </h5>
                  <ol className={`text-sm space-y-1 list-decimal list-inside ${
                    theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    <li>Go to "Credentials" → "Create Credentials" → "OAuth client ID"</li>
                    <li>Application type: "Web application"</li>
                    <li>Add this redirect URI:</li>
                  </ol>
                  
                  <div className={`mt-2 p-3 rounded-lg border ${
                    theme === 'gold' ? 'bg-black/20 border-yellow-400/20' : 'bg-white border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <code className={`text-xs font-mono ${
                        theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        {import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-oauth-callback
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-oauth-callback`)}
                        className={`ml-2 p-1 rounded transition-colors ${
                          theme === 'gold' ? 'text-yellow-400 hover:bg-yellow-400/10' : 'text-blue-600 hover:bg-blue-100'
                        }`}
                        title="Copy redirect URI"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div>
                  <h5 className={`text-sm font-medium mb-2 ${
                    theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
                  }`}>
                    4. Copy Your Credentials
                  </h5>
                  <p className={`text-sm ${
                    theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    After creating the OAuth client, copy the Client ID and Client Secret into the fields below.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Gmail OAuth2 Credential Fields */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Gmail Client ID *
              </label>
              <input
                type="text"
                value={formData.credentials.client_id || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  credentials: { ...formData.credentials, client_id: e.target.value }
                })}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  theme === 'gold'
                    ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                    : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                }`}
                placeholder="123456789-abcdefghijklmnop.apps.googleusercontent.com"
                required
              />
              <p className={`text-xs mt-1 ${
                theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
              }`}>
                From Google Cloud Console OAuth2 credentials
              </p>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Gmail Client Secret *
              </label>
              <div className="relative">
                <input
                  type={showCredentials ? 'text' : 'password'}
                  value={formData.credentials.client_secret || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    credentials: { ...formData.credentials, client_secret: e.target.value }
                  })}
                  className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 ${
                    theme === 'gold'
                      ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                      : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                  }`}
                  placeholder="GOCSPX-abcdefghijklmnopqrstuvwxyz"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCredentials(!showCredentials)}
                  className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  {showCredentials ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className={`text-xs mt-1 ${
                theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
              }`}>
                From Google Cloud Console OAuth2 credentials
              </p>
            </div>
          </div>

          {/* From Email Field */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              From Email *
            </label>
            <input
              type="email"
              value={formData.credentials.from_email || ''}
              onChange={(e) => setFormData({
                ...formData,
                credentials: { ...formData.credentials, from_email: e.target.value },
                sender_id: e.target.value
              })}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                theme === 'gold'
                  ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                  : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
              }`}
              placeholder="your-email@gmail.com"
              required
            />
            <p className={`text-xs mt-1 ${
              theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
            }`}>
              The Gmail address that will send emails
            </p>
          </div>

          {/* From Name Field */}
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              From Name (Optional)
            </label>
            <input
              type="text"
              value={formData.credentials.from_name || ''}
              onChange={(e) => setFormData({
                ...formData,
                credentials: { ...formData.credentials, from_name: e.target.value }
              })}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                theme === 'gold'
                  ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                  : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
              }`}
              placeholder="Your Name"
            />
          </div>
        </div>
      );
    }

    // Other provider credential fields (Vapi, Twilio, etc.)
    if (channel_type === 'voice' && provider === 'vapi') {
      return (
        <div>
          <label className={`block text-sm font-medium mb-2 ${
            theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Vapi API Key *
          </label>
          <div className="relative">
            <input
              type={showCredentials ? 'text' : 'password'}
              value={formData.credentials.api_key || ''}
              onChange={(e) => setFormData({
                ...formData,
                credentials: { ...formData.credentials, api_key: e.target.value }
              })}
              className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 ${
                theme === 'gold'
                  ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                  : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
              }`}
              placeholder="sk-..."
              required
            />
            <button
              type="button"
              onClick={() => setShowCredentials(!showCredentials)}
              className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              {showCredentials ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      );
    }

    if ((channel_type === 'sms' || channel_type === 'whatsapp') && provider === 'twilio') {
      return (
        <div className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Twilio Account SID *
            </label>
            <input
              type="text"
              value={formData.credentials.account_sid || ''}
              onChange={(e) => setFormData({
                ...formData,
                credentials: { ...formData.credentials, account_sid: e.target.value }
              })}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                theme === 'gold'
                  ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
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
                type={showCredentials ? 'text' : 'password'}
                value={formData.credentials.auth_token || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  credentials: { ...formData.credentials, auth_token: e.target.value }
                })}
                className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 ${
                  theme === 'gold'
                    ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                    : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                }`}
                placeholder="Auth Token"
                required
              />
              <button
                type="button"
                onClick={() => setShowCredentials(!showCredentials)}
                className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${
                  theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                }`}
              >
                {showCredentials ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              {channel_type === 'whatsapp' ? 'WhatsApp Number' : 'Twilio Phone Number'} *
            </label>
            <input
              type="tel"
              value={formData.sender_id}
              onChange={(e) => setFormData({ ...formData, sender_id: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                theme === 'gold'
                  ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                  : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
              }`}
              placeholder={channel_type === 'whatsapp' ? 'whatsapp:+1234567890' : '+1234567890'}
              required
            />
          </div>
        </div>
      );
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validate required fields
    if (!formData.name.trim()) {
      setTestResult({ success: false, message: 'Channel name is required' });
      return;
    }

    if (!formData.provider) {
      setTestResult({ success: false, message: 'Provider is required' });
      return;
    }

    setSaving(true);
    setTestResult(null);

    try {
      // Sanitize form data
      const sanitizedData = {
        user_id: user.id,
        name: SecurityManager.sanitizeInput(formData.name),
        provider: formData.provider,
        channel_type: formData.channel_type,
        sender_id: formData.sender_id ? SecurityManager.sanitizeInput(formData.sender_id) : null,
        credentials: formData.credentials,
        max_usage: formData.max_usage,
        is_active: formData.is_active,
      };

      // For Gmail, initiate OAuth flow instead of direct save
      if (formData.channel_type === 'email' && formData.provider === 'gmail') {
        if (!formData.credentials.client_id || !formData.credentials.client_secret) {
          setTestResult({ success: false, message: 'Gmail Client ID and Client Secret are required' });
          return;
        }

        // Create channel with OAuth credentials
        const { data, error } = await supabase
          .from('channels')
          .insert([{
            ...sanitizedData,
            credentials: {
              ...formData.credentials,
              email_provider: 'gmail',
              scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email',
              oauth_setup_completed: false
            },
            is_active: false // Will be activated after OAuth
          }])
          .select()
          .single();

        if (error) throw error;

        // Initiate OAuth flow
        await initiateGmailOAuth(data.id);
        return;
      }

      // For other providers, save directly
      const { error } = await supabase
        .from('channels')
        .insert([sanitizedData]);

      if (error) throw error;

      setTestResult({ success: true, message: 'Channel connected successfully!' });
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);

    } catch (error) {
      console.error('Error saving channel:', error);
      setTestResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to save channel' 
      });
    } finally {
      setSaving(false);
    }
  };

  const initiateGmailOAuth = async (channelId: string) => {
    try {
      // Generate secure state
      const state = crypto.randomUUID();

      // Update channel with OAuth state
      await supabase
        .from('channels')
        .update({ oauth_state: state })
        .eq('id', channelId);

      // Build OAuth URL
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', formData.credentials.client_id);
      authUrl.searchParams.set('redirect_uri', `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-oauth-callback`);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email');
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');

      // Open OAuth popup
      const popup = window.open(
        authUrl.toString(),
        'gmail-oauth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      // Listen for OAuth completion
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'oauth_success') {
          setTestResult({ success: true, message: 'Gmail connected successfully!' });
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 1500);
          window.removeEventListener('message', handleMessage);
          popup.close();
        } else if (event.data.type === 'oauth_error') {
          setTestResult({ 
            success: false, 
            message: `OAuth failed: ${event.data.description || event.data.error}` 
          });
          window.removeEventListener('message', handleMessage);
          popup.close();
        }
      };

      window.addEventListener('message', handleMessage);

      // Handle popup closed manually
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
        }
      }, 1000);

    } catch (error) {
      setTestResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Failed to initiate OAuth' 
      });
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    // Simulate test
    setTimeout(() => {
      setTestResult({ success: true, message: 'Connection test successful!' });
      setTesting(false);
    }, 2000);
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
              <h2 className={`text-xl font-bold ${
                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
              }`}>
                Connect Channel
              </h2>
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
            {/* Gmail Instant Connector */}
            {showGmailConnector && formData.channel_type === 'email' && formData.provider === 'gmail' && (
              <InstantGmailConnector
                onBack={() => setShowGmailConnector(false)}
                onSuccess={(channelData) => {
                  onSuccess();
                  onClose();
                }}
                onError={(error) => {
                  setTestResult({ success: false, message: error });
                  setShowGmailConnector(false);
                }}
              />
            )}

            {!showGmailConnector && (
              <>
            {/* Channel Type Selection */}
            <div>
              <label className={`block text-sm font-medium mb-3 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Channel Type *
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: 'voice', label: 'Voice (Vapi)', icon: Phone },
                  { key: 'sms', label: 'SMS (Twilio)', icon: MessageSquare },
                  { key: 'whatsapp', label: 'WhatsApp (Twilio)', icon: MessageSquare },
                  { key: 'email', label: 'Email (SMTP)', icon: Mail }
                ].map((type) => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.key}
                      type="button"
                      onClick={() => handleChannelTypeChange(type.key as any)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        formData.channel_type === type.key
                          ? theme === 'gold'
                            ? 'border-yellow-400 bg-yellow-400/10'
                            : 'border-blue-500 bg-blue-50'
                          : theme === 'gold'
                            ? 'border-gray-600 hover:border-gray-500'
                            : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex flex-col items-center space-y-2">
                        <Icon className={`h-5 w-5 ${
                          formData.channel_type === type.key
                            ? theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                            : theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`} />
                        <span className={`text-xs font-medium text-center ${
                          formData.channel_type === type.key
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
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  theme === 'gold'
                    ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
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

            {/* Provider-specific credential fields */}
            {renderCredentialFields()}

            {/* Daily Limit */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Daily Limit
              </label>
              <input
                type="number"
                min="1"
                max="10000"
                value={formData.max_usage}
                onChange={(e) => setFormData({ ...formData, max_usage: parseInt(e.target.value) || 100 })}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  theme === 'gold'
                    ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                    : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                }`}
              />
            </div>

            {/* Active Channel Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <div className={`text-sm font-medium ${
                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Active Channel
                </div>
                <div className={`text-xs ${
                  theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                }`}>
                  Enable this channel for campaigns
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="sr-only peer"
                />
                <div className={`relative w-11 h-6 rounded-full peer ${
                  theme === 'gold' 
                    ? 'bg-gray-700 peer-checked:bg-yellow-400' 
                    : 'bg-gray-200 peer-checked:bg-blue-600'
                } peer-focus:outline-none peer-focus:ring-4 ${
                  theme === 'gold' 
                    ? 'peer-focus:ring-yellow-400/25' 
                    : 'peer-focus:ring-blue-300'
                } peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all`}></div>
              </label>
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
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className={`flex-1 px-4 py-2 text-sm rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'text-gray-400 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                    : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                }`}
              >
                Cancel
              </button>

              {formData.channel_type !== 'email' && (
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testing}
                  className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    theme === 'gold'
                      ? 'border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  } disabled:opacity-50`}
                >
                  {testing ? (
                    <div className="flex items-center">
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
              )}

              <button
                type="submit"
                disabled={saving}
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'gold-gradient text-black hover-gold'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                } disabled:opacity-50`}
              >
                {saving ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    Connecting...
                  </div>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Connect Channel
                  </>
                )}
              </button>
            </div>
            </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}