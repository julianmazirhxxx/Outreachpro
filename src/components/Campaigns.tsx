import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLoadingState } from '../hooks/useLoadingState';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { LoadingSpinner } from './common/LoadingSpinner';
import { ErrorMessage } from './common/ErrorMessage';
import { ConfirmDialog } from './common/ConfirmDialog';
import { SecurityManager } from '../utils/security';
import { InputValidator } from '../utils/validation';
import { supabase } from '../lib/supabase';
import { Plus, Target, Calendar, Edit2, Trash2, Crown, Star, Zap, CheckCircle, XCircle, Pause, Play, Phone, MessageSquare, Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Campaign {
  id: string;
  name: string | null;
  avatar: string | null;
  offer: string | null;
  calendar_url: string | null;
  goal: string | null;
  status: string | null;
  created_at: string;
}

interface SelectedChannel {
  id: string;
  type: 'voice' | 'sms' | 'whatsapp' | 'email';
  provider: string;
  name: string;
  sender_id: string | null;
}

export function Campaigns() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { handleAsyncError } = useErrorHandler();
  const { isLoading, error, setError, executeAsync } = useLoadingState();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createStep, setCreateStep] = useState<'channels' | 'details'>('channels');
  const [availableChannels, setAvailableChannels] = useState<any[]>([]);
  const [selectedChannels, setSelectedChannels] = useState<SelectedChannel[]>([]);
  const [updatingCampaign, setUpdatingCampaign] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; campaignId: string; campaignName: string }>({ 
    show: false, campaignId: '', campaignName: '' 
  });
  const [formData, setFormData] = useState({
    name: '',
    offer: '',
    calendar_url: '',
    goal: '',
    status: 'draft',
  });

  useEffect(() => {
    if (user) {
      fetchCampaigns();
      fetchAvailableChannels();
    }
  }, [user]);

  const fetchAvailableChannels = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('channels')
        .select('id, name, provider, channel_type, sender_id, is_active, usage_count, max_usage')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;
      setAvailableChannels(data || []);
    } catch (error) {
      console.error('Error fetching channels:', error);
    }
  };

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

  const toggleChannelSelection = (channel: any) => {
    const isSelected = selectedChannels.some(ch => ch.id === channel.id);
    
    if (isSelected) {
      setSelectedChannels(selectedChannels.filter(ch => ch.id !== channel.id));
    } else {
      setSelectedChannels([...selectedChannels, {
        id: channel.id,
        type: channel.channel_type,
        provider: channel.provider,
        name: channel.name,
        sender_id: channel.sender_id
      }]);
    }
  };

  const generateCampaignSequences = (channels: SelectedChannel[], campaignId: string) => {
    const sequences = channels.map((channel, index) => {
      // Map voice to call for backward compatibility
      const sequenceType = channel.type === 'voice' ? 'call' : channel.type;
      
      return {
        campaign_id: campaignId,
        user_id: user?.id,
        step_number: index + 1,
        type: sequenceType,
        wait_seconds: index === 0 ? 0 : (sequenceType === 'email' ? 300 : 3600), // 5 min for email, 1 hour for others
        prompt: `You are an AI appointment setter for this campaign. Contact leads via ${channel.type} and book qualified appointments.`,
        email_subject: sequenceType === 'email' ? 'Quick question about your business growth' : null,
        email_template: sequenceType === 'email' ? 'Hi {{name}}, I noticed your company and wanted to reach out about helping you scale. Would you be interested in a quick 15-minute call to discuss?' : null
      };
    });
    
    return sequences;
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

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that at least one channel is selected
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

    if (!supabase) {
      setError('Database connection not available');
      return;
    }
    
    if (!user) return;

    await executeAsync(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase.from('campaigns').insert({
        user_id: user.id,
        name: SecurityManager.sanitizeInput(formData.name),
        offer: SecurityManager.sanitizeInput(formData.offer),
        calendar_url: SecurityManager.sanitizeUrl(formData.calendar_url),
        goal: SecurityManager.sanitizeInput(formData.goal),
        status: formData.status,
      }).select();

      if (error) throw error;

      if (data && data[0]) {
        const campaignId = data[0].id;
        const campaignName = data[0].name || data[0].offer || 'prospects';
        
        try {
          // Create default training resource
          await supabase
            .from('training_resources')
            .insert({
              campaign_id: campaignId,
              user_id: user.id,
              type: 'note',
              content: `You are an appointment setter for this campaign: ${campaignName}. Set qualified appointments for our offer targeting ${data[0].offer || 'prospects'}. Be professional, friendly, and focus on qualifying prospects who would benefit from our solution.`
            });

          // Create campaign sequences based on selected channels
          const sequences = generateCampaignSequences(selectedChannels, campaignId);
          if (sequences.length > 0) {
            await supabase
              .from('campaign_sequences')
              .insert(sequences);
          }
        } catch (trainingError) {
          console.error('Error adding default training resource:', trainingError);
          // Don't fail the campaign creation if training resource fails
        }
      }

      setFormData({ name: '', offer: '', calendar_url: '', goal: '', status: 'draft' });
      setSelectedChannels([]);
      setCreateStep('channels');
      setShowCreateForm(false);
      fetchCampaigns();
    }, {
      successMessage: 'Campaign created successfully with default AI training!',
      errorMessage: 'Failed to create campaign'
    });
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    await executeAsync(async () => {
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', campaignId);

      if (error) throw error;
      fetchCampaigns();
      setDeleteConfirm({ show: false, campaignId: '', campaignName: '' });
    }, {
      successMessage: 'Campaign deleted successfully',
      errorMessage: 'Failed to delete campaign'
    });
  };

  const resetCreateForm = () => {
    setShowCreateForm(false);
    setCreateStep('channels');
    setSelectedChannels([]);
    setFormData({ name: '', offer: '', calendar_url: '', goal: '', status: 'draft' });
    setError('');
  };

  const toggleCampaignStatus = async (campaignId: string, currentStatus: string) => {
    if (!user) return;
    
    setUpdatingCampaign(campaignId);
    
    try {
      const newStatus = currentStatus === 'active' ? 'paused' : 'active';
      
      // Update campaign status
      const { error: campaignError } = await supabase
        .from('campaigns')
        .update({ status: newStatus })
        .eq('id', campaignId);

      if (campaignError) throw campaignError;

      // Update sequence progress status
      if (newStatus === 'paused') {
        // Queue all ready sequences (pause them)
        await supabase
          .from('lead_sequence_progress')
          .update({ status: 'queued' })
          .eq('campaign_id', campaignId)
          .eq('status', 'ready');
      } else {
        // Resume all queued sequences
        await supabase
          .from('lead_sequence_progress')
          .update({ status: 'ready' })
          .eq('campaign_id', campaignId)
          .eq('status', 'queued');
      }

      // Refresh campaigns to show updated status
      fetchCampaigns();
    } catch (error) {
      handleAsyncError(error, 'Failed to update campaign status');
    } finally {
      setUpdatingCampaign(null);
    }
  };

  if (isLoading && campaigns.length === 0) {
    return (
      <LoadingSpinner size="lg" message="Loading campaigns..." className="h-64" />
    );
  }

  if (error && campaigns.length === 0) {
    return (
      <ErrorMessage
        title="Campaigns Error"
        message={error}
        onRetry={fetchCampaigns}
        onDismiss={() => setError('')}
        className="m-6"
      />
    );
  }

  if (theme === 'gold') {
    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <Crown className="h-8 w-8 text-yellow-400" />
              <h1 className="text-3xl font-bold gold-text-gradient">Elite Campaigns</h1>
            </div>
            <p className="text-gray-400">
              Manage your premium outreach campaigns
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center px-6 py-3 gold-gradient text-black text-sm font-bold rounded-lg hover-gold transition-all duration-200 shadow-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Elite Campaign
          </button>
        </div>

        {error && (
          <ErrorMessage
            message={error}
            onDismiss={() => setError('')}
          />
        )}

        {/* Create Campaign Form */}
        {showCreateForm && (
          <div className="black-card rounded-xl gold-border p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <Star className="h-5 w-5 text-yellow-400" />
                <h2 className="text-lg font-semibold text-gray-200">
                  Create New Elite Campaign
                </h2>
              </div>
              <button
                onClick={resetCreateForm}
                className="text-gray-400 hover:text-gray-300"
              >
                ×
              </button>
            </div>
            
            {/* Step Indicator */}
            <div className="flex items-center space-x-4 mb-8">
              <div className={`flex items-center space-x-2 ${
                createStep === 'channels' ? 'text-yellow-400' : 'text-gray-500'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  createStep === 'channels' ? 'gold-gradient text-black' : 'bg-gray-700 text-gray-400'
                }`}>
                  1
                </div>
                <span className="text-sm font-medium">Select Channels</span>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-600" />
              <div className={`flex items-center space-x-2 ${
                createStep === 'details' ? 'text-yellow-400' : 'text-gray-500'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  createStep === 'details' ? 'gold-gradient text-black' : 'bg-gray-700 text-gray-400'
                }`}>
                  2
                </div>
                <span className="text-sm font-medium">Campaign Details</span>
              </div>
            </div>

            {/* Step 1: Channel Selection */}
            {createStep === 'channels' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-200 mb-2">
                    Choose Your Communication Channels
                  </h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Select which channels you want to use for this campaign. You can choose multiple channels for a multi-touch sequence.
                  </p>
                </div>

                {availableChannels.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-yellow-400/30 rounded-lg">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-600" />
                    <h3 className="text-lg font-medium text-gray-200 mb-2">
                      No Channels Connected
                    </h3>
                    <p className="text-gray-400 mb-4">
                      You need to connect at least one communication channel before creating a campaign.
                    </p>
                    <Link
                      to="/settings"
                      className="inline-flex items-center px-4 py-2 gold-gradient text-black text-sm font-bold rounded-lg hover-gold transition-all duration-200"
                    >
                      Connect Channels
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {availableChannels.map((channel) => {
                      const Icon = getChannelIcon(channel.channel_type);
                      const isSelected = selectedChannels.some(ch => ch.id === channel.id);
                      
                      return (
                        <div
                          key={channel.id}
                          onClick={() => toggleChannelSelection(channel)}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-yellow-400 bg-yellow-400/10 scale-105'
                              : 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/50'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg ${
                              isSelected ? 'gold-gradient' : 'bg-gray-700'
                            }`}>
                              <Icon className={`h-5 w-5 ${
                                isSelected ? 'text-black' : getChannelColor(channel.channel_type)
                              }`} />
                            </div>
                            <div className="flex-1">
                              <h4 className={`font-medium ${
                                isSelected ? 'text-yellow-400' : 'text-gray-200'
                              }`}>
                                {channel.name || `${channel.provider} ${channel.channel_type}`}
                              </h4>
                              <p className={`text-sm ${
                                isSelected ? 'text-yellow-300' : 'text-gray-400'
                              }`}>
                                {channel.provider.charAt(0).toUpperCase() + channel.provider.slice(1)} • {channel.channel_type.charAt(0).toUpperCase() + channel.channel_type.slice(1)}
                              </p>
                              {channel.sender_id && (
                                <p className="text-xs text-gray-500 truncate">
                                  {channel.sender_id}
                                </p>
                              )}
                            </div>
                            {isSelected && (
                              <CheckCircle className="h-5 w-5 text-yellow-400" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Selected Channels Summary */}
                {selectedChannels.length > 0 && (
                  <div className="p-4 rounded-lg bg-yellow-400/5 border border-yellow-400/20">
                    <h4 className="text-sm font-medium text-yellow-400 mb-2">
                      Selected Channels ({selectedChannels.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedChannels.map((channel, index) => {
                        const Icon = getChannelIcon(channel.type);
                        return (
                          <div key={channel.id} className="flex items-center space-x-2 px-3 py-1 bg-yellow-400/10 rounded-full">
                            <span className="text-xs font-bold text-yellow-400">
                              {index + 1}
                            </span>
                            <Icon className="h-3 w-3 text-yellow-400" />
                            <span className="text-xs text-yellow-300">
                              {channel.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      These channels will be used in sequence order for your campaign
                    </p>
                  </div>
                )}

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={resetCreateForm}
                    className="px-4 py-2 text-gray-400 bg-gray-800 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setCreateStep('details')}
                    disabled={selectedChannels.length === 0}
                    className="inline-flex items-center px-6 py-2 gold-gradient text-black text-sm font-bold rounded-lg hover-gold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue to Details
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Campaign Details */}
            {createStep === 'details' && (
              <form onSubmit={handleCreateCampaign} className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-200 mb-2">
                    Campaign Details
                  </h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Configure your campaign settings and messaging
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Campaign Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-yellow-400/30 rounded-lg bg-black/50 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                    placeholder="e.g., Q4 SaaS Founders Outreach"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This will be the main identifier for your campaign
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Premium Offer Description *
                    </label>
                    <textarea
                      value={formData.offer}
                      onChange={(e) =>
                        setFormData({ ...formData, offer: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-yellow-400/30 rounded-lg bg-black/50 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent h-20"
                      placeholder="e.g., Exclusive VIP consultation to help scale your business to 100k/month"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Elite Calendar URL *
                    </label>
                    <input
                      type="url"
                      value={formData.calendar_url}
                      onChange={(e) =>
                        setFormData({ ...formData, calendar_url: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-yellow-400/30 rounded-lg bg-black/50 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                      placeholder="https://calendly.com/..."
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Campaign Vision & Goals
                  </label>
                  <textarea
                    value={formData.goal}
                    onChange={(e) =>
                      setFormData({ ...formData, goal: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-yellow-400/30 rounded-lg bg-black/50 text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent h-24"
                    placeholder="Describe your elite campaign objectives and target outcomes..."
                  />
                </div>

                {/* Selected Channels Preview */}
                <div className="p-4 rounded-lg bg-yellow-400/5 border border-yellow-400/20">
                  <h4 className="text-sm font-medium text-yellow-400 mb-3">
                    Campaign Sequence Preview
                  </h4>
                  <div className="space-y-2">
                    {selectedChannels.map((channel, index) => {
                      const Icon = getChannelIcon(channel.type);
                      const delay = index === 0 ? 'Immediate' : 
                                   channel.type === 'email' ? '5 minutes' : '1 hour';
                      
                      return (
                        <div key={channel.id} className="flex items-center space-x-3">
                          <div className="w-6 h-6 rounded-full bg-yellow-400 text-black text-xs font-bold flex items-center justify-center">
                            {index + 1}
                          </div>
                          <Icon className="h-4 w-4 text-yellow-400" />
                          <span className="text-sm text-gray-300">
                            {channel.name}
                          </span>
                          <span className="text-xs text-gray-500">
                            • {delay} delay
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={() => setCreateStep('channels')}
                    className="inline-flex items-center px-4 py-2 text-gray-400 bg-gray-800 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Channels
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`inline-flex items-center px-6 py-2 text-sm font-bold rounded-lg transition-all duration-200 shadow-lg ${
                      theme === 'gold'
                        ? 'gold-gradient text-black'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    } disabled:opacity-50`}
                  >
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                        Creating...
                      </>
                    ) : (
                      'Launch Campaign'
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* Campaigns Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="black-card rounded-xl gold-border p-6 hover:gold-shadow transition-all duration-300 group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 gold-gradient rounded-lg flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-200">
                  <Target className="h-6 w-6 text-black" />
                </div>
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                    campaign.status === 'active'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : campaign.status === 'paused'
                      ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                      : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                  }`}
                >
                  {campaign.status === 'active' && <Zap className="h-3 w-3 mr-1" />}
                  {campaign.status || 'Draft'}
                </span>
              </div>

              <h3 className="text-lg font-semibold text-gray-200 mb-2">
                {campaign.name || campaign.offer || 'Elite Campaign'}
              </h3>
              
              <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                {campaign.offer || campaign.goal || 'Premium outreach strategy'}
              </p>

              {campaign.calendar_url && (
                <div className="flex items-center text-sm text-yellow-400 mb-4">
                  <Calendar className="h-4 w-4 mr-1" />
                  <span className="truncate">VIP Calendar Active</span>
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-gray-500">
                  {new Date(campaign.created_at).toLocaleDateString()}
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-2">
                <Link
                  to={`/campaigns/${campaign.id}/edit`}
                  className="p-2 text-yellow-400 hover:bg-yellow-400/10 rounded-lg transition-colors border border-transparent hover:border-yellow-400/30"
                  title="Edit campaign"
                >
                  <Edit2 className="h-4 w-4" />
                </Link>
                <button
                  onClick={() => setDeleteConfirm({ 
                    show: true, 
                    campaignId: campaign.id, 
                    campaignName: campaign.name || campaign.offer || 'Elite Campaign' 
                  })}
                  className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors border border-transparent hover:border-red-400/30"
                  title="Delete campaign"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {campaigns.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 gold-gradient rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
              <Crown className="h-10 w-10 text-black" />
            </div>
            <h3 className="text-2xl font-bold gold-text-gradient mb-2">
              Ready to dominate your market?
            </h3>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">
              Create your first elite campaign and start converting high-value prospects into premium clients.
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center px-8 py-4 gold-gradient text-black text-sm font-bold rounded-lg hover-gold transition-all duration-200 shadow-lg"
            >
              <Crown className="h-5 w-5 mr-2" />
              Create Elite Campaign
            </button>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          isOpen={deleteConfirm.show}
          title="Delete Campaign"
          message={`Are you sure you want to delete "${deleteConfirm.campaignName}"? This action cannot be undone and will remove all associated leads and data.`}
          confirmText="Delete Campaign"
          cancelText="Cancel"
          type="danger"
          onConfirm={() => handleDeleteCampaign(deleteConfirm.campaignId)}
          onCancel={() => setDeleteConfirm({ show: false, campaignId: '', campaignName: '' })}
          loading={isLoading}
        />
      </div>
    );
  }

  // Blue theme (original design)
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Campaigns</h1>
          <p className="mt-2 text-gray-600">
            Manage your outreach campaigns
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Campaign
        </button>
      </div>

      {/* Upload Result Message */}
      {error && (
        <ErrorMessage
          message={error}
          onDismiss={() => setError('')}
        />
      )}

      {/* Create Campaign Form */}
      {showCreateForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Create New Campaign
          </h2>
          <form onSubmit={handleCreateCampaign} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Campaign Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Q4 SaaS Founders Outreach"
                required
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Offer Description
                </label>
                <input
                  type="text"
                  value={formData.offer}
                  onChange={(e) =>
                    setFormData({ ...formData, offer: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Free consultation call"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Calendar URL
                </label>
                <input
                  type="url"
                  value={formData.calendar_url}
                  onChange={(e) =>
                    setFormData({ ...formData, calendar_url: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://calendly.com/..."
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Campaign Goal
              </label>
              <textarea
                value={formData.goal}
                onChange={(e) =>
                  setFormData({ ...formData, goal: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-20"
                placeholder="Describe your campaign objectives..."
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={resetCreateForm}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    Creating...
                  </div>
                ) : (
                  'Create Campaign'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Campaigns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {campaigns.map((campaign) => (
          <div
            key={campaign.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Target className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex items-center space-x-2">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    campaign.status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : campaign.status === 'paused'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {campaign.status || 'Draft'}
                </span>
                
                {(campaign.status === 'active' || campaign.status === 'paused') && (
                  <button
                    onClick={() => toggleCampaignStatus(campaign.id, campaign.status || 'draft')}
                    disabled={updatingCampaign === campaign.id}
                    className={`p-1.5 rounded-lg transition-colors ${
                      updatingCampaign === campaign.id
                        ? 'opacity-50 cursor-not-allowed'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                    title={campaign.status === 'active' ? 'Pause campaign' : 'Resume campaign'}
                  >
                    {updatingCampaign === campaign.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                    ) : campaign.status === 'active' ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </button>
                )}
              </div>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {campaign.name || campaign.offer || 'Untitled Campaign'}
            </h3>
            
            <p className="text-sm text-gray-600 mb-4 line-clamp-2">
              {campaign.offer || campaign.goal || 'No description set'}
            </p>

            {campaign.calendar_url && (
              <div className="flex items-center text-sm text-gray-500 mb-4">
                <Calendar className="h-4 w-4 mr-1" />
                <span className="truncate">Calendar linked</span>
              </div>
            )}

            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-gray-500">
                {new Date(campaign.created_at).toLocaleDateString()}
              </span>
            </div>

            {/* Action buttons with grey styling */}
            <div className="flex justify-end gap-2">
              <Link
                to={`/campaigns/${campaign.id}/edit`}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                title="Edit campaign"
              >
                <Edit2 className="h-4 w-4" />
              </Link>
              <button
                onClick={() => setDeleteConfirm({ 
                  show: true, 
                  campaignId: campaign.id, 
                  campaignName: campaign.name || campaign.offer || 'Untitled Campaign' 
                })}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                title="Delete campaign"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {campaigns.length === 0 && (
        <div className="text-center py-12">
          <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">
            No campaigns yet
          </h3>
          <p className="text-gray-600 mb-6">
            Create your first campaign to start reaching out to leads.
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Edit2 className="h-4 w-4 mr-2" />
            Create & Setup Campaign
          </button>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.show}
        title="Delete Campaign"
        message={`Are you sure you want to delete "${deleteConfirm.campaignName}"? This action cannot be undone and will remove all associated leads and data.`}
        confirmText="Delete Campaign"
        cancelText="Cancel"
        type="danger"
        onConfirm={() => handleDeleteCampaign(deleteConfirm.campaignId)}
        onCancel={() => setDeleteConfirm({ show: false, campaignId: '', campaignName: '' })}
        loading={isLoading}
      />
    </div>
  );
}