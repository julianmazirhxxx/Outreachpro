import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { useLoadingState } from '../hooks/useLoadingState';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { LoadingSpinner } from './common/LoadingSpinner';
import { ErrorMessage } from './common/ErrorMessage';
import { ConfirmDialog } from './common/ConfirmDialog';
import { SecurityManager } from '../utils/security';
import { InputValidator } from '../utils/validation';
import { ArrowLeft, Save, Upload, MessageCircle, CheckCircle, XCircle, AlertCircle, Eye, ArrowRight, ArrowDown, Play, Phone, MessageSquare } from 'lucide-react';
import { AITrainer } from './AITrainer';
import { CampaignAnalytics } from './CampaignAnalytics';
import { UploadLeadsTab } from './UploadLeadsTab';
import { SequenceBuilder } from './SequenceBuilder';

interface Campaign {
  id: string;
  avatar: string | null;
  offer: string | null;
  calendar_url: string | null;
  goal: string | null;
  status: string | null;
  created_at: string;
}

export default function EditCampaign() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { handleAsyncError } = useErrorHandler();
  const { isLoading, error, setError, executeAsync } = useLoadingState();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [activeTab, setActiveTab] = useState<'analytics' | 'leads' | 'details' | 'training' | 'sequence'>('analytics');
  const [formData, setFormData] = useState({
    offer: '',
    calendar_url: '',
    goal: '',
    // Client Avatar/Persona fields
    target_industry: '',
    target_job_title: '',
    target_company_size: '',
    target_pain_points: '',
    target_description: '',
  });

  useEffect(() => {
    if (id && user) {
      fetchCampaign();
    }
  }, [id, user]);

  const fetchCampaign = async () => {
    if (!id || !user) return;

    await executeAsync(async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      
      if (!data) throw new Error('Campaign not found');

      if (data) {
        setCampaign(data);
        
        // Parse avatar field for client persona data
        let avatarData = {
          target_industry: '',
          target_job_title: '',
          target_company_size: '',
          target_pain_points: '',
          target_description: '',
        };
        
        if (data.avatar) {
          try {
            // Try to parse as JSON first
            const parsed = JSON.parse(data.avatar);
            avatarData = {
              target_industry: parsed.industry || '',
              target_job_title: parsed.jobTitle || '',
              target_company_size: parsed.companySize || '',
              target_pain_points: parsed.painPoints || '',
              target_description: parsed.description || '',
            };
          } catch (e) {
            // If not JSON, treat as plain text description
            avatarData.target_description = data.avatar;
          }
        }
        
        setFormData({
          offer: data.offer || '',
          calendar_url: data.calendar_url || '',
          goal: data.goal || '',
          ...avatarData,
        });
      }
    }, { errorMessage: 'Failed to load campaign' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !user) return;

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

    await executeAsync(async () => {
      // Prepare avatar data as JSON string
      const avatarData = {
        industry: SecurityManager.sanitizeInput(formData.target_industry),
        jobTitle: SecurityManager.sanitizeInput(formData.target_job_title),
        companySize: SecurityManager.sanitizeInput(formData.target_company_size),
        painPoints: SecurityManager.sanitizeInput(formData.target_pain_points),
        description: SecurityManager.sanitizeInput(formData.target_description),
      };
      
      // Only store avatar if at least one field has data
      const hasAvatarData = Object.values(avatarData).some(value => value.trim() !== '');
      const avatarString = hasAvatarData ? JSON.stringify(avatarData) : null;
      
      const updateData = {
        offer: SecurityManager.sanitizeInput(formData.offer),
        calendar_url: SecurityManager.sanitizeUrl(formData.calendar_url),
        goal: SecurityManager.sanitizeInput(formData.goal),
        avatar: avatarString,
      };
      
      const { error } = await supabase
        .from('campaigns')
        .update(updateData)
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update AI training prompts with new avatar data
      if (hasAvatarData) {
        await updateAITrainingPrompts(id, avatarData, formData.offer, formData.goal);
      }
    }, {
      successMessage: 'Campaign updated successfully!',
      errorMessage: 'Failed to update campaign'
    });
  };

  const generatePersonalizedPrompt = (avatarData: any, offer: string, goal: string) => {
    let prompt = "You are an AI appointment setter for this campaign.";
    
    // Add industry context
    if (avatarData.industry) {
      prompt += ` You're contacting professionals in the ${avatarData.industry} industry.`;
    }
    
    // Add role targeting
    if (avatarData.jobTitle) {
      prompt += ` Specifically, you're reaching out to ${avatarData.jobTitle}s and similar roles.`;
    }
    
    // Add company size context
    if (avatarData.companySize) {
      prompt += ` These are typically at companies with ${avatarData.companySize}.`;
    }
    
    // Add pain points
    if (avatarData.painPoints) {
      prompt += ` They commonly face these challenges: ${avatarData.painPoints}.`;
    }
    
    // Add offer context
    if (offer) {
      prompt += ` Your goal is to book qualified appointments for our offer: ${offer}.`;
    }
    
    // Add campaign goal context
    if (goal) {
      prompt += ` Campaign context: ${goal}.`;
    }
    
    // Add detailed persona description
    if (avatarData.description) {
      prompt += ` Additional context about your target audience: ${avatarData.description}.`;
    }
    
    // Add professional guidelines
    prompt += " Be professional, empathetic, and focus on understanding their specific needs before presenting our solution. Ask qualifying questions based on their likely pain points and company context.";
    
    return prompt;
  };

  const updateAITrainingPrompts = async (campaignId: string, avatarData: any, offer: string, goal: string) => {
    if (!user) return;
    
    try {
      // Generate personalized prompt
      const personalizedPrompt = generatePersonalizedPrompt(avatarData, offer, goal);
      
      // Update existing training resources
      const { data: existingResources } = await supabase
        .from('training_resources')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('type', 'note')
        .limit(1);
      
      if (existingResources && existingResources.length > 0) {
        // Update existing training resource
        await supabase
          .from('training_resources')
          .update({ content: personalizedPrompt })
          .eq('id', existingResources[0].id);
      } else {
        // Create new training resource if none exists
        await supabase
          .from('training_resources')
          .insert({
            campaign_id: campaignId,
            user_id: user.id,
            type: 'note',
            content: personalizedPrompt
          });
      }
      
      // Update campaign sequences with new prompt
      await supabase
        .from('campaign_sequences')
        .update({ prompt: personalizedPrompt })
        .eq('campaign_id', campaignId);
        
      console.log('AI training prompts updated with client avatar data');
    } catch (error) {
      console.error('Error updating AI training prompts:', error);
    }
  };

  const validateCampaignForPublishing = async (): Promise<string[]> => {
    const errors: string[] = [];
    
    if (!user || !campaign) return ['Campaign or user not found'];

    try {
      // Check if user has connected communication channels
      const { data: channels } = await supabase
        .from('channels')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (!channels || channels.length === 0) {
        errors.push('You must connect at least one communication channel before publishing a campaign. Go to Settings > Channels to set up your integrations.');
      }

      // Check if campaign has leads
      const { data: leads } = await supabase
        .from('uploaded_leads')
        .select('id')
        .eq('campaign_id', campaign.id)
        .limit(1);

      if (!leads || leads.length === 0) {
        errors.push('Campaign must have at least one lead before publishing. Upload leads in the "Upload Leads" tab.');
      }

      // Check basic campaign info
      if (!campaign.offer || campaign.offer.trim() === '') {
        errors.push('Campaign must have an offer description.');
      }

      if (!campaign.calendar_url || campaign.calendar_url.trim() === '') {
        errors.push('Campaign must have a calendar URL for booking appointments.');
      }

    } catch (error) {
      console.error('Error validating campaign:', error);
      errors.push('Error validating campaign. Please try again.');
    }

    return errors;
  };

  const setupCampaignDefaults = async (campaignId: string) => {
    if (!user) return;

    const errors: string[] = [];
    try {
      // Get existing training resources to use for prompt generation
      const { data: existingResources } = await supabase
        .from('training_resources')
        .select('content')
        .eq('campaign_id', campaignId)
        .limit(1);

      // Generate prompt from training resources, campaign description, or default
      let promptText = "You are an AI setter. Your job is to contact leads and book them into a calendar.";
      
      if (existingResources && existingResources.length > 0) {
        // Use training resource content
        promptText = existingResources[0].content;
      } else if (campaign?.goal && campaign.goal.trim() !== '') {
        // Use campaign description
        promptText = `You are an AI appointment setter. ${campaign.goal} Your job is to contact leads and book qualified appointments for our offer targeting ${campaign?.offer || 'prospects'}.`;
      } else {
        // Use default with campaign context
        promptText = `You are an AI setter. Your job is to contact leads and book them into a calendar for our offer: ${campaign?.offer || 'our solution'}. Be professional and focus on qualifying prospects.`;
      }

      // 1. Check if campaign_sequences exists, if not create default
      const { data: existingSequences } = await supabase
        .from('campaign_sequences')
        .select('id')
        .eq('campaign_id', campaignId)
        .limit(1);

      if (!existingSequences || existingSequences.length === 0) {
        await supabase
          .from('campaign_sequences')
          .insert({
            campaign_id: campaignId,
            user_id: user.id,
            step_number: 1,
            type: 'call', 
            wait_seconds: 0,
            prompt: promptText
          });
      }

      // 2. Check if training_resources exists, if not create default
      const { data: trainingResources } = await supabase
        .from('training_resources')
        .select('id')
        .eq('campaign_id', campaignId)
        .limit(1);

      if (!trainingResources || trainingResources.length === 0) {
        await supabase
          .from('training_resources')
          .insert({
            campaign_id: campaignId,
            user_id: user.id,
            type: 'note',
            content: promptText
          });
      }

      // 3. Get all campaign sequence steps (created by Sequence Builder)
      const { data: campaignSequences } = await supabase
        .from('campaign_sequences')
        .select('*')
        .eq('campaign_id', campaignId)
        .order('step_number');

      if (!campaignSequences || campaignSequences.length === 0) {
        errors.push('No sequence steps found. Please configure your campaign sequence first.');
        throw new Error('No sequence steps configured');
      }

      // 4. Get all uploaded leads for this campaign
      const { data: campaignLeads } = await supabase
        .from('uploaded_leads')
        .select('id')
        .eq('campaign_id', campaignId);

      if (campaignLeads && campaignLeads.length > 0) {
        // 5. First, insert leads into the leads table if they don't exist
        const leadsToInsert = campaignLeads.map(lead => ({
          id: lead.id,
          campaign_id: campaignId,
          user_id: user.id,
          status: 'not_called'
        }));

        // Use upsert to avoid duplicates
        await supabase
          .from('leads')
          .upsert(leadsToInsert, { onConflict: 'id' });

        // 6. Create lead_sequence_progress entries for EVERY lead × EVERY step
        const sequenceProgressData = [];
        const now = new Date();
        
        for (const lead of campaignLeads) {
          for (const sequence of campaignSequences) {
            // Calculate next_at timestamp based on step and wait_seconds
            let nextAt = new Date(now);
            
            if (sequence.step_number === 1) {
              // First step: ready immediately
              nextAt = now;
            } else {
              // Subsequent steps: calculate based on previous steps' wait times
              let totalWaitSeconds = 0;
              for (let i = 0; i < sequence.step_number - 1; i++) {
                const prevStep = campaignSequences[i];
                totalWaitSeconds += prevStep.wait_seconds || 0;
              }
              nextAt = new Date(now.getTime() + (totalWaitSeconds * 1000));
            }
            
            sequenceProgressData.push({
              lead_id: lead.id,
              campaign_id: campaignId,
              user_id: user.id,
              step: sequence.step_number,
              status: sequence.step_number === 1 ? 'ready' : 'queued',
              next_at: nextAt.toISOString(),
              last_contacted_at: now.toISOString()
            });
          }
        }

        // 7. Check for existing entries to avoid duplicates
        const { data: existingProgress } = await supabase
          .from('lead_sequence_progress')
          .select('lead_id, step')
          .eq('campaign_id', campaignId);

        const existingKeys = new Set(
          existingProgress?.map(ep => `${ep.lead_id}-${ep.step}`) || []
        );

        // Filter out entries that already exist
        const newProgressData = sequenceProgressData.filter(spd => 
          !existingKeys.has(`${spd.lead_id}-${spd.step}`)
        );

        // 8. Insert new sequence progress entries in batches
        if (newProgressData.length > 0) {
          // Insert in batches of 100 to avoid database limits
          const batchSize = 100;
          for (let i = 0; i < newProgressData.length; i += batchSize) {
            const batch = newProgressData.slice(i, i + batchSize);
            const { error: progressError } = await supabase
              .from('lead_sequence_progress')
              .insert(batch);
              
            if (progressError) {
              console.error('Error creating sequence progress batch:', progressError);
              errors.push(`Failed to set up batch ${Math.floor(i/batchSize) + 1} for outreach: ${progressError.message}`);
            }
          }
        }
        
        console.log(`Created ${newProgressData.length} new sequence progress entries for ${campaignLeads.length} leads across ${campaignSequences.length} steps`);
      } else {
        errors.push('No leads found to set up for outreach');
      }

    } catch (error) {
      console.error('Error setting up campaign defaults:', error);
      throw error;
    }
    
    if (errors.length > 0) {
      throw new Error(`Setup errors: ${errors.join(', ')}`);
    }
  };

  const handlePublish = async () => {
    setShowPublishDialog(false);
    if (!id || !user) return;

    // Validate campaign before publishing
    const errors = await validateCampaignForPublishing();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setPublishing(true);
    setValidationErrors([]);
    
    await executeAsync(async () => {
      // Setup campaign defaults and validate database requirements
      await setupCampaignDefaults(id);

      // Then update campaign status
      const { error } = await supabase
        .from('campaigns')
        .update({ status: 'active' })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state
      setCampaign(prev => prev ? { ...prev, status: 'active' } : null);
      setPublishing(false);
    }, {
      successMessage: 'Campaign published successfully! All leads are now ready for automated outreach.',
      errorMessage: 'Failed to publish campaign'
    });
    
    setPublishing(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const sanitizedValue = SecurityManager.sanitizeInput(e.target.value);
    setFormData({
      ...formData,
      [e.target.name]: sanitizedValue,
    });
  };

  if (isLoading && !campaign) {
    return (
      <LoadingSpinner size="lg" message="Loading campaign..." className="h-64" />
    );
  }

  if (error && !campaign) {
    return (
      <ErrorMessage
        title="Failed to Load Campaign"
        message={error}
        onRetry={fetchCampaign}
        onDismiss={() => navigate('/campaigns')}
        className="m-6"
      />
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Campaign not found
        </h3>
        <Link
          to="/campaigns"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Campaigns
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Link
            to="/campaigns"
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{campaign.offer || 'Untitled Campaign'}</h1>
            <p className="mt-1 text-sm text-gray-500">
              Campaign ID: {campaign.id}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            campaign.status === 'active'
              ? 'bg-green-100 text-green-800'
              : campaign.status === 'paused'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-gray-100 text-gray-800'
          }`}>
            {campaign.status || 'Draft'}
          </span>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className={`inline-flex items-center px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              theme === 'gold'
                ? 'gold-gradient text-black hover-gold'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isLoading ? (
              <div className={`animate-spin rounded-full h-4 w-4 border-b-2 mr-2 ${
                theme === 'gold' ? 'border-black' : 'border-white'
              }`}></div>
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isLoading ? 'Saving...' : 'Save'}
          </button>
          {campaign?.status === 'draft' && (
            <button
              onClick={() => setShowPublishDialog(true)}
              disabled={publishing || validationErrors.length > 0}
              className={`inline-flex items-center px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                theme === 'gold'
                  ? 'gold-gradient text-black hover-gold'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {publishing ? (
                <div className={`animate-spin rounded-full h-4 w-4 border-b-2 mr-2 ${
                  theme === 'gold' ? 'border-black' : 'border-white'
                }`}></div>
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {publishing ? 'Publishing...' : 'Publish'}
            </button>
          )}
        </div>
      </div>

      {/* Upload Result Message */}
      {error && (
        <ErrorMessage
          message={error}
          onDismiss={() => setError('')}
        />
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <ErrorMessage
          title="Campaign cannot be published"
          message={validationErrors.join('. ')}
          onDismiss={() => setValidationErrors([])}
        />
      )}

      {/* Tabs */}
      <div className={`rounded-xl shadow-sm border ${
        theme === 'gold' 
      }`}>
        <div className={`border-b ${
          theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
        }`}>
        }`}>
          <nav className="flex overflow-x-auto px-4 sm:px-6">
            {[
              { key: 'analytics', label: 'Campaign Analytics' },
              { key: 'leads', label: 'Upload Leads' },
              { key: 'details', label: 'Campaign Details' },
              { key: 'training', label: 'AI Training' },
              { key: 'sequence', label: 'Sequence Builder' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-4 px-4 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.key
                    ? theme === 'gold'
                      ? 'border-yellow-400 text-yellow-400'
                      : 'border-blue-500 text-blue-600'
                    : theme === 'gold'
                      ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-4 sm:p-6">
          {/* Campaign Details Tab */}
          {activeTab === 'details' && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Target Client Avatar Section */}
              <div className={`rounded-lg p-6 border ${
                theme === 'gold'
                  ? 'bg-yellow-400/10 border-yellow-400/20'
                  : 'bg-blue-50 border-blue-200'
              }`}>
                <h3 className={`text-lg font-semibold mb-4 ${
                  theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                }`}>
                  Target Client Avatar
                </h3>
                <p className={`text-sm mb-6 ${
                  theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Define your ideal client to help our AI create more personalized and effective outreach messages.
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label htmlFor="target_industry" className={`block text-sm font-medium mb-2 ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Industry
                    </label>
                    <input
                      type="text"
                      id="target_industry"
                      name="target_industry"
                      value={formData.target_industry}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                        theme === 'gold'
                          ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                          : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                      }`}
                      placeholder="e.g., SaaS, E-commerce, Healthcare"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="target_job_title" className={`block text-sm font-medium mb-2 ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Job Title / Role
                    </label>
                    <input
                      type="text"
                      id="target_job_title"
                      name="target_job_title"
                      value={formData.target_job_title}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                        theme === 'gold'
                          ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                          : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                      }`}
                      placeholder="e.g., Marketing Director, CEO, Sales Manager"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="target_company_size" className={`block text-sm font-medium mb-2 ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Company Size
                    </label>
                    <select
                      id="target_company_size"
                      name="target_company_size"
                      value={formData.target_company_size}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                        theme === 'gold'
                          ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                          : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                      }`}
                    >
                      <option value="">Select company size</option>
                      <option value="1-10 employees">1-10 employees (Startup)</option>
                      <option value="11-50 employees">11-50 employees (Small)</option>
                      <option value="51-200 employees">51-200 employees (Medium)</option>
                      <option value="201-1000 employees">201-1000 employees (Large)</option>
                      <option value="1000+ employees">1000+ employees (Enterprise)</option>
                    </select>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label htmlFor="target_pain_points" className={`block text-sm font-medium mb-2 ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Main Pain Points & Challenges
                    </label>
                    <textarea
                      id="target_pain_points"
                      name="target_pain_points"
                      value={formData.target_pain_points}
                      onChange={handleInputChange}
                      rows={3}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                        theme === 'gold'
                          ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                          : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                      }`}
                      placeholder="What problems does your ideal client face? What keeps them up at night?"
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="target_description" className={`block text-sm font-medium mb-2 ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Detailed Client Description
                    </label>
                    <textarea
                      id="target_description"
                      name="target_description"
                      value={formData.target_description}
                      onChange={handleInputChange}
                      rows={4}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                        theme === 'gold'
                          ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                          : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                      }`}
                      placeholder="Provide a detailed description of your ideal client: their goals, motivations, decision-making process, budget, timeline, etc."
                    />
                  </div>
                </div>
              </div>
              
              {/* Campaign Information Section */}
              <div className="space-y-6">
                <h3 className={`text-lg font-semibold ${
                  theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                }`}>
                  Campaign Information
                </h3>
                
              <div>
                <label htmlFor="offer" className={`block text-sm font-medium mb-2 ${
                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Campaign Offer *
                </label>
                <textarea
                  id="offer"
                  name="offer"
                  value={formData.offer}
                  onChange={handleInputChange}
                  rows={3}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                    theme === 'gold'
                      ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                      : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                  }`}
                  placeholder="e.g., Free consultation call to discuss your business growth strategy..."
                  required
                />
              </div>

              <div>
                <label htmlFor="goal" className={`block text-sm font-medium mb-2 ${
                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Description of the Campaign Goal
                </label>
                <textarea
                  id="goal"
                  name="goal"
                  value={formData.goal}
                  onChange={handleInputChange}
                  rows={4}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                    theme === 'gold'
                      ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                      : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                  }`}
                  placeholder="Describe your campaign objectives and goals..."
                />
              </div>

              <div>
                <label htmlFor="calendar_url" className={`block text-sm font-medium mb-2 ${
                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Calendar URL *
                </label>
                <input
                  type="url"
                  id="calendar_url"
                  name="calendar_url"
                  value={formData.calendar_url}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
                    theme === 'gold'
                      ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                      : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                  }`}
                  placeholder="https://calendly.com/..."
                />
              </div>
              </div>
            </form>
          )}

          {/* Campaign Analytics Tab */}
          {activeTab === 'analytics' && campaign && (
            <CampaignAnalytics campaignId={campaign.id} />
          )}

          {/* Upload Leads Tab */}
          {activeTab === 'leads' && campaign && (
            <UploadLeadsTab campaignId={campaign.id} />
          )}

          {/* AI Training Tab */}
          {activeTab === 'training' && campaign && (
            <AITrainer campaignId={campaign.id} />
          )}

          {/* Sequence Builder Tab */}
          {activeTab === 'sequence' && campaign && (
            <SequenceBuilder campaignId={campaign.id} />
          )}
        </div>
      </div>

      {/* Publish Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showPublishDialog}
        title="Publish Campaign"
        message="Are you sure you want to publish this campaign? This will activate automated outreach to all uploaded leads."
        confirmText="Publish Campaign"
        cancelText="Cancel"
        type="info"
        onConfirm={handlePublish}
        onCancel={() => setShowPublishDialog(false)}
        loading={publishing}
      />
    </div>
  );
}