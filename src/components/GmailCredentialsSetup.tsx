import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { 
  ExternalLink, 
  Copy, 
  CheckCircle, 
  AlertCircle, 
  Eye,
  EyeOff,
  Save,
  Settings,
  Code,
  Key,
  Shield
} from 'lucide-react';

interface GmailCredentialsSetupProps {
  onSuccess: (channelData: any) => void;
  onError: (error: string) => void;
  channelName: string;
}

export function GmailCredentialsSetup({ 
  onSuccess, 
  onError, 
  channelName 
}: GmailCredentialsSetupProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [credentials, setCredentials] = useState({
    client_id: '',
    client_secret: '',
    redirect_uri: ''
  });
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);

  const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-oauth-callback`;

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const validateCredentials = () => {
    const errors: string[] = [];
    
    if (!credentials.client_id.trim()) {
      errors.push('Client ID is required');
    } else if (!credentials.client_id.includes('.googleusercontent.com')) {
      errors.push('Client ID should end with .googleusercontent.com');
    }
    
    if (!credentials.client_secret.trim()) {
      errors.push('Client Secret is required');
    } else if (credentials.client_secret.length < 20) {
      errors.push('Client Secret seems too short (should be 24+ characters)');
    }
    
    return errors;
  };

  const handleSaveCredentials = async () => {
    const errors = validateCredentials();
    if (errors.length > 0) {
      onError(`Please fix: ${errors.join(', ')}`);
      return;
    }

    if (!user) {
      onError('User not authenticated');
      return;
    }

    setSaving(true);

    try {
      // Create channel with OAuth2 credentials
      const channelData = {
        user_id: user.id,
        name: channelName,
        provider: 'gmail',
        channel_type: 'email',
        credentials: {
          email_provider: 'gmail',
          client_id: credentials.client_id.trim(),
          client_secret: credentials.client_secret.trim(),
          scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
          oauth_setup_completed: false // Will be true after OAuth flow
        },
        is_active: false, // Will be activated after OAuth completion
      };

      const { data, error } = await supabase
        .from('channels')
        .insert([channelData])
        .select()
        .single();

      if (error) throw error;

      // Now initiate OAuth flow with user's credentials
      await initiateOAuthFlow(data.id);

    } catch (error) {
      console.error('Error saving credentials:', error);
      onError(error instanceof Error ? error.message : 'Failed to save credentials');
    } finally {
      setSaving(false);
    }
  };

  const initiateOAuthFlow = async (channelId: string) => {
    try {
      // Generate secure state
      const state = crypto.randomUUID();

      // Update channel with OAuth state
      await supabase
        .from('channels')
        .update({ oauth_state: state })
        .eq('id', channelId);

      // Build OAuth URL with user's credentials
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', credentials.client_id);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile');
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
          onSuccess({
            id: channelId,
            email_address: event.data.email,
            name: channelName
          });
          window.removeEventListener('message', handleMessage);
          popup.close();
        } else if (event.data.type === 'oauth_error') {
          onError(`OAuth failed: ${event.data.description || event.data.error}`);
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
      onError(error instanceof Error ? error.message : 'Failed to initiate OAuth');
    }
  };

  const steps = [
    {
      title: 'Create Google Cloud Project',
      content: (
        <div className="space-y-3">
          <p className={`text-sm ${theme === 'gold' ? 'text-gray-300' : 'text-gray-700'}`}>
            First, you need to create a Google Cloud project and enable the Gmail API.
          </p>
          <ol className={`text-sm space-y-2 list-decimal list-inside ${theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}`}>
            <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className={`${theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'} hover:underline`}>Google Cloud Console</a></li>
            <li>Create a new project or select an existing one</li>
            <li>Enable the Gmail API in the API Library</li>
            <li>Go to "APIs & Services" → "Credentials"</li>
          </ol>
        </div>
      )
    },
    {
      title: 'Configure OAuth2 Consent Screen',
      content: (
        <div className="space-y-3">
          <p className={`text-sm ${theme === 'gold' ? 'text-gray-300' : 'text-gray-700'}`}>
            Set up the OAuth consent screen for your application.
          </p>
          <ol className={`text-sm space-y-2 list-decimal list-inside ${theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}`}>
            <li>Click "OAuth consent screen" in the left sidebar</li>
            <li>Choose "External" user type</li>
            <li>Fill in app name: <code className="bg-gray-100 px-1 rounded">Cold Outreach SaaS</code></li>
            <li>Add your email as developer contact</li>
            <li>Add scopes: <code className="bg-gray-100 px-1 rounded">gmail.send</code></li>
            <li>Save and continue</li>
          </ol>
        </div>
      )
    },
    {
      title: 'Create OAuth2 Credentials',
      content: (
        <div className="space-y-3">
          <p className={`text-sm ${theme === 'gold' ? 'text-gray-300' : 'text-gray-700'}`}>
            Create OAuth2 client credentials for your application.
          </p>
          <ol className={`text-sm space-y-2 list-decimal list-inside ${theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}`}>
            <li>Click "Credentials" in the left sidebar</li>
            <li>Click "+ CREATE CREDENTIALS" → "OAuth client ID"</li>
            <li>Choose "Web application" as application type</li>
            <li>Name: <code className="bg-gray-100 px-1 rounded">Gmail Integration</code></li>
            <li>Add authorized redirect URI:</li>
          </ol>
          
          <div className={`p-3 rounded-lg border ${theme === 'gold' ? 'bg-black/20 border-yellow-400/20' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <code className={`text-xs font-mono ${theme === 'gold' ? 'text-gray-300' : 'text-gray-700'}`}>
                {redirectUri}
              </code>
              <button
                onClick={() => copyToClipboard(redirectUri, 'redirect_uri')}
                className={`ml-2 p-1 rounded transition-colors ${
                  theme === 'gold' ? 'text-yellow-400 hover:bg-yellow-400/10' : 'text-blue-600 hover:bg-blue-100'
                }`}
                title="Copy redirect URI"
              >
                {copied === 'redirect_uri' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
          
          <p className={`text-xs ${theme === 'gold' ? 'text-gray-500' : 'text-gray-500'}`}>
            ⚠️ Make sure to copy this exact URL as the authorized redirect URI
          </p>
        </div>
      )
    },
    {
      title: 'Get Your Credentials',
      content: (
        <div className="space-y-4">
          <p className={`text-sm ${theme === 'gold' ? 'text-gray-300' : 'text-gray-700'}`}>
            After creating the OAuth client, copy your credentials below:
          </p>
          
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Client ID *
              </label>
              <input
                type="text"
                value={credentials.client_id}
                onChange={(e) => setCredentials(prev => ({ ...prev, client_id: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  theme === 'gold'
                    ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                    : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                }`}
                placeholder="123456789-abcdefghijklmnop.apps.googleusercontent.com"
              />
              <p className={`text-xs mt-1 ${theme === 'gold' ? 'text-gray-500' : 'text-gray-500'}`}>
                Should end with .apps.googleusercontent.com
              </p>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Client Secret *
              </label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={credentials.client_secret}
                  onChange={(e) => setCredentials(prev => ({ ...prev, client_secret: e.target.value }))}
                  className={`w-full px-3 py-2 pr-10 border rounded-lg focus:outline-none focus:ring-2 ${
                    theme === 'gold'
                      ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                      : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                  }`}
                  placeholder="GOCSPX-abcdefghijklmnopqrstuvwxyz"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className={`absolute right-3 top-1/2 transform -translate-y-1/2 ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                  }`}
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className={`text-xs mt-1 ${theme === 'gold' ? 'text-gray-500' : 'text-gray-500'}`}>
                Usually starts with GOCSPX-
              </p>
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center space-x-2 mb-6">
        {steps.map((_, index) => (
          <React.Fragment key={index}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              currentStep > index + 1
                ? theme === 'gold' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'
                : currentStep === index + 1
                ? theme === 'gold' ? 'gold-gradient text-black' : 'bg-blue-100 text-blue-600'
                : theme === 'gold' ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-500'
            }`}>
              {currentStep > index + 1 ? <CheckCircle className="h-4 w-4" /> : index + 1}
            </div>
            {index < steps.length - 1 && (
              <div className={`flex-1 h-0.5 ${
                currentStep > index + 1
                  ? theme === 'gold' ? 'bg-green-400' : 'bg-green-500'
                  : theme === 'gold' ? 'bg-gray-700' : 'bg-gray-300'
              }`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Current Step Content */}
      <div className={`p-6 rounded-lg border ${
        theme === 'gold'
          ? 'border-yellow-400/20 bg-black/20'
          : 'border-gray-200 bg-gray-50'
      }`}>
        <h3 className={`text-lg font-semibold mb-4 ${
          theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
        }`}>
          Step {currentStep}: {steps[currentStep - 1].title}
        </h3>
        
        {steps[currentStep - 1].content}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
              currentStep === 1
                ? 'opacity-50 cursor-not-allowed'
                : theme === 'gold'
                  ? 'text-gray-400 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                  : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
            }`}
          >
            Previous
          </button>

          {currentStep < steps.length ? (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                theme === 'gold'
                  ? 'gold-gradient text-black hover-gold'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              Next Step
            </button>
          ) : (
            <button
              onClick={handleSaveCredentials}
              disabled={saving}
              className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors ${
                theme === 'gold'
                  ? 'gold-gradient text-black hover-gold'
                  : 'bg-green-600 text-white hover:bg-green-700'
              } disabled:opacity-50`}
            >
              {saving ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                  Connecting...
                </div>
              ) : (
                <div className="flex items-center">
                  <Save className="h-4 w-4 mr-2" />
                  Connect Gmail
                </div>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Quick Reference Card */}
      <div className={`p-4 rounded-lg ${
        theme === 'gold'
          ? 'bg-blue-500/10 border border-blue-500/20'
          : 'bg-blue-50 border border-blue-200'
      }`}>
        <h4 className={`text-sm font-medium mb-2 ${
          theme === 'gold' ? 'text-blue-400' : 'text-blue-700'
        }`}>
          📋 Quick Reference
        </h4>
        <div className={`text-sm space-y-1 ${
          theme === 'gold' ? 'text-blue-300' : 'text-blue-600'
        }`}>
          <p><strong>Project Name:</strong> Cold Outreach SaaS</p>
          <p><strong>Application Type:</strong> Web application</p>
          <p><strong>Required Scope:</strong> gmail.send</p>
          <p><strong>Redirect URI:</strong> {redirectUri}</p>
        </div>
      </div>

      {/* Security Notice */}
      <div className={`p-4 rounded-lg ${
        theme === 'gold'
          ? 'bg-green-500/10 border border-green-500/20'
          : 'bg-green-50 border border-green-200'
      }`}>
        <h4 className={`text-sm font-medium mb-2 ${
          theme === 'gold' ? 'text-green-400' : 'text-green-700'
        }`}>
          🔒 Security & Privacy
        </h4>
        <ul className={`text-sm space-y-1 ${
          theme === 'gold' ? 'text-green-300' : 'text-green-600'
        }`}>
          <li>• Your credentials are stored encrypted in Supabase</li>
          <li>• Only you can access your Gmail account</li>
          <li>• You can revoke access anytime in Google Account settings</li>
          <li>• We only request permission to send emails (gmail.send scope)</li>
        </ul>
      </div>

      {/* Troubleshooting */}
      <div className={`p-4 rounded-lg ${
        theme === 'gold'
          ? 'bg-yellow-500/10 border border-yellow-500/20'
          : 'bg-yellow-50 border border-yellow-200'
      }`}>
        <h4 className={`text-sm font-medium mb-2 ${
          theme === 'gold' ? 'text-yellow-400' : 'text-yellow-700'
        }`}>
          🔧 Common Issues
        </h4>
        <ul className={`text-sm space-y-1 ${
          theme === 'gold' ? 'text-yellow-300' : 'text-yellow-600'
        }`}>
          <li>• <strong>Popup blocked:</strong> Allow popups for this site</li>
          <li>• <strong>Redirect URI mismatch:</strong> Copy the exact URI shown above</li>
          <li>• <strong>App not verified:</strong> Click "Advanced" → "Go to app (unsafe)" during testing</li>
          <li>• <strong>Scope errors:</strong> Make sure gmail.send scope is added in consent screen</li>
        </ul>
      </div>
    </div>
  );
}