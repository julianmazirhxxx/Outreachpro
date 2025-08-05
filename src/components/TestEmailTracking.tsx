import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { 
  Mail, 
  Send, 
  CheckCircle, 
  XCircle, 
  Eye, 
  MousePointer, 
  Reply,
  TestTube,
  Crown,
  Zap
} from 'lucide-react';

interface Campaign {
  id: string;
  offer: string | null;
}

export function TestEmailTracking() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; trackingId?: string } | null>(null);

  useEffect(() => {
    if (user) {
      fetchCampaigns();
    }
  }, [user]);

  const fetchCampaigns = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, offer')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
      
      if (data && data.length > 0) {
        setSelectedCampaign(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    }
  };

  const sendTestEmail = async () => {
    if (!testEmail || !selectedCampaign) {
      setResult({ success: false, message: 'Please enter an email address and select a campaign' });
      return;
    }

    setSending(true);
    setResult(null);

    try {
      // Generate tracking ID
      const trackingId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create test email tracking record
      const { error: trackingError } = await supabase
        .from('email_tracking')
        .insert({
          user_id: user?.id,
          campaign_id: selectedCampaign,
          lead_id: null, // Test email doesn't have a lead
          email_address: testEmail,
          subject: 'Test Email Tracking - Please Open and Click',
          tracking_id: trackingId,
          provider: 'test',
          status: 'sent'
        });

      if (trackingError) throw trackingError;

      // Create test tracking pixel URL
      const pixelUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-tracking?t=${trackingId}&e=open`;
      
      // Create test tracking link
      const trackingUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/email-tracking?t=${trackingId}&e=click&url=${encodeURIComponent('https://example.com')}`;

      // Test email content with tracking
      const emailContent = `
        <html>
          <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Email Tracking Test</h2>
            <p>This is a test email to verify that email tracking is working correctly.</p>
            
            <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #495057;">What's being tracked:</h3>
              <ul style="color: #6c757d;">
                <li><strong>Email Opens:</strong> When you open this email</li>
                <li><strong>Link Clicks:</strong> When you click the test link below</li>
                <li><strong>Timestamps:</strong> Exact time of each interaction</li>
              </ul>
            </div>

            <p>Click this test link to verify click tracking:</p>
            <a href="${trackingUrl}" style="display: inline-block; background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0;">
              Test Click Tracking
            </a>

            <p style="margin-top: 30px; font-size: 12px; color: #6c757d;">
              This email was sent from your Cold Outreach SaaS platform for testing purposes.
            </p>

            <!-- Tracking pixel -->
            <img src="${pixelUrl}" width="1" height="1" style="display: none;" alt="" />
          </body>
        </html>
      `;

      // Send via SMTP edge function (if available) or simulate
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-smtp`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
              user: 'test@example.com',
              pass: 'test-password'
            },
            from: 'test@example.com',
            to: testEmail,
            subject: 'Test Email Tracking - Please Open and Click',
            html: emailContent
          }),
        });

        if (response.ok) {
          setResult({
            success: true,
            message: `Test email sent successfully! Check ${testEmail} and open the email, then click the test link to verify tracking.`,
            trackingId
          });
        } else {
          // If SMTP fails, still show success for tracking setup
          setResult({
            success: true,
            message: `Email tracking record created with ID: ${trackingId}. (Note: SMTP not configured - email not actually sent)`,
            trackingId
          });
        }
      } catch (smtpError) {
        // SMTP failed but tracking record was created
        setResult({
          success: true,
          message: `Email tracking record created with ID: ${trackingId}. (Note: SMTP not configured - email not actually sent)`,
          trackingId
        });
      }

    } catch (error) {
      console.error('Error sending test email:', error);
      setResult({
        success: false,
        message: `Failed to send test email: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className={`text-lg font-semibold mb-4 ${
          theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
        }`}>
          Test Email Tracking System
        </h3>
        <p className={`text-sm ${
          theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
        }`}>
          Send a test email to verify that email tracking (opens, clicks, replies) is working correctly
        </p>
      </div>

      {/* Test Form */}
      <div className={`p-6 rounded-lg border ${
        theme === 'gold'
          ? 'border-yellow-400/20 bg-black/20'
          : 'border-gray-200 bg-gray-50'
      }`}>
        <div className="space-y-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${
              theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Select Campaign
            </label>
            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                theme === 'gold'
                  ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                  : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
              }`}
            >
              <option value="">Select a campaign...</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.offer || 'Untitled Campaign'}
                </option>
              ))}
            </select>
          </div>

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
            <p className={`text-xs mt-1 ${
              theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
            }`}>
              Enter your email address to receive a test email with tracking
            </p>
          </div>

          <button
            onClick={sendTestEmail}
            disabled={sending || !testEmail || !selectedCampaign}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
              theme === 'gold'
                ? 'gold-gradient text-black hover-gold'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {sending ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                Sending Test Email...
              </div>
            ) : (
              <div className="flex items-center justify-center">
                <Send className="h-4 w-4 mr-2" />
                Send Test Email
              </div>
            )}
          </button>
        </div>
      </div>

      {/* Test Result */}
      {result && (
        <div className={`rounded-lg border p-4 ${
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
                <XCircle className="h-5 w-5" />
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{result.message}</p>
              {result.trackingId && (
                <p className="text-xs mt-1 font-mono">Tracking ID: {result.trackingId}</p>
              )}
            </div>
            <button
              onClick={() => setResult(null)}
              className="ml-auto text-current hover:opacity-70"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* What Gets Tracked */}
      <div className={`p-4 rounded-lg ${
        theme === 'gold'
          ? 'bg-yellow-400/10 border border-yellow-400/20'
          : 'bg-blue-50 border border-blue-200'
      }`}>
        <h4 className={`text-sm font-medium mb-3 ${
          theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
        }`}>
          📧 Email Tracking Features
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-2">
            <Eye className={`h-4 w-4 ${
              theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
            }`} />
            <span className={`text-sm ${
              theme === 'gold' ? 'text-yellow-300' : 'text-blue-600'
            }`}>
              Email Opens
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <MousePointer className={`h-4 w-4 ${
              theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
            }`} />
            <span className={`text-sm ${
              theme === 'gold' ? 'text-yellow-300' : 'text-blue-600'
            }`}>
              Link Clicks
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Reply className={`h-4 w-4 ${
              theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
            }`} />
            <span className={`text-sm ${
              theme === 'gold' ? 'text-yellow-300' : 'text-blue-600'
            }`}>
              Email Replies
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}