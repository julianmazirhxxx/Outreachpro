import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { LoadingSpinner } from './common/LoadingSpinner';
import { ErrorMessage } from './common/ErrorMessage';
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
  MessageSquare
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
}

export function LeadsManager() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'company_name'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      const [leadsResponse, campaignsResponse] = await Promise.all([
        supabase
          .from('uploaded_leads')
          .select('*')
          .eq('user_id', user.id)
          .order(sortBy, { ascending: sortOrder === 'asc' }),
        supabase
          .from('campaigns')
          .select('id, offer, status')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
      ]);

      if (leadsResponse.error) throw leadsResponse.error;
      if (campaignsResponse.error) throw campaignsResponse.error;

      setLeads(leadsResponse.data || []);
      setCampaigns(campaignsResponse.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load leads data');
    } finally {
      setLoading(false);
    }
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch = !searchTerm || 
      (lead.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.phone?.includes(searchTerm)) ||
      (lead.company_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (lead.job_title?.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCampaign = !selectedCampaign || lead.campaign_id === selectedCampaign;
    const matchesStatus = !selectedStatus || lead.status === selectedStatus;

    return matchesSearch && matchesCampaign && matchesStatus;
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
      ['Name', 'Email', 'Phone', 'Company', 'Job Title', 'Status', 'Campaign', 'Created'],
      ...leadsToExport.map(lead => [
        lead.name || '',
        lead.email || '',
        lead.phone || '',
        lead.company_name || '',
        lead.job_title || '',
        lead.status || '',
        getCampaignName(lead.campaign_id),
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
    
    if (!confirm(`Are you sure you want to delete ${selectedLeads.length} selected leads?`)) return;

    try {
      const { error } = await supabase
        .from('uploaded_leads')
        .delete()
        .in('id', selectedLeads)
        .eq('user_id', user?.id);

      if (error) throw error;

      setSelectedLeads([]);
      fetchData();
    } catch (error) {
      console.error('Error deleting leads:', error);
      setError('Failed to delete leads');
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" message="Loading leads..." className="h-64" />;
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
              Leads Database
            </h1>
          </div>
          <p className={theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}>
            Manage and organize your leads across all campaigns
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
            onClick={() => navigate('/campaigns')}
            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              theme === 'gold'
                ? 'gold-gradient text-black hover-gold'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Leads
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className={`p-6 rounded-xl border ${
          theme === 'gold' 
            ? 'black-card gold-border' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${
              theme === 'gold' ? 'bg-blue-500/20' : 'bg-blue-100'
            }`}>
              <Users className={`h-6 w-6 ${
                theme === 'gold' ? 'text-blue-400' : 'text-blue-600'
              }`} />
            </div>
            <div className="ml-4">
              <p className={`text-2xl font-bold ${
                theme === 'gold' ? 'text-yellow-400' : 'text-gray-900'
              }`}>
                {leads.length}
              </p>
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Total Leads
              </p>
            </div>
          </div>
        </div>

        <div className={`p-6 rounded-xl border ${
          theme === 'gold' 
            ? 'black-card gold-border' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${
              theme === 'gold' ? 'bg-green-500/20' : 'bg-green-100'
            }`}>
              <CheckCircle className={`h-6 w-6 ${
                theme === 'gold' ? 'text-green-400' : 'text-green-600'
              }`} />
            </div>
            <div className="ml-4">
              <p className={`text-2xl font-bold ${
                theme === 'gold' ? 'text-yellow-400' : 'text-gray-900'
              }`}>
                {leads.filter(l => l.status === 'contacted' || l.status === 'replied').length}
              </p>
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Contacted
              </p>
            </div>
          </div>
        </div>

        <div className={`p-6 rounded-xl border ${
          theme === 'gold' 
            ? 'black-card gold-border' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${
              theme === 'gold' ? 'bg-purple-500/20' : 'bg-purple-100'
            }`}>
              <MessageSquare className={`h-6 w-6 ${
                theme === 'gold' ? 'text-purple-400' : 'text-purple-600'
              }`} />
            </div>
            <div className="ml-4">
              <p className={`text-2xl font-bold ${
                theme === 'gold' ? 'text-yellow-400' : 'text-gray-900'
              }`}>
                {leads.filter(l => l.status === 'replied').length}
              </p>
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Replied
              </p>
            </div>
          </div>
        </div>

        <div className={`p-6 rounded-xl border ${
          theme === 'gold' 
            ? 'black-card gold-border' 
            : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center">
            <div className={`p-2 rounded-lg ${
              theme === 'gold' ? 'bg-orange-500/20' : 'bg-orange-100'
            }`}>
              <Calendar className={`h-6 w-6 ${
                theme === 'gold' ? 'text-orange-400' : 'text-orange-600'
              }`} />
            </div>
            <div className="ml-4">
              <p className={`text-2xl font-bold ${
                theme === 'gold' ? 'text-yellow-400' : 'text-gray-900'
              }`}>
                {leads.filter(l => l.status === 'booked').length}
              </p>
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Booked
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className={`p-6 rounded-xl border ${
        theme === 'gold' 
          ? 'black-card gold-border' 
          : 'bg-white border-gray-200'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
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

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedCampaign}
              onChange={(e) => setSelectedCampaign(e.target.value)}
              className={`px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
                theme === 'gold'
                  ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                  : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
              } focus:border-transparent`}
            >
              <option value="">All Campaigns</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.offer || 'Untitled Campaign'}
                </option>
              ))}
            </select>

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
                fetchData();
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
      <div className={`rounded-xl border ${
        theme === 'gold' 
          ? 'black-card gold-border' 
          : 'bg-white border-gray-200'
      }`}>
        <div className={`p-4 border-b ${
          theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <h3 className={`text-lg font-semibold ${
              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
            }`}>
              Leads ({filteredLeads.length})
            </h3>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={handleSelectAll}
                className={`text-sm ${
                  theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                } hover:underline`}
              >
                {selectedLeads.length === filteredLeads.length ? 'Deselect All' : 'Select All'}
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
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredLeads.length === 0 ? (
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
                {searchTerm || selectedCampaign || selectedStatus
                  ? 'No leads match your search criteria'
                  : 'Upload leads to get started with your campaigns'}
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
                    Campaign
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Added
                  </th>
                  <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Actions
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
                          theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          {getCampaignName(lead.campaign_id)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          {new Date(lead.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => {/* View lead details */}}
                            className={`p-2 rounded-lg transition-colors ${
                              theme === 'gold'
                                ? 'text-yellow-400 hover:bg-yellow-400/10'
                                : 'text-blue-600 hover:bg-blue-100'
                            }`}
                            title="View lead details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}