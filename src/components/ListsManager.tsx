import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
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
  Clock
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
                          Custom Fields
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
                            {lead.custom_fields && Object.keys(lead.custom_fields).length > 0 ? (
                              <div className={`text-sm ${
                                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                              }`}>
                                <div className="space-y-1">
                                  {Object.entries(lead.custom_fields).slice(0, 2).map(([key, value]) => (
                                    <div key={key} className="text-xs">
                                      <span className="font-medium">{key}:</span> {String(value).substring(0, 20)}
                                      {String(value).length > 20 && '...'}
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
                )}
              </div>
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
    </div>
  );
}