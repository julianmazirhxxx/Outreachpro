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
  Phone,
  MessageSquare,
  Mail,
  CheckCircle,
  ArrowRight,
  Clock,
  Users,
  X,
  AlertTriangle,
  Eye
} from 'lucide-react';

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
  const [campaignChannels, setCampaignChannels] = useState<Record<string, string[]>>({});
  
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
      fetchCampaignChannels();
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

  const fetchCampaignChannels = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('campaign_sequences')
        .select('campaign_id, type')
        .in('campaign_id', campaigns.map(c => c.id));

      if (error) throw error;

      const channelMap: Record<string, string[]> = {};
      data?.forEach(sequence => {
        if (!channelMap[sequence.campaign_id]) {
          channelMap[sequence.campaign_id] = [];
        }
        if (!channelMap[sequence.campaign_id].includes(sequence.type)) {
          channelMap[sequence.campaign_id].push(sequence.type);
        }
      });

      setCampaignChannels(channelMap);
    } catch (error) {
      console.error('Error fetching campaign channels:', error);
    }
  };

  const getCampaignIcon = (campaignId: string) => {
    const channels = campaignChannels[campaignId] || [];
    
    if (channels.length === 0) {
      return <Target className="h-6 w-6 text-blue-600" />;
    }
    
    // Show primary channel icon based on what's configured
    if (channels.includes('call') || channels.includes('voice')) {
      return <Phone className="h-6 w-6 text-blue-600" />;
    } else if (channels.includes('email')) {
      return <Mail className="h-6 w-6 text-blue-600" />;
    } else if (channels.includes('sms') || channels.includes('whatsapp')) {
      return <MessageSquare className="h-6 w-6 text-blue-600" />;
    } else {
      return <Target className="h-6 w-6 text-blue-600" />;
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

  const proceedToDetails = () => {
    if (selectedChannels.length === 0) {
      setError('Please select at least one communication channel to continue');
      return;
    }
    setError('');
    setCurrentStep('details');
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

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
        name: SecurityManager.sanitizeInput(formData.name || formData.offer),
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header - Exact match to screenshot */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Eye className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Campaigns</h1>
              <p className="text-gray-600">Manage your outreach campaigns</p>
            </div>
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
          <div className="mb-6">
            <ErrorMessage
              message={error}
              onDismiss={() => setError('')}
            />
          </div>
        )}

        {/* Campaigns Section */}
        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-4">
            Your Campaigns ({campaigns.length})
          </h2>
          
          {campaigns.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
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
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {campaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-sm transition-shadow"
                >
                  {/* Campaign Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                        {getCampaignIcon(campaign.id)}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {campaign.offer || campaign.name || 'New Campaign'}
                        </h3>
                        <p className="text-sm text-gray-500">
                          Created {new Date(campaign.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        {campaign.status || 'paused'}
                      </span>
                      <ArrowRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </div>

                  {/* Campaign Description */}
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {campaign.goal || campaign.offer || 'No description available'}
                  </p>

                  {/* Calendar Link */}

                  {/* Creation Date */}
                  <p className="text-xs text-gray-500 mb-4">
                    {new Date(campaign.created_at).toLocaleDateString()}
                  </p>

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between">
                    <div></div>
                    
                    <div className="flex items-center space-x-2">
                      <Link
                        to={`/campaigns/${campaign.id}/edit`}
                        className="p-2 rounded-lg text-blue-600 hover:bg-blue-100 transition-colors"
                        title="Edit campaign"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Link>
                      
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
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

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
                        Pick Your Conversions
                      </h2>
                      <p className="text-sm text-gray-600">
                        Select the communication channels for your outreach sequence
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
                  <div className="flex items-center space-x-4 mt-6">
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
                        <h3 className="text-lg font-semibold mb-2 text-gray-900">
                          Select Communication Channels
                        </h3>
                        <p className="text-sm mb-6 text-gray-600">
                          Choose which channels to include in your outreach sequence. Each channel has specific lead requirements.
                        </p>
                      </div>

                      {/* Channel Requirements Warning */}
                      {selectedChannels.length > 0 && (
                        <div className="p-4 rounded-lg border border-orange-200 bg-orange-50">
                          <div className="flex items-start space-x-2">
                            <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                            <div>
                              <h4 className="text-sm font-medium text-orange-800 mb-1">
                                Channel Requirements:
                              </h4>
                              <ul className="text-sm text-orange-700 space-y-1">
                                {selectedChannels.some(id => {
                                  const channel = connectedChannels.find(ch => ch.id === id);
                                  return channel?.channel_type !== 'email';
                                }) && (
                                  <li>• Phone channels require leads with phone numbers. Make sure to upload leads with valid phone numbers.</li>
                                )}
                                {selectedChannels.some(id => {
                                  const channel = connectedChannels.find(ch => ch.id === id);
                                  return channel?.channel_type === 'email';
                                }) && (
                                  <li>• Email channel requires leads with email addresses. Make sure to upload leads with valid email addresses.</li>
                                )}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Channel Selection Grid - 2x2 layout exactly like screenshot */}
                      <div className="grid grid-cols-2 gap-6">
                        {getChannelOptions().map((option) => {
                          const Icon = option.icon;
                          const isSelected = option.connectedChannel && selectedChannels.includes(option.connectedChannel.id);
                          const isAvailable = option.available;
                          
                          return (
                            <div
                              key={option.type}
                              onClick={() => isAvailable && handleChannelToggle(option.type)}
                              className={`relative p-8 rounded-lg border-2 transition-all cursor-pointer ${
                                !isAvailable
                                  ? 'border-gray-200 bg-gray-50 opacity-50 cursor-not-allowed'
                                  : isSelected
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {/* Selection Indicator */}
                              {isSelected && (
                                <div className="absolute top-4 right-4 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                                  <CheckCircle className="h-4 w-4 text-white" />
                                </div>
                              )}

                              {/* Channel Info */}
                              <div className="text-center space-y-4">
                                <div className={`w-16 h-16 mx-auto rounded-lg flex items-center justify-center ${
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
                                  <h4 className={`text-lg font-semibold mb-2 ${
                                    !isAvailable
                                      ? 'text-gray-400'
                                      : isSelected
                                        ? 'text-blue-600'
                                        : 'text-gray-900'
                                  }`}>
                                    {option.label}
                                  </h4>
                                  <p className="text-sm text-gray-500 mb-2">
                                    {option.description}
                                  </p>
                                  <p className={`text-xs font-medium ${
                                    !isAvailable ? 'text-red-500' : 'text-blue-600'
                                  }`}>
                                    {option.leadRequirement}
                                  </p>
                                  
                                  {isAvailable && option.connectedChannel && (
                                    <p className="text-xs text-blue-500 mt-1">
                                      {option.connectedChannel.name}
                                    </p>
                                  )}
                                  
                                  {!isAvailable && (
                                    <Link
                                      to="/settings"
                                      className="text-xs text-blue-600 hover:underline mt-2 inline-block"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      Connect in Settings →
                                    </Link>
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
                          onClick={proceedToDetails}
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
                      {/* Error Message within Modal */}
                      {error && (
                        <div className="rounded-lg border p-4 bg-red-50 border-red-200 text-red-800">
                          <div className="flex items-start">
                            <div className="flex-shrink-0">
                              <AlertTriangle className="h-5 w-5 text-red-600" />
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium">{error}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setError('')}
                              className="ml-auto text-red-600 hover:text-red-800"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      )}

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
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium mb-2 text-gray-700">
                            Campaign Name
                          </label>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="e.g., Q4 SaaS Founders Outreach"
                          />
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
      </div>
    </div>
  );
}