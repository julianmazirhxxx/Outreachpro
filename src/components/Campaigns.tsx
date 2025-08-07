import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLoadingState } from '../hooks/useLoadingState';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { LoadingSpinner } from './common/LoadingSpinner';
import { ErrorMessage } from './common/ErrorMessage';
import { supabase } from '../lib/supabase';
import { SecurityManager } from '../utils/security';
import { InputValidator } from '../utils/validation';
import { 
  Plus, 
  Target, 
  Calendar, 
  Edit2, 
  Trash2, 
  Play, 
  Pause, 
  Crown, 
  Zap,
  Phone,
  MessageSquare,
  Mail,
  CheckCircle,
  ArrowRight,
  Clock,
  Users
} from 'lucide-react';

interface Campaign {
  id: string;
  avatar: string | null;
  offer: string | null;
  calendar_url: string | null;
  goal: string | null;
  status: string | null;
  created_at: string;
}

interface ConnectedChannel {
  id: string;
  provider: string;
  channel_type: string;
  sender_id: string | null;
  is_active: boolean;
  name: string;
}

export function Campaigns() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { handleAsyncError } = useErrorHandler();
  const { isLoading, error, setError, executeAsync } = useLoadingState();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creatingCampaign, setCreatingCampaign] = useState(false);
  const [updatingCampaign, setUpdatingCampaign] = useState<string | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState<string | null>(null);
  
  // Channel selection state
  const [connectedChannels, setConnectedChannels] = useState<ConnectedChannel[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<'channels' | 'details'>('channels');
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    offer: '',
    calendar_url: '',
    goal: '',
  });

  useEffect(() => {
    if (user) {
      fetchCampaigns();
      fetchConnectedChannels();
    }
  }, [user]);

  const fetchCampaigns = async () => {
    if (!user) return;

    await executeAsync(async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    }, { errorMessage: 'Failed to load campaigns' });
  };

  const fetchConnectedChannels = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('channels')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at');

      if (error) throw error;
      setConnectedChannels(data || []);
    } catch (error) {
      console.error('Error fetching connected channels:', error);
    }
  };

  const handleChannelToggle = (channelId: string) => {
    setSelectedChannels(prev => 
      prev.includes(channelId)
        ? prev.filter(id => id !== channelId)
        : [...prev, channelId]
    );
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validate selected channels
    if (selectedChannels.length === 0) {
      setError('Please select at least one communication channel');
      return;
    }

    // Validate form data
    const validation = InputValidator.validateCampaignData({
      offer: formData.offer,
      calendar_url: formData.calendar_url,
      goal: formData.goal
    });
    
    if (!validation.isValid) {
      setError(validation.errors[0]);
      return;
    }

    setCreatingCampaign(true);

    await executeAsync(async () => {
      // Sanitize form data
      const sanitizedData = {
        user_id: user.id,
        name: SecurityManager.sanitizeInput(formData.name),
        offer: SecurityManager.sanitizeInput(formData.offer),
        calendar_url: SecurityManager.sanitizeUrl(formData.calendar_url),
        goal: SecurityManager.sanitizeInput(formData.goal),
        status: 'draft',
      };

      const { data: campaign, error } = await supabase
        .from('campaigns')
        .insert([sanitizedData])
        .select()
        .single();

      if (error) throw error;

      // Create default sequence steps for selected channels
      const sequenceSteps = selectedChannels.map((channelId, index) => {
        const channel = connectedChannels.find(ch => ch.id === channelId);
        return {
          campaign_id: campaign.id,
          user_id: user.id,
          step_number: index + 1,
          type: channel?.channel_type === 'voice' ? 'call' : channel?.channel_type || 'call',
          wait_seconds: index === 0 ? 0 : 24 * 3600, // First step immediate, others 24h later
          prompt: `You are an AI appointment setter. Contact leads via ${channel?.channel_type} and book qualified appointments for our offer: ${formData.offer}`,
        };
      });

      if (sequenceSteps.length > 0) {
        const { error: sequenceError } = await supabase
          .from('campaign_sequences')
          .insert(sequenceSteps);

        if (sequenceError) {
          console.error('Error creating sequence steps:', sequenceError);
        }
      }

      // Reset form
      setFormData({
        name: '',
        offer: '',
        calendar_url: '',
        goal: '',
      });
      setSelectedChannels([]);
      setCurrentStep('channels');
      setShowCreateForm(false);
      
      // Refresh campaigns list
      fetchCampaigns();
    }, {
      successMessage: 'Campaign created successfully!',
      errorMessage: 'Failed to create campaign'
    });

    setCreatingCampaign(false);
  };

  const toggleCampaignStatus = async (campaignId: string, currentStatus: string) => {
    if (!user) return;

    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    setUpdatingCampaign(campaignId);

    await executeAsync(async () => {
      const { error } = await supabase
        .from('campaigns')
        .update({ status: newStatus })
        .eq('id', campaignId)
        .eq('user_id', user.id);

      if (error) throw error;

      setCampaigns(campaigns.map(campaign => 
        campaign.id === campaignId 
          ? { ...campaign, status: newStatus }
          : campaign
      ));
    }, {
      successMessage: `Campaign ${newStatus === 'active' ? 'activated' : 'paused'} successfully`,
      errorMessage: `Failed to ${newStatus === 'active' ? 'activate' : 'pause'} campaign`
    });

    setUpdatingCampaign(null);
  };

  const deleteCampaign = async (campaignId: string) => {
    if (!user || !confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) return;

    setDeletingCampaign(campaignId);

    await executeAsync(async () => {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId)
        .eq('user_id', user.id);

      if (error) throw error;

      setCampaigns(campaigns.filter(campaign => campaign.id !== campaignId));
    }, {
      successMessage: 'Campaign deleted successfully',
      errorMessage: 'Failed to delete campaign'
    });

    setDeletingCampaign(null);
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

  const resetForm = () => {
    setFormData({
      name: '',
      offer: '',
      calendar_url: '',
      goal: '',
    });
    setSelectedChannels([]);
    setCurrentStep('channels');
    setShowCreateForm(false);
    setError('');
  };

  if (isLoading && campaigns.length === 0) {
    return <LoadingSpinner size="lg" message="Loading campaigns..." className="h-64" />;
  }

  return (
    <>
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
            Manage your outreach campaigns
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

      {/* Create Campaign Modal */}
      {showCreateForm && (
        <div className={`fixed inset-0 z-50 overflow-y-auto ${
          theme === 'gold' ? 'bg-black/75' : 'bg-gray-900/50'
        }`}>
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className={`w-full max-w-4xl rounded-xl shadow-2xl ${
              theme === 'gold' ? 'black-card gold-border' : 'bg-white border border-gray-200'
            }`}>
              {/* Modal Header */}
              <div className={`p-6 border-b ${
                theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className={`text-xl font-bold ${
                      theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                    }`}>
                      {currentStep === 'channels' ? 'Pick Your Conversions' : 'Campaign Details'}
                    </h2>
                    <p className={`text-sm ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {currentStep === 'channels' 
                        ? 'Select the communication channels for your outreach sequence'
                        : 'Configure your campaign details and objectives'
                      }
                    </p>
                  </div>
                  <button
                    onClick={resetForm}
                    className={`p-2 rounded-lg transition-colors ${
                      theme === 'gold'
                        ? 'text-gray-400 hover:bg-gray-800'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    ×
                  </button>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center space-x-4 mt-4">
                  <div className={`flex items-center space-x-2 ${
                    currentStep === 'channels' 
                      ? theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                      : theme === 'gold' ? 'text-green-400' : 'text-green-600'
                  }`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      currentStep === 'channels'
                        ? theme === 'gold' ? 'gold-gradient text-black' : 'bg-blue-600 text-white'
                        : theme === 'gold' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600'
                    }`}>
                      {currentStep === 'details' ? <CheckCircle className="h-4 w-4" /> : '1'}
                    </div>
                    <span className="text-sm font-medium">Pick Conversions</span>
                  </div>
                  
                  <ArrowRight className={`h-4 w-4 ${
                    theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
                  }`} />
                  
                  <div className={`flex items-center space-x-2 ${
                    currentStep === 'details'
                      ? theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                      : theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
                  }`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      currentStep === 'details'
                        ? theme === 'gold' ? 'gold-gradient text-black' : 'bg-blue-600 text-white'
                        : theme === 'gold' ? 'bg-gray-700 text-gray-500' : 'bg-gray-200 text-gray-500'
                    }`}>
                      2
                    </div>
                    <span className="text-sm font-medium">Campaign Details</span>
                  </div>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                {/* Step 1: Channel Selection */}
                {currentStep === 'channels' && (
                  <div className="space-y-6">
                    {connectedChannels.length === 0 ? (
                      <div className={`text-center py-12 border-2 border-dashed rounded-lg ${
                        theme === 'gold'
                          ? 'border-yellow-400/30 text-gray-400'
                          : 'border-gray-300 text-gray-500'
                      }`}>
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <h3 className={`text-lg font-medium mb-2 ${
                          theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                        }`}>
                          No channels connected
                        </h3>
                        <p className="mb-4">Connect communication channels to create campaigns</p>
                        <Link
                          to="/settings"
                          className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                            theme === 'gold'
                              ? 'gold-gradient text-black hover-gold'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Connect Channels
                        </Link>
                      </div>
                    ) : (
                      <>
                        <div>
                          <h3 className={`text-lg font-semibold mb-4 ${
                            theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                          }`}>
                            Select Communication Channels
                          </h3>
                          <p className={`text-sm mb-6 ${
                            theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            Choose which channels to include in your outreach sequence. Selected channels will be used in the order you select them.
                          </p>
                        </div>

                        {/* Channel Selection Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {connectedChannels.map((channel) => {
                            const Icon = getChannelIcon(channel.channel_type);
                            const isSelected = selectedChannels.includes(channel.id);
                            
                            return (
                              <div
                                key={channel.id}
                                onClick={() => handleChannelToggle(channel.id)}
                                className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all hover:scale-105 ${
                                  isSelected
                                    ? theme === 'gold'
                                      ? 'border-yellow-400 bg-yellow-400/10'
                                      : 'border-blue-500 bg-blue-50'
                                    : theme === 'gold'
                                      ? 'border-gray-600 hover:border-gray-500'
                                      : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                {/* Selection Indicator */}
                                {isSelected && (
                                  <div className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center ${
                                    theme === 'gold' ? 'bg-yellow-400' : 'bg-blue-600'
                                  }`}>
                                    <CheckCircle className={`h-4 w-4 ${
                                      theme === 'gold' ? 'text-black' : 'text-white'
                                    }`} />
                                  </div>
                                )}

                                {/* Channel Info */}
                                <div className="flex flex-col items-center text-center space-y-3">
                                  <div className={`p-3 rounded-lg ${
                                    isSelected
                                      ? theme === 'gold' ? 'bg-yellow-400/20' : 'bg-blue-100'
                                      : theme === 'gold' ? 'bg-gray-700' : 'bg-gray-100'
                                  }`}>
                                    <Icon className={`h-6 w-6 ${
                                      isSelected
                                        ? getChannelColor(channel.channel_type)
                                        : theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                                    }`} />
                                  </div>
                                  
                                  <div>
                                    <h4 className={`font-semibold ${
                                      isSelected
                                        ? theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                                        : theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                                    }`}>
                                      {channel.name}
                                    </h4>
                                    <p className={`text-sm ${
                                      theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                                    }`}>
                                      {channel.provider.charAt(0).toUpperCase() + channel.provider.slice(1)} {channel.channel_type.charAt(0).toUpperCase() + channel.channel_type.slice(1)}
                                    </p>
                                    {channel.sender_id && (
                                      <p className={`text-xs mt-1 ${
                                        theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
                                      }`}>
                                        {channel.sender_id.substring(0, 20)}...
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Selected Channels Preview */}
                        {selectedChannels.length > 0 && (
                          <div className={`p-4 rounded-lg border ${
                            theme === 'gold'
                              ? 'border-yellow-400/20 bg-yellow-400/5'
                              : 'border-blue-200 bg-blue-50'
                          }`}>
                            <h4 className={`text-sm font-medium mb-3 ${
                              theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
                            }`}>
                              Selected Sequence ({selectedChannels.length} channels)
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {selectedChannels.map((channelId, index) => {
                                const channel = connectedChannels.find(ch => ch.id === channelId);
                                if (!channel) return null;
                                
                                const Icon = getChannelIcon(channel.channel_type);
                                
                                return (
                                  <div
                                    key={channelId}
                                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
                                      theme === 'gold'
                                        ? 'bg-yellow-400/10 border border-yellow-400/20'
                                        : 'bg-blue-100 border border-blue-200'
                                    }`}
                                  >
                                    <span className={`text-xs font-bold ${
                                      theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                                    }`}>
                                      {index + 1}
                                    </span>
                                    <Icon className={`h-4 w-4 ${getChannelColor(channel.channel_type)}`} />
                                    <span className={`text-sm ${
                                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                                    }`}>
                                      {channel.channel_type.charAt(0).toUpperCase() + channel.channel_type.slice(1)}
                                    </span>
                                    {index > 0 && (
                                      <div className="flex items-center">
                                        <Clock className={`h-3 w-3 mr-1 ${
                                          theme === 'gold' ? 'text-gray-500' : 'text-gray-400'
                                        }`} />
                                        <span className={`text-xs ${
                                          theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                                        }`}>
                                          +24h
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Continue Button */}
                        <div className="flex justify-end">
                          <button
                            onClick={() => setCurrentStep('details')}
                            disabled={selectedChannels.length === 0}
                            className={`inline-flex items-center px-6 py-2 text-sm font-medium rounded-lg transition-colors ${
                              theme === 'gold'
                                ? 'gold-gradient text-black hover-gold'
                                : 'bg-blue-600 text-white hover:bg-blue-700'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            Continue to Details
                            <ArrowRight className="h-4 w-4 ml-2" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Step 2: Campaign Details */}
                {currentStep === 'details' && (
                  <form onSubmit={handleCreateCampaign} className="space-y-6">
                    {/* Selected Channels Summary */}
                    <div className={`p-4 rounded-lg border ${
                      theme === 'gold'
                        ? 'border-yellow-400/20 bg-yellow-400/5'
                        : 'border-blue-200 bg-blue-50'
                    }`}>
                      <h4 className={`text-sm font-medium mb-2 ${
                        theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
                      }`}>
                        Selected Channels ({selectedChannels.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedChannels.map((channelId, index) => {
                          const channel = connectedChannels.find(ch => ch.id === channelId);
                          if (!channel) return null;
                          
                          const Icon = getChannelIcon(channel.channel_type);
                          
                          return (
                            <div
                              key={channelId}
                              className={`flex items-center space-x-2 px-3 py-1 rounded-lg ${
                                theme === 'gold'
                                  ? 'bg-yellow-400/10 border border-yellow-400/20'
                                  : 'bg-blue-100 border border-blue-200'
                              }`}
                            >
                              <span className={`text-xs font-bold ${
                                theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                              }`}>
                                {index + 1}
                              </span>
                              <Icon className={`h-3 w-3 ${getChannelColor(channel.channel_type)}`} />
                              <span className={`text-xs ${
                                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                              }`}>
                                {channel.channel_type.charAt(0).toUpperCase() + channel.channel_type.slice(1)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => setCurrentStep('channels')}
                        className={`text-xs mt-2 hover:underline ${
                          theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                        }`}
                      >
                        ← Change channel selection
                      </button>
                    </div>

                    {/* Campaign Form Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Campaign Name *
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
                        Campaign Goal
                      </label>
                      <textarea
                        value={formData.goal}
                        onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                        rows={4}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                          theme === 'gold'
                            ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                            : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                        }`}
                        placeholder="Describe your campaign objectives and goals..."
                      />
                    </div>

                    {/* Form Actions */}
                    <div className="flex justify-between">
                      <button
                        type="button"
                        onClick={() => setCurrentStep('channels')}
                        className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                          theme === 'gold'
                            ? 'text-gray-400 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                            : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                        }`}
                      >
                        ← Back to Channels
                      </button>
                      
                      <button
                        type="submit"
                        disabled={creatingCampaign}
                        className={`inline-flex items-center px-6 py-2 text-sm font-medium rounded-lg transition-colors ${
                          theme === 'gold'
                            ? 'gold-gradient text-black hover-gold'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        } disabled:opacity-50`}
                      >
                        {creatingCampaign ? (
                          <div className={`animate-spin rounded-full h-4 w-4 border-b-2 mr-2 ${
                            theme === 'gold' ? 'border-black' : 'border-white'
                          }`}></div>
                        ) : (
                          <Plus className="h-4 w-4 mr-2" />
                        )}
                        {creatingCampaign ? 'Creating...' : 'Create Campaign'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Campaigns List */}
      {/* Simplified Campaigns List */}
      <div className="space-y-4">
        <h2 className={`text-lg font-medium ${
          theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
        }`}>
          Your Campaigns ({campaigns.length})
        </h2>
        
        {campaigns.length === 0 ? (
          <div className={`text-center py-16 rounded-2xl ${
            theme === 'gold'
              ? 'bg-gradient-to-br from-yellow-400/5 to-yellow-600/5'
              : 'bg-gradient-to-br from-blue-50 to-indigo-50'
          }`}>
            <Target className={`h-16 w-16 mx-auto mb-6 ${
              theme === 'gold' ? 'text-yellow-400/60' : 'text-blue-400'
            }`} />
            <h3 className={`text-xl font-semibold mb-3 ${
              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
            }`}>
              Ready to launch your first campaign?
            </h3>
            <p className={`text-lg mb-8 max-w-md mx-auto ${
              theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Create your first campaign to start reaching out to prospects and booking appointments
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className={`inline-flex items-center px-8 py-4 text-lg font-semibold rounded-xl transition-all shadow-lg hover:scale-105 ${
                theme === 'gold'
                  ? 'gold-gradient text-black hover-gold'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Plus className="h-5 w-5 mr-3" />
              Create Your First Campaign
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className={`group p-6 rounded-2xl transition-all duration-300 hover:scale-[1.02] cursor-pointer ${
                  theme === 'gold'
                    ? 'bg-gradient-to-r from-black/40 to-gray-900/40 hover:from-yellow-400/10 hover:to-yellow-600/10 border border-yellow-400/20 hover:border-yellow-400/40'
                    : 'bg-gradient-to-r from-white to-gray-50 hover:from-blue-50 hover:to-indigo-50 border border-gray-200 hover:border-blue-300 hover:shadow-lg'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all group-hover:scale-110 ${
                      theme === 'gold' ? 'gold-gradient shadow-lg' : 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg'
                    }`}>
                      <Target className={`h-7 w-7 ${
                        theme === 'gold' ? 'text-black' : 'text-white'
                      }`} />
                    </div>
                    <div>
                      <h3 className={`text-xl font-bold mb-1 ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        {campaign.offer || 'Untitled Campaign'}
                      </h3>
                      <div className="flex items-center space-x-4">
                        <p className={`text-sm ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          Created {new Date(campaign.created_at).toLocaleDateString()}
                        </p>
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                            campaign.status === 'active'
                              ? theme === 'gold' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-green-100 text-green-800'
                              : campaign.status === 'paused'
                              ? theme === 'gold' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-yellow-100 text-yellow-800'
                              : theme === 'gold' ? 'bg-gray-500/20 text-gray-400 border border-gray-500/30' : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {campaign.status === 'active' && <Zap className="h-3 w-3 mr-1" />}
                          {campaign.status || 'Draft'}
                        </span>
                      </div>
                      {campaign.goal && (
                        <p className={`text-sm mt-2 line-clamp-2 max-w-md ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {campaign.goal}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {(campaign.status === 'active' || campaign.status === 'paused') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCampaignStatus(campaign.id, campaign.status || 'draft');
                        }}
                        disabled={updatingCampaign === campaign.id}
                        className={`p-3 rounded-xl transition-all ${
                          updatingCampaign === campaign.id
                            ? 'opacity-50 cursor-not-allowed'
                            : theme === 'gold'
                              ? 'text-yellow-400 hover:bg-yellow-400/10 hover:scale-110'
                              : 'text-gray-600 hover:bg-gray-100 hover:scale-110'
                        }`}
                        title={campaign.status === 'active' ? 'Pause campaign' : 'Resume campaign'}
                      >
                        {updatingCampaign === campaign.id ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                        ) : campaign.status === 'active' ? (
                          <Pause className="h-5 w-5" />
                        ) : (
                          <Play className="h-5 w-5" />
                        )}
                      </button>
                    )}
                    
                    <Link
                      to={`/campaigns/${campaign.id}/edit`}
                      className={`p-3 rounded-xl transition-all hover:scale-110 ${
                        theme === 'gold'
                          ? 'text-yellow-400 hover:bg-yellow-400/10'
                          : 'text-blue-600 hover:bg-blue-100'
                      }`}
                      title="Edit campaign"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Edit2 className="h-5 w-5" />
                    </Link>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCampaign(campaign.id);
                      }}
                      disabled={deletingCampaign === campaign.id}
                      className={`p-3 rounded-xl transition-all hover:scale-110 ${
                        deletingCampaign === campaign.id
                          ? 'opacity-50 cursor-not-allowed'
                          : theme === 'gold'
                            ? 'text-red-400 hover:bg-red-400/10'
                            : 'text-red-600 hover:bg-red-50'
                      }`}
                      title="Delete campaign"
                    >
                      {deletingCampaign === campaign.id ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                      ) : (
                        <Trash2 className="h-5 w-5" />
                      )}
                    </button>

                    {campaign.calendar_url && (
                      <a
                        href={campaign.calendar_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className={`p-3 rounded-xl transition-all hover:scale-110 ${
                          theme === 'gold' ? 'text-yellow-400 hover:bg-yellow-400/10' : 'text-blue-600 hover:bg-blue-100'
                        }`}
                        title="View calendar"
                      >
                        <Calendar className="h-5 w-5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
      </div>
    </>
  );
}