import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
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
  X
} from 'lucide-react';

export function Settings() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'security' | 'appearance' | 'channels'>('profile');
  const [showChannelForm, setShowChannelForm] = useState(false);

  const tabs = [
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'notifications', label: 'Notifications', icon: Bell },
    { key: 'security', label: 'Security', icon: Shield },
    { key: 'appearance', label: 'Appearance', icon: Palette },
    { key: 'channels', label: 'Channels', icon: MessageSquare },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center space-x-3 mb-2">
          <User className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        </div>
        <p className="text-gray-600">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Settings Container */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex overflow-x-auto px-4 sm:px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`py-4 px-4 border-b-2 font-medium text-sm whitespace-nowrap flex items-center space-x-2 ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600'
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
                <h3 className="text-lg font-semibold mb-4 text-gray-900">
                  Profile Information
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">
                      Full Name
                    </label>
                    <input
                      type="text"
                      defaultValue={user?.user_metadata?.full_name || ''}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-700">
                      Email Address
                    </label>
                    <input
                      type="email"
                      defaultValue={user?.email || ''}
                      disabled
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                    />
                    <p className="text-xs mt-1 text-gray-500">
                      Email cannot be changed
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <button className="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors">
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
                <h3 className="text-lg font-semibold mb-4 text-gray-900">
                  Appearance Settings
                </h3>
                
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-gray-50">
                    <div className="font-medium mb-2 text-gray-900">
                      Theme
                    </div>
                    <div className="text-sm mb-4 text-gray-600">
                      Choose your preferred theme
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => theme === 'gold' && toggleTheme()}
                        className={`p-4 rounded-lg border-2 transition-all ${
                          theme === 'blue'
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                            <User className="h-4 w-4 text-white" />
                          </div>
                          <div className="text-left">
                            <div className="font-medium text-gray-900">Professional</div>
                            <div className="text-sm text-gray-600">Clean blue theme</div>
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
                            <User className="h-4 w-4 text-black" />
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
              <ChannelsManager onAddChannel={() => setShowChannelForm(true)} />
            </div>
          )}

        </div>
      </div>

      {/* Simple Channel Form Modal */}
      {showChannelForm && (
        <SimpleChannelForm
          onClose={() => setShowChannelForm(false)}
          onSuccess={() => {
            setShowChannelForm(false);
            window.location.reload(); // Simple refresh
          }}
        />
      )}
    </div>
  );
}

// Simple Channels Manager
function ChannelsManager({ onAddChannel }: { onAddChannel: () => void }) {
  const { user } = useAuth();
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchChannels();
    }
  }, [user]);

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
        .eq('id', channelId);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Header with Add button */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Connected Channels
          </h3>
          <p className="text-sm text-gray-600">
            Manage your communication channel integrations
          </p>
        </div>
        <button
          onClick={onAddChannel}
          className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Channel
        </button>
      </div>

      {channels.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg text-gray-500">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2 text-gray-900">
            No channels configured
          </h3>
          <p className="mb-4">Add your first communication channel to start outreach</p>
        </div>
      ) : (
        <div className="space-y-4">
          {channels.map((channel) => {
            const Icon = getChannelIcon(channel.channel_type);
            return (
              <div
                key={channel.id}
                className="p-6 rounded-lg border border-gray-200 bg-white transition-all hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 rounded-lg bg-blue-100">
                      <Icon className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">
                        {channel.name || `${channel.provider} ${channel.channel_type}`}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {channel.provider.charAt(0).toUpperCase() + channel.provider.slice(1)} • {channel.channel_type.charAt(0).toUpperCase() + channel.channel_type.slice(1)}
                      </p>
                      {channel.sender_id && (
                        <p className="text-xs text-gray-500">
                          {channel.sender_id.substring(0, 15)}...
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      channel.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {channel.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {channel.usage_count || 0}/{channel.max_usage || 100}
                    </span>
                    <span className="text-xs text-gray-500">
                      Added {new Date(channel.created_at).toLocaleDateString()}
                    </span>
                    <button
                      onClick={() => deleteChannel(channel.id)}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete channel"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Simple Channel Form
function SimpleChannelForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    channel_type: 'voice',
    provider: 'vapi',
    name: '',
    sender_id: '',
    api_key: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setError('');

    try {
      const channelData = {
        user_id: user.id,
        name: formData.name,
        provider: formData.provider,
        channel_type: formData.channel_type,
        sender_id: formData.sender_id || null,
        credentials: {
          api_key: formData.api_key
        },
        is_active: true,
        max_usage: 100,
      };

      const { error } = await supabase
        .from('channels')
        .insert([channelData]);

      if (error) throw error;

      onSuccess();
    } catch (error) {
      console.error('Error saving channel:', error);
      setError(error instanceof Error ? error.message : 'Failed to save channel');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/50">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-md rounded-xl shadow-2xl bg-white border border-gray-200">
          {/* Header */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Add Channel
              </h2>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Channel Type
                </label>
                <select
                  value={formData.channel_type}
                  onChange={(e) => setFormData({ ...formData, channel_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                >
                  <option value="voice">Voice (Vapi)</option>
                  <option value="sms">SMS (Twilio)</option>
                  <option value="email">Email (Gmail)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Channel Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  placeholder="e.g., Main Sales Line"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  API Key
                </label>
                <input
                  type="password"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                  placeholder="Enter your API key"
                  required
                />
              </div>

              {formData.channel_type !== 'voice' && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">
                    Phone Number / Email
                  </label>
                  <input
                    type="text"
                    value={formData.sender_id}
                    onChange={(e) => setFormData({ ...formData, sender_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900"
                    placeholder="+1234567890 or email@domain.com"
                  />
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-2 text-sm rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving...' : 'Add Channel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}