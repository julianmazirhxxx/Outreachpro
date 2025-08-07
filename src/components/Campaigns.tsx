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
  Users,
  X,
  AlertTriangle
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
  email_address?: string | null;
}

interface ChannelOption {
  type: 'voice' | 'sms' | 'whatsapp' | 'email';
  label: string;
  icon: any;
  description: string;
  leadRequirement: string;
  available: boolean;
  connectedChannel?: ConnectedChannel;
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
  const [channelValidationErrors, setChannelValidationErrors] = useState<string[]>([]);
  
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

  const getChannelOptions = (): ChannelOption[] => {
    const voiceChannel = connectedChannels.find(ch => ch.channel_type === 'voice');
    const smsChannel = connectedChannels.find(ch => ch.channel_type === 'sms');
    const whatsappChannel = connectedChannels.find(ch => ch.channel_type === 'whatsapp');
    const emailChannel = connectedChannels.find(ch => ch.channel_type === 'email');

    return [
      {
        type: 'voice',
        label: 'Voice Calls',
        icon: Phone,
        description: 'AI voice calls to prospects',
        leadRequirement: 'Requires: Phone numbers',
        available: !!voiceChannel,
        connectedChannel: voiceChannel
      },
      {
        type: 'sms',
        label: 'SMS Messages',
        icon: MessageSquare,
        description: 'Text messages to prospects',
        leadRequirement: 'Requires: Phone numbers',
        available: !!smsChannel,
        connectedChannel: smsChannel
      },
      {
        type: 'whatsapp',
        label: 'WhatsApp',
        icon: MessageSquare,
        description: 'WhatsApp messages to prospects',
        leadRequirement: 'Requires: Phone numbers',
        available: !!whatsappChannel,
        connectedChannel: whatsappChannel
      },
      {
        type: 'email',
        label: 'Email',
        icon: Mail,
        description: 'Email outreach to prospects',
        leadRequirement: 'Requires: Email addresses',
        available: !!emailChannel,
        connectedChannel: emailChannel
      }
    ];
  };

  const handleChannelToggle = (channelType: string) => {
    const channelOption = getChannelOptions().find(opt => opt.type === channelType);
    if (!channelOption?.available || !channelOption.connectedChannel) return;

    const channelId = channelOption.connectedChannel.id;
    
    setSelectedChannels(prev => 
      prev.includes(channelId)
        ? prev.filter(id => id !== channelId)
        : [...prev, channelId]
    );
  };

