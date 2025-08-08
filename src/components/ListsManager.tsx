import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { LoadingSpinner } from './common/LoadingSpinner';
import { ErrorMessage } from './common/ErrorMessage';
import { ConfirmDialog } from './common/ConfirmDialog';
import { 
  Users, 
  Upload, 
  Search, 
  Filter, 
  Eye, 
  Phone, 
  Mail, 
  Building, 
  Briefcase,
  Calendar,
  Target,
  Plus,
  Download,
  Trash2,
  Edit2,
  Crown,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
  Copy,
  ArrowRight,
  List,
  FolderPlus,
  Move,
  UserPlus
} from 'lucide-react';

interface Lead {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  company_name: string | null;
  job_title: string | null;
  status: string | null;
  created_at: string;
  campaign_id: string;
}

interface Campaign {
  id: string;
  offer: string | null;
  status: string | null;
  created_at: string;
  lead_count?: number;
  contacted_count?: number;
  replied_count?: number;
  booked_count?: number;
  channels?: string[];
}

interface CreateListForm {
  name: string;
  description: string;
  offer: string;
  calendar_url: string;
  goal: string;
}

export function ListsManager() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'company_name'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [showCreateList, setShowCreateList] = useState(false);
  const [showMoveLeads, setShowMoveLeads] = useState(false);
  const [showDuplicateLeads, setShowDuplicateLeads] = useState(false);
  const [targetCampaign, setTargetCampaign] = useState('');
  const [createListForm, setCreateListForm] = useState<CreateListForm>({
    name: '',
    description: '',
    offer: '',
    calendar_url: '',
    goal: ''
  });
  const [creating, setCreating] = useState(false);
  const [moving, setMoving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);

  useEffect(() => {
    if (user) {
      fetchCampaigns();
    }
  }, [user]);

  useEffect(() => {
    if (selectedCampaign) {
      fetchLeadsForCampaign();
    } else {
      setLeads([]);
    }
  }, [selectedCampaign, sortBy, sortOrder]);

  const fetchCampaigns = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Fetch campaigns with lead counts
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (campaignsError) throw campaignsError;

      // Get lead counts for each campaign
      const campaignsWithCounts = await Promise.all(
        (campaignsData || []).map(async (campaign) => {
          const [leadsCount, contactedCount, repliedCount, bookedCount, channelsData] = await Promise.all([
            supabase
              .from('uploaded_leads')
              .select('id', { count: 'exact' })
              .eq('campaign_id', campaign.id),
            supabase
              .from('uploaded_leads')
              .select('id', { count: 'exact' })
              .eq('campaign_id', campaign.id)
              .in('status', ['contacted', 'replied', 'booked']),
            supabase
              .from('uploaded_leads')
              .select('id', { count: 'exact' })
              .eq('campaign_id', campaign.id)
              .eq('status', 'replied'),
            supabase
              .from('uploaded_leads')
              .select('id', { count: 'exact' })
              .eq('campaign_id', campaign.id)
              .eq('status', 'booked'),
            supabase
              .from('campaign_sequences')
              .select('type')
              .eq('campaign_id', campaign.id)
          ]);

          return {
            ...campaign,
            lead_count: leadsCount.count || 0,
            contacted_count: contactedCount.count || 0,
            replied_count: repliedCount.count || 0,
            booked_count: bookedCount.count || 0,
            channels: channelsData.data?.map(s => s.type) || []
          };
        })
      );

      setCampaigns(campaignsWithCounts);
      
      // Auto-select first campaign if none selected
      if (!selectedCampaign && campaignsWithCounts.length > 0) {
        setSelectedCampaign(campaignsWithCounts[0].id);
      }
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      setError('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeadsForCampaign = async () => {
    if (!selectedCampaign || !user) return;

    try {
      setLeadsLoading(true);
      
      const { data, error } = await supabase
        .from('uploaded_leads')
        .select('*')
        .eq('campaign_id', selectedCampaign)
        .eq('user_id', user.id)
        .order(sortBy, { ascending: sortOrder === 'asc' });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
      setError('Failed to load leads for this campaign');
    } finally {
      setLeadsLoading(false);
    }
  };

  const createNewList = async () => {
    if (!user) return;

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .insert([{
          user_id: user.id,
          name: createListForm.name,
          offer: createListForm.offer,
          calendar_url: createListForm.calendar_url,
          goal: createListForm.goal,
          status: 'draft'
        }])
        .select()
        .single();

      if (error) throw error;

      setShowCreateList(false);
      setCreateListForm({
        name: '',
        description: '',
        offer: '',
        calendar_url: '',
        goal: ''
      });
      
      fetchCampaigns();
      setSelectedCampaign(data.id);
    } catch (error) {
      console.error('Error creating list:', error);
      setError('Failed to create new list');
    } finally {
      setCreating(false);
    }
  };

  const moveLeadsToList = async () => {
    if (!targetCampaign || selectedLeads.length === 0) return;

    setMoving(true);
    try {
      // Get target campaign requirements
      const targetCampaignData = campaigns.find(c => c.id === targetCampaign);
      if (!targetCampaignData) throw new Error('Target campaign not found');

      // Check if leads meet target campaign requirements
      const leadsToMove = leads.filter(lead => selectedLeads.includes(lead.id));
      const requiresEmail = targetCampaignData.channels?.includes('email');
      const requiresPhone = targetCampaignData.channels?.some(ch => ['call', 'voice', 'sms', 'whatsapp'].includes(ch));

      // Validate leads against target requirements
      const invalidLeads = leadsToMove.filter(lead => {
        if (requiresEmail && (!lead.email || lead.email.trim() === '')) return true;
        if (requiresPhone && (!lead.phone || lead.phone.trim() === '')) return true;
        return false;
      });

      if (invalidLeads.length > 0) {
        setError(`${invalidLeads.length} leads don't meet the target campaign requirements. Email campaigns need email addresses, voice/SMS/WhatsApp campaigns need phone numbers.`);
        setMoving(false);
        return;
      }

      // Check for duplicates in target campaign
      const { data: existingLeads, error: duplicateError } = await supabase
        .from('uploaded_leads')
        .select('email, phone')
        .eq('campaign_id', targetCampaign);

      if (duplicateError) throw duplicateError;

      const existingEmails = new Set(existingLeads?.map(l => l.email).filter(Boolean));
      const existingPhones = new Set(existingLeads?.map(l => l.phone).filter(Boolean));

      const duplicateLeads = leadsToMove.filter(lead => 
        (lead.email && existingEmails.has(lead.email)) ||
        (lead.phone && existingPhones.has(lead.phone))
      );

      if (duplicateLeads.length > 0) {
        setError(`${duplicateLeads.length} leads already exist in the target campaign. Duplicates are not allowed.`);
        setMoving(false);
        return;
      }

      // Move leads
      const { error } = await supabase
        .from('uploaded_leads')
        .update({ campaign_id: targetCampaign })
        .in('id', selectedLeads);

      if (error) throw error;

      setSelectedLeads([]);
      setShowMoveLeads(false);
      setTargetCampaign('');
      fetchCampaigns();
      fetchLeadsForCampaign();
    } catch (error) {
      console.error('Error moving leads:', error);
      setError('Failed to move leads');
    } finally {
      setMoving(false);
    }
  };

  const duplicateLeadsToList = async () => {
    if (!targetCampaign || selectedLeads.length === 0) return;

    setDuplicating(true);
    try {
      // Get target campaign requirements
      const targetCampaignData = campaigns.find(c => c.id === targetCampaign);
      if (!targetCampaignData) throw new Error('Target campaign not found');

      // Get leads to duplicate
      const leadsToDuplicate = leads.filter(lead => selectedLeads.includes(lead.id));
      
      // Validate against target requirements
      const requiresEmail = targetCampaignData.channels?.includes('email');
      const requiresPhone = targetCampaignData.channels?.some(ch => ['call', 'voice', 'sms', 'whatsapp'].includes(ch));

      const invalidLeads = leadsToDuplicate.filter(lead => {
        if (requiresEmail && (!lead.email || lead.email.trim() === '')) return true;
        if (requiresPhone && (!lead.phone || lead.phone.trim() === '')) return true;
        return false;
      });

      if (invalidLeads.length > 0) {
        setError(`${invalidLeads.length} leads don't meet the target campaign requirements.`);
        setDuplicating(false);
        return;
      }

      // Check for duplicates
      const { data: existingLeads, error: duplicateError } = await supabase
        .from('uploaded_leads')
        .select('email, phone')
        .eq('campaign_id', targetCampaign);

      if (duplicateError) throw duplicateError;

      const existingEmails = new Set(existingLeads?.map(l => l.email).filter(Boolean));
      const existingPhones = new Set(existingLeads?.map(l => l.phone).filter(Boolean));

      // Filter out duplicates
      const validLeads = leadsToDuplicate.filter(lead => 
        !(lead.email && existingEmails.has(lead.email)) &&
        !(lead.phone && existingPhones.has(lead.phone))
      );

      if (validLeads.length === 0) {
        setError('All selected leads already exist in the target campaign.');
        setDuplicating(false);
        return;
      }

      // Duplicate leads
      const leadsToInsert = validLeads.map(lead => ({
        name: lead.name,
        phone: lead.phone || '',
        email: lead.email,
        company_name: lead.company_name,
        job_title: lead.job_title,
        campaign_id: targetCampaign,
        user_id: user?.id,
        status: 'pending'
      }));

      const { error } = await supabase
        .from('uploaded_leads')
        .insert(leadsToInsert);

      if (error) throw error;

      setSelectedLeads([]);
      setShowDuplicateLeads(false);
      setTargetCampaign('');
      fetchCampaigns();
      
      if (duplicateLeads.length > validLeads.length) {
        setError(`Duplicated ${validLeads.length} leads. ${duplicateLeads.length - validLeads.length} were skipped as duplicates.`);
      }
    } catch (error) {
      console.error('Error duplicating leads:', error);
      setError('Failed to duplicate leads');
    } finally {
      setDuplicating(false);
    }
  };

  const deleteSelectedLeads = async () => {
    if (selectedLeads.length === 0) return;

    try {
      const { error } = await supabase
        .from('uploaded_leads')
        .delete()
        .in('id', selectedLeads)
        .eq('user_id', user?.id);

      if (error) throw error;

      setSelectedLeads([]);
      fetchCampaigns();
      fetchLeadsForCampaign();
    } catch (error) {
      console.error('Error deleting leads:', error);
      setError('Failed to delete leads');
    }
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch = !searchTerm || 
      (lead.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.phone?.includes(searchTerm)) ||
      (lead.company_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.job_title?.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = !selectedStatus || lead.status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  const getCampaignRequirements = (campaignId: string) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    if (!campaign?.channels) return { email: false, phone: false };
    
    return {
      email: campaign.channels.includes('email'),
      phone: campaign.channels.some(ch => ['call', 'voice', 'sms', 'whatsapp'].includes(ch))
    };
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'contacted':
        return CheckCircle;
      case 'replied':
        return MessageSquare;
      case 'booked':
        return Calendar;
      case 'not_interested':
        return XCircle;
      default:
        return Clock;
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'contacted':
        return theme === 'gold' ? 'text-blue-400' : 'text-blue-600';
      case 'replied':
        return theme === 'gold' ? 'text-green-400' : 'text-green-600';
      case 'booked':
        return theme === 'gold' ? 'text-purple-400' : 'text-purple-600';
      case 'not_interested':
        return theme === 'gold' ? 'text-red-400' : 'text-red-600';
      default:
        return theme === 'gold' ? 'text-gray-400' : 'text-gray-600';
    }
  };

  const handleSelectLead = (leadId: string) => {
    setSelectedLeads(prev => 
      prev.includes(leadId) 
        ? prev.filter(id => id !== leadId)
        : [...prev, leadId]
    );
  };

  const handleSelectAll = () => {
    if (selectedLeads.length === filteredLeads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(filteredLeads.map(lead => lead.id));
    }
  };

  const exportLeads = () => {
    const leadsToExport = selectedLeads.length > 0 
      ? leads.filter(lead => selectedLeads.includes(lead.id))
      : filteredLeads;

    const csvContent = [
      ['Name', 'Email', 'Phone', 'Company', 'Job Title', 'Status', 'Created'],
      ...leadsToExport.map(lead => [
        lead.name || '',
        lead.email || '',
        lead.phone || '',
        lead.company_name || '',
        lead.job_title || '',
        lead.status || '',
        new Date(lead.created_at).toLocaleDateString()
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_${selectedCampaign}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <LoadingSpinner size="lg" message="Loading lists..." className="h-64" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3 mb-2">
            {theme === 'gold' ? (
              <Crown className="h-8 w-8 text-yellow-400" />
            ) : (
              <List className="h-8 w-8 text-blue-600" />
            )}
            <h1 className={`text-3xl font-bold ${
              theme === 'gold' ? 'gold-text-gradient' : 'text-gray-900'
            }`}>
              Lists
            </h1>
          </div>
          <p className={theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}>
            Manage your lead lists and campaigns
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <Link
            to="/targeting"
            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              theme === 'gold'
                ? 'border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Target className="h-4 w-4 mr-2" />
            New Prospects
          </Link>
          
          <button
            onClick={() => setShowCreateList(true)}
            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              theme === 'gold'
                ? 'gold-gradient text-black hover-gold'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <FolderPlus className="h-4 w-4 mr-2" />
            Create New List
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <ErrorMessage
          message={error}
          onDismiss={() => setError('')}
        />
      )}

      {/* Campaign Lists Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lists Sidebar */}
        <div className={`lg:col-span-1 rounded-xl border ${
          theme === 'gold' 
            ? 'black-card gold-border' 
            : 'bg-white border-gray-200'
        }`}>
          <div className={`p-4 border-b ${
            theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
          }`}>
            <h3 className={`text-lg font-semibold ${
              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
            }`}>
              Campaign Lists ({campaigns.length})
            </h3>
          </div>
          
          <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                onClick={() => setSelectedCampaign(campaign.id)}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedCampaign === campaign.id
                    ? theme === 'gold'
                      ? 'border-yellow-400 bg-yellow-400/10'
                      : 'border-blue-500 bg-blue-50'
                    : theme === 'gold'
                      ? 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      theme === 'gold' ? 'gold-gradient' : 'bg-blue-100'
                    }`}>
                      <Target className={`h-4 w-4 ${
                        theme === 'gold' ? 'text-black' : 'text-blue-600'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-sm font-semibold truncate ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        {campaign.offer || 'Untitled Campaign'}
                      </h4>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    campaign.status === 'active'
                      ? theme === 'gold' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-800'
                      : theme === 'gold' ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {campaign.status || 'draft'}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className={`flex items-center ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    <Users className="h-3 w-3 mr-1" />
                    {campaign.lead_count || 0}
                  </div>
                  <div className={`flex items-center ${
                    theme === 'gold' ? 'text-green-400' : 'text-green-600'
                  }`}>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {campaign.contacted_count || 0}
                  </div>
                  <div className={`flex items-center ${
                    theme === 'gold' ? 'text-blue-400' : 'text-blue-600'
                  }`}>
                    <MessageSquare className="h-3 w-3 mr-1" />
                    {campaign.replied_count || 0}
                  </div>
                  <div className={`flex items-center ${
                    theme === 'gold' ? 'text-purple-400' : 'text-purple-600'
                  }`}>
                    <Calendar className="h-3 w-3 mr-1" />
                    {campaign.booked_count || 0}
                  </div>
                </div>

                {/* Channel indicators */}
                <div className="flex items-center space-x-1 mt-2">
                  {campaign.channels?.map((channel, index) => {
                    const channelIcons = {
                      email: Mail,
                      call: Phone,
                      voice: Phone,
                      sms: MessageSquare,
                      whatsapp: MessageSquare
                    };
                    const ChannelIcon = channelIcons[channel as keyof typeof channelIcons] || MessageSquare;
                    
                    return (
                      <div
                        key={index}
                        className={`w-5 h-5 rounded flex items-center justify-center ${
                          theme === 'gold' ? 'bg-yellow-400/20' : 'bg-blue-100'
                        }`}
                        title={channel}
                      >
                        <ChannelIcon className={`h-3 w-3 ${
                          theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                        }`} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Leads Content */}
        <div className={`lg:col-span-2 rounded-xl border ${
          theme === 'gold' 
            ? 'black-card gold-border' 
            : 'bg-white border-gray-200'
        }`}>
          {selectedCampaign ? (
            <>
              {/* Leads Header */}
              <div className={`p-4 border-b ${
                theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className={`text-lg font-semibold ${
                      theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                    }`}>
                      {campaigns.find(c => c.id === selectedCampaign)?.offer || 'Campaign Leads'}
                    </h3>
                    <p className={`text-sm ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {filteredLeads.length} leads
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Link
                      to={`/campaigns/${selectedCampaign}/edit`}
                      className={`inline-flex items-center px-3 py-2 text-sm rounded-lg border transition-colors ${
                        theme === 'gold'
                          ? 'border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      Upload Leads
                    </Link>
                    
                    <button
                      onClick={() => navigate(`/campaigns/${selectedCampaign}/edit`)}
                      className={`inline-flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                        theme === 'gold'
                          ? 'text-gray-400 hover:bg-gray-800'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                      title="Edit campaign"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Search and Filters */}
                <div className="flex flex-col md:flex-row md:items-center md:space-x-4 space-y-4 md:space-y-0">
                  <div className="flex-1">
                    <div className="relative">
                      <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                        theme === 'gold' ? 'text-yellow-400' : 'text-gray-400'
                      }`} />
                      <input
                        type="text"
                        placeholder="Search leads..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                          theme === 'gold'
                            ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                            : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                        } focus:border-transparent`}
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        theme === 'gold'
                          ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                          : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                      } focus:border-transparent`}
                    >
                      <option value="">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="contacted">Contacted</option>
                      <option value="replied">Replied</option>
                      <option value="booked">Booked</option>
                      <option value="not_interested">Not Interested</option>
                    </select>

                    <select
                      value={`${sortBy}-${sortOrder}`}
                      onChange={(e) => {
                        const [field, order] = e.target.value.split('-');
                        setSortBy(field as any);
                        setSortOrder(order as any);
                      }}
                      className={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        theme === 'gold'
                          ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                          : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                      } focus:border-transparent`}
                    >
                      <option value="created_at-desc">Newest First</option>
                      <option value="created_at-asc">Oldest First</option>
                      <option value="name-asc">Name A-Z</option>
                      <option value="name-desc">Name Z-A</option>
                      <option value="company_name-asc">Company A-Z</option>
                      <option value="company_name-desc">Company Z-A</option>
                    </select>
                  </div>
                </div>

                {/* Bulk Actions */}
                {selectedLeads.length > 0 && (
                  <div className={`mt-4 p-4 rounded-lg border ${
                    theme === 'gold'
                      ? 'border-yellow-400/20 bg-yellow-400/5'
                      : 'border-blue-200 bg-blue-50'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${
                        theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
                      }`}>
                        {selectedLeads.length} leads selected
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setShowMoveLeads(true)}
                          className={`inline-flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                            theme === 'gold'
                              ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                              : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <Move className="h-4 w-4 mr-1" />
                          Move
                        </button>
                        <button
                          onClick={() => setShowDuplicateLeads(true)}
                          className={`inline-flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                            theme === 'gold'
                              ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                              : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Duplicate
                        </button>
                        <button
                          onClick={exportLeads}
                          className={`inline-flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                            theme === 'gold'
                              ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                              : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Export
                        </button>
                        <button
                          onClick={deleteSelectedLeads}
                          className={`inline-flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                            theme === 'gold'
                              ? 'bg-red-600 text-white hover:bg-red-700'
                              : 'bg-red-600 text-white hover:bg-red-700'
                          }`}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Leads Table */}
              <div className="overflow-x-auto">
                {leadsLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <LoadingSpinner size="md" message="Loading leads..." />
                  </div>
                ) : filteredLeads.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className={`h-12 w-12 mx-auto mb-4 ${
                      theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
                    }`} />
                    <h3 className={`text-lg font-medium mb-2 ${
                      theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                    }`}>
                      No leads in this list
                    </h3>
                    <p className={`mb-6 ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {searchTerm || selectedStatus
                        ? 'No leads match your search criteria'
                        : 'Upload leads to get started with this campaign'}
                    </p>
                    <Link
                      to={`/campaigns/${selectedCampaign}/edit`}
                      className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        theme === 'gold'
                          ? 'gold-gradient text-black hover-gold'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Leads
                    </Link>
                  </div>
                ) : (
                  <table className="min-w-full">
                    <thead className={`${
                      theme === 'gold' ? 'bg-black/20' : 'bg-gray-50'
                    }`}>
                      <tr>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          <input
                            type="checkbox"
                            checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0}
                            onChange={handleSelectAll}
                            className="rounded"
                          />
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Lead
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Contact Info
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Company
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Status
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Added
                        </th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${
                      theme === 'gold' ? 'divide-yellow-400/20' : 'divide-gray-200'
                    }`}>
                      {filteredLeads.map((lead) => {
                        const StatusIcon = getStatusIcon(lead.status);
                        return (
                          <tr key={lead.id} className={`hover:${
                            theme === 'gold' ? 'bg-yellow-400/5' : 'bg-gray-50'
                          } transition-colors`}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={selectedLeads.includes(lead.id)}
                                onChange={() => handleSelectLead(lead.id)}
                                className="rounded"
                              />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                  theme === 'gold' ? 'bg-blue-500/20' : 'bg-blue-100'
                                }`}>
                                  <Users className={`h-5 w-5 ${
                                    theme === 'gold' ? 'text-blue-400' : 'text-blue-600'
                                  }`} />
                                </div>
                                <div className="ml-4">
                                  <div className={`text-sm font-medium ${
                                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                                  }`}>
                                    {lead.name || 'No name'}
                                  </div>
                                  {lead.job_title && (
                                    <div className={`text-sm ${
                                      theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                                    }`}>
                                      {lead.job_title}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="space-y-1">
                                {lead.email && (
                                  <div className={`flex items-center text-sm ${
                                    theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                                  }`}>
                                    <Mail className="h-3 w-3 mr-2" />
                                    {lead.email}
                                  </div>
                                )}
                                {lead.phone && (
                                  <div className={`flex items-center text-sm ${
                                    theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                                  }`}>
                                    <Phone className="h-3 w-3 mr-2" />
                                    {lead.phone}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {lead.company_name ? (
                                <div className={`flex items-center text-sm ${
                                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                  <Building className="h-3 w-3 mr-2" />
                                  {lead.company_name}
                                </div>
                              ) : (
                                <span className={`text-sm ${
                                  theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                                }`}>
                                  No company
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <StatusIcon className={`h-4 w-4 mr-2 ${getStatusColor(lead.status)}`} />
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  lead.status === 'booked'
                                    ? theme === 'gold' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-800'
                                    : lead.status === 'replied'
                                    ? theme === 'gold' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-800'
                                    : lead.status === 'contacted'
                                    ? theme === 'gold' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-800'
                                    : lead.status === 'not_interested'
                                    ? theme === 'gold' ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-800'
                                    : theme === 'gold' ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {lead.status || 'pending'}
                                </span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className={`text-sm ${
                                theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                              }`}>
                                {new Date(lead.created_at).toLocaleDateString()}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <List className={`h-12 w-12 mx-auto mb-4 ${
                  theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
                }`} />
                <h3 className={`text-lg font-medium mb-2 ${
                  theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                }`}>
                  Select a campaign list
                </h3>
                <p className={theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}>
                  Choose a campaign from the left to view and manage its leads
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create New List Modal */}
      {showCreateList && (
        <div className={`fixed inset-0 z-50 overflow-y-auto ${
          theme === 'gold' ? 'bg-black/75' : 'bg-gray-900/50'
        }`}>
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className={`w-full max-w-md rounded-xl shadow-2xl ${
              theme === 'gold' ? 'black-card gold-border' : 'bg-white border border-gray-200'
            }`}>
              <div className={`p-6 border-b ${
                theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-semibold ${
                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    Create New List
                  </h3>
                  <button
                    onClick={() => setShowCreateList(false)}
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

              <div className="p-6 space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    List Name *
                  </label>
                  <input
                    type="text"
                    value={createListForm.name}
                    onChange={(e) => setCreateListForm({ ...createListForm, name: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                        : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                    }`}
                    placeholder="e.g., SaaS Founders Q4"
                    required
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Offer Description *
                  </label>
                  <textarea
                    value={createListForm.offer}
                    onChange={(e) => setCreateListForm({ ...createListForm, offer: e.target.value })}
                    rows={3}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                        : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                    }`}
                    placeholder="Describe your offer..."
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
                    value={createListForm.calendar_url}
                    onChange={(e) => setCreateListForm({ ...createListForm, calendar_url: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                        : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                    }`}
                    placeholder="https://calendly.com/..."
                    required
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowCreateList(false)}
                    className={`flex-1 px-4 py-2 text-sm rounded-lg transition-colors ${
                      theme === 'gold'
                        ? 'text-gray-400 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                        : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createNewList}
                    disabled={creating || !createListForm.name || !createListForm.offer || !createListForm.calendar_url}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      theme === 'gold'
                        ? 'gold-gradient text-black hover-gold'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    } disabled:opacity-50`}
                  >
                    {creating ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                        Creating...
                      </div>
                    ) : (
                      <>
                        <FolderPlus className="h-4 w-4 mr-2" />
                        Create List
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Move Leads Modal */}
      <ConfirmDialog
        isOpen={showMoveLeads}
        title="Move Leads to Another List"
        message={
          <div className="space-y-4">
            <p>Select the target campaign to move {selectedLeads.length} selected leads:</p>
            <select
              value={targetCampaign}
              onChange={(e) => setTargetCampaign(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                theme === 'gold'
                  ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                  : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
              }`}
            >
              <option value="">Select target campaign...</option>
              {campaigns.filter(c => c.id !== selectedCampaign).map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.offer || 'Untitled Campaign'}
                </option>
              ))}
            </select>
          </div>
        }
        confirmText="Move Leads"
        cancelText="Cancel"
        type="info"
        onConfirm={moveLeadsToList}
        onCancel={() => {
          setShowMoveLeads(false);
          setTargetCampaign('');
        }}
        loading={moving}
      />

      {/* Duplicate Leads Modal */}
      <ConfirmDialog
        isOpen={showDuplicateLeads}
        title="Duplicate Leads to Another List"
        message={
          <div className="space-y-4">
            <p>Select the target campaign to duplicate {selectedLeads.length} selected leads:</p>
            <select
              value={targetCampaign}
              onChange={(e) => setTargetCampaign(e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                theme === 'gold'
                  ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                  : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
              }`}
            >
              <option value="">Select target campaign...</option>
              {campaigns.filter(c => c.id !== selectedCampaign).map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.offer || 'Untitled Campaign'}
                </option>
              ))}
            </select>
          </div>
        }
        confirmText="Duplicate Leads"
        cancelText="Cancel"
        type="info"
        onConfirm={duplicateLeadsToList}
        onCancel={() => {
          setShowDuplicateLeads(false);
          setTargetCampaign('');
        }}
        loading={duplicating}
      />
    </div>
  );
}