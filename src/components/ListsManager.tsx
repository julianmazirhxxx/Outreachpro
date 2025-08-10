import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { LeadEditModal } from './LeadEditModal';
import { LoadingSpinner } from './common/LoadingSpinner';
import { ErrorMessage } from './common/ErrorMessage';
import { 
  Users, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Upload, 
  Download,
  Eye,
  Phone,
  Mail,
  Building,
  Briefcase,
  Crown,
  Zap,
  Target,
  ArrowRight,
  CheckCircle,
  XCircle,
  Clock,
  X,
  FileText,
  Tag
} from 'lucide-react';
import Papa from 'papaparse';

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
  custom_fields: any;
  created_at: string;
}

export function ListsManager() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [lists, setLists] = useState<List[]>([]);
  const [selectedList, setSelectedList] = useState<List | null>(null);
  const [listLeads, setListLeads] = useState<ListLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [uploadingToList, setUploadingToList] = useState(false);
  const [editingLead, setEditingLead] = useState<ListLead | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [uploadStep, setUploadStep] = useState<'select' | 'map' | 'preview'>('select');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tags: ''
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (user) {
      fetchLists();
    }
  }, [user]);

  useEffect(() => {
    if (selectedList) {
      fetchListLeads(selectedList.id);
    }
  }, [selectedList]);

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
        .order('created_at', { ascending: false });

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

  const fetchListLeads = async (listId: string) => {
    if (!user) return;

    try {
      setLeadsLoading(true);
      
      const { data, error } = await supabase
        .from('list_leads')
        .select('*')
        .eq('list_id', listId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setListLeads(data || []);
    } catch (error) {
      console.error('Error fetching list leads:', error);
      setError('Failed to load list leads');
    } finally {
      setLeadsLoading(false);
    }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setCreating(true);
    setError('');

    try {
      const { error } = await supabase
        .from('lists')
        .insert([{
          user_id: user.id,
          name: formData.name,
          description: formData.description || null,
          tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()) : []
        }]);

      if (error) throw error;

      setFormData({ name: '', description: '', tags: '' });
      setShowCreateForm(false);
      fetchLists();
    } catch (error) {
      console.error('Error creating list:', error);
      setError('Failed to create list');
    } finally {
      setCreating(false);
    }
  };

  const deleteList = async (listId: string) => {
    if (!confirm('Are you sure you want to delete this list? This will also delete all leads in the list.')) return;

    try {
      const { error } = await supabase
        .from('lists')
        .delete()
        .eq('id', listId)
        .eq('user_id', user?.id);

      if (error) throw error;
      
      if (selectedList?.id === listId) {
        setSelectedList(null);
        setListLeads([]);
      }
      fetchLists();
    } catch (error) {
      console.error('Error deleting list:', error);
      setError('Failed to delete list');
    }
  };

  const exportListLeads = (list: List) => {
    const leads = listLeads.filter(lead => lead.list_id === list.id);
    
    const csvContent = [
      ['Name', 'Email', 'Phone', 'Company', 'Job Title', 'Created'],
      ...leads.map(lead => [
        lead.name || '',
        lead.email || '',
        lead.phone || '',
        lead.company_name || '',
        lead.job_title || '',
        new Date(lead.created_at).toLocaleDateString()
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${list.name.replace(/[^a-zA-Z0-9]/g, '_')}_leads.csv`;
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

  const deleteSelectedLeads = async () => {
    if (selectedLeads.length === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedLeads.length} selected leads from this list?`)) return;

    try {
      const { error } = await supabase
        .from('list_leads')
        .delete()
        .in('id', selectedLeads)
        .eq('user_id', user?.id);

      if (error) throw error;

      setSelectedLeads([]);
      if (selectedList) {
        fetchListLeads(selectedList.id);
      }
      fetchLists();
    } catch (error) {
      console.error('Error deleting leads:', error);
      setError('Failed to delete leads');
    }
  };

  const handleFileSelect = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    setCsvFile(file);
    
    // Parse CSV
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
        const autoMapping: Record<string, string> = {};
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
      },
      error: (error) => {
        setError('Failed to parse CSV: ' + error.message);
      }
    });
  };

  const processLeads = () => {
    const leads: any[] = [];
    
    csvData.forEach((row) => {
      const lead: any = {
        list_id: selectedList?.id,
        user_id: user?.id,
        custom_fields: {}
      };
      
      // Map columns to lead fields
      Object.entries(columnMapping).forEach(([csvColumn, dbField]) => {
        if (dbField && row[csvColumn] !== undefined && row[csvColumn] !== null) {
          const value = String(row[csvColumn]).trim();
          if (value !== '' && value !== 'EMPTY' && value !== 'NULL') {
            if (['name', 'email', 'phone', 'company_name', 'job_title'].includes(dbField)) {
              lead[dbField] = value;
            } else {
              lead.custom_fields[dbField] = value;
            }
          }
        }
      });
      
      // Store unmapped columns as custom fields
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
        leads.push(lead);
      }
    });

    return leads;
  };

  const uploadProcessedLeads = async () => {
    if (!selectedList || !user) return;

    const leadsToUpload = processLeads();
    if (leadsToUpload.length === 0) {
      setError('No valid leads to upload');
      return;
    }

    setUploadingToList(true);
    setError('');

    try {
      const { error } = await supabase
        .from('list_leads')
        .insert(leadsToUpload);

      if (error) throw error;

      setShowUploadForm(false);
      setUploadStep('select');
      setCsvFile(null);
      setCsvData([]);
      setCsvHeaders([]);
      setColumnMapping({});
      fetchListLeads(selectedList.id);
      fetchLists();
    } catch (error) {
      console.error('Error uploading leads:', error);
      setError('Failed to upload leads: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setUploadingToList(false);
    }
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

  const filteredLeads = listLeads.filter(lead => 
    !searchTerm || 
    (lead.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (lead.email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (lead.phone?.includes(searchTerm)) ||
    (lead.company_name?.toLowerCase().includes(searchTerm.toLowerCase()))
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
              Lists Manager
            </h1>
          </div>
          <p className={theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}>
            Organize your leads into targeted lists for better campaign management
          </p>
        </div>
        
        <button
          onClick={() => setShowCreateForm(true)}
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

      {/* Error Message */}
      {error && (
        <ErrorMessage
          message={error}
          onDismiss={() => setError('')}
        />
      )}

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
              Your Lists ({lists.length})
            </h3>
          </div>

          <div className="p-4">
            {lists.length === 0 ? (
              <div className="text-center py-8">
                <Users className={`h-12 w-12 mx-auto mb-4 ${
                  theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
                }`} />
                <h3 className={`text-lg font-medium mb-2 ${
                  theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                }`}>
                  No lists yet
                </h3>
                <p className={`mb-4 ${
                  theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Create your first list to organize leads
                </p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
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
              <div className="space-y-2">
                {lists.map((list) => (
                  <div
                    key={list.id}
                    onClick={() => setSelectedList(list)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedList?.id === list.id
                        ? theme === 'gold'
                          ? 'border-yellow-400 bg-yellow-400/10'
                          : 'border-blue-500 bg-blue-50'
                        : theme === 'gold'
                          ? 'border-gray-600 hover:border-gray-500 hover:bg-gray-800/50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className={`font-medium ${
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
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            exportListLeads(list);
                          }}
                          className={`p-1 rounded transition-colors ${
                            theme === 'gold'
                              ? 'text-gray-400 hover:bg-gray-700'
                              : 'text-gray-500 hover:bg-gray-100'
                          }`}
                          title="Export leads"
                        >
                          <Download className="h-4 w-4" />
                        </button>
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
                          title="Delete list"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* List Details */}
        <div className={`lg:col-span-2 rounded-xl border ${
          theme === 'gold' 
            ? 'black-card gold-border' 
            : 'bg-white border-gray-200'
        }`}>
          {selectedList ? (
            <>
              <div className={`p-4 border-b ${
                theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
              }`}>
                <div className="flex items-center justify-between">
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
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setShowUploadForm(true)}
                      className={`inline-flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                        theme === 'gold'
                          ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Upload className="h-4 w-4 mr-1" />
                      Upload
                    </button>
                    <button
                      onClick={() => exportListLeads(selectedList)}
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

              {/* Search */}
              <div className="p-4">
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                    theme === 'gold' ? 'text-yellow-400' : 'text-gray-400'
                  }`} />
                  <input
                    type="text"
                    placeholder="Search leads in this list..."
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

              {/* Leads Table */}
              <div className="overflow-x-auto">
                {leadsLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className={`animate-spin rounded-full h-8 w-8 border-2 border-transparent ${
                      theme === 'gold'
                        ? 'border-t-yellow-400'
                        : 'border-t-blue-600'
                    }`}></div>
                  </div>
                ) : filteredLeads.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className={`h-12 w-12 mx-auto mb-4 ${
                      theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
                    }`} />
                    <h3 className={`text-lg font-medium mb-2 ${
                      theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                    }`}>
                      {searchTerm ? 'No matching leads' : 'No leads in this list'}
                    </h3>
                    <p className={`mb-4 ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {searchTerm ? 'Try adjusting your search terms' : 'Upload a CSV file to add leads to this list'}
                    </p>
                    {!searchTerm && (
                      <button
                        onClick={() => setShowUploadForm(true)}
                        className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
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
                          Email
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Phone
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Company
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Job Title
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Actions
                        </th>
                        <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          Custom Fields
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
                                  {lead.name || 'No name'}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {lead.email && lead.email !== '' && lead.email !== 'EMPTY' ? (
                              <div className={`flex items-center text-sm ${
                                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                              }`}>
                                <Mail className="h-3 w-3 mr-2" />
                                <span className="truncate max-w-48">{lead.email}</span>
                              </div>
                            ) : (
                              <span className={`text-sm ${
                                theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                              }`}>
                                No email
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {lead.phone && lead.phone !== '' && lead.phone !== 'EMPTY' ? (
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
                          <td className="px-6 py-4 whitespace-nowrap">
                            {lead.company_name ? (
                              <div className={`flex items-center text-sm ${
                                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                              }`}>
                                <Building className="h-3 w-3 mr-2" />
                                <span className="truncate max-w-32">{lead.company_name}</span>
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
                            {lead.job_title ? (
                              <div className={`flex items-center text-sm ${
                                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                              }`}>
                                <Briefcase className="h-3 w-3 mr-2" />
                                <span className="truncate max-w-32">{lead.job_title}</span>
                              </div>
                            ) : (
                              <span className={`text-sm ${
                                theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                              }`}>
                                No title
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => setEditingLead(lead)}
                                className={`p-2 rounded-lg transition-colors ${
                                  theme === 'gold'
                                    ? 'text-yellow-400 hover:bg-yellow-400/10'
                                    : 'text-blue-600 hover:bg-blue-100'
                                }`}
                                title="Edit lead"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {lead.custom_fields && Object.keys(lead.custom_fields).length > 0 ? (
                              <div className={`text-sm ${
                                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                              }`}>
                                <div className="space-y-1">
                                  {Object.entries(lead.custom_fields).slice(0, 2).map(([key, value]) => (
                                    <div key={key} className="text-xs">
                                      <span className="font-medium">{key}:</span> {String(value).substring(0, 15)}
                                      {String(value).length > 15 && '...'}
                                    </div>
                                  ))}
                                  {Object.keys(lead.custom_fields).length > 2 && (
                                    <div className={`text-xs ${
                                      theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                                    }`}>
                                      +{Object.keys(lead.custom_fields).length - 2} more
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className={`text-sm ${
                                theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                              }`}>
                                No custom fields
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Bulk Actions */}
              {selectedLeads.length > 0 && (
                <div className={`px-6 py-4 border-t ${
                  theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
                }`}>
                  <div className={`p-4 rounded-lg ${
                    theme === 'gold'
                      ? 'bg-yellow-400/10 border border-yellow-400/20'
                      : 'bg-blue-50 border border-blue-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${
                        theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
                      }`}>
                        {selectedLeads.length} leads selected
                      </span>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setSelectedLeads([])}
                          className={`text-sm ${
                            theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                          } hover:underline`}
                        >
                          Clear selection
                        </button>
                        <button
                          onClick={deleteSelectedLeads}
                          className="inline-flex items-center px-3 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete ({selectedLeads.length})
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Target className={`h-16 w-16 mx-auto mb-4 ${
                  theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
                }`} />
                <h3 className={`text-xl font-medium mb-2 ${
                  theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                }`}>
                  Select a List
                </h3>
                <p className={theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}>
                  Choose a list from the sidebar to view and manage its leads
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create List Modal */}
      {showCreateForm && (
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
                  <h2 className={`text-xl font-bold ${
                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    Create New List
                  </h2>
                  <button
                    onClick={() => setShowCreateForm(false)}
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
                <form onSubmit={handleCreateList} className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium mb-2 ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      List Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={3}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        theme === 'gold'
                          ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                          : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                      }`}
                      placeholder="Describe this list and its target audience..."
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
                      value={formData.tags}
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                      className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                        theme === 'gold'
                          ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                          : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                      }`}
                      placeholder="e.g., high-value, warm-leads, enterprise"
                    />
                    <p className={`text-xs mt-1 ${
                      theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                    }`}>
                      Separate tags with commas
                    </p>
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
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
                      disabled={creating}
                      className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        theme === 'gold'
                          ? 'gold-gradient text-black hover-gold'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      } disabled:opacity-50`}
                    >
                      {creating ? 'Creating...' : 'Create List'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Form Modal */}
      {showUploadForm && selectedList && (
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
                  <h2 className={`text-xl font-bold ${
                    theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                  }`}>
                    Upload Leads to {selectedList.name}
                  </h2>
                  <button
                    onClick={() => {
                      setShowUploadForm(false);
                      setUploadStep('select');
                      setCsvFile(null);
                      setCsvData([]);
                      setCsvHeaders([]);
                      setColumnMapping({});
                    }}
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
                {/* Step 1: File Selection */}
                {uploadStep === 'select' && (
                  <div className="space-y-4">
                    <div>
                      <label className={`block text-sm font-medium mb-2 ${
                        theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        CSV File
                      </label>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect(file);
                        }}
                        className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                          theme === 'gold'
                            ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                            : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                        }`}
                        disabled={uploadingToList}
                      />
                      <p className={`text-xs mt-1 ${
                        theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                      }`}>
                        CSV should have columns: Name, Email, Phone, Company, Job Title, and any custom fields
                      </p>
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
                        Match your CSV columns to lead fields. Unmapped columns will be stored as custom fields.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { field: 'name', label: 'Full Name', icon: Users, required: true },
                        { field: 'email', label: 'Email Address', icon: Mail, required: false },
                        { field: 'phone', label: 'Phone Number', icon: Phone, required: false },
                        { field: 'company_name', label: 'Company Name', icon: Building, required: false },
                        { field: 'job_title', label: 'Job Title', icon: Briefcase, required: false }
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
                                fieldConfig.required 
                                  ? theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                                  : theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
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
                              <div className={`mt-2 p-2 rounded text-xs ${
                                theme === 'gold' ? 'bg-black/20' : 'bg-white'
                              }`}>
                                <div className={`font-medium mb-1 ${
                                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                  Sample data:
                                </div>
                                <div className={`${
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
                        onClick={() => setUploadStep('preview')}
                        className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors ${
                          theme === 'gold'
                            ? 'gold-gradient text-black hover-gold'
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        Preview Leads
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Preview and Upload */}
                {uploadStep === 'preview' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className={`text-lg font-semibold mb-2 ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        Preview & Upload
                      </h3>
                      <p className={`text-sm ${
                        theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Review your processed leads before uploading
                      </p>
                    </div>

                    {/* Upload Stats */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className={`p-4 rounded-lg border ${
                        theme === 'gold'
                          ? 'border-yellow-400/20 bg-black/10'
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
                          ? 'border-yellow-400/20 bg-black/10'
                          : 'border-gray-200 bg-white'
                      }`}>
                        <div className={`text-2xl font-bold ${
                          theme === 'gold' ? 'text-yellow-400' : 'text-green-600'
                        }`}>
                          {processLeads().length}
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
                          : 'border-gray-200 bg-white'
                      }`}>
                        <div className={`text-2xl font-bold ${
                          theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                        }`}>
                          {csvData.length > 0 ? Math.round((processLeads().length / csvData.length) * 100) : 0}%
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
                              <th className={`text-left py-2 px-3 text-xs font-medium ${
                                theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                              }`}>
                                Custom Fields
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {processLeads().slice(0, 5).map((lead, index) => (
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
                                <td className={`py-2 px-3 text-sm ${
                                  theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                                }`}>
                                  {Object.keys(lead.custom_fields || {}).length} fields
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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
                        onClick={uploadProcessedLeads}
                        disabled={uploadingToList || processLeads().length === 0}
                        className={`px-6 py-2 text-sm font-medium rounded-lg transition-colors ${
                          theme === 'gold'
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        } disabled:opacity-50`}
                      >
                        {uploadingToList ? (
                          <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Uploading...
                          </div>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload {processLeads().length} Leads
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {uploadingToList && (
                  <div className={`p-4 rounded-lg ${
                    theme === 'gold'
                      ? 'bg-blue-500/10 border border-blue-500/20'
                      : 'bg-blue-50 border border-blue-200'
                  }`}>
                    <div className="flex items-center">
                      <div className={`animate-spin rounded-full h-4 w-4 border-2 border-transparent mr-3 ${
                        theme === 'gold'
                          ? 'border-t-yellow-400'
                          : 'border-t-blue-600'
                      }`}></div>
                      <span className={`text-sm ${
                        theme === 'gold' ? 'text-blue-400' : 'text-blue-700'
                      }`}>
                        Uploading leads to list...
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lead Edit Modal */}
      {editingLead && (
        <LeadEditModal
          lead={editingLead}
          listId={selectedList?.id || ''}
          onClose={() => setEditingLead(null)}
          onSave={() => {
            if (selectedList) {
              fetchListLeads(selectedList.id);
            }
            fetchLists();
          }}
        />
      )}
    </div>
  );
}