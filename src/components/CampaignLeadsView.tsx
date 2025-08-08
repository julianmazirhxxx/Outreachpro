import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { LoadingSpinner } from './common/LoadingSpinner';
import { ErrorMessage } from './common/ErrorMessage';
import { 
  Users, 
  Search, 
  Phone, 
  Mail, 
  Building, 
  Briefcase,
  Eye,
  Trash2,
  Download,
  CheckCircle,
  XCircle,
  Clock,
  MessageSquare,
  Calendar
} from 'lucide-react';

interface CampaignLead {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  company_name: string | null;
  job_title: string | null;
  status: string | null;
  created_at: string;
  source_platform: string | null;
}

interface CampaignLeadsViewProps {
  campaignId: string;
}

export function CampaignLeadsView({ campaignId }: CampaignLeadsViewProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [leads, setLeads] = useState<CampaignLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const leadsPerPage = 100;

  useEffect(() => {
    if (campaignId && user) {
      fetchLeads();
    }
  }, [campaignId, user, currentPage, searchTerm, selectedStatus]);

  const fetchLeads = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Build query
      let query = supabase
        .from('uploaded_leads')
        .select('*', { count: 'exact' })
        .eq('campaign_id', campaignId)
        .eq('user_id', user.id);

      // Apply filters
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,company_name.ilike.%${searchTerm}%`);
      }

      if (selectedStatus) {
        query = query.eq('status', selectedStatus);
      }

      // Apply pagination
      const from = (currentPage - 1) * leadsPerPage;
      const to = from + leadsPerPage - 1;
      
      const { data, error, count } = await query
        .range(from, to)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setLeads(data || []);
      setTotalLeads(count || 0);
    } catch (error) {
      console.error('Error fetching campaign leads:', error);
      setError('Failed to load campaign leads');
    } finally {
      setLoading(false);
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

  const exportLeads = () => {
    const leadsToExport = selectedLeads.length > 0 
      ? leads.filter(lead => selectedLeads.includes(lead.id))
      : leads;

    const csvContent = [
      ['Name', 'Email', 'Phone', 'Company', 'Job Title', 'Status', 'Source', 'Created'],
      ...leadsToExport.map(lead => [
        lead.name || '',
        lead.email || '',
        lead.phone || '',
        lead.company_name || '',
        lead.job_title || '',
        lead.status || '',
        lead.source_platform || 'Manual',
        new Date(lead.created_at).toLocaleDateString()
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campaign_leads_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const deleteSelectedLeads = async () => {
    if (selectedLeads.length === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedLeads.length} selected leads?`)) return;

    try {
      const { error } = await supabase
        .from('uploaded_leads')
        .delete()
        .in('id', selectedLeads)
        .eq('user_id', user.id);

      if (error) throw error;

      setSelectedLeads([]);
      fetchLeads();
    } catch (error) {
      console.error('Error deleting leads:', error);
      setError('Failed to delete leads');
    }
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

  const totalPages = Math.ceil(totalLeads / leadsPerPage);

  if (loading) {
    return <LoadingSpinner size="lg" message="Loading campaign leads..." className="h-64" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-lg font-semibold ${
            theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
          }`}>
            Campaign Leads ({totalLeads})
          </h3>
          <p className={`text-sm ${
            theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            View and manage leads in this campaign
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <ErrorMessage
          message={error}
          onDismiss={() => setError('')}
        />
      )}

      {/* Filters and Search */}
      <div className={`p-4 rounded-lg border ${
        theme === 'gold'
          ? 'border-yellow-400/20 bg-black/10'
          : 'border-gray-200 bg-gray-50'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Search */}
          <div className="flex-1 max-w-md">
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

          {/* Status Filter */}
          <div className="flex items-center space-x-3">
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

            {selectedLeads.length > 0 && (
              <div className="flex items-center space-x-2">
                <button
                  onClick={exportLeads}
                  className={`inline-flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                    theme === 'gold'
                      ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export ({selectedLeads.length})
                </button>
                <button
                  onClick={deleteSelectedLeads}
                  className="inline-flex items-center px-3 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete ({selectedLeads.length})
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className={`rounded-xl border ${
        theme === 'gold' 
          ? 'black-card gold-border' 
          : 'bg-white border-gray-200'
      }`}>
        {leads.length === 0 ? (
          <div className="text-center py-12">
            <Users className={`h-12 w-12 mx-auto mb-4 ${
              theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
            }`} />
            <h3 className={`text-lg font-medium mb-2 ${
              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
            }`}>
              No leads in this campaign
            </h3>
            <p className={`mb-6 ${
              theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {searchTerm || selectedStatus
                ? 'No leads match your search criteria'
                : 'Upload leads to this campaign to get started'}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
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
                        checked={selectedLeads.length === leads.length && leads.length > 0}
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
                  {leads.map((lead) => {
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
                            {lead.email && lead.email !== '' && lead.email !== 'EMPTY' ? (
                              <div className={`flex items-center text-sm ${
                                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                              }`}>
                                <Mail className="h-3 w-3 mr-2" />
                                {lead.email}
                              </div>
                            ) : null}
                            {lead.phone && lead.phone !== '' && lead.phone !== 'EMPTY' ? (
                              <div className={`flex items-center text-sm ${
                                theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                              }`}>
                                <Phone className="h-3 w-3 mr-2" />
                                {lead.phone}
                              </div>
                            ) : null}
                            {(!lead.email || lead.email === '' || lead.email === 'EMPTY') && 
                             (!lead.phone || lead.phone === '' || lead.phone === 'EMPTY') && (
                              <span className={`text-sm ${
                                theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                              }`}>
                                No contact info
                              </span>
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
                            theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                          }`}>
                            {lead.source_platform || 'Manual'}
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
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className={`px-6 py-4 border-t ${
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
                      className={`px-3 py-2 text-sm rounded-lg transition-colors disabled:opacity-50 ${
                        theme === 'gold'
                          ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
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
                      className={`px-3 py-2 text-sm rounded-lg transition-colors disabled:opacity-50 ${
                        theme === 'gold'
                          ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                          : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}

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
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}