import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { 
  Plus, 
  Target, 
  Edit2, 
  Trash2, 
  Eye,
  Crown,
  Zap,
  Phone,
  MessageSquare,
  Mail,
  Calendar,
  CheckCircle,
  ArrowRight
} from 'lucide-react';

import { X } from 'lucide-react';

interface Campaign {
  id: string;
  name: string | null;
  offer: string | null;
  calendar_url: string | null;
  goal: string | null;
  status: string | null;
  created_at: string;
}

export function Campaigns() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    offer: '',
    calendar_url: '',
    goal: '',
    conversion_goals: {
      target_bookings: 10,
      target_response_rate: 15,
      target_conversion_rate: 5
    },
    outreach_channels: {
      voice: false,
      sms: false,
      whatsapp: false,
      email: false
    }
  });
  const [creating, setCreating] = useState(false);

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
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      setError('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setCreating(true);
    setError('');

    try {
      const { error } = await supabase
        .from('campaigns')
        .insert([{
          user_id: user.id,
          name: formData.name || formData.offer,
          offer: formData.offer,
          calendar_url: formData.calendar_url,
          goal: formData.goal,
          avatar: JSON.stringify({
            conversion_goals: formData.conversion_goals,
            outreach_channels: formData.outreach_channels
          }),
          status: 'draft',
        }]);

      if (error) throw error;

      setFormData({ name: '', offer: '', calendar_url: '', goal: '' });
      setShowCreateForm(false);
      fetchCampaigns();
    } catch (error) {
      console.error('Error creating campaign:', error);
      setError('Failed to create campaign');
    } finally {
      setCreating(false);
    }
  };

  const deleteCampaign = async (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return;

    try {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId)
        .eq('user_id', user.id);

      if (error) throw error;
      fetchCampaigns();
    } catch (error) {
      console.error('Error deleting campaign:', error);
      setError('Failed to delete campaign');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              {theme === 'gold' ? (
                <Crown className="h-8 w-8 text-yellow-400" />
              ) : (
                <Target className="h-8 w-8 text-blue-600" />
              )}
              <h1 className={`text-3xl font-bold ${
                theme === 'gold' ? 'gold-text-gradient' : 'text-gray-900'
              }`}>
                Campaigns
              </h1>
            </div>
            <p className={theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}>
              Manage your outreach campaigns and conversion goals
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              theme === 'gold'
                ? 'gold-gradient text-black hover-gold'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Campaign
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <ErrorMessage
            message={error}
            onDismiss={() => setError('')}
          />
        )}

        {/* Campaigns List */}
        <div className={`rounded-xl border ${
          theme === 'gold' 
            ? 'black-card gold-border' 
            : 'bg-white border-gray-200'
        }`}>
          <div className={`p-4 border-b ${
            theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
          }`}>
            <h2 className={`text-lg font-medium ${
              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
            }`}>
            Your Campaigns ({campaigns.length})
          </h2>
          </div>
          
          <div className="p-4">
          {campaigns.length === 0 ? (
            <div className="text-center py-12">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                theme === 'gold' ? 'bg-yellow-400/20' : 'bg-blue-100'
              }`}>
                <Target className={`h-8 w-8 ${
                  theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                }`} />
              </div>
              <h3 className={`text-lg font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
              }`}>
                No campaigns yet
              </h3>
              <p className={`mb-6 ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Create your first campaign to start outreach
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className={`inline-flex items-center px-6 py-3 text-sm font-medium rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'gold-gradient text-black hover-gold'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Campaign
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className={`rounded-lg border p-6 transition-all hover:shadow-md ${
                    theme === 'gold'
                      ? 'border-yellow-400/20 bg-black/10 hover:bg-yellow-400/5'
                      : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        theme === 'gold' ? 'gold-gradient' : 'bg-blue-100'
                      }`}>
                        <Target className={`h-6 w-6 ${
                          theme === 'gold' ? 'text-black' : 'text-blue-600'
                        }`} />
                      </div>
                      <div>
                        <h3 className={`text-lg font-semibold ${
                          theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                        }`}>
                          {campaign.offer || campaign.name || 'New Campaign'}
                        </h3>
                        <p className={`text-sm ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Created {new Date(campaign.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      campaign.status === 'active'
                        ? theme === 'gold' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-800'
                        : theme === 'gold' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {campaign.status || 'draft'}
                    </span>
                  </div>

                  <p className={`text-sm mb-4 ${
                    theme === 'gold' ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {campaign.goal || campaign.offer || 'No description available'}
                  </p>

                  <div className="flex items-center justify-between">
                    <div></div>
                    
                    <div className="flex items-center space-x-2">
                      <Link
                        to={`/campaigns/${campaign.id}/edit`}
                        className={`p-2 rounded-lg transition-colors ${
                          theme === 'gold'
                            ? 'text-yellow-400 hover:bg-yellow-400/10'
                            : 'text-blue-600 hover:bg-blue-100'
                        }`}
                        title="Edit campaign"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Link>
                      
                      <button
                        onClick={() => deleteCampaign(campaign.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          theme === 'gold'
                            ? 'text-red-400 hover:bg-red-400/10'
                            : 'text-red-600 hover:bg-red-50'
                        }`}
                        title="Delete campaign"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>

        {/* Create Campaign Modal */}
        {showCreateForm && (
          <div className={`fixed inset-0 z-50 overflow-y-auto ${
            theme === 'gold' ? 'bg-black/75' : 'bg-gray-900/50'
          }`}>
            <div className="flex items-center justify-center min-h-screen p-4">
              <div className={`w-full max-w-2xl rounded-xl shadow-2xl ${
                theme === 'gold' ? 'black-card gold-border' : 'bg-white border border-gray-200'
              }`}>
                <div className={`p-6 border-b ${
                  theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <h2 className={`text-xl font-bold ${
                      theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                    }`}>
                      Create New Campaign
                    </h2>
                    <button
                      onClick={() => setShowCreateForm(false)}
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

                <div className="p-6">
                  <form onSubmit={handleCreateCampaign} className="space-y-4">
                    {/* Basic Campaign Info */}
                    <div className="space-y-4">
                      <h3 className={`text-lg font-semibold ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        Campaign Details
                      </h3>
                      
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        Campaign Name
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
                          placeholder="e.g., Q4 SaaS Founders Outreach"
                        />
                      </div>

                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        Offer Description *
                        </label>
                        <textarea
                          value={formData.offer}
                          onChange={(e) => setFormData({ ...formData, offer: e.target.value })}
                          rows={3}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                            theme === 'gold'
                              ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                              : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                          }`}
                          placeholder="e.g., Free consultation call to discuss your business growth strategy..."
                          required
                        />
                      </div>

                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        Calendar URL *
                        </label>
                        <input
                          type="url"
                          value={formData.calendar_url}
                          onChange={(e) => setFormData({ ...formData, calendar_url: e.target.value })}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                            theme === 'gold'
                              ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                              : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                          }`}
                          placeholder="https://calendly.com/..."
                          required
                        />
                      </div>

                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                        Campaign Goal
                        </label>
                        <textarea
                          value={formData.goal}
                          onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                          rows={3}
                          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                            theme === 'gold'
                              ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                              : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                          }`}
                          placeholder="Describe your campaign objectives..."
                        />
                      </div>
                    </div>
                    </div>

                    {/* Outreach Channels */}
                    <div className="space-y-4">
                      <h3 className={`text-lg font-semibold ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        Outreach Channels
                      </h3>
                      <p className={`text-sm ${
                        theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Select which channels you want to use for this campaign
                      </p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { key: 'voice', label: 'Voice Calls', icon: Phone },
                          { key: 'sms', label: 'SMS', icon: MessageSquare },
                          { key: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
                          { key: 'email', label: 'Email', icon: Mail }
                        ].map((channel) => {
                          const Icon = channel.icon;
                          const isSelected = formData.outreach_channels[channel.key as keyof typeof formData.outreach_channels];
                          
                          return (
                            <button
                              key={channel.key}
                              type="button"
                              onClick={() => setFormData({
                                ...formData,
                                outreach_channels: {
                                  ...formData.outreach_channels,
                                  [channel.key]: !isSelected
                                }
                              })}
                              className={`p-3 rounded-lg border-2 transition-all ${
                                isSelected
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
                                  isSelected
                                    ? theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                                    : theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                                }`} />
                                <span className={`text-xs font-medium text-center ${
                                  isSelected
                                    ? theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                                    : theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                  {channel.label}
                                </span>
                              </div>
                            </button>
                          );
                    {/* Conversion Goals */}
                    <div className="space-y-4">
                      <h3 className={`text-lg font-semibold ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        Conversion Goals
                      </h3>
                      <p className={`text-sm ${
                        theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Set your target metrics for this campaign
                      </p>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${
                            theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Target Bookings
                          </label>
                          <div className="relative">
                            <Calendar className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                              theme === 'gold' ? 'text-yellow-400' : 'text-gray-400'
                            }`} />
                            <input
                              type="number"
                              min="1"
                              value={formData.conversion_goals.target_bookings}
                              onChange={(e) => setFormData({
                                ...formData,
                                conversion_goals: {
                                  ...formData.conversion_goals,
                                  target_bookings: parseInt(e.target.value) || 10
                                }
                              })}
                              className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                                theme === 'gold'
                                  ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                                  : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                              }`}
                              placeholder="10"
                            />
                          </div>
                        </div>
                        })}
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${
                            theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Response Rate (%)
                          </label>
                          <div className="relative">
                            <ArrowRight className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                              theme === 'gold' ? 'text-yellow-400' : 'text-gray-400'
                            }`} />
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={formData.conversion_goals.target_response_rate}
                              onChange={(e) => setFormData({
                                ...formData,
                                conversion_goals: {
                                  ...formData.conversion_goals,
                                  target_response_rate: parseInt(e.target.value) || 15
                                }
                              })}
                              className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                                theme === 'gold'
                                  ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                                  : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                              }`}
                              placeholder="15"
                            />
                          </div>
                        </div>
                      </div>
                        <div>
                          <label className={`block text-sm font-medium mb-2 ${
                            theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            Conversion Rate (%)
                          </label>
                          <div className="relative">
                            <CheckCircle className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                              theme === 'gold' ? 'text-yellow-400' : 'text-gray-400'
                            }`} />
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={formData.conversion_goals.target_conversion_rate}
                              onChange={(e) => setFormData({
                                ...formData,
                                conversion_goals: {
                                  ...formData.conversion_goals,
                                  target_conversion_rate: parseInt(e.target.value) || 5
                                }
                              })}
                              className={`w-full pl-10 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                                theme === 'gold'
                                  ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                                  : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                              }`}
                              placeholder="5"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    </div>
                    <div className="flex space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setShowCreateForm(false)}
                        className={`flex-1 px-4 py-2 text-sm rounded-lg transition-colors ${
                          theme === 'gold'
                            ? 'text-gray-400 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                            : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                        }`}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={creating}
                        className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                          theme === 'gold'
                            ? 'gold-gradient text-black hover-gold'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {creating ? 'Creating...' : 'Create Campaign'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}