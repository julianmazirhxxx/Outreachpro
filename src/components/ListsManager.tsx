import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { LoadingSpinner } from './common/LoadingSpinner';
import { ErrorMessage } from './common/ErrorMessage';
import { LeadEditModal } from './LeadEditModal';
import Papa from 'papaparse';
import { 
  Users, 
  Upload, 
  Download, 
  Search, 
  Plus, 
  Trash2, 
  Edit2,
  Mail,
  Phone,
  Building,
  Briefcase,
  Tag,
  Crown,
  Zap,
  CheckCircle,
  XCircle,
  Eye,
  Filter,
  MoreHorizontal,
  FileText,
  Target
} from 'lucide-react';

interface List {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  created_at: string;
  lead_count?: number;
}

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  job_title: string | null;
  source_url: string | null;
  source_platform: string | null;
  custom_fields: Record<string, any>;
  created_at: string;
}

interface ColumnMapping {
  [key: string]: string;
}

export function ListsManager() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'lists' | 'leads'>('lists');
  const [lists, setLists] = useState<List[]>([]);
  const [selectedList, setSelectedList] = useState<List | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [showCreateList, setShowCreateList] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');

  // Upload states
  const [uploadStep, setUploadStep] = useState<'select' | 'map' | 'preview'>('select');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [processedLeads, setProcessedLeads] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) {
      fetchLists();
    }
  }, [user]);

  useEffect(() => {
    if (selectedList) {
      fetchLeads(selectedList.id);
      setActiveTab('leads');
    }
  }, [selectedList]);

  const fetchLists = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('lists')
        .select(`
          *,
          list_leads(count)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const listsWithCounts = data?.map(list => ({
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

  const fetchLeads = async (listId: string) => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('list_leads')
        .select('*')
        .eq('list_id', listId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
      setError('Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  const createList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newListName.trim()) return;

    try {
      const { error } = await supabase
        .from('lists')
        .insert([{
          user_id: user.id,
          name: newListName.trim(),
          description: newListDescription.trim() || null,
          tags: []
        }]);

      if (error) throw error;

      setNewListName('');
      setNewListDescription('');
      setShowCreateList(false);
      fetchLists();
    } catch (error) {
      console.error('Error creating list:', error);
      setError('Failed to create list');
    }
  };

  const deleteList = async (listId: string) => {
    if (!confirm('Are you sure you want to delete this list and all its leads?')) return;

    try {
      const { error } = await supabase
        .from('lists')
        .delete()
        .eq('id', listId)
        .eq('user_id', user.id);

      if (error) throw error;

      if (selectedList?.id === listId) {
        setSelectedList(null);
        setActiveTab('lists');
      }
      fetchLists();
    } catch (error) {
      console.error('Error deleting list:', error);
      setError('Failed to delete list');
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
    if (selectedLeads.length === leads.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(leads.map(lead => lead.id));
    }
  };

  const deleteSelectedLeads = async () => {
    if (selectedLeads.length === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedLeads.length} selected leads?`)) return;

    try {
      const { error } = await supabase
        .from('list_leads')
        .delete()
        .in('id', selectedLeads)
        .eq('user_id', user.id);

      if (error) throw error;

      setSelectedLeads([]);
      if (selectedList) {
        fetchLeads(selectedList.id);
      }
      fetchLists(); // Refresh counts
    } catch (error) {
      console.error('Error deleting leads:', error);
      setError('Failed to delete leads');
    }
  };

  const exportLeads = () => {
    const leadsToExport = selectedLeads.length > 0 
      ? leads.filter(lead => selectedLeads.includes(lead.id))
      : leads;

    if (leadsToExport.length === 0) return;

    // Get all unique custom field keys
    const allCustomFields = new Set<string>();
    leadsToExport.forEach(lead => {
      if (lead.custom_fields) {
        Object.keys(lead.custom_fields).forEach(key => allCustomFields.add(key));
      }
    });

    const customFieldKeys = Array.from(allCustomFields);

    // Create CSV headers
    const headers = [
      'Name', 'Email', 'Phone', 'Company', 'Job Title', 'Source Platform', 'Source URL', 'Created',
      ...customFieldKeys
    ];

    // Create CSV rows
    const rows = leadsToExport.map(lead => [
      lead.name || '',
      lead.email || '',
      lead.phone || '',
      lead.company_name || '',
      lead.job_title || '',
      lead.source_platform || '',
      lead.source_url || '',
      new Date(lead.created_at).toLocaleDateString(),
      ...customFieldKeys.map(key => lead.custom_fields?.[key] || '')
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedList?.name || 'leads'}_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // CSV Upload Functions
  const handleFileUpload = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
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
          }
        });
        
        setColumnMapping(autoMapping);
        setUploadStep('map');
      }
    });
  };

  const processLeads = () => {
    const processedData: any[] = [];
    
    csvData.forEach((row) => {
      const lead: any = {
        custom_fields: {}
      };
      
      // Map standard fields
      Object.entries(columnMapping).forEach(([csvColumn, dbField]) => {
        if (dbField && row[csvColumn] !== undefined && row[csvColumn] !== null) {
          const value = String(row[csvColumn]).trim();
          if (value !== '' && value !== 'EMPTY' && value !== 'NULL') {
            if (['name', 'email', 'phone', 'company_name', 'job_title'].includes(dbField)) {
              lead[dbField] = value;
            }
          }
        }
      });

      // Map unmapped columns as custom fields
      csvHeaders.forEach(header => {
        if (!columnMapping[header] && row[header] !== undefined && row[header] !== null) {
          const value = String(row[header]).trim();
          if (value !== '' && value !== 'EMPTY' && value !== 'NULL') {
            lead.custom_fields[header] = value;
          }
        }
      });
      
      // Only include leads with at least a name
      if (lead.name && lead.name.trim() !== '') {
        processedData.push(lead);
      }
    });

    setProcessedLeads(processedData);
    setUploadStep('preview');
  };

  const uploadLeads = async () => {
    if (!user || !selectedList || processedLeads.length === 0) return;

    setUploading(true);
    try {
      const leadsToUpload = processedLeads.map(lead => ({
        ...lead,
        list_id: selectedList.id,
        user_id: user.id
      }));

      const { error } = await supabase
        .from('list_leads')
        .insert(leadsToUpload);

      if (error) throw error;

      setShowUploadModal(false);
      setUploadStep('select');
      setCsvFile(null);
      setCsvData([]);
      setProcessedLeads([]);
      fetchLeads(selectedList.id);
      fetchLists(); // Refresh counts
    } catch (error) {
      console.error('Upload error:', error);
      setError('Failed to upload leads');
    } finally {
      setUploading(false);
    }
  };

  const filteredLeads = leads.filter(lead => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      lead.name?.toLowerCase().includes(search) ||
      lead.email?.toLowerCase().includes(search) ||
      lead.phone?.includes(search) ||
      lead.company_name?.toLowerCase().includes(search) ||
      lead.job_title?.toLowerCase().includes(search) ||
      Object.values(lead.custom_fields || {}).some(value => 
        String(value).toLowerCase().includes(search)
      )
    );
  });

  if (loading && lists.length === 0) {
    return <LoadingSpinner size="lg" message="Loading lists..." className="h-64" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
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
            Lists Manager
          </h1>
        </div>
        <p className={theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}>
          Organize your leads into targeted lists for better campaign management
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <ErrorMessage
          message={error}
          onDismiss={() => setError('')}
        />
      )}

      {/* Main Content */}
      <div className={`rounded-xl border ${
        theme === 'gold' 
          ? 'black-card gold-border' 
          : 'bg-white border-gray-200'
      }`}>
        {/* Tabs */}
        <div className={`border-b ${
          theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
        }`}>
          <nav className="flex px-4 sm:px-6">
            <button
              onClick={() => {
                setActiveTab('lists');
                setSelectedList(null);
                setSelectedLeads([]);
              }}
              className={`py-4 px-4 border-b-2 font-medium text-sm whitespace-nowrap flex items-center space-x-2 ${
                activeTab === 'lists'
                  ? theme === 'gold'
                    ? 'border-yellow-400 text-yellow-400'
                    : 'border-blue-500 text-blue-600'
                  : theme === 'gold'
                    ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Target className="h-4 w-4" />
              <span>Your Lists ({lists.length})</span>
            </button>
            
            {selectedList && (
              <button
                onClick={() => setActiveTab('leads')}
                className={`py-4 px-4 border-b-2 font-medium text-sm whitespace-nowrap flex items-center space-x-2 ${
                  activeTab === 'leads'
                    ? theme === 'gold'
                      ? 'border-yellow-400 text-yellow-400'
                      : 'border-blue-500 text-blue-600'
                    : theme === 'gold'
                      ? 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>{selectedList.name} ({leads.length})</span>
              </button>
            )}
          </nav>
        </div>

        <div className="p-4 sm:p-6">
          {/* Lists Tab */}
          {activeTab === 'lists' && (
            <div className="space-y-6">
              {/* Lists Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className={`text-lg font-semibold ${
                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    Your Lists
                  </h3>
                  <p className={`text-sm ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Organize leads into targeted lists for campaigns
                  </p>
                </div>
                
                <button
                  onClick={() => setShowCreateList(true)}
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    theme === 'gold'
                      ? 'gold-gradient text-black hover-gold'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New List
                </button>
              </div>

              {/* Lists Grid */}
              {lists.length === 0 ? (
                <div className="text-center py-12">
                  <Target className={`h-12 w-12 mx-auto mb-4 ${
                    theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
                  }`} />
                  <h3 className={`text-lg font-medium mb-2 ${
                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    No lists yet
                  </h3>
                  <p className={`mb-6 ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Create your first list to organize leads
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {lists.map((list) => (
                    <div
                      key={list.id}
                      className={`p-4 rounded-lg border transition-all hover:shadow-md cursor-pointer ${
                        theme === 'gold'
                          ? 'border-yellow-400/20 bg-black/10 hover:bg-yellow-400/5'
                          : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                      }`}
                      onClick={() => setSelectedList(list)}
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
                              {list.name}
                            </h4>
                            <p className={`text-sm ${
                              theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              {list.lead_count || 0} leads
                            </p>
                          </div>
                        </div>
                        
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteList(list.id);
                          }}
                          className={`p-1 rounded transition-colors ${
                            theme === 'gold'
                              ? 'text-red-400 hover:bg-red-400/10'
                              : 'text-red-600 hover:bg-red-50'
                          }`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      
                      {list.description && (
                        <p className={`text-sm ${
                          theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          {list.description}
                        </p>
                      )}
                      
                      <div className={`mt-3 text-xs ${
                        theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                      }`}>
                        Created {new Date(list.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Leads Tab */}
          {activeTab === 'leads' && selectedList && (
            <div className="space-y-6">
              {/* Leads Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h3 className={`text-lg font-semibold ${
                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    {selectedList.name}
                  </h3>
                  <p className={`text-sm ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {selectedList.description || 'No description'}
                  </p>
                </div>
                
                <div className="flex items-center space-x-3">
                  {selectedLeads.length > 0 && (
                    <>
                      <button
                        onClick={() => setEditingLead(leads.find(l => l.id === selectedLeads[0]) || null)}
                        disabled={selectedLeads.length !== 1}
                        className={`inline-flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                          selectedLeads.length === 1
                            ? theme === 'gold'
                              ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                              : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                            : 'opacity-50 cursor-not-allowed border border-gray-300 text-gray-400'
                        }`}
                        title={selectedLeads.length === 1 ? 'Edit selected lead' : 'Select exactly one lead to edit'}
                      >
                        <Edit2 className="h-4 w-4 mr-1" />
                        Edit
                      </button>
                      
                      <button
                        onClick={deleteSelectedLeads}
                        className="inline-flex items-center px-3 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete ({selectedLeads.length})
                      </button>
                    </>
                  )}
                  
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className={`inline-flex items-center px-3 py-2 text-sm rounded-lg border transition-colors ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Upload
                  </button>
                  
                  <button
                    onClick={exportLeads}
                    className={`inline-flex items-center px-3 py-2 text-sm rounded-lg border transition-colors ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </button>
                </div>
              </div>

              {/* Search */}
              <div className="relative max-w-md">
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

              {/* Leads Table */}
              {filteredLeads.length === 0 ? (
                <div className="text-center py-12">
                  <Users className={`h-12 w-12 mx-auto mb-4 ${
                    theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
                  }`} />
                  <h3 className={`text-lg font-medium mb-2 ${
                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    {searchTerm ? 'No leads match your search' : 'No leads in this list'}
                  </h3>
                  <p className={`mb-6 ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    {searchTerm ? 'Try adjusting your search terms' : 'Upload leads to get started'}
                  </p>
                  {!searchTerm && (
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className={`inline-flex items-center px-6 py-3 text-sm font-medium rounded-lg transition-colors ${
                        theme === 'gold'
                          ? 'gold-gradient text-black hover-gold'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Leads
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className={`${
                      theme === 'gold' ? 'bg-black/20' : 'bg-gray-50'
                    }`}>
                      <tr>
                        <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          <input
                            type="checkbox"
                            checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0}
                            onChange={handleSelectAll}
                            className="rounded"
                          />
                        </th>
                        <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Lead
                        </th>
                        <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Email
                        </th>
                        <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Phone
                        </th>
                        <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Company
                        </th>
                        <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Job Title
                        </th>
                        <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Custom Fields
                        </th>
                        <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
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
                          <td className="px-4 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedLeads.includes(lead.id)}
                              onChange={() => handleSelectLead(lead.id)}
                              className="rounded"
                            />
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                theme === 'gold' ? 'bg-blue-500/20' : 'bg-blue-100'
                              }`}>
                                <Users className={`h-4 w-4 ${
                                  theme === 'gold' ? 'text-blue-400' : 'text-blue-600'
                                }`} />
                              </div>
                              <div className="ml-3">
                                <div className={`text-sm font-medium ${
                                  theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                                }`}>
                                  {lead.name}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {lead.email ? (
                              <div className={`flex items-center text-sm ${
                                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                              }`}>
                                <Mail className="h-3 w-3 mr-2" />
                                <span className="truncate max-w-32">{lead.email}</span>
                              </div>
                            ) : (
                              <span className={`text-sm ${
                                theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                              }`}>
                                No email
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {lead.phone ? (
                              <div className={`flex items-center text-sm ${
                                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                              }`}>
                                <Phone className="h-3 w-3 mr-2" />
                                {lead.phone}
                              </div>
                            ) : (
                              <span className={`text-sm ${
                                theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                              }`}>
                                No phone
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {lead.company_name ? (
                              <div className={`flex items-center text-sm ${
                                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                              }`}>
                                <Building className="h-3 w-3 mr-2" />
                                <span className="truncate max-w-24">{lead.company_name}</span>
                              </div>
                            ) : (
                              <span className={`text-sm ${
                                theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                              }`}>
                                No company
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {lead.job_title ? (
                              <div className={`flex items-center text-sm ${
                                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                              }`}>
                                <Briefcase className="h-3 w-3 mr-2" />
                                <span className="truncate max-w-24">{lead.job_title}</span>
                              </div>
                            ) : (
                              <span className={`text-sm ${
                                theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                              }`}>
                                No title
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {lead.custom_fields && Object.keys(lead.custom_fields).length > 0 ? (
                              <div className={`flex items-center text-sm ${
                                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                              }`}>
                                <Tag className="h-3 w-3 mr-2" />
                                <span className={`text-sm ${
                                  theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                                }`}>
                                  {Object.keys(lead.custom_fields).length} field{Object.keys(lead.custom_fields).length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            ) : (
                              <span className={`text-sm ${
                                theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                              }`}>
                                No custom fields
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
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
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create List Modal */}
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
                <h3 className={`text-lg font-semibold ${
                  theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                }`}>
                  Create New List
                </h3>
              </div>
              
              <form onSubmit={createList} className="p-6 space-y-4">
                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                  }`}>
                    List Name *
                  </label>
                  <input
                    type="text"
                    value={newListName}
                    onChange={(e) => setNewListName(e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                        : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                    }`}
                    placeholder="e.g., SaaS Founders"
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
                    value={newListDescription}
                    onChange={(e) => setNewListDescription(e.target.value)}
                    rows={3}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                        : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                    }`}
                    placeholder="Describe this list..."
                  />
                </div>

                <div className="flex space-x-3">
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
                    Create List
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && selectedList && (
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
                    Upload Leads to {selectedList.name}
                  </h3>
                  <button
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadStep('select');
                      setCsvFile(null);
                    }}
                    className={`p-2 rounded-lg transition-colors ${
                      theme === 'gold'
                        ? 'text-gray-400 hover:bg-gray-800'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                {/* Step 1: File Selection */}
                {uploadStep === 'select' && (
                  <div className="space-y-6">
                    <div
                      onDrop={(e) => {
                        e.preventDefault();
                        const files = Array.from(e.dataTransfer.files);
                        if (files.length > 0) handleFileUpload(files[0]);
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
                          if (files && files.length > 0) handleFileUpload(files[0]);
                        }}
                        className="hidden"
                        id="csv-upload"
                      />
                      <label
                        htmlFor="csv-upload"
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
                  </div>
                )}

                {/* Step 2: Column Mapping */}
                {uploadStep === 'map' && (
                  <div className="space-y-6">
                    <div>
                      <h4 className={`text-lg font-semibold mb-2 ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        Map Your CSV Columns
                      </h4>
                      <p className={`text-sm ${
                        theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Match your CSV columns to lead fields. Unmapped columns will be saved as custom fields.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { field: 'name', label: 'Full Name', icon: Users },
                        { field: 'email', label: 'Email Address', icon: Mail },
                        { field: 'phone', label: 'Phone Number', icon: Phone },
                        { field: 'company_name', label: 'Company Name', icon: Building },
                        { field: 'job_title', label: 'Job Title', icon: Briefcase }
                      ].map((fieldConfig) => {
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
                                theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                              }`} />
                              <div className={`font-medium ${
                                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                              }`}>
                                {fieldConfig.label}
                              </div>
                            </div>
                            
                            <select
                              value={mappedColumn || ''}
                              onChange={(e) => {
                                const newMapping = { ...columnMapping };
                                // Remove existing mapping for this field
                                Object.keys(newMapping).forEach(key => {
                                  if (newMapping[key] === fieldConfig.field) {
                                    delete newMapping[key];
                                  }
                                });
                                // Add new mapping
                                if (e.target.value) {
                                  newMapping[e.target.value] = fieldConfig.field;
                                }
                                setColumnMapping(newMapping);
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
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex justify-between">
                      <button
                        onClick={() => setUploadStep('select')}
                        className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                          theme === 'gold'
                            ? 'text-gray-400 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                            : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                        }`}
                      >
                        Back
                      </button>
                      <button
                        onClick={processLeads}
                        className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors ${
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
                      <h4 className={`text-lg font-semibold mb-2 ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        Preview & Upload
                      </h4>
                      <p className={`text-sm ${
                        theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Review your processed leads before uploading
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className={`p-4 rounded-lg border ${
                        theme === 'gold'
                          ? 'border-yellow-400/20 bg-black/10'
                          : 'border-gray-200 bg-gray-50'
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
                          ? 'border-yellow-400/20 bg-black/10'
                          : 'border-gray-200 bg-gray-50'
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
                          ? 'border-yellow-400/20 bg-black/10'
                          : 'border-gray-200 bg-gray-50'
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
                        onClick={uploadLeads}
                        disabled={uploading || processedLeads.length === 0}
                        className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                          theme === 'gold'
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                      >
                        {uploading ? (
                          <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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

      {/* Lead Edit Modal */}
      {editingLead && selectedList && (
        <LeadEditModal
          lead={editingLead}
          listId={selectedList.id}
          onClose={() => setEditingLead(null)}
          onSave={() => {
            setEditingLead(null);
            fetchLeads(selectedList.id);
          }}
        />
      )}
    </div>
  );
}