import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { 
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Play,
  Shield,
  Zap,
  Mail,
  Crown
} from 'lucide-react';

interface InstantGmailConnectorProps {
  onBack: () => void;
  onSuccess: (channelData: any) => void;
  onError: (error: string) => void;
}

export function InstantGmailConnector({ onBack, onSuccess, onError }: InstantGmailConnectorProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [connecting, setConnecting] = useState(false);
  const [connectionStep, setConnectionStep] = useState<'select' | 'oauth' | 'instructions'>('select');
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleOAuthConnect = async () => {
    if (!user) {
      onError('User not authenticated');
      return;
    }

    setConnecting(true);
    setConnectionStep('oauth');
    setResult(null);

    try {
      // Use our pre-configured OAuth2 credentials for instant connection
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gmail-oauth-initiate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: user.id,
          channel_name: 'Gmail Account',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to initiate OAuth');
      }

      const { auth_url, channel_id } = await response.json();

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
        if (event.data.type === 'oauth_success') {
          setResult({ success: true, message: 'Gmail connected successfully!' });
          setConnecting(false);
          
          // Fetch the updated channel data
          fetchChannelData(channel_id);
          
          window.removeEventListener('message', handleMessage);
          popup.close();
        } else if (event.data.type === 'oauth_error') {
          setResult({ 
            success: false, 
            message: `Connection failed: ${event.data.description || event.data.error}` 
          });
          setConnecting(false);
          window.removeEventListener('message', handleMessage);
          popup.close();
        }
      };

      window.addEventListener('message', handleMessage);

      // Handle popup closed manually
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          if (connecting) {
            setConnecting(false);
            setResult({ success: false, message: 'Connection cancelled by user' });
          }
          window.removeEventListener('message', handleMessage);
        }
      }, 1000);

    } catch (error) {
      setConnecting(false);
      setResult({ 
        success: false, 
        message: error instanceof Error ? error.message : 'Connection failed' 
      });
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
    <div className={`space-y-6 max-w-2xl mx-auto ${
      theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
    }`}>
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
            <h2 className={`text-2xl font-bold ${
              theme === 'gold' ? 'gold-text-gradient' : 'text-gray-900'
            }`}>
              Connect Your Google Account
            </h2>
            <p className={`text-sm ${
              theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Gmail / G-Suite
            </p>
          </div>
        </div>
      </div>

      {/* Connection Options */}
      {connectionStep === 'select' && (
        <div className="space-y-6">
          <div className="text-center">
            <h3 className={`text-xl font-semibold mb-2 ${
              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
            }`}>
              Select a connection option
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Option 1: OAuth (Recommended) */}
            <div
              onClick={handleOAuthConnect}
              className={`relative p-6 rounded-xl border-2 cursor-pointer transition-all hover:scale-105 ${
                theme === 'gold'
                  ? 'border-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20'
                  : 'border-blue-500 bg-blue-50 hover:bg-blue-100'
              }`}
            >
              <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold ${
                theme === 'gold'
                  ? 'bg-yellow-400 text-black'
                  : 'bg-blue-600 text-white'
              }`}>
                Recommended
              </div>

              <div className="space-y-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  theme === 'gold' ? 'gold-gradient' : 'bg-blue-600'
                }`}>
                  <Zap className={`h-6 w-6 ${
                    theme === 'gold' ? 'text-black' : 'text-white'
                  }`} />
                </div>

                <div>
                  <h4 className={`text-lg font-bold mb-2 ${
                    theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                  }`}>
                    Option 1: OAuth
                  </h4>
                  <div className="space-y-2">
                    <div className={`flex items-center text-sm ${
                      theme === 'gold' ? 'text-green-400' : 'text-green-600'
                    }`}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Easier to setup
                    </div>
                    <div className={`flex items-center text-sm ${
                      theme === 'gold' ? 'text-green-400' : 'text-green-600'
                    }`}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      More stable and less disconnects
                    </div>
                    <div className={`flex items-center text-sm ${
                      theme === 'gold' ? 'text-green-400' : 'text-green-600'
                    }`}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Available for GSuite accounts
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Option 2: Manual Setup */}
            <div
              onClick={() => setConnectionStep('instructions')}
              className={`p-6 rounded-xl border-2 cursor-pointer transition-all hover:scale-105 ${
                theme === 'gold'
                  ? 'border-gray-600 bg-gray-800/50 hover:bg-gray-700/50'
                  : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <div className="space-y-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  theme === 'gold' ? 'bg-gray-700' : 'bg-gray-200'
                }`}>
                  <Shield className={`h-6 w-6 ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                  }`} />
                </div>

                <div>
                  <h4 className={`text-lg font-bold mb-2 ${
                    theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Option 2: Manual Setup
                  </h4>
                  <div className="space-y-2">
                    <div className={`flex items-center text-sm ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Available for personal accounts
                    </div>
                    <div className={`flex items-center text-sm ${
                      theme === 'gold' ? 'text-orange-400' : 'text-orange-600'
                    }`}>
                      <AlertCircle className="h-4 w-4 mr-2" />
                      Requires 2-factor authentication
                    </div>
                    <div className={`flex items-center text-sm ${
                      theme === 'gold' ? 'text-orange-400' : 'text-orange-600'
                    }`}>
                      <AlertCircle className="h-4 w-4 mr-2" />
                      More prone to disconnects
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OAuth Connection Step */}
      {connectionStep === 'oauth' && (
        <div className="text-center space-y-6">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto ${
            theme === 'gold' ? 'gold-gradient' : 'bg-blue-100'
          }`}>
            {connecting ? (
              <div className={`animate-spin rounded-full h-8 w-8 border-2 border-transparent ${
                theme === 'gold' ? 'border-t-black' : 'border-t-blue-600'
              }`}></div>
            ) : result?.success ? (
              <CheckCircle className={`h-8 w-8 ${
                theme === 'gold' ? 'text-black' : 'text-blue-600'
              }`} />
            ) : (
              <AlertCircle className={`h-8 w-8 ${
                theme === 'gold' ? 'text-black' : 'text-red-600'
              }`} />
            )}
          </div>

          <div>
            <h3 className={`text-xl font-bold mb-2 ${
              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
            }`}>
              {connecting ? 'Connecting to Gmail...' : 
               result?.success ? 'Successfully Connected!' :
               result ? 'Connection Failed' : 'Ready to Connect'}
            </h3>
            <p className={`text-sm ${
              theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {connecting ? 'Please complete the authorization in the popup window' :
               result?.success ? 'Your Gmail account is now connected and ready to use' :
               result ? result.message : 'Click the button below to authorize Gmail access'}
            </p>
          </div>

          {!connecting && !result?.success && (
            <button
              onClick={handleOAuthConnect}
              className={`inline-flex items-center px-8 py-4 text-lg font-bold rounded-xl transition-all shadow-lg ${
                theme === 'gold'
                  ? 'gold-gradient text-black hover-gold'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Connect with Google
              <ExternalLink className="h-5 w-5 ml-2" />
            </button>
          )}

          {result?.success && (
            <button
              onClick={() => onSuccess({})}
              className={`inline-flex items-center px-6 py-3 text-sm font-medium rounded-lg transition-colors ${
                theme === 'gold'
                  ? 'gold-gradient text-black hover-gold'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Continue to Dashboard
            </button>
          )}
        </div>
      )}

      {/* Manual Setup Instructions */}
      {connectionStep === 'instructions' && (
        <div className="space-y-6">
          <div className="text-center">
            <h3 className={`text-xl font-bold mb-2 ${
              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
            }`}>
              Manual Gmail Setup
            </h3>
            <p className={`text-sm ${
              theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              For personal Gmail accounts with 2FA enabled
            </p>
          </div>

          <div className={`p-6 rounded-xl border ${
            theme === 'gold'
              ? 'border-yellow-400/20 bg-yellow-400/5'
              : 'border-blue-200 bg-blue-50'
          }`}>
            <div className="flex items-center space-x-3 mb-4">
              <Play className={`h-5 w-5 ${
                theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
              }`} />
              <h4 className={`text-lg font-semibold ${
                theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
              }`}>
                Watch Tutorial Video
              </h4>
            </div>
            <p className={`text-sm mb-4 ${
              theme === 'gold' ? 'text-yellow-300' : 'text-blue-600'
            }`}>
              Follow this step-by-step video guide to set up Gmail with App Passwords
            </p>
            <a
              href="https://www.youtube.com/watch?v=hXiPshHn9Pw"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                theme === 'gold'
                  ? 'gold-gradient text-black hover-gold'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Play className="h-4 w-4 mr-2" />
              Watch Setup Tutorial
              <ExternalLink className="h-4 w-4 ml-2" />
            </a>
          </div>

          <div className={`p-6 rounded-xl border ${
            theme === 'gold'
              ? 'border-yellow-400/20 bg-black/20'
              : 'border-gray-200 bg-gray-50'
          }`}>
            <h4 className={`text-lg font-semibold mb-4 ${
              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
            }`}>
              Quick Setup Steps:
            </h4>
            <ol className={`space-y-3 text-sm ${
              theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              <li className="flex items-start">
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mr-3 mt-0.5 ${
                  theme === 'gold' ? 'bg-yellow-400 text-black' : 'bg-blue-600 text-white'
                }`}>
                  1
                </span>
                <div>
                  <strong>Enable 2-Factor Authentication</strong>
                  <br />
                  Go to your Google Account settings and enable 2FA if not already enabled
                </div>
              </li>
              <li className="flex items-start">
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mr-3 mt-0.5 ${
                  theme === 'gold' ? 'bg-yellow-400 text-black' : 'bg-blue-600 text-white'
                }`}>
                  2
                </span>
                <div>
                  <strong>Generate App Password</strong>
                  <br />
                  Go to Security → App passwords → Generate new app password for "Mail"
                </div>
              </li>
              <li className="flex items-start">
                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold mr-3 mt-0.5 ${
                  theme === 'gold' ? 'bg-yellow-400 text-black' : 'bg-blue-600 text-white'
                }`}>
                  3
                </span>
                <div>
                  <strong>Use App Password</strong>
                  <br />
                  Use your Gmail address and the generated app password (not your regular password)
                </div>
              </li>
            </ol>
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => setConnectionStep('select')}
              className={`px-6 py-2 text-sm font-medium rounded-lg border transition-colors ${
                theme === 'gold'
                  ? 'border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Back to Options
            </button>
          </div>
        </div>
      )}

      {/* Benefits Section */}
      <div className={`p-6 rounded-xl border ${
        theme === 'gold'
          ? 'border-green-500/20 bg-green-500/5'
          : 'border-green-200 bg-green-50'
      }`}>
        <h4 className={`text-sm font-medium mb-3 ${
          theme === 'gold' ? 'text-green-400' : 'text-green-700'
        }`}>
          ✅ What you get with Gmail connection:
        </h4>
        <ul className={`text-sm space-y-1 ${
          theme === 'gold' ? 'text-green-300' : 'text-green-600'
        }`}>
          <li>• Send emails directly from your Gmail account</li>
          <li>• Higher deliverability rates</li>
          <li>• Automatic reply tracking in your Gmail</li>
          <li>• Professional sender reputation</li>
          <li>• Integration with your existing email workflow</li>
        </ul>
      </div>

      {/* Security Notice */}
      <div className={`p-4 rounded-lg ${
        theme === 'gold'
          ? 'bg-gray-500/10 border border-gray-500/20'
          : 'bg-gray-50 border border-gray-200'
      }`}>
        <div className="flex items-center space-x-2">
          <Shield className={`h-4 w-4 ${
            theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
          }`} />
          <span className={`text-xs ${
            theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Your credentials are stored securely and encrypted. You can revoke access anytime.
          </span>
        </div>
      </div>
    </div>
  );
}