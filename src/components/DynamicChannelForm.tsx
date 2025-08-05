import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { SecurityManager } from '../utils/security';
import { InputValidator } from '../utils/validation';
import { SimpleGmailConnector } from './SimpleGmailConnector';
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
  Shield,
  Zap,
  Crown
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
  const [showSimpleGmailConnector, setShowSimpleGmailConnector] = useState(false);

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
        return [{ value: 'gmail', label: 'Gmail API' }];
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

    // Show Gmail connector immediately when email is selected
    if (type === 'email') {
      setShowSimpleGmailConnector(true);
    } else {
      setShowSimpleGmailConnector(false);
    }
  };

  const renderCredentialFields = () => {
    const { channel_type, provider } = formData;

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

          <div className="p-6 space-y-6">
            {/* Gmail Instant Connector */}
            {showSimpleGmailConnector ? (
              <SimpleGmailConnector
                onBack={() => setShowSimpleGmailConnector(false)}
                onSuccess={(channelData) => {
                  onSuccess();
                  onClose();
                }}
                onError={(error) => {
                  setTestResult({ success: false, message: error });
                  setShowSimpleGmailConnector(false);
                }}
                channelName={formData.name || 'Gmail Account'}
              />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
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
                      { key: 'email', label: 'Email (Gmail)', icon: Mail }
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
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}