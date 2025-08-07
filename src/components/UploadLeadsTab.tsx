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
  MoreHorizontal,
  ArrowRight,
  ArrowLeft
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
  rawData: any[];
  detectedColumns: string[];
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

interface ColumnMapping {
  [key: string]: string; // CSV column -> database field
}

export function UploadLeadsTab({ campaignId, setError }: UploadLeadsTabProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { isLoading, error: loadingError, executeAsync } = useLoadingState();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<UploadPreview | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [currentStep, setCurrentStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  
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
    setCurrentStep('mapping');

    try {
      // Parse CSV
      const csvText = await file.text();
      const parseResult = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim()
      });

      if (parseResult.errors.length > 0) {
        throw new Error(`CSV parsing error: ${parseResult.errors[0].message}`);
      }

      // Get detected columns from CSV
      const detectedColumns = Object.keys(parseResult.data[0] || {});
      
      // Auto-detect column mappings
      const autoMapping: ColumnMapping = {};
      detectedColumns.forEach(col => {
        const lowerCol = col.toLowerCase();
        if (lowerCol.includes('name') || lowerCol.includes('full_name') || lowerCol.includes('first_name')) {
          autoMapping[col] = 'name';
        } else if (lowerCol.includes('phone') || lowerCol.includes('mobile') || lowerCol.includes('cell')) {
          autoMapping[col] = 'phone';
        } else if (lowerCol.includes('email') || lowerCol.includes('mail')) {
          autoMapping[col] = 'email';
        } else if (lowerCol.includes('company') || lowerCol.includes('organization')) {
          autoMapping[col] = 'company_name';
        } else if (lowerCol.includes('title') || lowerCol.includes('position') || lowerCol.includes('job')) {
          autoMapping[col] = 'job_title';
        }
      });

      setColumnMapping(autoMapping);
      setUploadPreview({
        validLeads: [],
        rawData: parseResult.data,
        detectedColumns,
        duplicates: [],
        stats: {
          total: parseResult.data.length,
          valid: 0,
          duplicates: 0,
          existingDuplicates: 0,
          internalDuplicates: 0
        }
      });

    } catch (error) {
      console.error('Error processing file:', error);
      setError(error instanceof Error ? error.message : 'Failed to process file');
      setCurrentStep('upload');
    } finally {
      setUploading(false);
    }
  };

  const processWithColumnMapping = async () => {
    if (!uploadPreview || !user) return;

    setUploading(true);

    try {
      // Map CSV data using selected column mappings
      const rawLeads = uploadPreview.rawData.map((row: any) => {
        const mappedLead: any = {};
        
        // Apply column mappings
        Object.entries(columnMapping).forEach(([csvColumn, dbField]) => {
          if (dbField && row[csvColumn] !== undefined && row[csvColumn] !== null) {
            const value = row[csvColumn].toString().trim();
            if (value && value !== 'null' && value !== 'undefined' && value !== 'EMPTY' && value !== '') {
              mappedLead[dbField] = value;
            }
          }
        });

        return {
          name: mappedLead.name || null,
          phone: mappedLead.phone || '', // Always empty string, never null
          email: mappedLead.email || null,
          company_name: mappedLead.company_name || null,
          job_title: mappedLead.job_title || null,
        };
      });

      // Filter out completely empty rows
      const validLeads = rawLeads.filter(lead => {
        const hasName = lead.name && lead.name !== '';
        const hasPhone = lead.phone && lead.phone !== '';
        const hasEmail = lead.email && lead.email !== '';
        
        return hasName || hasPhone || hasEmail;
      });

      // Check for duplicates against existing leads
      const { data: existingLeads, error: existingError } = await supabase
        .from('uploaded_leads')
        .select('phone, email')
        .eq('campaign_id', campaignId)
        .eq('user_id', user.id);

      if (existingError) throw existingError;

      // Simple duplicate detection
      const seenPhones = new Set(existingLeads?.map(l => l.phone).filter(Boolean) || []);
      const seenEmails = new Set(existingLeads?.map(l => l.email).filter(Boolean) || []);
      const duplicates: Array<{ lead: any; reason: string }> = [];
      const uniqueLeads: any[] = [];

      validLeads.forEach(lead => {
        let isDuplicate = false;
        const reasons: string[] = [];

        if (lead.phone && lead.phone !== '' && seenPhones.has(lead.phone)) {
          isDuplicate = true;
          reasons.push('Phone already exists');
        }
        if (lead.email && seenEmails.has(lead.email)) {
          isDuplicate = true;
          reasons.push('Email already exists');
        }

        if (isDuplicate) {
          duplicates.push({ lead, reason: reasons.join(', ') });
        } else {
          uniqueLeads.push(lead);
          if (lead.phone && lead.phone !== '') seenPhones.add(lead.phone);
          if (lead.email) seenEmails.add(lead.email);
        }
      });

      setUploadPreview({
        ...uploadPreview,
        validLeads: uniqueLeads,
        duplicates,
        stats: {
          total: rawLeads.length,
          valid: uniqueLeads.length,
          duplicates: duplicates.length,
          existingDuplicates: duplicates.filter(d => d.reason.includes('already exists')).length,
          internalDuplicates: duplicates.filter(d => !d.reason.includes('already exists')).length
        }
      });
      
      setCurrentStep('preview');

    } catch (error) {
      console.error('Error processing leads:', error);
      setError(error instanceof Error ? error.message : 'Failed to process leads');
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

      // Prepare leads for insertion with proper field handling
      const leadsToInsert = uploadPreview.validLeads.map(lead => ({
        name: lead.name || null,
        phone: lead.phone || '', // Ensure empty string for NOT NULL constraint
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
      setCurrentStep('upload');
      
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
      setSelectedLeads(prev => prev.filter(id => !currentPageLeads.map(l => l.id).includes(id)));
    } else {
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

  const resetUpload = () => {
    setUploadPreview(null);
    setColumnMapping({});
    setCurrentStep('upload');
  };

  // STEP 1: Upload File
  if (currentStep === 'upload') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              Upload Leads ({leads.length})
            </h3>
            <p className="text-gray-600 mt-1">
              Upload CSV files to add leads to your campaign
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
          </div>
        </div>

        {/* Upload Area */}
        <div className="bg-white rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-400 transition-colors">
          <label className="cursor-pointer block p-12 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
            
            <div className="space-y-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                {uploading ? (
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent"></div>
                ) : (
                  <Upload className="h-8 w-8 text-blue-600" />
                )}
              </div>
              
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                  {uploading ? 'Processing CSV file...' : 'Upload CSV File'}
                </h4>
                <p className="text-gray-600 mb-4">
                  {uploading ? 'Please wait while we process your file' : 'Drag and drop your CSV file here, or click to browse'}
                </p>
                
                {!uploading && (
                  <div className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    <FileText className="h-5 w-5 mr-2" />
                    Choose CSV File
                  </div>
                )}
              </div>
            </div>
          </label>
        </div>

        {/* CSV Format Guide */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h4 className="text-lg font-semibold mb-4 text-blue-900">
            📋 CSV Format Guide
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h5 className="font-medium text-blue-800 mb-2">Required Columns (at least one):</h5>
              <ul className="text-sm space-y-1 text-blue-700">
                <li>• <strong>Name:</strong> Full name, first_name, last_name</li>
                <li>• <strong>Phone:</strong> phone, mobile, cell_phone</li>
                <li>• <strong>Email:</strong> email, email_address</li>
              </ul>
            </div>
            <div>
              <h5 className="font-medium text-blue-800 mb-2">Optional Columns:</h5>
              <ul className="text-sm space-y-1 text-blue-700">
                <li>• <strong>Company:</strong> company, company_name, organization</li>
                <li>• <strong>Job Title:</strong> title, job_title, position</li>
              </ul>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-100 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>💡 Tip:</strong> Column names are auto-detected, but you can manually map them in the next step.
            </p>
          </div>
        </div>

        {/* Current Leads Summary */}
        {leads.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="text-lg font-semibold mb-4 text-gray-900">
              Current Leads in Campaign
            </h4>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{leads.length}</div>
                <div className="text-sm text-gray-600">Total Leads</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">
                  {leads.filter(l => l.status === 'pending').length}
                </div>
                <div className="text-sm text-gray-600">Pending</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {leads.filter(l => l.status === 'contacted').length}
                </div>
                <div className="text-sm text-gray-600">Contacted</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {leads.filter(l => l.status === 'replied').length}
                </div>
                <div className="text-sm text-gray-600">Replied</div>
              </div>
            </div>

            <button
              onClick={() => setCurrentStep('preview')}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Eye className="h-4 w-4 mr-2" />
              View All Leads
            </button>
          </div>
        )}
      </div>
    );
  }

  // STEP 2: Column Mapping
  if (currentStep === 'mapping' && uploadPreview) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              Map CSV Columns
            </h3>
            <p className="text-gray-600 mt-1">
              Match your CSV columns with lead fields
            </p>
          </div>
          <button
            onClick={resetUpload}
            className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </button>
        </div>

        {/* Progress */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 text-green-600">
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium">File Uploaded</span>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400" />
          <div className="flex items-center space-x-2 text-blue-600">
            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
              2
            </div>
            <span className="text-sm font-medium">Map Columns</span>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400" />
          <div className="flex items-center space-x-2 text-gray-400">
            <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-xs font-bold">
              3
            </div>
            <span className="text-sm font-medium">Preview & Upload</span>
          </div>
        </div>

        {/* File Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <FileText className="h-5 w-5 text-blue-600" />
            <div>
              <div className="font-medium text-blue-900">
                {uploadPreview.stats.total} rows detected
              </div>
              <div className="text-sm text-blue-700">
                {uploadPreview.detectedColumns.length} columns found: {uploadPreview.detectedColumns.join(', ')}
              </div>
            </div>
          </div>
        </div>

        {/* Column Mapping */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-lg font-semibold mb-6 text-gray-900">
            Match Your CSV Columns
          </h4>

          <div className="space-y-6">
            {[
              { field: 'name', label: 'Lead Name', required: false, description: 'Full name of the lead', icon: Users },
              { field: 'phone', label: 'Phone Number', required: true, description: 'Required for voice/SMS campaigns', icon: Phone },
              { field: 'email', label: 'Email Address', required: false, description: 'Required for email campaigns', icon: Mail },
              { field: 'company_name', label: 'Company Name', required: false, description: 'Company or organization', icon: Building },
              { field: 'job_title', label: 'Job Title', required: false, description: 'Position or role', icon: Building }
            ].map((fieldInfo) => {
              const Icon = fieldInfo.icon;
              const mappedColumn = Object.entries(columnMapping).find(([_, dbField]) => dbField === fieldInfo.field)?.[0] || '';
              
              return (
                <div key={fieldInfo.field} className="border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                    {/* Field Info */}
                    <div className="flex items-start space-x-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                        <Icon className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-gray-900">
                            {fieldInfo.label}
                          </span>
                          {fieldInfo.required && (
                            <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-800">
                              Required
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {fieldInfo.description}
                        </p>
                      </div>
                    </div>
                    
                    {/* Column Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select CSV Column
                      </label>
                      <select
                        value={mappedColumn}
                        onChange={(e) => {
                          const csvColumn = e.target.value;
                          const newMapping = { ...columnMapping };
                          
                          // Remove any existing mapping to this field
                          Object.keys(newMapping).forEach(key => {
                            if (newMapping[key] === fieldInfo.field) {
                              delete newMapping[key];
                            }
                          });
                          
                          // Add new mapping if column selected
                          if (csvColumn) {
                            newMapping[csvColumn] = fieldInfo.field;
                          }
                          
                          setColumnMapping(newMapping);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">-- Select Column --</option>
                        {uploadPreview.detectedColumns.map(col => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Sample Data Preview */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sample Data
                      </label>
                      <div className="p-3 bg-gray-50 rounded-lg border">
                        <div className="text-sm text-gray-900 font-mono">
                          {mappedColumn && uploadPreview.rawData[0] && uploadPreview.rawData[0][mappedColumn] 
                            ? uploadPreview.rawData[0][mappedColumn]
                            : 'No column selected'
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Validation Warning */}
          {Object.values(columnMapping).filter(Boolean).length === 0 && (
            <div className="mt-6 p-4 rounded-lg border border-yellow-200 bg-yellow-50">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3" />
                <div>
                  <div className="font-medium text-yellow-800">
                    Please map at least one column to continue
                  </div>
                  <div className="text-sm text-yellow-700 mt-1">
                    You need to select which CSV columns contain your lead data
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between mt-8">
            <button
              onClick={resetUpload}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Upload
            </button>
            
            <button
              onClick={processWithColumnMapping}
              disabled={uploading || Object.values(columnMapping).filter(Boolean).length === 0}
              className="inline-flex items-center px-6 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  Continue to Preview
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STEP 3: Preview & Upload
  if (currentStep === 'preview') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              {uploadPreview ? 'Upload Preview' : 'Current Leads'}
            </h3>
            <p className="text-gray-600 mt-1">
              {uploadPreview ? 'Review and confirm your lead upload' : 'Manage your campaign leads'}
            </p>
          </div>
          {uploadPreview && (
            <button
              onClick={() => setCurrentStep('mapping')}
              className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Mapping
            </button>
          )}
        </div>

        {/* Progress */}
        {uploadPreview && (
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-green-600">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">File Uploaded</span>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-400" />
            <div className="flex items-center space-x-2 text-green-600">
              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">Columns Mapped</span>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-400" />
            <div className="flex items-center space-x-2 text-blue-600">
              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                3
              </div>
              <span className="text-sm font-medium">Preview & Upload</span>
            </div>
          </div>
        )}

        {/* Upload Statistics */}
        {uploadPreview && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{uploadPreview.stats.total}</div>
              <div className="text-sm text-gray-600">Total Rows</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{uploadPreview.stats.valid}</div>
              <div className="text-sm text-gray-600">Valid & Unique</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-600">{uploadPreview.stats.duplicates}</div>
              <div className="text-sm text-gray-600">Duplicates</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{uploadPreview.stats.existingDuplicates}</div>
              <div className="text-sm text-gray-600">Already in Campaign</div>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{uploadPreview.stats.internalDuplicates}</div>
              <div className="text-sm text-gray-600">Within Upload</div>
            </div>
          </div>
        )}

        {/* Duplicates Warning */}
        {uploadPreview && uploadPreview.duplicates.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-yellow-800">
                  {uploadPreview.duplicates.length} Duplicate Leads Found
                </h4>
                <p className="text-sm text-yellow-700 mt-1">
                  These leads will be skipped during upload to avoid duplicates.
                </p>
                <button
                  onClick={downloadDuplicateReport}
                  className="inline-flex items-center px-3 py-2 mt-3 text-sm font-medium rounded-lg border border-yellow-300 text-yellow-800 hover:bg-yellow-100 transition-colors"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Duplicate Report
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sample Data Preview */}
        {uploadPreview && uploadPreview.validLeads.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="text-lg font-semibold mb-4 text-gray-900">
              Sample Valid Leads (First 5)
            </h4>
            
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Name</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Phone</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Email</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Company</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-900">Job Title</th>
                  </tr>
                </thead>
                <tbody>
                  {uploadPreview.validLeads.slice(0, 5).map((lead, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-3 px-4 text-sm text-gray-900">{lead.name || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-900">{lead.phone || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-900">{lead.email || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-900">{lead.company_name || '-'}</td>
                      <td className="py-3 px-4 text-sm text-gray-900">{lead.job_title || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Upload Actions */}
        {uploadPreview && (
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">
                  Ready to Upload
                </h4>
                <p className="text-gray-600 mt-1">
                  {uploadPreview.stats.valid} unique leads will be added to your campaign
                </p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setCurrentStep('mapping')}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Mapping
                </button>
                
                <button
                  onClick={confirmUpload}
                  disabled={uploading || uploadPreview.stats.valid === 0}
                  className="inline-flex items-center px-6 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Upload {uploadPreview.stats.valid} Leads
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Current Leads Table (when not in upload preview) */}
        {!uploadPreview && (
          <>
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
                <div className="md:col-span-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search leads..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
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
            </div>

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
                    <button
                      onClick={() => setCurrentStep('upload')}
                      className="inline-flex items-center px-6 py-3 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload First Leads
                    </button>
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
                        <div>Date Added</div>
                      </div>
                      <div className="w-10"></div>
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
                            <div>
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                getStatusColor(lead.status)
                              }`}>
                                {lead.status || 'pending'}
                              </span>
                            </div>
                            <div className="text-sm text-gray-500">
                              <div className="flex items-center">
                                <Calendar className="h-3 w-3 mr-1 text-gray-400" />
                                {new Date(lead.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
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

            {/* Add New Leads Button */}
            {!uploadPreview && (
              <div className="text-center">
                <button
                  onClick={() => setCurrentStep('upload')}
                  className="inline-flex items-center px-6 py-3 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Upload More Leads
                </button>
              </div>
            )}
          </>
        )}

        {/* Error Message */}
        {loadingError && (
          <ErrorMessage
            message={loadingError}
            onDismiss={() => {}}
          />
        )}

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

  return null;
}