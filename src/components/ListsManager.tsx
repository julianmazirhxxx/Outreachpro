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
  ChevronDown,
  ChevronUp,
  Copy,
  ArrowRight,
  X,
  Save
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
  lead_count: number;
  contacted_count: number;
  replied_count: number;
  booked_count: number;
  channel_types: string[];
}

interface CampaignRequirements {
  needsEmail: boolean;
  needsPhone: boolean;
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
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateList, setShowCreateList] = useState(false);
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [targetCampaignId, setTargetCampaignId] = useState('');
  const [newListData, setNewListData] = useState({
    name: '',
    offer: '',
    calendar_url: '',
    goal: ''
  });
  const [campaignRequirements, setCampaignRequirements] = useState<Record<string, CampaignRequirements>>({});

  const LEADS_PER_PAGE = 100;

  useEffect(() => {
    if (user) {
      fetchCampaigns();
    }
  }, [user]);

  useEffect(() => {
    if (selectedCampaign) {
      fetchLeads();
    }
  }, [selectedCampaign, sortBy, sortOrder, currentPage]);

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

      // Fetch lead counts for each campaign
      const campaignsWithCounts = await Promise.all(
        (campaignsData || []).map(async (campaign) => {
          const [leadsCount, contactedCount, repliedCount, bookedCount, sequencesData] = await Promise.all([
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
              .from('bookings')
              .select('id', { count: 'exact' })
              .eq('campaign_id', campaign.id),
            supabase
              .from('campaign_sequences')
              .select('type')
              .eq('campaign_id', campaign.id)
          ]);

          const channelTypes = sequencesData.data?.map(s => s.type) || [];
          
          // Determine requirements for this campaign
          const requirements: CampaignRequirements = {
            needsEmail: channelTypes.includes('email'),
            needsPhone: channelTypes.includes('call') || channelTypes.includes('voice') || 
                       channelTypes.includes('sms') || channelTypes.includes('whatsapp')
          };

          setCampaignRequirements(prev => ({
            ...prev,
            [campaign.id]: requirements
          }));

          return {
            ...campaign,
            lead_count: leadsCount.count || 0,
            contacted_count: contactedCount.count || 0,
            replied_count: repliedCount.count || 0,
            booked_count: bookedCount.count || 0,
            channel_types: channelTypes
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

  const fetchLeads = async () => {
    if (!selectedCampaign || !user) return;

    try {
      setLeadsLoading(true);
      
      const offset = (currentPage - 1) * LEADS_PER_PAGE;
      
      let query = supabase
        .from('uploaded_leads')
        .select('*')
        .eq('campaign_id', selectedCampaign)
        .eq('user_id', user.id)
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + LEADS_PER_PAGE - 1);

      if (selectedStatus) {
        query = query.eq('status', selectedStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
      setError('Failed to load leads');
    } finally {
      setLeadsLoading(false);
    }
  };

  const createNewList = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('campaigns')
        .insert([{
          user_id: user.id,
          name: newListData.name || newListData.offer,
          offer: newListData.offer,
          calendar_url: newListData.calendar_url,
          goal: newListData.goal,
          status: 'draft',
        }])
        .select()
        .single();

      if (error) throw error;

      setNewListData({ name: '', offer: '', calendar_url: '', goal: '' });
      setShowCreateList(false);
      fetchCampaigns();
      
      // Navigate to edit the new campaign
      navigate(`/campaigns/${data.id}/edit`);
    } catch (error) {
      console.error('Error creating list:', error);
      setError('Failed to create new list');
    }
  };

  const moveLeads = async () => {
    if (!targetCampaignId || selectedLeads.length === 0) return;

    try {
      // Get target campaign requirements
      const targetRequirements = campaignRequirements[targetCampaignId];
      if (!targetRequirements) {
        setError('Target campaign requirements not found');
        return;
      }

      // Validate leads meet target campaign requirements
      const leadsToMove = leads.filter(lead => selectedLeads.includes(lead.id));
      const invalidLeads = leadsToMove.filter(lead => {
        if (targetRequirements.needsEmail && (!lead.email || lead.email.trim() === '')) {
          return true;
        }
        if (targetRequirements.needsPhone && (!lead.phone || lead.phone.trim() === '')) {
          return true;
        }
        return false;
      });

      if (invalidLeads.length > 0) {
        setError(`${invalidLeads.length} leads don't meet target campaign requirements`);
        return;
      }

      // Check for duplicates in target campaign
      const { data: existingLeads, error: duplicateError } = await supabase
        .from('uploaded_leads')
        .select('email, phone')
        .eq('campaign_id', targetCampaignId);

      if (duplicateError) throw duplicateError;

      const existingEmails = new Set(existingLeads?.map(l => l.email).filter(Boolean));
      const existingPhones = new Set(existingLeads?.map(l => l.phone).filter(Boolean));

      const duplicates = leadsToMove.filter(lead => 
        (lead.email && existingEmails.has(lead.email)) ||
        (lead.phone && existingPhones.has(lead.phone))
      );

      if (duplicates.length > 0) {
        setError(`${duplicates.length} leads already exist in target campaign`);
        return;
      }

      // Move leads
      const { error } = await supabase
        .from('uploaded_leads')
        .update({ campaign_id: targetCampaignId })
        .in('id', selectedLeads);

      if (error) throw error;

      setSelectedLeads([]);
      setShowMoveDialog(false);
      setTargetCampaignId('');
      fetchLeads();
      fetchCampaigns();
    } catch (error) {
      console.error('Error moving leads:', error);
      setError('Failed to move leads');
    }
  };

  const duplicateLeads = async () => {
    if (!targetCampaignId || selectedLeads.length === 0) return;

    try {
      // Get target campaign requirements
      const targetRequirements = campaignRequirements[targetCampaignId];
      if (!targetRequirements) {
        setError('Target campaign requirements not found');
        return;
      }

      // Validate and prepare leads for duplication
      const leadsToDuplicate = leads.filter(lead => selectedLeads.includes(lead.id));
      const validLeads = leadsToDuplicate.filter(lead => {
        if (targetRequirements.needsEmail && (!lead.email || lead.email.trim() === '')) {
          return false;
        }
        if (targetRequirements.needsPhone && (!lead.phone || lead.phone.trim() === '')) {
          return false;
        }
        return true;
      });

      if (validLeads.length === 0) {
        setError('No leads meet target campaign requirements');
        return;
      }

      // Check for duplicates
      const { data: existingLeads, error: duplicateError } = await supabase
        .from('uploaded_leads')
        .select('email, phone')
        .eq('campaign_id', targetCampaignId);

      if (duplicateError) throw duplicateError;

      const existingEmails = new Set(existingLeads?.map(l => l.email).filter(Boolean));
      const existingPhones = new Set(existingLeads?.map(l => l.phone).filter(Boolean));

      const leadsToInsert = validLeads.filter(lead => 
        !(lead.email && existingEmails.has(lead.email)) &&
        !(lead.phone && existingPhones.has(lead.phone))
      ).map(lead => ({
        name: lead.name,
        email: lead.email,
        phone: lead.phone || '',
        company_name: lead.company_name,
        job_title: lead.job_title,
        campaign_id: targetCampaignId,
        user_id: user?.id,
        status: 'pending'
      }));

      if (leadsToInsert.length === 0) {
        setError('All selected leads already exist in target campaign');
        return;
      }

      const { error } = await supabase
        .from('uploaded_leads')
        .insert(leadsToInsert);

      if (error) throw error;

      setSelectedLeads([]);
      setShowDuplicateDialog(false);
      setTargetCampaignId('');
      fetchCampaigns();
    } catch (error) {
      console.error('Error duplicating leads:', error);
      setError('Failed to duplicate leads');
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

  const getCampaignName = (campaignId: string) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    return campaign?.offer || 'Unknown Campaign';
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
    a.download = `leads_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
      fetchLeads();
      fetchCampaigns();
    } catch (error) {
      console.error('Error deleting leads:', error);
      setError('Failed to delete leads');
    }
  };

  const totalPages = Math.ceil(filteredLeads.length / LEADS_PER_PAGE);
  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * LEADS_PER_PAGE,
    currentPage * LEADS_PER_PAGE
  );

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
              <Users className="h-8 w-8 text-blue-600" />
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
          
          <Link
            to="/campaigns"
            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              theme === 'gold'
                ? 'gold-gradient text-black hover-gold'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Leads
          </Link>
          
          <button
            onClick={() => setShowCreateList(true)}
            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              theme === 'gold'
                ? 'gold-gradient text-black hover-gold'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            <Plus className="h-4 w-4 mr-2" />
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

      {/* Campaign Lists Dropdown */}
      <div className={`p-6 rounded-xl border ${
        theme === 'gold' 
          ? 'black-card gold-border' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-semibold ${
            theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
          }`}>
            Campaign Lists ({campaigns.length})
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                    ? 'border-yellow-400/20 bg-black/10 hover:bg-yellow-400/5'
                    : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    theme === 'gold' ? 'gold-gradient' : 'bg-blue-100'
                  }`}>
                    <Target className={`h-5 w-5 ${
                      theme === 'gold' ? 'text-black' : 'text-blue-600'
                    }`} />
                  </div>
                  <div>
                    <h4 className={`font-semibold ${
                      theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                    }`}>
                      {campaign.offer || 'Untitled Campaign'}
                    </h4>
                    <p className={`text-xs ${
                      theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
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

              {/* Campaign Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className={`text-center p-2 rounded ${
                  theme === 'gold' ? 'bg-black/20' : 'bg-white'
                }`}>
                  <div className={`text-lg font-bold ${
                    theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                  }`}>
                    {campaign.lead_count}
                  </div>
                  <div className={`text-xs ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Total Leads
                  </div>
                </div>
                
                <div className={`text-center p-2 rounded ${
                  theme === 'gold' ? 'bg-black/20' : 'bg-white'
                }`}>
                  <div className={`text-lg font-bold ${
                    theme === 'gold' ? 'text-green-400' : 'text-green-600'
                  }`}>
                    {campaign.contacted_count}
                  </div>
                  <div className={`text-xs ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Contacted
                  </div>
                </div>
              </div>

              {/* Channel Types */}
              <div className="flex items-center space-x-2 mt-3">
                {campaign.channel_types.map((type) => {
                  const Icon = type === 'call' || type === 'voice' ? Phone :
                              type === 'email' ? Mail : MessageSquare;
                  return (
                    <div
                      key={type}
                      className={`p-1 rounded ${
                        theme === 'gold' ? 'bg-yellow-400/20' : 'bg-blue-100'
                      }`}
                      title={type}
                    >
                      <Icon className={`h-3 w-3 ${
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

      {/* Selected Campaign Leads */}
      {selectedCampaign && (
        <div className={`rounded-xl border ${
          theme === 'gold' 
            ? 'black-card gold-border' 
            : 'bg-white border-gray-200'
        }`}>
          <div className={`p-4 border-b ${
            theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
          }`}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <h3 className={`text-lg font-semibold ${
                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
              }`}>
                {getCampaignName(selectedCampaign)} - Leads ({filteredLeads.length})
              </h3>
              
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                    theme === 'gold' ? 'text-yellow-400' : 'text-gray-400'
                  }`} />
                  <input
                    type="text"
                    placeholder="Search leads..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                        : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                    } focus:border-transparent`}
                  />
                </div>

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
                      onClick={() => setShowMoveDialog(true)}
                      className={`inline-flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                        theme === 'gold'
                          ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <ArrowRight className="h-4 w-4 mr-1" />
                      Move
                    </button>
                    <button
                      onClick={() => setShowDuplicateDialog(true)}
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
              <div className="flex items-center justify-center py-12">
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
                  No leads found
                </h3>
                <p className={`mb-6 ${
                  theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {searchTerm || selectedStatus
                    ? 'No leads match your search criteria'
                    : 'This campaign has no leads yet'}
                </p>
                <Link
                  to="/campaigns"
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
              <>
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
                          checked={selectedLeads.length === paginatedLeads.length && paginatedLeads.length > 0}
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
                    {paginatedLeads.map((lead) => {
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

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className={`p-4 border-t ${
                    theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className={`text-sm ${
                        theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Showing {((currentPage - 1) * LEADS_PER_PAGE) + 1} to {Math.min(currentPage * LEADS_PER_PAGE, filteredLeads.length)} of {filteredLeads.length} leads
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                            currentPage === 1
                              ? 'opacity-50 cursor-not-allowed'
                              : theme === 'gold'
                                ? 'text-yellow-400 hover:bg-yellow-400/10'
                                : 'text-blue-600 hover:bg-blue-100'
                          }`}
                        >
                          Previous
                        </button>
                        
                        <span className={`px-3 py-2 text-sm ${
                          theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Page {currentPage} of {totalPages}
                        </span>
                        
                        <button
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                            currentPage === totalPages
                              ? 'opacity-50 cursor-not-allowed'
                              : theme === 'gold'
                                ? 'text-yellow-400 hover:bg-yellow-400/10'
                                : 'text-blue-600 hover:bg-blue-100'
                          }`}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

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
                    List Name
                  </label>
                  <input
                    type="text"
                    value={newListData.name}
                    onChange={(e) => setNewListData({ ...newListData, name: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                        : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                    }`}
                    placeholder="e.g., Q4 SaaS Founders"
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Offer Description *
                  </label>
                  <textarea
                    value={newListData.offer}
                    onChange={(e) => setNewListData({ ...newListData, offer: e.target.value })}
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
                    value={newListData.calendar_url}
                    onChange={(e) => setNewListData({ ...newListData, calendar_url: e.target.value })}
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
                    disabled={!newListData.offer || !newListData.calendar_url}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      theme === 'gold'
                        ? 'gold-gradient text-black hover-gold'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    } disabled:opacity-50`}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Create List
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Move Leads Dialog */}
      <ConfirmDialog
        isOpen={showMoveDialog}
        title="Move Leads"
        message={
          <div className="space-y-4">
            <p>Select the target campaign to move {selectedLeads.length} selected leads:</p>
            <select
              value={targetCampaignId}
              onChange={(e) => setTargetCampaignId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        onConfirm={moveLeads}
        onCancel={() => {
          setShowMoveDialog(false);
          setTargetCampaignId('');
        }}
      />

      {/* Duplicate Leads Dialog */}
      <ConfirmDialog
        isOpen={showDuplicateDialog}
        title="Duplicate Leads"
        message={
          <div className="space-y-4">
            <p>Select the target campaign to duplicate {selectedLeads.length} selected leads:</p>
            <select
              value={targetCampaignId}
              onChange={(e) => setTargetCampaignId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        onConfirm={duplicateLeads}
        onCancel={() => {
          setShowDuplicateDialog(false);
          setTargetCampaignId('');
        }}
      />
    </div>
  );
}