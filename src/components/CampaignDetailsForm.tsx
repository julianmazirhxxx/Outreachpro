import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLoadingState } from '../hooks/useLoadingState';
import { ErrorMessage } from './common/ErrorMessage';
import { SecurityManager } from '../utils/security';
import { InputValidator } from '../utils/validation';
import { supabase } from '../lib/supabase';
import { Save } from 'lucide-react';

interface Campaign {
  id: string;
  avatar: string | null;
  offer: string | null;
  calendar_url: string | null;
  goal: string | null;
  status: string | null;
  created_at: string;
}

interface CampaignDetailsFormProps {
  campaign: Campaign;
  onSave?: () => void;
}

export function CampaignDetailsForm({ campaign, onSave }: CampaignDetailsFormProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { isLoading, error, setError, executeAsync } = useLoadingState();
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
    if (campaign) {
      // Parse avatar field for client persona data
      let avatarData = {
        target_industry: '',
        target_job_title: '',
        target_company_size: '',
        target_pain_points: '',
        target_description: '',
      };
      
      if (campaign.avatar) {
        try {
          // Try to parse as JSON first
          const parsed = JSON.parse(campaign.avatar);
          avatarData = {
            target_industry: parsed.industry || '',
            target_job_title: parsed.jobTitle || '',
            target_company_size: parsed.companySize || '',
            target_pain_points: parsed.painPoints || '',
            target_description: parsed.description || '',
          };
        } catch (e) {
          // If not JSON, treat as plain text description
          avatarData.target_description = campaign.avatar;
        }
      }
      
      setFormData({
        offer: campaign.offer || '',
        calendar_url: campaign.calendar_url || '',
        goal: campaign.goal || '',
        ...avatarData,
      });
    }
  }, [campaign]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Sanitize all form data before submission
    const sanitizedFormData = Object.entries(formData).reduce((acc, [key, value]) => {
      acc[key] = typeof value === 'string' ? SecurityManager.sanitizeInput(value) : value;
      return acc;
    }, {} as Record<string, any>);

    // Validate form data
    const validation = InputValidator.validateCampaignData({
      offer: sanitizedFormData.offer,
      calendar_url: sanitizedFormData.calendar_url,
      goal: sanitizedFormData.goal
    });
    
    if (!validation.isValid) {
      setError(validation.errors[0]);
      return;
    }

    await executeAsync(async () => {
      // Prepare avatar data as JSON string
      const avatarData = {
        industry: sanitizedFormData.target_industry,
        jobTitle: sanitizedFormData.target_job_title,
        companySize: sanitizedFormData.target_company_size,
        painPoints: sanitizedFormData.target_pain_points,
        description: sanitizedFormData.target_description,
      };
      
      // Only store avatar if at least one field has data
      const hasAvatarData = Object.values(avatarData).some(value => value.trim() !== '');
      const avatarString = hasAvatarData ? JSON.stringify(avatarData) : null;
      
      const updateData = {
        offer: sanitizedFormData.offer,
        calendar_url: SecurityManager.sanitizeUrl(sanitizedFormData.calendar_url),
        goal: sanitizedFormData.goal,
        avatar: avatarString,
      };
      
      const { error } = await supabase
        .from('campaigns')
        .update(updateData)
        .eq('id', campaign.id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update AI training prompts with new avatar data
      if (hasAvatarData) {
        await updateAITrainingPrompts(campaign.id, avatarData, formData.offer, formData.goal);
      }

      onSave?.();
    }, {
      successMessage: 'Campaign updated successfully!',
      errorMessage: 'Failed to update campaign'
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    // Don't sanitize on every keystroke to preserve spaces while typing
    // We'll sanitize before submission
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <ErrorMessage
          message={error}
          onDismiss={() => setError('')}
        />
      )}

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

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className={`inline-flex items-center px-6 py-2 text-sm font-medium rounded-lg transition-colors ${
            theme === 'gold'
              ? 'gold-gradient text-black hover-gold'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          } disabled:opacity-50`}
        >
          {isLoading ? (
            <div className={`animate-spin rounded-full h-4 w-4 border-b-2 mr-2 ${
              theme === 'gold' ? 'border-black' : 'border-white'
            }`}></div>
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {isLoading ? 'Saving...' : 'Save Campaign Details'}
        </button>
      </div>
    </form>
  );
}