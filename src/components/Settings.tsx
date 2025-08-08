import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { DynamicChannelForm } from './DynamicChannelForm';
import { 
  User, 
  Bell, 
  Shield, 
  Palette, 
  MessageSquare,
  Check,
  Plus,
  Phone,
  Mail,
  Trash2,
  Edit2,
  Crown,
  Zap,
  Settings as SettingsIcon,
  ExternalLink
} from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  provider: string;
  channel_type: string;
  sender_id: string | null;
  email_address: string | null;
  is_active: boolean;
  usage_count: number;
  max_usage: number;
  created_at: string;
}

export function Settings() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'security' | 'appearance' | 'channels'>('channels');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChannelForm, setShowChannelForm] = useState(false);

  const tabs = [
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'notifications', label: 'Notifications', icon: Bell },
    { key: 'security', label: 'Security', icon: Shield },
    { key: 'appearance', label: 'Appearance', icon: Palette },
    { key: 'channels', label: 'Channels', icon: MessageSquare },
  ];

  useEffect(() => {
    if (user && activeTab === 'channels') {
      fetchChannels();
    }
  }, [user, activeTab]);

  const fetchChannels = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setChannels(data || []);
    } catch (error) {
      console.error('Error fetching channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteChannel = async (channelId: string) => {
    if (!confirm('Are you sure you want to delete this channel?')) return;
    
    try {
      const { error } = await supabase
        .from('channels')
        .delete()
        .eq('id', channelId)
        .eq('user_id', user?.id);

      if (error) throw error;
      fetchChannels();
    } catch (error) {
      console.error('Error deleting channel:', error);
    }
  };

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

  const getChannelColor = (type: string) => {
    switch (type) {
      case 'voice':
        return theme === 'gold' ? 'text-yellow-400' : 'text-blue-600';
      case 'sms':
        return theme === 'gold' ? 'text-yellow-400' : 'text-green-600';
      case 'whatsapp':
        return theme === 'gold' ? 'text-yellow-400' : 'text-emerald-600';
      case 'email':
        return theme === 'gold' ? 'text-yellow-400' : 'text-purple-600';
      default:
        return theme === 'gold' ? 'text-gray-400' : 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-3 mb-2">
          {theme === 'gold' ? (
            <Crown className="h-8 w-8 text-yellow-400" />
          ) : (
            <SettingsIcon className="h-8 w-8 text-blue-600" />
          )}
          <h1 className={`text-3xl font-bold ${
            theme === 'gold' ? 'gold-text-gradient' : 'text-gray-900'
          }`}>
            Settings
          </h1>
        </div>
        <p className={theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}>
          Manage your account settings and preferences
        </p>
      </div>

      {/* Settings Container */}
      <div className={`rounded-xl shadow-sm border ${
        theme === 'gold' 
          ? 'black-card gold-border' 
          : 'bg-white border-gray-200'
      }`}>
        {/* Tabs */}
        <div className={`border-b ${
          theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
        }`}>
          <nav className="flex overflow-x-auto px-4 sm:px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`py-4 px-4 border-b-2 font-medium text-sm whitespace-nowrap flex items-center space-x-2 ${
                    activeTab === tab.key
                      ? theme === 'gold'
                        ? 'border-yellow-400 text-yellow-400'
                        : 'border-blue-500 text-blue-600'
                      : theme === 'gold'
                        ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 sm:p-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h3 className={`text-lg font-semibold mb-4 ${
                  theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                }`}>
                  Profile Information
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Full Name
                    </label>
                    <input
                      type="text"
                      defaultValue={user?.user_metadata?.full_name || ''}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        theme === 'gold'
                          ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                          : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                      }`}
                    />
                  </div>
                  
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      defaultValue={user?.email || ''}
                      disabled
                      className={`w-full px-3 py-2 border rounded-lg ${
                        theme === 'gold'
                          ? 'border-gray-600 bg-gray-800 text-gray-500'
                          : 'border-gray-300 bg-gray-50 text-gray-500'
                      }`}
                    />
                    <p className={`text-xs mt-1 ${
                      theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                    }`}>
                      Email cannot be changed
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <button className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      theme === 'gold'
                        ? 'gold-gradient text-black hover-gold'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}>
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h3 className={`text-lg font-semibold mb-4 ${
                  theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                }`}>
                  Appearance Settings
                </h3>
                
                <div className="space-y-4">
                  <div className={`p-4 rounded-lg ${
                    theme === 'gold' ? 'bg-black/20' : 'bg-gray-50'
                  }`}>
                    <div className={`font-medium mb-2 ${
                      theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                    }`}>
                      Theme
                    </div>
                    <div className={`text-sm mb-4 ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      Choose your preferred theme
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => theme === 'gold' && toggleTheme()}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          theme === 'blue'
                            ? 'border-blue-500 bg-blue-50'
                            : theme === 'gold'
                              ? 'border-gray-600 hover:border-gray-500'
                              : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <User className="h-4 w-4 text-white" />
                          </div>
                          <div className="text-left">
                            <div className={`font-medium ${
                              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                            }`}>
                              Professional
                            </div>
                            <div className={`text-sm ${
                              theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              Clean blue theme
                            </div>
                          </div>
                          {theme === 'blue' && (
                            <Check className="h-5 w-5 text-blue-600 ml-auto" />
                          )}
                        </div>
                      </button>

                      <button
                        onClick={() => theme === 'blue' && toggleTheme()}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          theme === 'gold'
                            ? 'border-yellow-400 bg-yellow-400/10'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center">
                            <Crown className="h-4 w-4 text-black" />
                          </div>
                          <div className="text-left">
                            <div className={`font-medium ${
                              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                            }`}>
                              Premium Gold
                            </div>
                            <div className={`text-sm ${
                              theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              Luxury gold theme
                            </div>
                          </div>
                          {theme === 'gold' && (
                            <Check className="h-5 w-5 text-yellow-400 ml-auto" />
                          )}
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Channels Tab */}
          {activeTab === 'channels' && (
            <div className="space-y-6">
              {/* Header with Add button */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-lg font-semibold ${
                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    Connected Channels
                  </h3>
                  <p className={`text-sm ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Manage your communication channel integrations
                  </p>
                </div>
                <button
                  onClick={() => setShowChannelForm(true)}
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    theme === 'gold'
                      ? 'gold-gradient text-black hover-gold'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Channel
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className={`animate-spin rounded-full h-8 w-8 border-2 border-transparent ${
                    theme === 'gold'
                      ? 'border-t-yellow-400'
                      : 'border-t-blue-600'
                  }`}></div>
                </div>
              ) : channels.length === 0 ? (
                <div className={`text-center py-12 border-2 border-dashed rounded-lg ${
                  theme === 'gold'
                    ? 'border-yellow-400/30 text-gray-400'
                    : 'border-gray-300 text-gray-500'
                }`}>
                  <MessageSquare className={`h-12 w-12 mx-auto mb-4 opacity-50 ${
                    theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
                  }`} />
                  <h3 className={`text-lg font-medium mb-2 ${
                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    No channels configured
                  </h3>
                  <p className="mb-4">Add your first communication channel to start outreach</p>
                  <button
                    onClick={() => setShowChannelForm(true)}
                    className={`inline-flex items-center px-6 py-3 text-sm font-medium rounded-lg transition-colors ${
                      theme === 'gold'
                        ? 'gold-gradient text-black hover-gold'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Channel
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {channels.map((channel) => {
                    const Icon = getChannelIcon(channel.channel_type);
                    return (
                      <div
                        key={channel.id}
                        className={`p-6 rounded-xl border transition-all hover:shadow-md ${
                          theme === 'gold'
                            ? 'black-card gold-border hover:gold-shadow'
                            : 'bg-white border-gray-200 hover:shadow-lg'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-4">
                            <div className={`p-3 rounded-lg ${
                              theme === 'gold' ? 'gold-gradient' : 'bg-blue-100'
                            }`}>
                              <Icon className={`h-6 w-6 ${
                                theme === 'gold' ? 'text-black' : getChannelColor(channel.channel_type).replace('text-yellow-400', 'text-blue-600')
                              }`} />
                            </div>
                            <div>
                              <h4 className={`text-lg font-semibold ${
                                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                              }`}>
                                {channel.name}
                              </h4>
                              <p className={`text-sm ${
                                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                              }`}>
                                {channel.provider.charAt(0).toUpperCase() + channel.provider.slice(1)} • {channel.channel_type.charAt(0).toUpperCase() + channel.channel_type.slice(1)}
                              </p>
                              {(channel.sender_id || channel.email_address) && (
                                <p className={`text-xs ${
                                  theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                                }`}>
                                  {channel.email_address || channel.sender_id}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                              channel.is_active
                                ? theme === 'gold'
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-green-100 text-green-800'
                                : theme === 'gold'
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-red-100 text-red-800'
                            }`}>
                              {channel.is_active ? 'Active' : 'Inactive'}
                            </span>
                            <button
                              onClick={() => deleteChannel(channel.id)}
                              className={`p-2 rounded-lg transition-colors ${
                                theme === 'gold'
                                  ? 'text-gray-400 hover:text-red-400 hover:bg-red-400/10'
                                  : 'text-gray-400 hover:text-red-600 hover:bg-red-50'
                              }`}
                              title="Delete channel"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {/* Channel Stats */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className={`text-sm ${
                              theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              Usage
                            </span>
                            <span className={`text-sm font-medium ${
                              theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                            }`}>
                              {channel.usage_count || 0} / {channel.max_usage || 100}
                            </span>
                          </div>
                          
                          <div className={`w-full bg-gray-200 rounded-full h-2 ${
                            theme === 'gold' ? 'bg-gray-700' : 'bg-gray-200'
                          }`}>
                            <div
                              className={`h-2 rounded-full ${
                                theme === 'gold' ? 'gold-gradient' : 'bg-blue-600'
                              }`}
                              style={{
                                width: `${Math.min(((channel.usage_count || 0) / (channel.max_usage || 100)) * 100, 100)}%`
                              }}
                            />
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className={`text-xs ${
                              theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                            }`}>
                              Added {new Date(channel.created_at).toLocaleDateString()}
                            </span>
                            
                            {/* Provider-specific links */}
                            {channel.provider === 'vapi' && (
                              <a
                                href="https://dashboard.vapi.ai"
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`text-xs hover:underline flex items-center ${
                                  theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                                }`}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Vapi Dashboard
                              </a>
                            )}
                            
                            {channel.provider === 'twilio' && (
                              <a
                                href="https://console.twilio.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`text-xs hover:underline flex items-center ${
                                  theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                                }`}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Twilio Console
                              </a>
                            )}
                            
                            {channel.provider === 'gmail' && (
                              <a
                                href="https://myaccount.google.com/security"
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`text-xs hover:underline flex items-center ${
                                  theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                                }`}
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                Google Security
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Channel Setup Guide */}
              <div className={`p-6 rounded-lg border ${
                theme === 'gold'
                  ? 'border-yellow-400/20 bg-yellow-400/5'
                  : 'border-blue-200 bg-blue-50'
              }`}>
                <h4 className={`text-sm font-medium mb-3 ${
                  theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
                }`}>
                  📋 Supported Channels
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className={`flex items-center text-sm ${
                      theme === 'gold' ? 'text-yellow-300' : 'text-blue-600'
                    }`}>
                      <Phone className="h-4 w-4 mr-2" />
                      <strong>Voice Calls:</strong> Vapi AI
                    </div>
                    <div className={`flex items-center text-sm ${
                      theme === 'gold' ? 'text-yellow-300' : 'text-blue-600'
                    }`}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      <strong>SMS:</strong> Twilio
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className={`flex items-center text-sm ${
                      theme === 'gold' ? 'text-yellow-300' : 'text-blue-600'
                    }`}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      <strong>WhatsApp:</strong> Twilio
                    </div>
                    <div className={`flex items-center text-sm ${
                      theme === 'gold' ? 'text-yellow-300' : 'text-blue-600'
                    }`}>
                      <Mail className="h-4 w-4 mr-2" />
                      <strong>Email:</strong> Gmail API
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Other tabs content remains the same */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h3 className={`text-lg font-semibold ${
                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
              }`}>
                Notification Settings
              </h3>
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Notification preferences will be available soon.
              </p>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <h3 className={`text-lg font-semibold ${
                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
              }`}>
                Security Settings
              </h3>
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Security settings will be available soon.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Channel Form Modal */}
      {showChannelForm && (
        <DynamicChannelForm
          onClose={() => setShowChannelForm(false)}
          onSuccess={() => {
            setShowChannelForm(false);
            fetchChannels();
          }}
        />
      )}
    </div>
  );
}