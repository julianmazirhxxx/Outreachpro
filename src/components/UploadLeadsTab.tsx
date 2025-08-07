import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLoadingState } from '../hooks/useLoadingState';
import { ErrorMessage } from './common/ErrorMessage';
import { ConfirmDialog } from './common/ConfirmDialog';
import { supabase } from '../lib/supabase';
import { SecurityManager } from '../utils/security';
import { InputValidator } from '../utils/validation';
import Papa from 'papaparse';
import { 
  Upload, 
  FileText, 
  Download, 
  Users, 
  CheckCircle, 
  AlertTriangle,
  UserX,
  Filter,
  Eye,
  Trash2,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Target,
  Plus,
  X,
  Mail,
  Phone,
  Building,
  Calendar,
  MoreHorizontal
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
}

interface UploadLeadsTabProps {
  campaignId: string;
  setError: (error: string) => void;
}

interface UploadPreview {
  validLeads: any[];
  duplicates: Array<{
    lead: any;
    reason: string;
  }>;
  stats: {
    total: number;
    valid: number;
    duplicates: number;
    existingDuplicates: number;
    internalDuplicates: number;
  };
}

export function UploadLeadsTab({ campaignId, setError }: UploadLeadsTabProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { isLoading, error: loadingError, executeAsync } = useLoadingState();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<UploadPreview | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  
  // Pagination and filtering state
  const [currentPage, setCurrentPage] = useState(1);
  const [leadsPerPage, setLeadsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'created_at' | 'status'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Delete functionality
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingLeads, setDeletingLeads] = useState(false);

  useEffect(() => {
    if (campaignId) {
      fetchLeads();
    }
  }, [campaignId]);

  useEffect(() => {
    // Apply filters and search
    let filtered = [...leads];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(lead => 
        (lead.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (lead.phone?.includes(searchTerm)) ||
        (lead.email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (lead.company_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (lead.job_title?.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter(lead => lead.status === statusFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let aValue = a[sortBy] || '';
      let bValue = b[sortBy] || '';
      
      if (sortBy === 'created_at') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      } else {
        aValue = aValue.toString().toLowerCase();
        bValue = bValue.toString().toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredLeads(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [leads, searchTerm, statusFilter, sortBy, sortOrder]);

  const fetchLeads = async () => {
    if (!user) return;

    await executeAsync(async () => {
      const { data, error } = await supabase
        .from('uploaded_leads')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    }, { errorMessage: 'Failed to load leads' });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    const fileValidation = SecurityManager.validateFileUpload(file, {
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: ['text/csv', 'application/csv', 'text/plain'],
      allowedExtensions: ['.csv']
    });

    if (!fileValidation.isValid) {
      setError(fileValidation.errors[0]);
      return;
    }

    setUploading(true);
    setUploadPreview(null);
    setShowPreview(false);

    try {
      // Parse CSV
      const csvText = await file.text();
      const parseResult = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.toLowerCase().trim()
      });

      if (parseResult.errors.length > 0) {
        throw new Error(`CSV parsing error: ${parseResult.errors[0].message}`);
      }

      // Map CSV data to lead format
      const rawLeads = parseResult.data.map((row: any) => ({
        name: (row.name || row.full_name || row.first_name || '').toString().trim() || null,
        phone: (row.phone || row.phone_number || row.mobile || '').toString().trim() || null,
        email: (row.email || row.email_address || '').toString().trim() || null,
        company_name: (row.company || row.company_name || row.organization || '').toString().trim() || null,
        job_title: (row.title || row.job_title || row.position || '').toString().trim() || null,
      }));

      // Filter out completely empty rows and validate
      const validLeads = rawLeads.filter(lead => {
        // Must have at least name OR phone OR email
        const hasName = lead.name && lead.name !== 'null' && lead.name !== '';
        const hasPhone = lead.phone && lead.phone !== 'null' && lead.phone !== '' && lead.phone !== 'EMPTY';
        const hasEmail = lead.email && lead.email !== 'null' && lead.email !== '' && lead.email !== 'EMPTY';
        
        return hasName || hasPhone || hasEmail;
      });

      // Simple duplicate detection within the upload
      const seenPhones = new Set();
      const seenEmails = new Set();
      const duplicates: Array<{ lead: any; reason: string }> = [];
      const uniqueLeads: any[] = [];

      validLeads.forEach(lead => {
        let isDuplicate = false;
        const reasons: string[] = [];

        if (lead.phone && seenPhones.has(lead.phone)) {
          isDuplicate = true;
          reasons.push('Duplicate phone in upload');
        }
        if (lead.email && seenEmails.has(lead.email)) {
          isDuplicate = true;
          reasons.push('Duplicate email in upload');
        }

        if (isDuplicate) {
          duplicates.push({ lead, reason: reasons.join(', ') });
        } else {
          uniqueLeads.push(lead);
          if (lead.phone) seenPhones.add(lead.phone);
          if (lead.email) seenEmails.add(lead.email);
        }
      });

      const validation = {
        validLeads: uniqueLeads,
        duplicates,
        stats: {
          total: rawLeads.length,
          valid: uniqueLeads.length,
          duplicates: duplicates.length,
          existingDuplicates: 0,
          internalDuplicates: duplicates.length
        }
      };

      setUploadPreview(validation);
      setShowPreview(true);

    } catch (error) {
      console.error('Error processing file:', error);
      setError(error instanceof Error ? error.message : 'Failed to process file');
    } finally {
      setUploading(false);
    }
  };

  const confirmUpload = async () => {
    if (!uploadPreview || !user) return;

    setUploading(true);

    await executeAsync(async () => {
      if (uploadPreview.validLeads.length === 0) {
        throw new Error('No valid leads to upload');
      }

      // Ensure all leads have required fields and proper structure
      const leadsToInsert = uploadPreview.validLeads.map(lead => ({
        name: lead.name || null,
        phone: lead.phone || null,
        email: lead.email || null,
        company_name: lead.company_name || null,
        job_title: lead.job_title || null,
        campaign_id: campaignId,
        user_id: user.id,
        status: 'pending',
        source_platform: 'csv_upload',
        retries: 0
      }));

      // Upload valid leads in batches
      const batchSize = 100;
      let totalUploaded = 0;

      for (let i = 0; i < leadsToInsert.length; i += batchSize) {
        const batch = leadsToInsert.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from('uploaded_leads')
          .insert(batch);

        if (error) throw error;
        totalUploaded += batch.length;
      }

      // Reset upload state
      setUploadPreview(null);
      setShowPreview(false);
      
      // Refresh leads list
      fetchLeads();

      return totalUploaded;
    }, {
      successMessage: `Successfully uploaded ${uploadPreview.validLeads.length} leads to your campaign!`,
      errorMessage: 'Failed to upload leads'
    });

    setUploading(false);
  };

  const downloadDuplicateReport = () => {
    if (!uploadPreview || uploadPreview.duplicates.length === 0) return;
    
    // Simple CSV download
    const csvContent = [
      ['Name', 'Phone', 'Email', 'Company', 'Job Title', 'Reason'],
      ...uploadPreview.duplicates.map(dup => [
        dup.lead.name || '',
        dup.lead.phone || '',
        dup.lead.email || '',
        dup.lead.company_name || '',
        dup.lead.job_title || '',
        dup.reason
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `duplicate_leads_${new Date().toISOString().split('T')[0]}.csv`;
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
    const currentPageLeads = getCurrentPageLeads();
    const allSelected = currentPageLeads.every(lead => selectedLeads.includes(lead.id));
    
    if (allSelected) {
      // Deselect all on current page
      setSelectedLeads(prev => prev.filter(id => !currentPageLeads.map(l => l.id).includes(id)));
    } else {
      // Select all on current page
      setSelectedLeads(prev => [...new Set([...prev, ...currentPageLeads.map(l => l.id)])]);
    }
  };

  const deleteSelectedLeads = async () => {
    if (!user || selectedLeads.length === 0) return;

    setDeletingLeads(true);

    await executeAsync(async () => {
      const { error } = await supabase
        .from('uploaded_leads')
        .delete()
        .in('id', selectedLeads)
        .eq('user_id', user.id);

      if (error) throw error;

      setSelectedLeads([]);
      setShowDeleteDialog(false);
      fetchLeads();
    }, {
      successMessage: `Successfully deleted ${selectedLeads.length} leads`,
      errorMessage: 'Failed to delete leads'
    });

    setDeletingLeads(false);
  };

  const deleteSingleLead = async (leadId: string) => {
    if (!user || !confirm('Are you sure you want to delete this lead?')) return;

    await executeAsync(async () => {
      const { error } = await supabase
        .from('uploaded_leads')
        .delete()
        .eq('id', leadId)
        .eq('user_id', user.id);

      if (error) throw error;

      fetchLeads();
    }, {
      successMessage: 'Lead deleted successfully',
      errorMessage: 'Failed to delete lead'
    });
  };

  // Pagination calculations
  const totalPages = Math.ceil(filteredLeads.length / leadsPerPage);
  const startIndex = (currentPage - 1) * leadsPerPage;
  const endIndex = startIndex + leadsPerPage;
  
  const getCurrentPageLeads = () => {
    return filteredLeads.slice(startIndex, endIndex);
  };

  const getStatusOptions = () => {
    const statuses = [...new Set(leads.map(lead => lead.status).filter(Boolean))];
    return statuses;
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'contacted':
        return 'bg-blue-100 text-blue-800';
      case 'replied':
        return 'bg-green-100 text-green-800';
      case 'booked':
        return 'bg-purple-100 text-purple-800';
      case 'not_interested':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Current Leads ({filteredLeads.length})
          </h3>
          <p className="text-sm text-gray-600">
            Upload and manage leads for this campaign
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Link
            to="/targeting"
            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border border-blue-600 text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <Target className="h-4 w-4 mr-2" />
            Find New Leads
          </Link>
          <label className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer">
            <Upload className="h-4 w-4 mr-2" />
            Upload Leads
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedLeads.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-sm font-medium text-blue-700">
                {selectedLeads.length} lead{selectedLeads.length !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={() => setSelectedLeads([])}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear selection
              </button>
            </div>
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search leads by name, phone, email, company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              {getStatusOptions().map(status => (
                <option key={status} value={status}>
                  {status?.charAt(0).toUpperCase() + status?.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Leads Per Page */}
          <div>
            <select
              value={leadsPerPage}
              onChange={(e) => setLeadsPerPage(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={10}>10 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>
        </div>

        {/* Sort Options */}
        <div className="flex items-center space-x-4 mt-4">
          <span className="text-sm font-medium text-gray-700">Sort by:</span>
          <div className="flex items-center space-x-2">
            {[
              { key: 'created_at', label: 'Date Added' },
              { key: 'name', label: 'Name' },
              { key: 'status', label: 'Status' }
            ].map(option => (
              <button
                key={option.key}
                onClick={() => {
                  if (sortBy === option.key) {
                    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortBy(option.key as any);
                    setSortOrder('desc');
                  }
                }}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  sortBy === option.key
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {option.label}
                {sortBy === option.key && (
                  <span className="ml-1">
                    {sortOrder === 'asc' ? '↑' : '↓'}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Upload Preview */}
      {showPreview && uploadPreview && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-900">
              Upload Preview
            </h4>
            <div className="flex items-center space-x-2">
              {uploadPreview.duplicates.length > 0 && (
                <button
                  onClick={() => setShowDuplicates(!showDuplicates)}
                  className="inline-flex items-center px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {showDuplicates ? 'Hide' : 'View'} Duplicates
                </button>
              )}
              {uploadPreview.duplicates.length > 0 && (
                <button
                  onClick={downloadDuplicateReport}
                  className="inline-flex items-center px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Duplicates
                </button>
              )}
            </div>
          </div>

          {/* Upload Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="p-4 rounded-lg bg-blue-50">
              <div className="text-lg font-bold text-blue-600">
                {uploadPreview.stats.total}
              </div>
              <div className="text-sm text-blue-700">
                Total Rows
              </div>
            </div>

            <div className="p-4 rounded-lg bg-green-50">
              <div className="text-lg font-bold text-green-600">
                {uploadPreview.stats.valid}
              </div>
              <div className="text-sm text-green-700">
                Valid & Unique
              </div>
            </div>

            <div className="p-4 rounded-lg bg-red-50">
              <div className="text-lg font-bold text-red-600">
                {uploadPreview.stats.duplicates}
              </div>
              <div className="text-sm text-red-700">
                Total Duplicates
              </div>
            </div>

            <div className="p-4 rounded-lg bg-orange-50">
              <div className="text-lg font-bold text-orange-600">
                {uploadPreview.stats.existingDuplicates}
              </div>
              <div className="text-sm text-orange-700">
                Already in Campaign
              </div>
            </div>

            <div className="p-4 rounded-lg bg-purple-50">
              <div className="text-lg font-bold text-purple-600">
                {uploadPreview.stats.internalDuplicates}
              </div>
              <div className="text-sm text-purple-700">
                Within Upload
              </div>
            </div>
          </div>

          {/* Duplicate Details */}
          {showDuplicates && uploadPreview.duplicates.length > 0 && (
            <div className="mb-6 p-4 rounded-lg border border-red-200 bg-red-50">
              <h5 className="text-sm font-medium mb-3 text-red-700">
                Duplicate Leads (First 10)
              </h5>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {uploadPreview.duplicates.slice(0, 10).map((duplicate, index) => (
                  <div
                    key={index}
                    className="p-3 rounded-lg bg-white"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {duplicate.lead.name || 'No name'}
                        </div>
                        <div className="text-xs text-gray-600">
                          {duplicate.lead.phone} • {duplicate.lead.email}
                        </div>
                      </div>
                      <div className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800">
                        {duplicate.reason}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {uploadPreview.duplicates.length > 10 && (
                <p className="text-xs mt-2 text-gray-500">
                  Showing 10 of {uploadPreview.duplicates.length} duplicates. Export full list for complete analysis.
                </p>
              )}
            </div>
          )}

          {/* Upload Actions */}
          <div className="flex space-x-3">
            <button
              onClick={() => {
                setShowPreview(false);
                setUploadPreview(null);
              }}
              className="flex-1 px-4 py-2 text-sm rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            
            <button
              onClick={confirmUpload}
              disabled={uploading || uploadPreview.stats.valid === 0}
              className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Uploading...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Upload {uploadPreview.stats.valid} Unique Leads
                </div>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Duplicate Removal Result */}

      {/* Error Message */}
      {loadingError && (
        <ErrorMessage
          message={loadingError}
          onDismiss={() => {}}
        />
      )}

      {/* Leads Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {filteredLeads.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-medium mb-2 text-gray-900">
              {searchTerm || statusFilter ? 'No leads match your filters' : 'No leads uploaded yet'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || statusFilter 
                ? 'Try adjusting your search or filter criteria'
                : 'Upload a CSV file with your leads to get started'
              }
            </p>
            {!searchTerm && !statusFilter && (
              <label className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                Upload First Leads
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            )}
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
              <div className="flex items-center">
                <div className="flex items-center mr-4">
                  <input
                    type="checkbox"
                    checked={getCurrentPageLeads().length > 0 && getCurrentPageLeads().every(lead => selectedLeads.includes(lead.id))}
                    onChange={handleSelectAll}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>
                <div className="grid grid-cols-6 gap-4 flex-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <div>Name</div>
                  <div>Phone</div>
                  <div>Email</div>
                  <div>Company</div>
                  <div>Status</div>
                  <div>Uploaded</div>
                </div>
                <div className="w-10"></div> {/* Space for actions */}
              </div>
            </div>

            {/* Table Body */}
            <div className="divide-y divide-gray-200">
              {getCurrentPageLeads().map((lead) => (
                <div key={lead.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center">
                    <div className="flex items-center mr-4">
                      <input
                        type="checkbox"
                        checked={selectedLeads.includes(lead.id)}
                        onChange={() => handleSelectLead(lead.id)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    </div>
                    <div className="grid grid-cols-6 gap-4 flex-1">
                      {/* Name */}
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                          <Users className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {lead.name || 'No name'}
                          </div>
                          {lead.job_title && (
                            <div className="text-xs text-gray-500">
                              {lead.job_title}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Phone */}
                      <div className="text-sm text-gray-900">
                        {lead.phone ? (
                          <div className="flex items-center">
                            <Phone className="h-3 w-3 mr-1 text-gray-400" />
                            {lead.phone}
                          </div>
                        ) : (
                          <span className="text-gray-400">No phone</span>
                        )}
                      </div>

                      {/* Email */}
                      <div className="text-sm text-gray-900">
                        {lead.email ? (
                          <div className="flex items-center">
                            <Mail className="h-3 w-3 mr-1 text-gray-400" />
                            <span className="truncate">{lead.email}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">No email</span>
                        )}
                      </div>

                      {/* Company */}
                      <div className="text-sm text-gray-900">
                        {lead.company_name ? (
                          <div className="flex items-center">
                            <Building className="h-3 w-3 mr-1 text-gray-400" />
                            <span className="truncate">{lead.company_name}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">No company</span>
                        )}
                      </div>

                      {/* Status */}
                      <div>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          getStatusColor(lead.status)
                        }`}>
                          {lead.status || 'pending'}
                        </span>
                      </div>

                      {/* Uploaded Date */}
                      <div className="text-sm text-gray-500">
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1 text-gray-400" />
                          {new Date(lead.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="w-10 flex justify-end">
                      <button
                        onClick={() => deleteSingleLead(lead.id)}
                        className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete lead"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing {startIndex + 1} to {Math.min(endIndex, filteredLeads.length)} of {filteredLeads.length} leads
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                              currentPage === pageNum
                                ? 'bg-blue-600 text-white'
                                : 'text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                    </div>
                    
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

      {/* CSV Format Guide */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium mb-2 text-blue-700">
          📋 CSV Format Requirements
        </h4>
        <div className="text-sm space-y-1 text-blue-600">
          <p><strong>Required columns:</strong> name, phone, email (at least one contact method)</p>
          <p><strong>Optional columns:</strong> company, company_name, job_title, title, position</p>
          <p><strong>Duplicate detection:</strong> Matches on phone number and/or email address</p>
          <p><strong>Phone format:</strong> Any format accepted (+1234567890, (123) 456-7890, etc.)</p>
          <p><strong>Email format:</strong> Standard email validation applied</p>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Delete Selected Leads"
        message={`Are you sure you want to delete ${selectedLeads.length} selected lead${selectedLeads.length !== 1 ? 's' : ''}? This action cannot be undone.`}
        confirmText="Delete Leads"
        cancelText="Cancel"
        type="danger"
        onConfirm={deleteSelectedLeads}
        onCancel={() => setShowDeleteDialog(false)}
        loading={deletingLeads}
      />
    </div>
  );
}