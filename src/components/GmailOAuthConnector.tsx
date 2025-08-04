import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { 
  Mail, 
  ExternalLink, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Shield,
  Key
} from 'lucide-react';

interface GmailOAuthConnectorProps {
  onSuccess: (channelData: any) => void;
  onError: (error: string) => void;
  channelName?: string;
}

export function GmailOAuthConnector({ 
  onSuccess, 
  onError, 
  channelName = 'Gmail Channel' 
}: GmailOAuthConnectorProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [connecting, setConnecting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'success' | 'error'>('idle');

  const initiateGmailOAuth = async () => {
    if (!user) {
      onError('User not authenticated');
      return;
    }

    setConnecting(true);
    setStatus('connecting');

    try {
      // Call our edge function to initiate OAuth
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-oauth-initiate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          channel_name: channelName,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initiate OAuth');
      }

      const { auth_url, channel_id, state } = await response.json();

      // Open OAuth popup
      const popup = window.open(
        auth_url,
        'gmail-oauth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      // Listen for OAuth completion
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin && !event.origin.includes('supabase')) {
          return;
        }

        if (event.data.type === 'oauth_success') {
          setStatus('success');
          setConnecting(false);
          
          // Fetch the updated channel data
          fetchChannelData(channel_id);
          
          window.removeEventListener('message', handleMessage);
          popup.close();
        } else if (event.data.type === 'oauth_error') {
          setStatus('error');
          setConnecting(false);
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
          if (status === 'connecting') {
            setConnecting(false);
            setStatus('error');
            onError('OAuth cancelled by user');
          }
          window.removeEventListener('message', handleMessage);
        }
      }, 1000);

    } catch (error) {
      setConnecting(false);
      setStatus('error');
      onError(error instanceof Error ? error.message : 'OAuth initiation failed');
    }
  };

  const fetchChannelData = async (channelId: string) => {
    try {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('id', channelId)
        .single();

      if (error) throw error;

      onSuccess(data);
    } catch (error) {
      console.error('Error fetching channel data:', error);
      onError('Failed to fetch updated channel data');
    }
  };

  return (
    <div className="space-y-4">
      {/* OAuth Connection Button */}
      <div className={`p-6 rounded-lg border ${
        theme === 'gold'
          ? 'border-yellow-400/20 bg-black/20'
          : 'border-gray-200 bg-gray-50'
      }`}>
        <div className="flex items-center space-x-3 mb-4">
          <div className={`p-2 rounded-lg ${
            theme === 'gold' ? 'bg-red-500/20' : 'bg-red-100'
          }`}>
            <Mail className={`h-5 w-5 ${
              theme === 'gold' ? 'text-red-400' : 'text-red-600'
            }`} />
          </div>
          <div>
            <h3 className={`text-lg font-semibold ${
              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
            }`}>
              Connect Gmail Account
            </h3>
            <p className={`text-sm ${
              theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Secure OAuth2 authentication for Gmail API access
            </p>
          </div>
        </div>

        {/* Status Messages */}
        {status === 'connecting' && (
          <div className={`mb-4 p-3 rounded-lg ${
            theme === 'gold'
              ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
              : 'bg-blue-50 border border-blue-200 text-blue-800'
          }`}>
            <div className="flex items-center">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              <span className="text-sm font-medium">Connecting to Gmail...</span>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className={`mb-4 p-3 rounded-lg ${
            theme === 'gold'
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-green-50 border border-green-200 text-green-800'
          }`}>
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">Successfully connected to Gmail!</span>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className={`mb-4 p-3 rounded-lg ${
            theme === 'gold'
              ? 'bg-red-500/10 border border-red-500/30 text-red-400'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">Connection failed. Please try again.</span>
            </div>
          </div>
        )}

        {/* Connect Button */}
        <button
          onClick={initiateGmailOAuth}
          disabled={connecting}
          className={`w-full flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-all ${
            theme === 'gold'
              ? 'gold-gradient text-black hover-gold'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {connecting ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Connect with Google
              <ExternalLink className="h-4 w-4 ml-2" />
            </>
          )}
        </button>
      </div>

      {/* Security Information */}
      <div className={`p-4 rounded-lg ${
        theme === 'gold'
          ? 'bg-yellow-400/10 border border-yellow-400/20'
          : 'bg-blue-50 border border-blue-200'
      }`}>
        <h4 className={`text-sm font-medium mb-2 ${
          theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
        }`}>
          🔒 Secure OAuth2 Authentication
        </h4>
        <ul className={`text-sm space-y-1 ${
          theme === 'gold' ? 'text-yellow-300' : 'text-blue-600'
        }`}>
          <li className="flex items-center">
            <Shield className="h-3 w-3 mr-2" />
            Your Gmail password is never stored or accessed
          </li>
          <li className="flex items-center">
            <Key className="h-3 w-3 mr-2" />
            Only email sending permission is requested
          </li>
          <li className="flex items-center">
            <CheckCircle className="h-3 w-3 mr-2" />
            Tokens are encrypted and stored securely
          </li>
          <li className="flex items-center">
            <ExternalLink className="h-3 w-3 mr-2" />
            You can revoke access anytime in your Google Account settings
          </li>
        </ul>
      </div>

      {/* What Happens Next */}
      <div className={`p-4 rounded-lg ${
        theme === 'gold'
          ? 'bg-green-500/10 border border-green-500/20'
          : 'bg-green-50 border border-green-200'
      }`}>
        <h4 className={`text-sm font-medium mb-2 ${
          theme === 'gold' ? 'text-green-400' : 'text-green-700'
        }`}>
          ✅ What Happens After Connection
        </h4>
        <ul className={`text-sm space-y-1 ${
          theme === 'gold' ? 'text-green-300' : 'text-green-600'
        }`}>
          <li>• Your Gmail account will be connected for sending campaign emails</li>
          <li>• Access tokens are automatically refreshed when they expire</li>
          <li>• n8n can now send emails using your Gmail account</li>
          <li>• All emails will appear to come from your connected Gmail address</li>
        </ul>
      </div>
    </div>
  );
}