  const validateChannelSelection = (): string[] => {
    const errors: string[] = [];
    
    if (selectedChannels.length === 0) {
      errors.push('Please select at least one communication channel');
    }

    // Check if user has the required lead data for selected channels
    const selectedChannelTypes = selectedChannels.map(channelId => {
      const channel = connectedChannels.find(ch => ch.id === channelId);
      return channel?.channel_type;
    });

    const needsPhoneNumbers = selectedChannelTypes.some(type => 
      type === 'voice' || type === 'sms' || type === 'whatsapp'
    );
    const needsEmailAddresses = selectedChannelTypes.includes('email');

    if (needsPhoneNumbers) {
      errors.push('Selected channels require leads with phone numbers. Make sure to upload leads with valid phone numbers.');
    }
    if (needsEmailAddresses) {
      errors.push('Email channel requires leads with email addresses. Make sure to upload leads with valid email addresses.');
    }

    return errors;
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validate channel selection
    const channelErrors = validateChannelSelection();
    if (channelErrors.length > 0) {
      setChannelValidationErrors(channelErrors);
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
      setChannelValidationErrors([]);
      
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
    setChannelValidationErrors([]);
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
              <Target className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Campaigns</h1>
            </div>
            <p className="text-gray-600">Manage your outreach campaigns</p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
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
          <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-900/50">
            <div className="flex items-center justify-center min-h-screen p-4">
              <div className="w-full max-w-4xl rounded-xl shadow-2xl bg-white border border-gray-200">
                {/* Modal Header */}
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {currentStep === 'channels' ? 'Pick Your Conversions' : 'Campaign Details'}
                      </h2>
                      <p className="text-sm text-gray-600">
                        {currentStep === 'channels' 
                          ? 'Select the communication channels for your outreach sequence'
                          : 'Configure your campaign details and objectives'
                        }
                      </p>
                    </div>
                    <button
                      onClick={resetForm}
                      className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Progress Steps */}
                  <div className="flex items-center space-x-4 mt-4">
                    <div className={`flex items-center space-x-2 ${
                      currentStep === 'channels' 
                        ? 'text-blue-600'
                        : 'text-green-600'
                    }`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        currentStep === 'channels'
                          ? 'bg-blue-600 text-white'
                          : 'bg-green-100 text-green-600'
                      }`}>
                        {currentStep === 'details' ? <CheckCircle className="h-4 w-4" /> : '1'}
                      </div>
                      <span className="text-sm font-medium">Pick Conversions</span>
                    </div>
                    
                    <ArrowRight className="h-4 w-4 text-gray-400" />
                    
                    <div className={`flex items-center space-x-2 ${
                      currentStep === 'details'
                        ? 'text-blue-600'
                        : 'text-gray-400'
                    }`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        currentStep === 'details'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-500'
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
                      <div>
                        <h3 className="text-lg font-semibold mb-4 text-gray-900">
                          Select Communication Channels
                        </h3>
                        <p className="text-sm mb-6 text-gray-600">
                          Choose which channels to include in your outreach sequence. Each channel has specific lead requirements.
                        </p>
                      </div>

                      {/* Channel Validation Errors */}
                      {channelValidationErrors.length > 0 && (
                        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                          <div className="flex items-start">
                            <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium mb-1">Channel Requirements:</p>
                              <ul className="list-disc list-inside space-y-1">
                                {channelValidationErrors.map((error, index) => (
                                  <li key={index}>{error}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Channel Selection Grid - Always show 4 options */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {getChannelOptions().map((option) => {
                          const Icon = option.icon;
                          const isSelected = option.connectedChannel && selectedChannels.includes(option.connectedChannel.id);
                          const isAvailable = option.available;
                          
                          return (
                            <div
                              key={option.type}
                              onClick={() => isAvailable && handleChannelToggle(option.type)}
                              className={`relative p-6 rounded-lg border-2 transition-all ${
                                !isAvailable
                                  ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                                  : isSelected
                                    ? 'border-blue-500 bg-blue-50 cursor-pointer hover:bg-blue-100'
                                    : 'border-gray-200 bg-white cursor-pointer hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {/* Selection Indicator */}
                              {isSelected && (
                                <div className="absolute top-3 right-3 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                                  <CheckCircle className="h-4 w-4 text-white" />
                                </div>
                              )}

                              {/* Not Available Indicator */}
                              {!isAvailable && (
                                <div className="absolute top-3 right-3 w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center">
                                  <X className="h-4 w-4 text-white" />
                                </div>
                              )}

                              {/* Channel Info */}
                              <div className="flex flex-col items-center text-center space-y-3">
                                <div className={`p-4 rounded-lg ${
                                  !isAvailable
                                    ? 'bg-gray-100'
                                    : isSelected
                                      ? 'bg-blue-100'
                                      : 'bg-gray-100'
                                }`}>
                                  <Icon className={`h-8 w-8 ${
                                    !isAvailable
                                      ? 'text-gray-400'
                                      : isSelected
                                        ? 'text-blue-600'
                                        : 'text-gray-500'
                                  }`} />
                                </div>
                                
                                <div>
                                  <h4 className={`font-semibold ${
                                    !isAvailable
                                      ? 'text-gray-400'
                                      : isSelected
                                        ? 'text-blue-600'
                                        : 'text-gray-700'
                                  }`}>
                                    {option.label}
                                  </h4>
                                  <p className="text-sm text-gray-500 mt-1">
                                    {option.description}
                                  </p>
                                  <p className={`text-xs mt-2 font-medium ${
                                    !isAvailable ? 'text-red-500' : 'text-blue-600'
                                  }`}>
                                    {option.leadRequirement}
                                  </p>
                                  
                                  {!isAvailable && (
                                    <div className="mt-2">
                                      <Link
                                        to="/settings"
                                        className="text-xs text-blue-600 hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        Connect in Settings →
                                      </Link>
                                    </div>
                                  )}
                                  
                                  {isAvailable && option.connectedChannel && (
                                    <p className="text-xs text-gray-400 mt-1">
                                      {option.connectedChannel.name}
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
                        <div className="p-4 rounded-lg border border-blue-200 bg-blue-50">
                          <h4 className="text-sm font-medium mb-3 text-blue-700">
                            Selected Sequence ({selectedChannels.length} channels)
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {selectedChannels.map((channelId, index) => {
                              const channel = connectedChannels.find(ch => ch.id === channelId);
                              if (!channel) return null;
                              
                              const Icon = channel.channel_type === 'voice' ? Phone :
                                          channel.channel_type === 'email' ? Mail : MessageSquare;
                              
                              return (
                                <div
                                  key={channelId}
                                  className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-blue-100 border border-blue-200"
                                >
                                  <span className="text-xs font-bold text-blue-600">
                                    {index + 1}
                                  </span>
                                  <Icon className="h-4 w-4 text-blue-600" />
                                  <span className="text-sm text-gray-700">
                                    {channel.channel_type.charAt(0).toUpperCase() + channel.channel_type.slice(1)}
                                  </span>
                                  {index > 0 && (
                                    <div className="flex items-center">
                                      <Clock className="h-3 w-3 mr-1 text-gray-400" />
                                      <span className="text-xs text-gray-500">+24h</span>
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
                          onClick={() => {
                            const errors = validateChannelSelection();
                            if (errors.length > 0) {
                              setChannelValidationErrors(errors);
                              return;
                            }
                            setChannelValidationErrors([]);
                            setCurrentStep('details');
                          }}
                          disabled={selectedChannels.length === 0}
                          className="inline-flex items-center px-6 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Continue to Details
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Campaign Details */}
                  {currentStep === 'details' && (
                    <form onSubmit={handleCreateCampaign} className="space-y-6">
                      {/* Selected Channels Summary */}
                      <div className="p-4 rounded-lg border border-blue-200 bg-blue-50">
                        <h4 className="text-sm font-medium mb-2 text-blue-700">
                          Selected Channels ({selectedChannels.length})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {selectedChannels.map((channelId, index) => {
                            const channel = connectedChannels.find(ch => ch.id === channelId);
                            if (!channel) return null;
                            
                            const Icon = channel.channel_type === 'voice' ? Phone :
                                        channel.channel_type === 'email' ? Mail : MessageSquare;
                            
                            return (
                              <div
                                key={channelId}
                                className="flex items-center space-x-2 px-3 py-1 rounded-lg bg-blue-100 border border-blue-200"
                              >
                                <span className="text-xs font-bold text-blue-600">
                                  {index + 1}
                                </span>
                                <Icon className="h-3 w-3 text-blue-600" />
                                <span className="text-xs text-gray-700">
                                  {channel.channel_type.charAt(0).toUpperCase() + channel.channel_type.slice(1)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={() => setCurrentStep('channels')}
                          className="text-xs mt-2 text-blue-600 hover:underline"
                        >
                          ← Change channel selection
                        </button>
                      </div>

                      {/* Campaign Form Fields */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium mb-2 text-gray-700">
                            Campaign Name *
                          </label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="e.g., Q4 SaaS Founders Outreach"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium mb-2 text-gray-700">
                            Calendar URL *
                          </label>
                          <input
                            type="url"
                            value={formData.calendar_url}
                            onChange={(e) => setFormData({ ...formData, calendar_url: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="https://calendly.com/..."
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">
                          Offer Description *
                        </label>
                        <textarea
                          value={formData.offer}
                          onChange={(e) => setFormData({ ...formData, offer: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="e.g., Free consultation call to discuss your business growth strategy..."
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2 text-gray-700">
                          Campaign Goal
                        </label>
                        <textarea
                          value={formData.goal}
                          onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Describe your campaign objectives and goals..."
                        />
                      </div>

                      {/* Form Actions */}
                      <div className="flex justify-between">
                        <button
                          type="button"
                          onClick={() => setCurrentStep('channels')}
                          className="px-4 py-2 text-sm rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors"
                        >
                          ← Back to Channels
                        </button>
                        
                        <button
                          type="submit"
                          disabled={creatingCampaign}
                          className="inline-flex items-center px-6 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          {creatingCampaign ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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

        {/* Campaigns List - Simple Design */}
        {campaigns.length === 0 ? (
          <div className="bg-white shadow rounded-lg">
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Target className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-medium mb-2 text-gray-900">
                No campaigns yet
              </h3>
              <p className="mb-6 text-gray-600">
                Create your first campaign to start outreach
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center px-6 py-3 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create First Campaign
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900">Your Campaigns ({campaigns.length})</h2>
              </div>
            </div>
            
            <div className="p-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                {campaigns.map((campaign, index) => (
                  <div
                    key={campaign.id}
                    className={`p-6 border-b border-gray-200 transition-all hover:bg-gray-50 ${
                      index % 2 === 1 ? 'lg:border-l lg:border-gray-200' : ''
                    } ${
                      index >= campaigns.length - 2 ? 'lg:border-b-0' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Target className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {campaign.offer || 'Untitled Campaign'}
                          </h3>
                          <p className="text-sm text-gray-600">
                            Created {new Date(campaign.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          campaign.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : campaign.status === 'paused'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {campaign.status === 'active' && <Zap className="h-3 w-3 mr-1" />}
                        {campaign.status || 'Draft'}
                      </span>
                    </div>

                    {campaign.goal && (
                      <p className="text-sm mb-4 line-clamp-2 text-gray-600">
                        {campaign.goal}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <Link
                        to={`/campaigns/${campaign.id}/edit`}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                      >
                        <Edit2 className="h-4 w-4 mr-2" />
                        Manage
                      </Link>
                      
                      <div className="flex items-center space-x-2">
                        {(campaign.status === 'active' || campaign.status === 'paused') && (
                          <button
                            onClick={() => toggleCampaignStatus(campaign.id, campaign.status || 'draft')}
                            disabled={updatingCampaign === campaign.id}
                            className={`p-2 rounded-lg transition-colors ${
                              updatingCampaign === campaign.id
                                ? 'opacity-50 cursor-not-allowed'
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                            title={campaign.status === 'active' ? 'Pause campaign' : 'Resume campaign'}
                          >
                            {updatingCampaign === campaign.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                            ) : campaign.status === 'active' ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </button>
                        )}
                        
                        <button
                          onClick={() => deleteCampaign(campaign.id)}
                          disabled={deletingCampaign === campaign.id}
                          className={`p-2 rounded-lg transition-colors ${
                            deletingCampaign === campaign.id
                              ? 'opacity-50 cursor-not-allowed'
                              : 'text-red-600 hover:bg-red-50'
                          }`}
                          title="Delete campaign"
                        >
                          {deletingCampaign === campaign.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>

                        {campaign.calendar_url && (
                          <a
                            href={campaign.calendar_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg text-blue-600 hover:bg-blue-100 transition-colors"
                            title="View calendar"
                          >
                            <Calendar className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}