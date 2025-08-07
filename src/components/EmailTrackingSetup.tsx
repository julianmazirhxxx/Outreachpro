import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { emailTracking, EmailTrackingUtils } from '../utils/emailTracking';
import { 
  Mail, 
  Eye, 
  MousePointer, 
  Reply, 
  Settings, 
  ExternalLink,
  Copy,
  CheckCircle,
  AlertTriangle,
  Webhook,
  Code,
  TestTube
} from 'lucide-react';

export function EmailTrackingSetup() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [emailChannels, setEmailChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; trackingId?: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchEmailChannels();
    }
  }, [user]);

  const fetchEmailChannels = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('user_id', user.id)
        .eq('channel_type', 'email')
        .eq('is_active', true);

      if (error) throw error;
      setEmailChannels(data || []);
    } catch (error) {
      console.error('Error fetching email channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendTestEmailWithTracking = async () => {
    if (!testEmail || !user) {
      setTestResult({ success: false, message: 'Please enter a test email address' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      // Generate tracking ID
      const trackingId = emailTracking.generateTrackingId();
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;

      // Create test email content with tracking
      const testSubject = 'Email Tracking Test - Please Open and Click';
      const testHtmlContent = `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Email Tracking Test</h2>
            <p>This is a test email to verify that email tracking is working correctly.</p>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #495057;">What's being tracked:</h3>
              <ul style="color: #6c757d;">
                <li><strong>Email Opens:</strong> When you open this email (tracked via pixel)</li>
                <li><strong>Link Clicks:</strong> When you click the test link below</li>
                <li><strong>Email Replies:</strong> If you reply to this email</li>
              </ul>
            </div>

            <p>Click this test link to verify click tracking:</p>
            <a href="https://example.com/test-page" style="display: inline-block; background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0;">
              Test Click Tracking
            </a>

            <p style="margin-top: 30px; font-size: 12px; color: #6c757d;">
              Reply to this email to test reply tracking. The tracking ID is: ${trackingId}
            </p>
          </body>
        </html>
      `;

      // Process email for tracking
      const trackingConfig = {
        trackingId,
        baseUrl,
        originalEmail: user.email || '',
        campaignId: 'test-campaign',
        leadId: 'test-lead'
      };

      const processedEmail = emailTracking.processEmailForTracking(
        testHtmlContent,
        testSubject,
        trackingConfig
      );

      // Create tracking record
      const trackingResult = await emailTracking.createTrackingRecord(
        trackingConfig,
        {
          subject: processedEmail.subject,
          recipient: testEmail,
          provider: 'test',
          messageId: `test-${trackingId}@${new URL(baseUrl).hostname}`
        },
        supabase
      );

      if (!trackingResult.success) {
        throw new Error(trackingResult.error || 'Failed to create tracking record');
      }

      // Store tracked links
      await emailTracking.storeTrackedLinks(trackingId, processedEmail.trackedLinks, supabase);

      setTestResult({
        success: true,
        message: `Email tracking test setup completed! Tracking ID: ${trackingId}. In a real campaign, this email would be sent with full tracking enabled.`,
        trackingId
      });

    } catch (error) {
      console.error('Error setting up test email tracking:', error);
      setTestResult({
        success: false,
        message: `Failed to setup email tracking: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setTesting(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const webhookUrl = EmailTrackingUtils.generateWebhookUrl(import.meta.env.VITE_SUPABASE_URL);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className={`animate-spin rounded-full h-8 w-8 border-2 border-transparent ${
          theme === 'gold'
            ? 'border-t-yellow-400'
            : 'border-t-blue-600'
        }`}></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className={`text-lg font-semibold ${
          theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
        }`}>
          Email Tracking Configuration
        </h3>
        <p className={`text-sm ${
          theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          Set up email open tracking, click tracking, and reply detection
        </p>
      </div>

      {/* Connected Email Channels */}
      <div className={`p-4 rounded-lg border ${
        theme === 'gold'
          ? 'border-yellow-400/20 bg-black/10'
          : 'border-gray-200 bg-gray-50'
      }`}>
        <h4 className={`text-sm font-medium mb-3 ${
          theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
        }`}>
          Connected Email Channels ({emailChannels.length})
        </h4>
        
        {emailChannels.length === 0 ? (
          <div className="text-center py-6">
            <Mail className={`h-8 w-8 mx-auto mb-2 ${
              theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
            }`} />
            <p className={`text-sm ${
              theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              No email channels connected. Connect an email channel in Settings first.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {emailChannels.map((channel) => (
              <div
                key={channel.id}
                className={`p-3 rounded-lg border ${
                  theme === 'gold'
                    ? 'border-yellow-400/20 bg-black/20'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Mail className={`h-4 w-4 ${
                      theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                    }`} />
                    <span className={`text-sm font-medium ${
                      theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                    }`}>
                      {channel.name}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      theme === 'gold'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-green-100 text-green-800'
                    }`}>
                      Active
                    </span>
                  </div>
                  <span className={`text-xs ${
                    theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                  }`}>
                    {channel.email_address || channel.sender_id}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Test Email Tracking */}
      <div className={`p-6 rounded-lg border ${
        theme === 'gold'
          ? 'border-yellow-400/20 bg-black/20'
          : 'border-gray-200 bg-gray-50'
      }`}>
        <div className="flex items-center space-x-3 mb-4">
          <TestTube className={`h-5 w-5 ${
            theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
          }`} />
          <h4 className={`text-lg font-semibold ${
            theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
          }`}>
            Test Email Tracking
          </h4>
        </div>

        <div className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Test Email Address
            </label>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                theme === 'gold'
                  ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                  : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
              }`}
              placeholder="your-email@domain.com"
            />
          </div>

          <button
            onClick={sendTestEmailWithTracking}
            disabled={testing || !testEmail}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
              theme === 'gold'
                ? 'gold-gradient text-black hover-gold'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {testing ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                Setting up tracking test...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <TestTube className="h-4 w-4 mr-2" />
                Setup Email Tracking Test
              </div>
            )}
          </button>
        </div>

        {/* Test Result */}
        {testResult && (
          <div className={`mt-4 rounded-lg border p-4 ${
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
                  <AlertTriangle className="h-5 w-5" />
                )}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">{testResult.message}</p>
                {testResult.trackingId && (
                  <p className="text-xs mt-1 font-mono">Tracking ID: {testResult.trackingId}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Webhook Configuration */}
      <div className={`p-6 rounded-lg border ${
        theme === 'gold'
          ? 'border-yellow-400/20 bg-black/20'
          : 'border-gray-200 bg-gray-50'
      }`}>
        <div className="flex items-center space-x-3 mb-4">
          <Webhook className={`h-5 w-5 ${
            theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
          }`} />
          <h4 className={`text-lg font-semibold ${
            theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
          }`}>
            Email Reply Webhook Setup
          </h4>
        </div>

        <p className={`text-sm mb-4 ${
          theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          Configure your email provider to send reply webhooks to this URL for automatic reply detection:
        </p>

        <div className={`p-3 rounded-lg border ${
          theme === 'gold' ? 'bg-black/20 border-yellow-400/20' : 'bg-gray-50 border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <code className={`text-sm font-mono ${
              theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              {webhookUrl}
            </code>
            <button
              onClick={() => copyToClipboard(webhookUrl, 'webhook')}
              className={`ml-2 p-1 rounded transition-colors ${
                theme === 'gold' ? 'text-yellow-400 hover:bg-yellow-400/10' : 'text-blue-600 hover:bg-blue-100'
              }`}
              title="Copy webhook URL"
            >
              {copied === 'webhook' ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Provider-specific instructions */}
        <div className="mt-4 space-y-3">
          <div className={`p-3 rounded-lg ${
            theme === 'gold' ? 'bg-blue-500/10' : 'bg-blue-50'
          }`}>
            <h5 className={`text-sm font-medium mb-2 ${
              theme === 'gold' ? 'text-blue-400' : 'text-blue-700'
            }`}>
              Gmail Setup (Recommended)
            </h5>
            <ul className={`text-sm space-y-1 ${
              theme === 'gold' ? 'text-blue-300' : 'text-blue-600'
            }`}>
              <li>• Enable Gmail API push notifications</li>
              <li>• Set up Pub/Sub topic for email events</li>
              <li>• Configure webhook endpoint in Google Cloud Console</li>
            </ul>
            <a
              href="https://developers.google.com/gmail/api/guides/push"
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center text-xs mt-2 hover:underline ${
                theme === 'gold' ? 'text-blue-400' : 'text-blue-600'
              }`}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Gmail API Push Documentation
            </a>
          </div>
        </div>
      </div>

      {/* Tracking Features Overview */}
      <div className={`p-4 rounded-lg ${
        theme === 'gold'
          ? 'bg-green-500/10 border border-green-500/20'
          : 'bg-green-50 border border-green-200'
      }`}>
        <h4 className={`text-sm font-medium mb-3 ${
          theme === 'gold' ? 'text-green-400' : 'text-green-700'
        }`}>
          📧 Email Tracking Features
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-2">
            <Eye className={`h-4 w-4 ${
              theme === 'gold' ? 'text-green-400' : 'text-green-600'
            }`} />
            <div>
              <div className={`text-sm font-medium ${
                theme === 'gold' ? 'text-green-300' : 'text-green-700'
              }`}>
                Email Opens
              </div>
              <div className={`text-xs ${
                theme === 'gold' ? 'text-green-400' : 'text-green-600'
              }`}>
                1x1 tracking pixel
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <MousePointer className={`h-4 w-4 ${
              theme === 'gold' ? 'text-green-400' : 'text-green-600'
            }`} />
            <div>
              <div className={`text-sm font-medium ${
                theme === 'gold' ? 'text-green-300' : 'text-green-700'
              }`}>
                Link Clicks
              </div>
              <div className={`text-xs ${
                theme === 'gold' ? 'text-green-400' : 'text-green-600'
              }`}>
                URL redirects
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Reply className={`h-4 w-4 ${
              theme === 'gold' ? 'text-green-400' : 'text-green-600'
            }`} />
            <div>
              <div className={`text-sm font-medium ${
                theme === 'gold' ? 'text-green-300' : 'text-green-700'
              }`}>
                Email Replies
              </div>
              <div className={`text-xs ${
                theme === 'gold' ? 'text-green-400' : 'text-green-600'
              }`}>
                Webhook detection
              </div>
            </div>
          </div>
        </div>
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
          🔧 Troubleshooting Email Tracking
        </h4>
        <ul className={`text-sm space-y-1 ${
          theme === 'gold' ? 'text-yellow-300' : 'text-yellow-600'
        }`}>
          <li>• <strong>Opens not tracking:</strong> Check if tracking pixel is being blocked by email client</li>
          <li>• <strong>Clicks not tracking:</strong> Verify tracking URLs are properly generated</li>
          <li>• <strong>Replies not tracking:</strong> Ensure webhook URL is configured in your email provider</li>
          <li>• <strong>Missing tracking IDs:</strong> Check that emails include proper tracking headers</li>
          <li>• <strong>Database issues:</strong> Verify email_tracking and email_events tables exist</li>
        </ul>
      </div>
    </div>
  );
}