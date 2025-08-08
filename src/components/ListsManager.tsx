import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { LoadingSpinner } from './common/LoadingSpinner';
import { ErrorMessage } from './common/ErrorMessage';
import Papa from 'papaparse';
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
  ArrowRight,
  ArrowLeft,
  X,
  Save,
  Tag,
  FileText,
  Database,
  Copy,
  Move
} from 'lucide-react';

interface List {
  id: string;
  name: string;
  description: string | null;
  tags: string[] | null;
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
  name: string | null;
  offer: string | null;
  status: string | null;
}

interface LeadData {
  name?: string;
  phone?: string;
  email?: string;
  company_name?: string;
  job_title?: string;
  source_url?: string;
  source_platform?: string;
}

interface ColumnMapping {
  [key: string]: string;
}

export function ListsManager() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [lists, setLists] = useState<List[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedList, setSelectedList] = useState<string>('');
  const [listLeads, setListLeads] = useState<ListLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'company_name'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const leadsPerPage = 100;

  // Modals
  const [showCreateList, setShowCreateList] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showAddToCampaignModal, setShowAddToCampaignModal] = useState(false);

  // Upload states
  const [uploadStep, setUploadStep] = useState<'upload' | 'map' | 'preview'>('upload');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [processedLeads, setProcessedLeads] = useState<LeadData[]>([]);
  const [uploading, setUploading] = useState(false);

  // Form states
  const [newListForm, setNewListForm] = useState({
    name: '',
    description: '',
    tags: ''
  });

  useEffect(() => {
    if (user) {
      fetchLists();
      fetchCampaigns();
    }
  }, [user]);

  useEffect(() => {
    if (selectedList) {
      fetchListLeads();
    }
  }, [selectedList, currentPage, sortBy, sortOrder]);

  const fetchLists = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Get lists with lead counts
      const { data: listsData, error: listsError } = await supabase
        .from('lists')
        .select(`
          *,
          list_leads(count)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (listsError) throw listsError;

      const listsWithCounts = listsData?.map(list => ({
        ...list,
        lead_count: list.list_leads?.[0]?.count || 0
      })) || [];

      setLists(listsWithCounts);
      
      // Auto-select first list if none selected
      if (!selectedList && listsWithCounts.length > 0) {
        setSelectedList(listsWithCounts[0].id);
      }
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
        .select('id, name, offer, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    }
  };

  const fetchListLeads = async () => {
    if (!selectedList || !user) return;

    try {
      setLeadsLoading(true);
      
      // Get total count for pagination
      const { count, error: countError } = await supabase
        .from('list_leads')
        .select('*', { count: 'exact', head: true })
        .eq('list_id', selectedList)
        .eq('user_id', user.id);

      if (countError) throw countError;
      setTotalLeads(count || 0);

      // Get paginated leads
      const from = (currentPage - 1) * leadsPerPage;
      const to = from + leadsPerPage - 1;

      let query = supabase
        .from('list_leads')
        .select('*')
        .eq('list_id', selectedList)
        .eq('user_id', user.id)
        .range(from, to)
        .order(sortBy, { ascending: sortOrder === 'asc' });

      // Apply search filter
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,company_name.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setListLeads(data || []);
    } catch (error) {
      console.error('Error fetching list leads:', error);
      setError('Failed to load leads');
    } finally {
      setLeadsLoading(false);
    }
  };

  const createNewList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('lists')
        .insert([{
          user_id: user.id,
          name: newListForm.name.trim(),
          description: newListForm.description.trim() || null,
          tags: newListForm.tags ? newListForm.tags.split(',').map(t => t.trim()).filter(t => t) : null
        }])
        .select()
        .single();

      if (error) throw error;

      setNewListForm({ name: '', description: '', tags: '' });
      setShowCreateList(false);
      fetchLists();
      setSelectedList(data.id);
    } catch (error) {
      console.error('Error creating list:', error);
      setError('Failed to create list');
    }
  };

  const handleFileUpload = (file: File) => {
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setCsvFile(file);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setError('CSV parsing error: ' + results.errors[0].message);
          return;
        }

        setCsvData(results.data);
        setCsvHeaders(results.meta.fields || []);
        
        // Auto-detect column mappings
        const autoMapping: ColumnMapping = {};
        const headers = results.meta.fields || [];
        
        headers.forEach(header => {
          const lowerHeader = header.toLowerCase().trim();
          if (lowerHeader.includes('name') || lowerHeader.includes('first') || lowerHeader.includes('full')) {
            autoMapping[header] = 'name';
          } else if (lowerHeader.includes('phone') || lowerHeader.includes('mobile') || lowerHeader.includes('cell')) {
            autoMapping[header] = 'phone';
          } else if (lowerHeader.includes('email') || lowerHeader.includes('mail')) {
            autoMapping[header] = 'email';
          } else if (lowerHeader.includes('company') || lowerHeader.includes('organization')) {
            autoMapping[header] = 'company_name';
          } else if (lowerHeader.includes('title') || lowerHeader.includes('position') || lowerHeader.includes('job')) {
            autoMapping[header] = 'job_title';
          } else if (lowerHeader.includes('url') || lowerHeader.includes('website')) {
            autoMapping[header] = 'source_url';
          } else if (lowerHeader.includes('source') || lowerHeader.includes('platform')) {
            autoMapping[header] = 'source_platform';
          }
        });
        
        setColumnMapping(autoMapping);
        setUploadStep('map');
      },
      error: (error) => {
        setError('Failed to parse CSV: ' + error.message);
      }
    });
  };

  const processLeads = () => {
    const leads: LeadData[] = [];
    
    csvData.forEach((row) => {
      const lead: LeadData = {};
      
      // Map columns to lead fields
      Object.entries(columnMapping).forEach(([csvColumn, dbField]) => {
        if (dbField && row[csvColumn] !== undefined && row[csvColumn] !== null) {
          const value = String(row[csvColumn]).trim();
          if (value !== '' && value !== 'EMPTY' && value !== 'NULL') {
            lead[dbField as keyof LeadData] = value;
          }
        }
      });

      // Only require name for lists (no campaign-specific requirements)
      if (lead.name && lead.name.trim() !== '') {
        leads.push(lead);
      }
    });

    setProcessedLeads(leads);
    setUploadStep('preview');
  };

  const uploadLeadsToList = async () => {
    if (!user || !selectedList || processedLeads.length === 0) {
      setError('No valid leads to upload');
      return;
    }

    setUploading(true);

    try {
      // Add list_id and user_id to each lead
      const leadsToUpload = processedLeads.map(lead => ({
        ...lead,
        list_id: selectedList,
        user_id: user.id,
        phone: lead.phone || null,
        email: lead.email || null,
        company_name: lead.company_name || null,
        job_title: lead.job_title || null,
        source_url: lead.source_url || null,
        source_platform: lead.source_platform || null,
        custom_fields: {}
      }));

      const { error } = await supabase
        .from('list_leads')
        .insert(leadsToUpload);

      if (error) throw error;

      // Reset upload state
      resetUpload();
      fetchListLeads();
      fetchLists(); // Refresh counts
      
    } catch (error) {
      console.error('Upload error:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload leads');
    } finally {
      setUploading(false);
    }
  };

  const moveLeadsToCampaign = async (campaignId: string) => {
    if (selectedLeads.length === 0) return;

    try {
      // Get campaign requirements
      const { data: sequences, error: seqError } = await supabase
        .from('campaign_sequences')
        .select('type')
        .eq('campaign_id', campaignId);

      if (seqError) throw seqError;

      const channelTypes = sequences?.map(s => s.type) || [];
      const needsEmail = channelTypes.includes('email');
      const needsPhone = channelTypes.includes('call') || channelTypes.includes('sms') || channelTypes.includes('whatsapp');

      // Get selected leads
      const leadsToMove = listLeads.filter(lead => selectedLeads.includes(lead.id));
      
      // Validate leads meet campaign requirements
      const validLeads = leadsToMove.filter(lead => {
        if (needsEmail && (!lead.email || lead.email.trim() === '')) return false;
        if (needsPhone && (!lead.phone || lead.phone.trim() === '')) return false;
        return true;
      });

      if (validLeads.length === 0) {
        setError('No leads meet the campaign requirements');
        return;
      }

      if (validLeads.length < leadsToMove.length) {
        const skipped = leadsToMove.length - validLeads.length;
        setError(`${skipped} leads skipped due to missing required fields`);
      }

      // Convert to campaign leads format
      const campaignLeads = validLeads.map(lead => ({
        user_id: user.id,
        campaign_id: campaignId,
        name: lead.name,
        phone: lead.phone || '',
        email: lead.email,
        company_name: lead.company_name,
        job_title: lead.job_title,
        source_url: lead.source_url,
        source_platform: lead.source_platform,
        status: 'pending'
      }));

      // Insert into uploaded_leads (campaign leads)
      const { error: insertError } = await supabase
        .from('uploaded_leads')
        .insert(campaignLeads);

      if (insertError) throw insertError;

      setSelectedLeads([]);
      setShowAddToCampaignModal(false);
      
    } catch (error) {
      console.error('Error moving leads to campaign:', error);
      setError('Failed to move leads to campaign');
    }
  };

  const resetUpload = () => {
    setCsvFile(null);
    setCsvData([]);
    setCsvHeaders([]);
    setColumnMapping({});
    setProcessedLeads([]);
    setUploadStep('upload');
    setShowUploadModal(false);
  };

  const updateColumnMapping = (csvColumn: string, dbField: string) => {
    const newMapping = { ...columnMapping };
    
    // Remove any existing mapping for this database field
    Object.keys(newMapping).forEach(key => {
      if (newMapping[key] === dbField) {
        delete newMapping[key];
      }
    });
    
    // Add new mapping if dbField is not empty
    if (dbField) {
      newMapping[csvColumn] = dbField;
    } else {
      delete newMapping[csvColumn];
    }
    
    setColumnMapping(newMapping);
  };

  const getFieldConfigs = () => [
    { field: 'name', label: 'Full Name', icon: Users, required: true },
    { field: 'email', label: 'Email Address', icon: Mail, required: false },
    { field: 'phone', label: 'Phone Number', icon: Phone, required: false },
    { field: 'company_name', label: 'Company Name', icon: Building, required: false },
    { field: 'job_title', label: 'Job Title', icon: Briefcase, required: false },
    { field: 'source_url', label: 'Source URL', icon: Target, required: false },
    { field: 'source_platform', label: 'Source Platform', icon: Database, required: false }
  ];

  const isValidMapping = () => {
    // Only require name for lists
    const nameColumn = Object.keys(columnMapping).find(key => columnMapping[key] === 'name');
    return !!nameColumn;
  };

  const filteredLeads = listLeads.filter((lead) => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      (lead.name?.toLowerCase().includes(searchLower)) ||
      (lead.email?.toLowerCase().includes(searchLower)) ||
      (lead.phone?.includes(searchTerm)) ||
      (lead.company_name?.toLowerCase().includes(searchLower)) ||
      (lead.job_title?.toLowerCase().includes(searchLower))
    );
  });

  const totalPages = Math.ceil(totalLeads / leadsPerPage);

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
            Build and manage your lead collections independently from campaigns
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={() => window.location.href = '/targeting'}
            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              theme === 'gold'
                ? 'border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Target className="h-4 w-4 mr-2" />
            New Prospects
          </button>
          
          <button
            onClick={() => setShowCreateList(true)}
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

      {/* Lists Overview */}
      <div className={`p-6 rounded-xl border ${
        theme === 'gold' 
          ? 'black-card gold-border' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="flex items-center justify-between mb-6">
          <h3 className={`text-lg font-semibold ${
            theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
          }`}>
            Your Lists ({lists.length})
          </h3>
          
          {selectedList && (
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowUploadModal(true)}
                className={`inline-flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                    : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload to List
              </button>
              
              {selectedLeads.length > 0 && (
                <button
                  onClick={() => setShowAddToCampaignModal(true)}
                  className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    theme === 'gold'
                      ? 'gold-gradient text-black hover-gold'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  <Move className="h-4 w-4 mr-2" />
                  Add to Campaign ({selectedLeads.length})
                </button>
              )}
            </div>
          )}
        </div>

        {lists.length === 0 ? (
          <div className="text-center py-12">
            <Database className={`h-12 w-12 mx-auto mb-4 ${
              theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
            }`} />
            <h3 className={`text-lg font-medium mb-2 ${
              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
            }`}>
              No lists created yet
            </h3>
            <p className={`mb-6 ${
              theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Create your first list to start building your lead database
            </p>
            <button
              onClick={() => setShowCreateList(true)}
              className={`inline-flex items-center px-6 py-3 text-sm font-medium rounded-lg transition-colors ${
                theme === 'gold'
                  ? 'gold-gradient text-black hover-gold'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create First List
            </button>
          </div>
        ) : (
          <>
            {/* List Selector */}
            <div className="mb-6">
              <label className={`block text-sm font-medium mb-2 ${
                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
              }`}>
                Select List to View
              </label>
              <select
                value={selectedList}
                onChange={(e) => {
                  setSelectedList(e.target.value);
                  setCurrentPage(1);
                  setSelectedLeads([]);
                }}
                className={`w-full max-w-md px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                  theme === 'gold'
                    ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                    : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                }`}
              >
                <option value="">Select a list...</option>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name} ({list.lead_count} leads)
                  </option>
                ))}
              </select>
            </div>

            {/* Lists Grid Preview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {lists.map((list) => (
                <div
                  key={list.id}
                  onClick={() => {
                    setSelectedList(list.id);
                    setCurrentPage(1);
                    setSelectedLeads([]);
                  }}
                  className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                    selectedList === list.id
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
                        theme === 'gold' ? 'bg-blue-500/20' : 'bg-blue-100'
                      }`}>
                        <Database className={`h-5 w-5 ${
                          theme === 'gold' ? 'text-blue-400' : 'text-blue-600'
                        }`} />
                      </div>
                      <div>
                        <h4 className={`font-semibold ${
                          theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                        }`}>
                          {list.name}
                        </h4>
                        <p className={`text-sm ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {list.lead_count || 0} leads
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {list.description && (
                    <p className={`text-sm mb-3 ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {list.description}
                    </p>
                  )}
                  
                  {list.tags && list.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {list.tags.slice(0, 3).map((tag, index) => (
                        <span
                          key={index}
                          className={`px-2 py-1 text-xs rounded-full ${
                            theme === 'gold'
                              ? 'bg-yellow-400/20 text-yellow-400'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {tag}
                        </span>
                      ))}
                      {list.tags.length > 3 && (
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          theme === 'gold'
                            ? 'bg-gray-600 text-gray-400'
                            : 'bg-gray-200 text-gray-600'
                        }`}>
                          +{list.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Selected List Leads */}
      {selectedList && (
        <div className={`rounded-xl border ${
          theme === 'gold' 
            ? 'black-card gold-border' 
            : 'bg-white border-gray-200'
        }`}>
          {/* Leads Header */}
          <div className={`p-4 border-b ${
            theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
          }`}>
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h3 className={`text-lg font-semibold ${
                  theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                }`}>
                  {lists.find(l => l.id === selectedList)?.name} ({totalLeads} leads)
                </h3>
                <p className={`text-sm ${
                  theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Showing {Math.min(leadsPerPage, totalLeads)} leads per page
                </p>
              </div>

              {/* Search and Filters */}
              <div className="flex items-center space-x-3">
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
                  }`}
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
                      onClick={() => setShowAddToCampaignModal(true)}
                      className={`inline-flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                        theme === 'gold'
                          ? 'gold-gradient text-black hover-gold'
                          : 'bg-green-600 text-white hover:bg-green-700'
                      }`}
                    >
                      <Move className="h-4 w-4 mr-1" />
                      Add to Campaign
                    </button>
                    
                    <button
                      onClick={() => {/* Export selected */}}
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
                  {searchTerm
                    ? 'No leads match your search criteria'
                    : 'Upload leads or add prospects to get started'}
                </p>
                <div className="flex justify-center space-x-3">
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      theme === 'gold'
                        ? 'gold-gradient text-black hover-gold'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Leads
                  </button>
                  <button
                    onClick={() => window.location.href = '/targeting'}
                    className={`inline-flex items-center px-4 py-2 text-sm rounded-lg border transition-colors ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Find New Prospects
                  </button>
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
                          onChange={() => {
                            if (selectedLeads.length === filteredLeads.length) {
                              setSelectedLeads([]);
                            } else {
                              setSelectedLeads(filteredLeads.map(lead => lead.id));
                            }
                          }}
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
                            onChange={() => {
                              if (selectedLeads.includes(lead.id)) {
                                setSelectedLeads(prev => prev.filter(id => id !== lead.id));
                              } else {
                                setSelectedLeads(prev => [...prev, lead.id]);
                              }
                            }}
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
                              Manual
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
                        Showing {((currentPage - 1) * leadsPerPage) + 1} to {Math.min(currentPage * leadsPerPage, totalLeads)} of {totalLeads} leads
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
                          <ArrowLeft className="h-4 w-4" />
                        </button>
                        
                        <span className={`px-3 py-1 text-sm ${
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
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
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

              <form onSubmit={createNewList} className="p-6 space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    List Name *
                  </label>
                  <input
                    type="text"
                    value={newListForm.name}
                    onChange={(e) => setNewListForm({ ...newListForm, name: e.target.value })}
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
                    value={newListForm.description}
                    onChange={(e) => setNewListForm({ ...newListForm, description: e.target.value })}
                    rows={3}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                        : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                    }`}
                    placeholder="Describe this list and its purpose..."
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
                    value={newListForm.tags}
                    onChange={(e) => setNewListForm({ ...newListForm, tags: e.target.value })}
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
                    type="button"
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
                    type="submit"
                    className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      theme === 'gold'
                        ? 'gold-gradient text-black hover-gold'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Create List
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Upload to List Modal */}
      {showUploadModal && (
        <div className={`fixed inset-0 z-50 overflow-y-auto ${
          theme === 'gold' ? 'bg-black/75' : 'bg-gray-900/50'
        }`}>
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className={`w-full max-w-4xl rounded-xl shadow-2xl ${
              theme === 'gold' ? 'black-card gold-border' : 'bg-white border border-gray-200'
            }`}>
              <div className={`p-6 border-b ${
                theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
                  <h3 className={`text-lg font-semibold ${
                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    Upload Leads to List
                  </h3>
                  <button
                    onClick={resetUpload}
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
                {/* Step 1: Upload File */}
                {uploadStep === 'upload' && (
                  <div className="space-y-6">
                    <div
                      onDrop={(e) => {
                        e.preventDefault();
                        const files = Array.from(e.dataTransfer.files);
                        if (files.length > 0) {
                          handleFileUpload(files[0]);
                        }
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                        theme === 'gold'
                          ? 'border-yellow-400/30 bg-yellow-400/5 hover:bg-yellow-400/10'
                          : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <Upload className={`h-12 w-12 mx-auto mb-4 ${
                        theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                      }`} />
                      <h3 className={`text-lg font-semibold mb-2 ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        Upload CSV File
                      </h3>
                      <p className={`text-sm mb-4 ${
                        theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Drag and drop your CSV file here, or click to browse
                      </p>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => {
                          const files = e.target.files;
                          if (files && files.length > 0) {
                            handleFileUpload(files[0]);
                          }
                        }}
                        className="hidden"
                        id="csv-upload-list"
                      />
                      <label
                        htmlFor="csv-upload-list"
                        className={`inline-flex items-center px-6 py-3 text-sm font-medium rounded-lg cursor-pointer transition-colors ${
                          theme === 'gold'
                            ? 'gold-gradient text-black hover-gold'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Choose File
                      </label>
                    </div>

                    <div className={`p-4 rounded-lg ${
                      theme === 'gold'
                        ? 'bg-blue-500/10 border border-blue-500/20'
                        : 'bg-blue-50 border border-blue-200'
                    }`}>
                      <h4 className={`text-sm font-medium mb-2 ${
                        theme === 'gold' ? 'text-blue-400' : 'text-blue-700'
                      }`}>
                        📋 CSV Requirements for Lists
                      </h4>
                      <div className={`text-sm space-y-2 ${
                        theme === 'gold' ? 'text-blue-300' : 'text-blue-600'
                      }`}>
                        <div>
                          <strong>Required Fields:</strong>
                          <ul className="ml-4 mt-1 space-y-1">
                            <li>• <strong>Name</strong> - for personalization</li>
                          </ul>
                        </div>
                        <div>
                          <strong>Optional Fields:</strong>
                          <ul className="ml-4 mt-1 space-y-1">
                            <li>• Email addresses - for email campaigns</li>
                            <li>• Phone numbers - for voice/SMS campaigns</li>
                            <li>• Company names - for better targeting</li>
                            <li>• Job titles - for personalized messaging</li>
                            <li>• Source URLs - for tracking lead sources</li>
                            <li>• Source platforms - for attribution</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Column Mapping */}
                {uploadStep === 'map' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className={`text-lg font-semibold mb-2 ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        Map Your CSV Columns
                      </h3>
                      <p className={`text-sm ${
                        theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Match your CSV columns to the lead fields. Only Name is required for lists.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {getFieldConfigs().map((fieldConfig) => {
                        const Icon = fieldConfig.icon;
                        const mappedColumn = Object.keys(columnMapping).find(
                          key => columnMapping[key] === fieldConfig.field
                        );
                        
                        return (
                          <div
                            key={fieldConfig.field}
                            className={`p-4 rounded-lg border ${
                              theme === 'gold'
                                ? 'border-yellow-400/20 bg-black/10'
                                : 'border-gray-200 bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center space-x-3 mb-3">
                              <Icon className={`h-5 w-5 ${
                                fieldConfig.required 
                                  ? theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                                  : theme === 'gold' ? 'text-gray-400' : 'text-gray-400'
                              }`} />
                              <div>
                                <div className={`font-medium ${
                                  theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                                }`}>
                                  {fieldConfig.label}
                                  {fieldConfig.required && (
                                    <span className="text-red-500 ml-1">*</span>
                                  )}
                                </div>
                                <div className={`text-xs ${
                                  fieldConfig.required 
                                    ? theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                                    : theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                                }`}>
                                  {fieldConfig.required ? 'Required' : 'Optional'}
                                </div>
                              </div>
                            </div>
                            
                            <select
                              value={mappedColumn || ''}
                              onChange={(e) => {
                                if (e.target.value) {
                                  updateColumnMapping(e.target.value, fieldConfig.field);
                                }
                              }}
                              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                                theme === 'gold'
                                  ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                                  : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                              }`}
                            >
                              <option value="">Select CSV column...</option>
                              {csvHeaders.map(header => (
                                <option key={header} value={header}>
                                  {header}
                                </option>
                              ))}
                            </select>
                            
                            {/* Sample data preview */}
                            {mappedColumn && csvData.length > 0 && (
                              <div className={`mt-2 p-2 rounded border-l-4 ${
                                theme === 'gold'
                                  ? 'border-yellow-400 bg-yellow-400/5'
                                  : 'border-blue-500 bg-blue-50'
                              }`}>
                                <div className={`text-xs font-medium ${
                                  theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
                                }`}>
                                  Sample data:
                                </div>
                                <div className={`text-xs ${
                                  theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                                }`}>
                                  {csvData.slice(0, 3).map((row, i) => (
                                    <div key={i}>"{row[mappedColumn] || 'empty'}"</div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex justify-between">
                      <button
                        type="button"
                        onClick={() => setUploadStep('upload')}
                        className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                          theme === 'gold'
                            ? 'text-gray-400 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                            : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                        }`}
                      >
                        Back to Upload
                      </button>
                      <button
                        onClick={processLeads}
                        disabled={!isValidMapping()}
                        className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                          theme === 'gold'
                            ? 'gold-gradient text-black hover-gold'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        Process Leads
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Preview & Upload */}
                {uploadStep === 'preview' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className={`text-lg font-semibold mb-2 ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        Review & Upload to List
                      </h3>
                      <p className={`text-sm ${
                        theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Review your processed leads before adding to the list
                      </p>
                    </div>

                    {/* Upload Stats */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className={`p-4 rounded-lg border ${
                        theme === 'gold'
                          ? 'border-yellow-400/20 bg-black/20'
                          : 'border-gray-200 bg-white'
                      }`}>
                        <div className={`text-2xl font-bold ${
                          theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                        }`}>
                          {csvData.length}
                        </div>
                        <div className={`text-sm ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          Total Rows
                        </div>
                      </div>

                      <div className={`p-4 rounded-lg border ${
                        theme === 'gold'
                          ? 'border-yellow-400/20 bg-black/20'
                          : 'border-gray-200 bg-white'
                      }`}>
                        <div className={`text-2xl font-bold ${
                          theme === 'gold' ? 'text-yellow-400' : 'text-green-600'
                        }`}>
                          {processedLeads.length}
                        </div>
                        <div className={`text-sm ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          Valid Leads
                        </div>
                      </div>

                      <div className={`p-4 rounded-lg border ${
                        theme === 'gold'
                          ? 'border-yellow-400/20 bg-black/20'
                          : 'border-gray-200 bg-white'
                      }`}>
                        <div className={`text-2xl font-bold ${
                          theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                        }`}>
                          {csvData.length > 0 ? Math.round((processedLeads.length / csvData.length) * 100) : 0}%
                        </div>
                        <div className={`text-sm ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          Success Rate
                        </div>
                      </div>
                    </div>

                    {/* Sample Leads Preview */}
                    <div className={`p-4 rounded-lg border ${
                      theme === 'gold'
                        ? 'border-yellow-400/20 bg-black/10'
                        : 'border-gray-200 bg-gray-50'
                    }`}>
                      <h4 className={`text-sm font-medium mb-3 ${
                        theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Sample Leads (First 5)
                      </h4>
                      
                      <div className="overflow-x-auto">
                        <table className="min-w-full">
                          <thead>
                            <tr className={`border-b ${
                              theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
                            }`}>
                              <th className={`text-left py-2 px-3 text-xs font-medium ${
                                theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                              }`}>
                                Name
                              </th>
                              <th className={`text-left py-2 px-3 text-xs font-medium ${
                                theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                              }`}>
                                Email
                              </th>
                              <th className={`text-left py-2 px-3 text-xs font-medium ${
                                theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                              }`}>
                                Phone
                              </th>
                              <th className={`text-left py-2 px-3 text-xs font-medium ${
                                theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                              }`}>
                                Company
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {processedLeads.slice(0, 5).map((lead, index) => (
                              <tr key={index} className={`border-b ${
                                theme === 'gold' ? 'border-yellow-400/10' : 'border-gray-100'
                              }`}>
                                <td className={`py-2 px-3 text-sm ${
                                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                  {lead.name || 'No name'}
                                </td>
                                <td className={`py-2 px-3 text-sm ${
                                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                  {lead.email || 'No email'}
                                </td>
                                <td className={`py-2 px-3 text-sm ${
                                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                  {lead.phone || 'No phone'}
                                </td>
                                <td className={`py-2 px-3 text-sm ${
                                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                  {lead.company_name || 'No company'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-between">
                      <button
                        onClick={() => setUploadStep('map')}
                        className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                          theme === 'gold'
                            ? 'text-gray-400 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                            : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                        }`}
                      >
                        Back to Mapping
                      </button>
                      <button
                        onClick={uploadLeadsToList}
                        disabled={uploading || processedLeads.length === 0}
                        className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                          theme === 'gold'
                            ? 'gold-gradient text-black hover-gold'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                      >
                        {uploading ? (
                          <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                            Uploading...
                          </div>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload {processedLeads.length} Leads
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add to Campaign Modal */}
      {showAddToCampaignModal && (
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
                    Add to Campaign
                  </h3>
                  <button
                    onClick={() => setShowAddToCampaignModal(false)}
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
                <p className={`text-sm ${
                  theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Select a campaign to add {selectedLeads.length} selected leads. Leads will be validated against campaign requirements.
                </p>

                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {campaigns.map((campaign) => (
                    <button
                      key={campaign.id}
                      onClick={() => moveLeadsToCampaign(campaign.id)}
                      className={`w-full p-3 text-left rounded-lg border transition-colors ${
                        theme === 'gold'
                          ? 'border-yellow-400/20 bg-black/10 hover:bg-yellow-400/5'
                          : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className={`font-medium ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        {campaign.offer || campaign.name || 'Untitled Campaign'}
                      </div>
                      <div className={`text-sm ${
                        theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Status: {campaign.status || 'draft'}
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setShowAddToCampaignModal(false)}
                  className={`w-full px-4 py-2 text-sm rounded-lg transition-colors ${
                    theme === 'gold'
                      ? 'text-gray-400 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                      : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                  }`}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}