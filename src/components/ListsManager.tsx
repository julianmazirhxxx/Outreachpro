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
  ChevronLeft,
  ChevronRight,
  Copy,
  ArrowRight,
  X,
  Save,
  Tag,
  List,
  Database
} from 'lucide-react';

interface List {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  lead_count?: number;
}

interface ListLead {
  id: string;
  list_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  job_title: string | null;
  source_url: string | null;
  source_platform: string | null;
  custom_fields: any;
  created_at: string;
}

interface Campaign {
  id: string;
  offer: string | null;
  status: string | null;
}

export function ListsManager() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [lists, setLists] = useState<List[]>([]);
  const [selectedList, setSelectedList] = useState<List | null>(null);
  const [leads, setLeads] = useState<ListLead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'company_name'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const [showCreateListModal, setShowCreateListModal] = useState(false);
  const [showMoveLeadsModal, setShowMoveLeadsModal] = useState(false);
  const [showDuplicateLeadsModal, setShowDuplicateLeadsModal] = useState(false);
  const [newListData, setNewListData] = useState({
    name: '',
    description: '',
    tags: ''
  });
  const [targetCampaignId, setTargetCampaignId] = useState('');
  const [targetListId, setTargetListId] = useState('');
  const [saving, setSaving] = useState(false);

  const LEADS_PER_PAGE = 100;

  useEffect(() => {
    if (user) {
      fetchLists();
      fetchCampaigns();
    }
  }, [user]);

  useEffect(() => {
    if (selectedList) {
      fetchLeads();
      fetchTotalLeads();
    }
  }, [selectedList, currentPage, sortBy, sortOrder, searchTerm]);

  const fetchLists = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Fetch lists with lead counts
      const { data: listsData, error: listsError } = await supabase
        .from('lists')
        .select(`
          *,
          list_leads(count)
        `)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (listsError) throw listsError;

      const listsWithCounts = listsData?.map(list => ({
        ...list,
        lead_count: list.list_leads?.[0]?.count || 0
      })) || [];

      setLists(listsWithCounts);
    } catch (error) {
      console.error('Error fetching lists:', error);
      setError('Failed to load lists');
    } finally {
      setLoading(false);
    }
  };

  const fetchCampaigns = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, offer, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    }
  };

  const fetchTotalLeads = async () => {
    if (!selectedList) return;

    try {
      let query = supabase
        .from('list_leads')
        .select('id', { count: 'exact' })
        .eq('list_id', selectedList.id);

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,company_name.ilike.%${searchTerm}%,job_title.ilike.%${searchTerm}%`);
      }

      const { count, error } = await query;
      if (error) throw error;
      
      setTotalLeads(count || 0);
    } catch (error) {
      console.error('Error fetching total leads:', error);
    }
  };

  const fetchLeads = async () => {
    if (!selectedList) return;

    try {
      setLeadsLoading(true);
      
      const startIndex = (currentPage - 1) * LEADS_PER_PAGE;
      
      let query = supabase
        .from('list_leads')
        .select('*')
        .eq('list_id', selectedList.id)
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(startIndex, startIndex + LEADS_PER_PAGE - 1);

      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,company_name.ilike.%${searchTerm}%,job_title.ilike.%${searchTerm}%`);
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
    if (!user || !newListData.name.trim()) {
      setError('List name is required');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('lists')
        .insert({
          user_id: user.id,
          name: newListData.name.trim(),
          description: newListData.description.trim() || null,
          tags: newListData.tags ? newListData.tags.split(',').map(t => t.trim()).filter(t => t) : []
        })
        .select()
        .single();

      if (error) throw error;

      setNewListData({ name: '', description: '', tags: '' });
      setShowCreateListModal(false);
      fetchLists();
    } catch (error) {
      console.error('Error creating list:', error);
      setError('Failed to create list');
    } finally {
      setSaving(false);
    }
  };

  const deleteList = async (listId: string) => {
    try {
      const { error } = await supabase
        .from('lists')
        .delete()
        .eq('id', listId)
        .eq('user_id', user?.id);

      if (error) throw error;

      if (selectedList?.id === listId) {
        setSelectedList(null);
        setLeads([]);
      }
      fetchLists();
    } catch (error) {
      console.error('Error deleting list:', error);
      setError('Failed to delete list');
    }
  };

  const moveLeadsToCampaign = async () => {
    if (!targetCampaignId || selectedLeads.length === 0) return;

    setSaving(true);
    try {
      // Get selected leads data
      const selectedLeadsData = leads.filter(lead => selectedLeads.includes(lead.id));
      
      // Get campaign requirements
      const { data: campaignSequences } = await supabase
        .from('campaign_sequences')
        .select('type')
        .eq('campaign_id', targetCampaignId);

      const channelTypes = campaignSequences?.map(s => s.type) || [];
      const requiresEmail = channelTypes.includes('email');
      const requiresPhone = channelTypes.includes('call') || channelTypes.includes('voice') || 
                           channelTypes.includes('sms') || channelTypes.includes('whatsapp');

      // Filter leads that meet campaign requirements
      const validLeads = selectedLeadsData.filter(lead => {
        if (requiresEmail && (!lead.email || lead.email.trim() === '')) return false;
        if (requiresPhone && (!lead.phone || lead.phone.trim() === '')) return false;
        return true;
      });

      if (validLeads.length === 0) {
        setError('No leads meet the requirements for this campaign');
        setSaving(false);
        return;
      }

      // Convert to campaign leads format
      const campaignLeads = validLeads.map(lead => ({
        user_id: user?.id,
        campaign_id: targetCampaignId,
        name: lead.name,
        email: lead.email || '',
        phone: lead.phone || '',
        company_name: lead.company_name,
        job_title: lead.job_title,
        source_url: lead.source_url,
        source_platform: lead.source_platform,
        status: 'pending'
      }));

      // Insert into uploaded_leads (campaign leads) - this will auto-sync to campaign list
      const { error } = await supabase
        .from('uploaded_leads')
        .insert(campaignLeads);

      if (error) throw error;

      setShowMoveLeadsModal(false);
      setSelectedLeads([]);
      setTargetCampaignId('');
      
      if (validLeads.length < selectedLeadsData.length) {
        setError(`Moved ${validLeads.length} leads. ${selectedLeadsData.length - validLeads.length} leads didn't meet campaign requirements.`);
      }
    } catch (error) {
      console.error('Error moving leads to campaign:', error);
      setError('Failed to move leads to campaign');
    } finally {
      setSaving(false);
    }
  };

  const duplicateLeadsToList = async () => {
    if (!targetListId || selectedLeads.length === 0) return;

    setSaving(true);
    try {
      // Get selected leads data
      const selectedLeadsData = leads.filter(lead => selectedLeads.includes(lead.id));
      
      // Convert to list leads format
      const listLeads = selectedLeadsData.map(lead => ({
        list_id: targetListId,
        user_id: user?.id,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        company_name: lead.company_name,
        job_title: lead.job_title,
        source_url: lead.source_url,
        source_platform: lead.source_platform,
        custom_fields: lead.custom_fields || {}
      }));

      // Insert into list_leads (with duplicate prevention)
      const { error } = await supabase
        .from('list_leads')
        .insert(listLeads);

      if (error) throw error;

      setShowDuplicateLeadsModal(false);
      setSelectedLeads([]);
      setTargetListId('');
      fetchLists(); // Refresh to update counts
    } catch (error) {
      console.error('Error duplicating leads to list:', error);
      setError('Failed to duplicate leads to list');
    } finally {
      setSaving(false);
    }
  };

  const deleteSelectedLeads = async () => {
    if (selectedLeads.length === 0) return;

    try {
      const { error } = await supabase
        .from('list_leads')
        .delete()
        .in('id', selectedLeads)
        .eq('user_id', user?.id);

      if (error) throw error;

      setSelectedLeads([]);
      fetchLeads();
      fetchLists(); // Refresh to update counts
    } catch (error) {
      console.error('Error deleting leads:', error);
      setError('Failed to delete leads');
    }
  };

  const exportLeads = () => {
    const leadsToExport = selectedLeads.length > 0 
      ? leads.filter(lead => selectedLeads.includes(lead.id))
      : filteredLeads;

    const csvContent = [
      ['Name', 'Email', 'Phone', 'Company', 'Job Title', 'Source URL', 'Source Platform', 'Created'],
      ...leadsToExport.map(lead => [
        lead.name || '',
        lead.email || '',
        lead.phone || '',
        lead.company_name || '',
        lead.job_title || '',
        lead.source_url || '',
        lead.source_platform || '',
        new Date(lead.created_at).toLocaleDateString()
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedList?.name || 'leads'}_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch = !searchTerm || 
      (lead.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.phone?.includes(searchTerm)) ||
      (lead.company_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.job_title?.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesSearch;
  });

  const totalPages = Math.ceil(totalLeads / LEADS_PER_PAGE);

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
              <Database className="h-8 w-8 text-blue-600" />
            )}
            <h1 className={`text-3xl font-bold ${
              theme === 'gold' ? 'gold-text-gradient' : 'text-gray-900'
            }`}>
              Lists
            </h1>
          </div>
          <p className={theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}>
            Manage your lead lists and organize prospects for campaigns
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
            onClick={() => setShowCreateListModal(true)}
            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              theme === 'gold'
                ? 'gold-gradient text-black hover-gold'
                : 'bg-blue-600 text-white hover:bg-blue-700'
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

      {/* Lists Dropdown Selector */}
      <div className={`p-6 rounded-xl border ${
        theme === 'gold' 
          ? 'black-card gold-border' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-semibold ${
            theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
          }`}>
            Select List to View
          </h3>
          <span className={`text-sm ${
            theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {lists.length} lists total
          </span>
        </div>

        <div className="relative">
          <select
            value={selectedList?.id || ''}
            onChange={(e) => {
              const list = lists.find(l => l.id === e.target.value);
              setSelectedList(list || null);
              setCurrentPage(1);
              setSelectedLeads([]);
            }}
            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 appearance-none ${
              theme === 'gold'
                ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
            }`}
          >
            <option value="">Select a list to view leads...</option>
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name} ({list.lead_count || 0} leads)
                {list.tags && list.tags.length > 0 && ` • ${list.tags.join(', ')}`}
              </option>
            ))}
          </select>
          <ChevronDown className={`absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 pointer-events-none ${
            theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
          }`} />
        </div>

        {/* Lists Grid Preview */}
        {lists.length > 0 && (
          <div className="mt-6">
            <h4 className={`text-sm font-medium mb-3 ${
              theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              All Lists Overview
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lists.slice(0, 6).map((list) => (
                <div
                  key={list.id}
                  onClick={() => {
                    setSelectedList(list);
                    setCurrentPage(1);
                    setSelectedLeads([]);
                  }}
                  className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                    selectedList?.id === list.id
                      ? theme === 'gold'
                        ? 'border-yellow-400 bg-yellow-400/10'
                        : 'border-blue-500 bg-blue-50'
                      : theme === 'gold'
                        ? 'border-yellow-400/20 bg-black/10 hover:bg-yellow-400/5'
                        : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <List className={`h-4 w-4 ${
                        theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                      }`} />
                      <span className={`text-sm font-medium ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        {list.name}
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      theme === 'gold'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {list.lead_count || 0}
                    </span>
                  </div>
                  
                  {list.description && (
                    <p className={`text-xs mb-2 line-clamp-2 ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {list.description}
                    </p>
                  )}
                  
                  {list.tags && list.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {list.tags.slice(0, 2).map((tag, index) => (
                        <span
                          key={index}
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${
                            theme === 'gold'
                              ? 'bg-yellow-400/20 text-yellow-400'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                      {list.tags.length > 2 && (
                        <span className={`text-xs ${
                          theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                        }`}>
                          +{list.tags.length - 2}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            {lists.length > 6 && (
              <p className={`text-xs mt-3 text-center ${
                theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
              }`}>
                Showing 6 of {lists.length} lists. Use dropdown above to view all.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Selected List Leads */}
      {selectedList && (
        <div className={`rounded-xl border ${
          theme === 'gold' 
            ? 'black-card gold-border' 
            : 'bg-white border-gray-200'
        }`}>
          <div className={`p-4 border-b ${
            theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  theme === 'gold' ? 'gold-gradient' : 'bg-blue-100'
                }`}>
                  <List className={`h-5 w-5 ${
                    theme === 'gold' ? 'text-black' : 'text-blue-600'
                  }`} />
                </div>
                <div>
                  <h3 className={`text-lg font-semibold ${
                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    {selectedList.name}
                  </h3>
                  <p className={`text-sm ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {totalLeads} total leads • Page {currentPage} of {totalPages}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                {selectedLeads.length > 0 && (
                  <>
                    <button
                      onClick={() => setShowMoveLeadsModal(true)}
                      className={`inline-flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                        theme === 'gold'
                          ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <ArrowRight className="h-4 w-4 mr-1" />
                      Move to Campaign ({selectedLeads.length})
                    </button>
                    
                    <button
                      onClick={() => setShowDuplicateLeadsModal(true)}
                      className={`inline-flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                        theme === 'gold'
                          ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Duplicate to List
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
                      Delete ({selectedLeads.length})
                    </button>
                  </>
                )}
                
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
              </div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className={`p-4 border-b ${
            theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
          }`}>
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

              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field as any);
                  setSortOrder(order as any);
                  setCurrentPage(1);
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
                  {searchTerm
                    ? 'No leads match your search criteria'
                    : 'Upload leads or add prospects to this list'}
                </p>
                <div className="flex justify-center space-x-3">
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
                  <Link
                    to="/targeting"
                    className={`inline-flex items-center px-4 py-2 text-sm rounded-lg border transition-colors ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Find New Prospects
                  </Link>
                </div>
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
                        Source
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
                    {filteredLeads.map((lead) => (
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
                                {lead.name}
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
                          {lead.source_platform ? (
                            <div className={`text-sm ${
                              theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                              {lead.source_platform}
                            </div>
                          ) : (
                            <span className={`text-sm ${
                              theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                            }`}>
                              Manual upload
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className={`text-sm ${
                            theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            {new Date(lead.created_at).toLocaleDateString()}
                          </div>
                        </td>
                      </tr>
                    ))}
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
                        Showing {((currentPage - 1) * LEADS_PER_PAGE) + 1} to {Math.min(currentPage * LEADS_PER_PAGE, totalLeads)} of {totalLeads} leads
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                            theme === 'gold'
                              ? 'text-gray-400 hover:bg-gray-800'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        
                        <span className={`text-sm ${
                          theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Page {currentPage} of {totalPages}
                        </span>
                        
                        <button
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          className={`p-2 rounded-lg transition-colors disabled:opacity-50 ${
                            theme === 'gold'
                              ? 'text-gray-400 hover:bg-gray-800'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <ChevronRight className="h-4 w-4" />
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
      {showCreateListModal && (
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
                    onClick={() => setShowCreateListModal(false)}
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
                    value={newListData.name}
                    onChange={(e) => setNewListData({ ...newListData, name: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                        : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                    }`}
                    placeholder="e.g., SaaS Founders, Marketing Directors"
                    required
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Description
                  </label>
                  <textarea
                    value={newListData.description}
                    onChange={(e) => setNewListData({ ...newListData, description: e.target.value })}
                    rows={3}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                        : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                    }`}
                    placeholder="Describe this list..."
                  />
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    Tags
                  </label>
                  <input
                    type="text"
                    value={newListData.tags}
                    onChange={(e) => setNewListData({ ...newListData, tags: e.target.value })}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                        : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                    }`}
                    placeholder="e.g., high-value, warm, qualified (comma separated)"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowCreateListModal(false)}
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
                    disabled={saving || !newListData.name.trim()}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      theme === 'gold'
                        ? 'gold-gradient text-black hover-gold'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    } disabled:opacity-50`}
                  >
                    {saving ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                        Creating...
                      </div>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
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

      {/* Move to Campaign Modal */}
      {showMoveLeadsModal && (
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
                    Move {selectedLeads.length} Leads to Campaign
                  </h3>
                  <button
                    onClick={() => setShowMoveLeadsModal(false)}
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
                    Select Target Campaign
                  </label>
                  <select
                    value={targetCampaignId}
                    onChange={(e) => setTargetCampaignId(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                        : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                    }`}
                  >
                    <option value="">Select campaign...</option>
                    {campaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.offer || 'Untitled Campaign'}
                      </option>
                    ))}
                  </select>
                  <p className={`text-xs mt-1 ${
                    theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                  }`}>
                    Leads will be validated against campaign requirements
                  </p>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowMoveLeadsModal(false)}
                    className={`flex-1 px-4 py-2 text-sm rounded-lg transition-colors ${
                      theme === 'gold'
                        ? 'text-gray-400 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                        : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={moveLeadsToCampaign}
                    disabled={saving || !targetCampaignId}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      theme === 'gold'
                        ? 'gold-gradient text-black hover-gold'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    } disabled:opacity-50`}
                  >
                    {saving ? 'Moving...' : 'Move Leads'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate to List Modal */}
      {showDuplicateLeadsModal && (
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
                    Duplicate {selectedLeads.length} Leads to List
                  </h3>
                  <button
                    onClick={() => setShowDuplicateLeadsModal(false)}
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
                    Select Target List
                  </label>
                  <select
                    value={targetListId}
                    onChange={(e) => setTargetListId(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                        : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                    }`}
                  >
                    <option value="">Select list...</option>
                    {lists.filter(list => list.id !== selectedList?.id).map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name} ({list.lead_count || 0} leads)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowDuplicateLeadsModal(false)}
                    className={`flex-1 px-4 py-2 text-sm rounded-lg transition-colors ${
                      theme === 'gold'
                        ? 'text-gray-400 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                        : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={duplicateLeadsToList}
                    disabled={saving || !targetListId}
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      theme === 'gold'
                        ? 'gold-gradient text-black hover-gold'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    } disabled:opacity-50`}
                  >
                    {saving ? 'Duplicating...' : 'Duplicate Leads'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}