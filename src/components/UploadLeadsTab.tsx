import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { useLoadingState } from '../hooks/useLoadingState';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { SecurityManager } from '../utils/security';
import { InputValidator } from '../utils/validation';
import { LoadingSpinner } from './common/LoadingSpinner';
import { 
  Upload, 
  User, 
  Phone, 
  Mail, 
  Building, 
  Briefcase, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Eye, 
  ArrowRight, 
  ArrowDown, 
  Trash2, 
  Target,
  Search,
  Filter,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Calendar,
  Clock,
  TrendingUp
} from 'lucide-react';

interface UploadedLead {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  company_name: string | null;
  job_title: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
  source_platform: string | null;
  source_url: string | null;
  booking_url: string | null;
  vapi_call_id: string | null;
  twilio_sms_status: string | null;
  retries: number | null;
}

interface UploadResult {
  success: boolean;
  message: string;
  leadsCount?: number;
  errors?: string[];
}

interface CSVPreview {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

interface ColumnMapping {
  [dbColumn: string]: string;
}

interface Campaign {
  id: string;
  offer: string | null;
}

interface FilterState {
  search: string;
  status: string;
  hasPhone: boolean | null;
  hasEmail: boolean | null;
  hasCompany: boolean | null;
  dateRange: string;
  customStartDate: string;
  customEndDate: string;
  phoneValidation: string;
}

interface PaginationState {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
}

const DATABASE_COLUMNS = [
  { key: 'name', label: 'Name', description: 'Contact\'s full name', required: false },
  { key: 'phone', label: 'Phone Number', description: 'Contact phone number', required: false },
  { key: 'email', label: 'Email Address', description: 'Contact email address', required: false },
  { key: 'company_name', label: 'Company Name', description: 'Company or organization name', required: false },
  { key: 'job_title', label: 'Job Title', description: 'Contact\'s position or role', required: false },
  { key: 'source_url', label: 'Source URL', description: 'Website or profile URL', required: false },
  { key: 'source_platform', label: 'Source Platform', description: 'Platform where contact was found', required: false },
];

interface UploadLeadsTabProps {
  campaignId: string;
}

export function UploadLeadsTab({ campaignId }: UploadLeadsTabProps) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [existingLeads, setExistingLeads] = useState<UploadedLead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<UploadedLead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignForSync, setSelectedCampaignForSync] = useState<string>('');
  const [showCampaignSelector, setShowCampaignSelector] = useState(false);
  const [pendingLeadsForSync, setPendingLeadsForSync] = useState<any[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [csvPreview, setCsvPreview] = useState<CSVPreview | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [showInvalidPhoneDialog, setShowInvalidPhoneDialog] = useState(false);
  const [invalidPhoneLeads, setInvalidPhoneLeads] = useState<any[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Filter and pagination state
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: '',
    hasPhone: null,
    hasEmail: null,
    hasCompany: null,
    dateRange: 'all',
    customStartDate: '',
    customEndDate: '',
    phoneValidation: 'all',
  });

  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    itemsPerPage: 50,
    totalItems: 0,
    totalPages: 0,
  });

  useEffect(() => {
    if (campaignId) {
      fetchExistingLeads();
      fetchCampaigns();
    }
  }, [campaignId]);

  useEffect(() => {
    applyFiltersAndPagination();
  }, [existingLeads, filters, pagination.currentPage, pagination.itemsPerPage]);

  // Phone number validation function
  const isValidPhoneNumber = (phone: string | null): boolean => {
    if (!phone || phone.trim() === '') return false;
    
    // Remove all non-digit characters except +
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    
    // Must start with + and have at least 10 digits
    if (!cleanPhone.startsWith('+')) return false;
    
    // Remove the + and check if remaining are all digits
    const digits = cleanPhone.slice(1);
    if (!/^\d+$/.test(digits)) return false;
    
    // Must have between 10-15 digits (international standard)
    return digits.length >= 10 && digits.length <= 15;
  };

  // Find leads with invalid phone numbers
  const findInvalidPhoneLeads = () => {
    return existingLeads.filter(lead => !isValidPhoneNumber(lead.phone));
  };

  const fetchCampaigns = async () => {
    if (!user) return;
    
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) return;

    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, offer')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    }
  };

  const fetchExistingLeads = async () => {
    if (!campaignId || !user) return;
    
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      setLoading(false);
      return;
    }

    try {
      setRefreshing(true);
      const { data, error } = await supabase
        .from('uploaded_leads')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setExistingLeads(data || []);
    } catch (error) {
      console.error('Error fetching existing leads:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFiltersAndPagination = () => {
    let filtered = [...existingLeads];

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(lead => 
        (lead.name?.toLowerCase().includes(searchLower)) ||
        (lead.phone?.includes(filters.search)) ||
        (lead.email?.toLowerCase().includes(searchLower)) ||
        (lead.company_name?.toLowerCase().includes(searchLower)) ||
        (lead.job_title?.toLowerCase().includes(searchLower))
      );
    }

    // Apply status filter
    if (filters.status) {
      filtered = filtered.filter(lead => lead.status === filters.status);
    }

    // Apply contact info filters
    if (filters.hasPhone !== null) {
      filtered = filtered.filter(lead => 
        filters.hasPhone ? (lead.phone && lead.phone.trim() !== '') : (!lead.phone || lead.phone.trim() === '')
      );
    }

    if (filters.hasEmail !== null) {
      filtered = filtered.filter(lead => 
        filters.hasEmail ? (lead.email && lead.email.trim() !== '') : (!lead.email || lead.email.trim() === '')
      );
    }

    if (filters.hasCompany !== null) {
      filtered = filtered.filter(lead => 
        filters.hasCompany ? (lead.company_name && lead.company_name.trim() !== '') : (!lead.company_name || lead.company_name.trim() === '')
      );
    }

    // Phone validation filter
    if (filters.phoneValidation === 'valid') {
      filtered = filtered.filter(lead => isValidPhoneNumber(lead.phone));
    } else if (filters.phoneValidation === 'invalid') {
      filtered = filtered.filter(lead => !isValidPhoneNumber(lead.phone));
    }

    // Apply date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      let startDate = new Date();

      switch (filters.dateRange) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          startDate.setDate(now.getDate() - 30);
          break;
        case 'custom':
          if (filters.customStartDate) {
            startDate = new Date(filters.customStartDate);
            const endDate = filters.customEndDate ? new Date(filters.customEndDate) : now;
            filtered = filtered.filter(lead => {
              const leadDate = new Date(lead.created_at);
              return leadDate >= startDate && leadDate <= endDate;
            });
          }
          break;
      }

      if (filters.dateRange !== 'custom') {
        filtered = filtered.filter(lead => new Date(lead.created_at) >= startDate);
      }
    }

    // Update pagination
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / pagination.itemsPerPage);
    const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
    const endIndex = startIndex + pagination.itemsPerPage;
    const paginatedLeads = filtered.slice(startIndex, endIndex);

    setFilteredLeads(paginatedLeads);
    setPagination(prev => ({
      ...prev,
      totalItems,
      totalPages,
    }));
  };

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, currentPage: 1 })); // Reset to first page when filtering
  };

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, currentPage: page }));
  };

  const handleItemsPerPageChange = (itemsPerPage: number) => {
    setPagination(prev => ({ 
      ...prev, 
      itemsPerPage, 
      currentPage: 1 
    }));
  };

  const toggleLeadSelection = (leadId: string) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId);
    } else {
      newSelected.add(leadId);
    }
    setSelectedLeads(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredLeads.map(lead => lead.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedLeads.size === 0) return;
    
    if (!confirm(`Are you sure you want to delete ${selectedLeads.size} selected leads?`)) return;
    
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      alert('Database connection not available');
      return;
    }

    setBulkActionLoading(true);
    try {
      const { error } = await supabase
        .from('uploaded_leads')
        .delete()
        .in('id', Array.from(selectedLeads));

      if (error) throw error;
      
      setSelectedLeads(new Set());
      fetchExistingLeads();
    } catch (error) {
      console.error('Error deleting leads:', error);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleFindInvalidPhones = () => {
    const invalidLeads = findInvalidPhoneLeads();
    setInvalidPhoneLeads(invalidLeads);
    setShowInvalidPhoneDialog(true);
  };

  const handleDeleteInvalidPhones = async () => {
    if (invalidPhoneLeads.length === 0) return;

    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      alert('Database connection not available');
      return;
    }

    setBulkActionLoading(true);
    try {
      const idsToDelete = invalidPhoneLeads.map(lead => lead.id);
      
      const { error } = await supabase
        .from('uploaded_leads')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      setInvalidPhoneLeads([]);
      setShowInvalidPhoneDialog(false);
      fetchExistingLeads();
    } catch (error) {
      console.error('Error deleting leads with invalid phone numbers:', error);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const parseCSVForPreview = (csvText: string): CSVPreview => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [], totalRows: 0 };

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = lines.slice(1, 6).map(line =>
      line.split(',').map(cell => cell.trim().replace(/"/g, ''))
    );

    return {
      headers,
      rows,
      totalRows: lines.length - 1
    };
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setUploadResult(null);
    setShowPreview(false);

    try {
      const csvText = await file.text();
      const preview = parseCSVForPreview(csvText);
      setCsvPreview(preview);

      // Auto-suggest column mappings
      const autoMapping: ColumnMapping = {};
      
      DATABASE_COLUMNS.forEach(dbCol => {
        const matchingHeader = preview.headers.find(header => {
          const lowerHeader = header.toLowerCase();
          const lowerDbKey = dbCol.key.toLowerCase();
          
          if (lowerHeader === lowerDbKey) return true;
          
          switch (dbCol.key) {
            case 'name':
              return lowerHeader.includes('name') || lowerHeader.includes('full_name') || lowerHeader.includes('first_name');
            case 'phone':
              return lowerHeader.includes('phone') || lowerHeader.includes('mobile') || lowerHeader.includes('number') || lowerHeader === 'tel';
            case 'email':
              return lowerHeader.includes('email') || lowerHeader.includes('mail') || lowerHeader === 'e-mail';
            case 'company_name':
              return lowerHeader.includes('company') || lowerHeader.includes('organization') || lowerHeader.includes('org');
            case 'job_title':
              return lowerHeader.includes('title') || lowerHeader.includes('position') || lowerHeader.includes('job') || lowerHeader.includes('role');
            case 'source_url':
              return lowerHeader.includes('url') || lowerHeader.includes('website') || lowerHeader.includes('link');
            case 'source_platform':
              return lowerHeader.includes('platform') || lowerHeader.includes('source') || lowerHeader.includes('site');
            default:
              return false;
          }
        });
        
        if (matchingHeader) {
          autoMapping[dbCol.key] = matchingHeader;
        }
      });

      setColumnMapping(autoMapping);
      setShowPreview(true);
    } catch (error) {
      console.error('Error parsing CSV:', error);
      setUploadResult({
        success: false,
        message: 'Error reading CSV file. Please check the file format.',
        errors: ['Make sure the file is a valid CSV with comma-separated values']
      });
    }
  };

  const handleColumnMappingChange = (dbColumn: string, csvColumn: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [dbColumn]: csvColumn === 'none' ? '' : csvColumn
    }));
  };

  const processCSVData = (csvData: any[]) => {
    const processedLeads: any[] = [];
    const invalidLeads: Array<{ row: number; errors: string[] }> = [];
    let duplicateCount = 0;
    const seenPhones = new Set<string>();
    const seenEmails = new Set<string>();

    csvData.forEach((row, index) => {
      try {
        // Validate lead data before processing
        const leadValidation = validateLeadRow(row, index + 2); // +2 for header row and 1-based indexing
        
        if (!leadValidation.isValid) {
          invalidLeads.push({
            row: index + 2,
            errors: leadValidation.errors
          });
          return; // Skip this lead
        }
        
        // Clean and normalize phone number
        const cleanPhone = leadValidation.cleanPhone;
        const normalizedPhone = cleanPhone?.startsWith('1') ? `+${cleanPhone}` : `+1${cleanPhone}`;
        
        // Check for duplicates
        if (normalizedPhone && seenPhones.has(normalizedPhone)) {
          duplicateCount++;
          return;
        }
        
        if (row.email && seenEmails.has(row.email)) {
          duplicateCount++;
          return;
        }

        if (normalizedPhone) seenPhones.add(normalizedPhone);
        if (row.email) seenEmails.add(row.email);

        processedLeads.push({
          name: leadValidation.cleanData.name,
          phone: leadValidation.cleanData.phone,
          email: leadValidation.cleanData.email,
          company_name: leadValidation.cleanData.company_name,
          job_title: leadValidation.cleanData.job_title,
          source_url: row.source_url?.toString().trim() || null,
          source_platform: row.source_platform?.toString().trim() || null,
          campaign_id: campaignId,
          user_id: user?.id,
          status: 'pending'
        });
      } catch (error) {
        console.error(`Error processing row ${index + 1}:`, error);
      }
    });

    return { processedLeads, duplicateCount, invalidLeads };
  };
  
  const validateLeadRow = (row: any, rowNumber: number) => {
    const errors: string[] = [];
    let isValid = true;
    
    // Clean the data first
    const cleanData = {
      name: row.name?.toString().trim() || null,
      phone: row.phone?.toString().trim() || null,
      email: row.email?.toString().trim() || null,
      company_name: row.company_name?.toString().trim() || null,
      job_title: row.job_title?.toString().trim() || null,
    };
    
    // Validate phone number if provided
    let cleanPhone = null;
    if (cleanData.phone) {
      const phoneValidation = InputValidator.validatePhone(cleanData.phone);
      if (!phoneValidation.isValid) {
        errors.push(`Invalid phone format: ${cleanData.phone}`);
        isValid = false;
      } else {
        // Clean phone number for processing
        cleanPhone = cleanData.phone.replace(/\D/g, '');
        if (cleanPhone.length < 10) {
          errors.push(`Phone number too short: ${cleanData.phone}`);
          isValid = false;
        }
      }
    }
    
    // Validate email if provided
    if (cleanData.email) {
      const emailValidation = InputValidator.validateEmail(cleanData.email);
      if (!emailValidation.isValid) {
        errors.push(`Invalid email format: ${cleanData.email}`);
        isValid = false;
      }
    }
    
    // At least one contact method required
    if (!cleanData.phone && !cleanData.email) {
      errors.push('Must have either valid phone or email');
      isValid = false;
    }
    
    // Validate name if provided
    if (cleanData.name && cleanData.name.length < 2) {
      errors.push(`Name too short: ${cleanData.name}`);
      isValid = false;
    }
    
    return {
      isValid,
      errors,
      cleanData,
      cleanPhone
    };
  };

  const processCSVWithMapping = (csvText: string) => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return { leads: [], errors: [] };

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const leads = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const lead: any = {};

      Object.entries(columnMapping).forEach(([dbColumn, csvColumn]) => {
        if (csvColumn) {
          const csvIndex = headers.indexOf(csvColumn);
          if (csvIndex !== -1 && values[csvIndex]) {
            lead[dbColumn] = values[csvIndex];
          }
        }
      });

      if (lead.name || lead.phone || lead.email) {
        leads.push(lead);
      } else {
        errors.push(`Row ${i + 1}: Missing required data (name, phone, or email)`);
      }
    }

    return { leads, errors };
  };

  const handleFileUpload = async (file: File) => {
    if (!file || !user || !campaignId) return;
    
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      setUploadResult({
        success: false,
        message: 'Database connection not available',
        errors: ['Please check your environment configuration']
      });
      return;
    }

    setUploadLoading(true);
    setUploadResult(null);

    try {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const { processedLeads, duplicateCount, invalidLeads } = processCSVData(results.data);
            
            if (processedLeads.length === 0) {
              if (invalidLeads.length > 0) {
                const errorSummary = invalidLeads.slice(0, 5).map(invalid => 
                  `Row ${invalid.row}: ${invalid.errors.join(', ')}`
                ).join('\n');
                
                setError(`No valid leads found. Issues found:\n${errorSummary}${
                  invalidLeads.length > 5 ? `\n... and ${invalidLeads.length - 5} more errors` : ''
                }`);
              } else {
                setError('No valid leads found in the CSV file');
              }
              return;
            }

            const { error: dbError } = await supabase
              .from('uploaded_leads')
              .insert(processedLeads);

            if (dbError) {
              throw new Error(`Database error: ${dbError.message}`);
            }

            // Also insert leads into the leads table for n8n engine
            setUploadResult({
              success: true,
              message: `Successfully uploaded ${processedLeads.length} leads${
                duplicateCount > 0 ? ` (${duplicateCount} duplicates skipped)` : ''
              }${
                invalidLeads.length > 0 ? ` (${invalidLeads.length} invalid leads skipped)` : ''
              }`,
              count: processedLeads.length
            });

            // Reset form and refresh leads
            setCsvFile(null);
            setCsvPreview(null);
            setShowPreview(false);
            setColumnMapping({});
            fetchExistingLeads();
          } catch (error) {
            console.error('Error processing CSV:', error);
            setError('Error processing CSV file. Please check the format and try again.');
          }
        },
        error: (error) => {
          console.error('CSV parsing error:', error);
          setError('Error reading CSV file. Please check the file format.');
        }
      });
    } catch (error) {
      console.error('Error uploading CSV:', error);
      setUploadResult({
        success: false,
        message: 'Failed to upload leads.',
        errors: [error instanceof Error ? error.message : 'Unknown error occurred']
      });
    } finally {
      setUploadLoading(false);
    }
  };

  const deleteLead = async (leadId: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      alert('Database connection not available');
      return;
    }

    try {
      const { error } = await supabase
        .from('uploaded_leads')
        .delete()
        .eq('id', leadId);

      if (error) throw error;
      fetchExistingLeads();
    } catch (error) {
      console.error('Error deleting lead:', error);
    }
  };

  const resetUpload = () => {
    setCsvFile(null);
    setCsvPreview(null);
    setShowPreview(false);
    setColumnMapping({});
    setUploadResult(null);
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'pending':
        return theme === 'gold' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-800';
      case 'called':
        return theme === 'gold' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-800';
      case 'contacted':
        return theme === 'gold' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-800';
      case 'booked':
        return theme === 'gold' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-800';
      case 'not_interested':
        return theme === 'gold' ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-800';
      default:
        return theme === 'gold' ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-800';
    }
  };

  const getUniqueStatuses = () => {
    const statuses = [...new Set(existingLeads.map(lead => lead.status).filter(Boolean))];
    return statuses.sort();
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: '',
      hasPhone: null,
      hasEmail: null,
      hasCompany: null,
      dateRange: 'all',
      customStartDate: '',
      customEndDate: '',
      phoneValidation: 'all',
    });
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const exportFilteredLeads = () => {
    // Get all filtered leads (not just current page)
    let allFiltered = [...existingLeads];
    
    // Apply same filters as applyFiltersAndPagination but without pagination
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      allFiltered = allFiltered.filter(lead => 
        (lead.name?.toLowerCase().includes(searchLower)) ||
        (lead.phone?.includes(filters.search)) ||
        (lead.email?.toLowerCase().includes(searchLower)) ||
        (lead.company_name?.toLowerCase().includes(searchLower)) ||
        (lead.job_title?.toLowerCase().includes(searchLower))
      );
    }

    if (filters.status) {
      allFiltered = allFiltered.filter(lead => lead.status === filters.status);
    }

    // Create CSV content
    const headers = ['Name', 'Phone', 'Email', 'Company', 'Job Title', 'Status', 'Created At'];
    const csvContent = [
      headers.join(','),
      ...allFiltered.map(lead => [
        lead.name || '',
        lead.phone || '',
        lead.email || '',
        lead.company_name || '',
        lead.job_title || '',
        lead.status || '',
        new Date(lead.created_at).toLocaleDateString()
      ].map(field => `"${field}"`).join(','))
    ].join('\n');

    // Download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Upload Result Message */}
      {uploadResult && (
        <div className={`rounded-lg border p-4 ${
          uploadResult.success 
            ? theme === 'gold'
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-green-50 border-green-200 text-green-800'
            : theme === 'gold'
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {uploadResult.success ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium">
                {uploadResult.message}
              </h3>
              {uploadResult.errors && uploadResult.errors.length > 0 && (
                <ul className="mt-1 text-sm list-disc list-inside">
                  {uploadResult.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              )}
            </div>
            <button
              onClick={() => setUploadResult(null)}
              className="flex-shrink-0 ml-3 hover:opacity-70"
            >
              <XCircle className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      {/* Upload Section */}
      {!showPreview ? (
        <div className={`text-center py-12 border-2 border-dashed rounded-lg ${
          theme === 'gold'
            ? 'border-yellow-400/30 bg-yellow-400/5'
            : 'border-gray-300 bg-gray-50'
        }`}>
          <Upload className={`h-12 w-12 mx-auto mb-4 ${
            theme === 'gold' ? 'text-yellow-400' : 'text-gray-400'
          }`} />
          <h3 className={`text-lg font-medium mb-2 ${
            theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
          }`}>
            Upload CSV File
          </h3>
          <p className={"mb-6 " + (theme === 'gold' ? 'text-gray-400' : 'text-gray-600')}>
            Upload a CSV file with your leads data. We'll help you map your columns to our database fields.
          </p>
          
          <input
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="mb-4"
          />
          
          <div className={`text-xs space-y-1 ${
            theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
          }`}>
            <p>• CSV files only with comma-separated values</p>
            <p>• First row should contain column headers</p>
            <p>• We support various column names and will help you map them</p>
          </div>
        </div>
      ) : (
        /* CSV Preview and Upload */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-lg font-semibold ${
                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
              }`}>
                CSV Preview & Column Mapping
              </h3>
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {csvPreview?.totalRows} total rows found. Map our database fields to your CSV columns.
              </p>
            </div>
            <button
              onClick={resetUpload}
              className={`text-sm transition-colors ${
                theme === 'gold' ? 'text-gray-400 hover:text-gray-300' : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Choose Different File
            </button>
          </div>

          {/* Column Mapping */}
          <div className={`rounded-lg p-6 ${
            theme === 'gold' ? 'bg-black/20 border border-yellow-400/20' : 'bg-gray-50 border border-gray-200'
          }`}>
            <h4 className={`text-sm font-medium mb-4 flex items-center ${
              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
            }`}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Column Mapping
            </h4>
            <div className="space-y-4">
              {DATABASE_COLUMNS.map((dbCol) => (
                <div key={dbCol.key} className={`rounded-lg border p-4 ${
                  theme === 'gold' ? 'bg-black/30 border-yellow-400/20' : 'bg-white border-gray-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label className={`text-sm font-medium ${
                        theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                      }`}>
                        {dbCol.label}
                      </label>
                      <p className={`text-xs mt-1 ${
                        theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                      }`}>
                        {dbCol.description}
                      </p>
                    </div>
                    <div className="w-48">
                      <select
                        value={columnMapping[dbCol.key] || ''}
                        onChange={(e) => handleColumnMappingChange(dbCol.key, e.target.value)}
                        className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                          theme === 'gold'
                            ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                            : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                        }`}
                      >
                        <option value="">Select CSV column...</option>
                        {csvPreview?.headers.map((header) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upload Actions */}
          <div className="flex justify-between items-center">
            <div className={`text-sm ${
              theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {Object.values(columnMapping).filter(Boolean).length} fields mapped
            </div>
            <div className="flex space-x-3">
              <button
                onClick={resetUpload}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'text-gray-400 bg-gray-800 hover:bg-gray-700'
                    : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => handleFileUpload(csvFile!)}
                disabled={uploadLoading || Object.values(columnMapping).filter(Boolean).length === 0}
                className={`px-6 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  theme === 'gold'
                    ? 'gold-gradient text-black hover-gold'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {uploadLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    Uploading...
                  </div>
                ) : (
                  `Upload ${csvPreview?.totalRows} Leads`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Professional Leads Table */}
      <div className={`rounded-xl shadow-sm border ${
        theme === 'gold' 
          ? 'black-card gold-border' 
          : 'bg-white border-gray-200'
      }`}>
        {/* Table Header with Stats and Actions */}
        <div className={`px-6 py-4 border-b ${
          theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
        }`}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center space-x-4">
              <h2 className={`text-lg font-semibold ${
                theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
              }`}>
                Uploaded Leads
              </h2>
              <div className="flex items-center space-x-4 text-sm">
                <span className={`px-2 py-1 rounded-full ${
                  theme === 'gold' ? 'bg-yellow-400/20 text-yellow-400' : 'bg-blue-100 text-blue-800'
                }`}>
                  {pagination.totalItems} total
                </span>
                {selectedLeads.size > 0 && (
                  <span className={`px-2 py-1 rounded-full ${
                    theme === 'gold' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-100 text-green-800'
                  }`}>
                    {selectedLeads.size} selected
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {selectedLeads.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkActionLoading}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                    theme === 'gold'
                      ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20'
                      : 'text-red-600 bg-red-50 hover:bg-red-100'
                  } disabled:opacity-50`}
                >
                  {bulkActionLoading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      Deleting...
                    </div>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete ({selectedLeads.size})
                    </>
                  )}
                </button>
              )}
              
              <button
                onClick={exportFilteredLeads}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20'
                    : 'text-blue-600 bg-blue-50 hover:bg-blue-100'
                }`}
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </button>
              
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  showFilters
                    ? theme === 'gold'
                      ? 'gold-gradient text-black'
                      : 'bg-blue-600 text-white'
                    : theme === 'gold'
                      ? 'text-gray-400 bg-gray-800 hover:bg-gray-700'
                      : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <Filter className="h-4 w-4 mr-1" />
                Filters
              </button>
              
              <button
                onClick={fetchExistingLeads}
                disabled={refreshing}
                className={`p-2 rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'text-gray-400 hover:bg-gray-800'
                    : 'text-gray-600 hover:bg-gray-100'
                } disabled:opacity-50`}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className={`px-6 py-4 border-b ${
            theme === 'gold' ? 'border-yellow-400/20 bg-yellow-400/5' : 'border-gray-200 bg-gray-50'
          }`}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Search */}
              <div>
                <label className={`block text-xs font-medium mb-1 ${
                  theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Search
                </label>
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${
                    theme === 'gold' ? 'text-gray-500' : 'text-gray-400'
                  }`} />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                    placeholder="Name, phone, email..."
                    className={`w-full pl-10 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 bg-black/50 text-gray-200 placeholder-gray-500 focus:ring-yellow-400'
                        : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                    }`}
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <label className={`block text-xs font-medium mb-1 ${
                  theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                    theme === 'gold'
                      ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                      : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                  }`}
                >
                  <option value="">All statuses</option>
                  {getUniqueStatuses().map(status => (
                    <option key={status} value={status}>
                      {status?.replace('_', ' ') || 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Contact Info Filter */}
              <div>
                <label className={`block text-xs font-medium mb-1 ${
                  theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Contact Info
                </label>
                <select
                  value={filters.hasPhone === null ? '' : filters.hasPhone ? 'has_phone' : 'no_phone'}
                  onChange={(e) => {
                    const value = e.target.value;
                    handleFilterChange('hasPhone', value === '' ? null : value === 'has_phone');
                  }}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                    theme === 'gold'
                      ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                      : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                  }`}
                >
                  <option value="">All leads</option>
                  <option value="has_phone">Has phone</option>
                  <option value="no_phone">No phone</option>
                </select>
              </div>

              {/* Phone Validation Filter */}
              <div>
                <label className={`block text-xs font-medium mb-1 ${
                  theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Phone Numbers
                </label>
                <select
                  value={filters.phoneValidation}
                  onChange={(e) => handleFilterChange('phoneValidation', e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                    theme === 'gold'
                      ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                      : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                  }`}
                >
                  <option value="all">All leads</option>
                  <option value="valid">Valid phone numbers</option>
                  <option value="invalid">Invalid phone numbers</option>
                </select>
              </div>

              {/* Date Range Filter */}
              <div>
                <label className={`block text-xs font-medium mb-1 ${
                  theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  Date Range
                </label>
                <select
                  value={filters.dateRange}
                  onChange={(e) => handleFilterChange('dateRange', e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                    theme === 'gold'
                      ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                      : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                  }`}
                >
                  <option value="all">All time</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 days</option>
                  <option value="month">Last 30 days</option>
                  <option value="custom">Custom range</option>
                </select>
              </div>
            </div>

            {/* Custom Date Range */}
            {filters.dateRange === 'custom' && (
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className={`block text-xs font-medium mb-1 ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={filters.customStartDate}
                    onChange={(e) => handleFilterChange('customStartDate', e.target.value)}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                        : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                    }`}
                  />
                </div>
                <div>
                  <label className={`block text-xs font-medium mb-1 ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    End Date
                  </label>
                  <input
                    type="date"
                    value={filters.customEndDate}
                    onChange={(e) => handleFilterChange('customEndDate', e.target.value)}
                    className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                        : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between items-center mt-4">
              <button
                onClick={clearFilters}
                className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'text-gray-400 hover:bg-gray-800'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Clear all filters
              </button>

              <div className="flex space-x-2">
                <button
                  onClick={() => setSelectedLeads(new Set())}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                    theme === 'gold'
                      ? 'text-gray-400 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                      : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                  }`}
                >
                  Clear Selection
                </button>

                <button
                  onClick={handleFindInvalidPhones}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                    theme === 'gold'
                      ? 'text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 hover:bg-yellow-400/20'
                      : 'text-orange-700 bg-orange-100 border border-orange-200 hover:bg-orange-200'
                  }`}
                >
                  Find Invalid Phones ({findInvalidPhoneLeads().length})
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Table Content */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="relative">
              <div className={`animate-spin rounded-full h-12 w-12 border-4 border-transparent ${
                theme === 'gold'
                  ? 'border-t-yellow-400 border-r-yellow-500'
                  : 'border-t-blue-600 border-r-blue-500'
              }`}></div>
            </div>
          </div>
        ) : pagination.totalItems === 0 ? (
          <div className="text-center py-16">
            <User className={`h-16 w-16 mx-auto mb-4 ${
              theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
            }`} />
            <h3 className={`text-xl font-medium mb-2 ${
              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
            }`}>
              {existingLeads.length === 0 ? 'No leads uploaded yet' : 'No leads match your filters'}
            </h3>
            <p className={`mb-6 ${
              theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {existingLeads.length === 0 
                ? 'Upload a CSV file to add leads to this campaign'
                : 'Try adjusting your filters to see more results'
              }
            </p>
            {existingLeads.length > 0 && (
              <button
                onClick={clearFilters}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'gold-gradient text-black hover-gold'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className={theme === 'gold' ? 'bg-black/30' : 'bg-gray-50'}>
                  <tr>
                    <th className="px-6 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selectedLeads.size === filteredLeads.length && filteredLeads.length > 0}
                        onChange={toggleSelectAll}
                        className={`rounded ${
                          theme === 'gold'
                            ? 'text-yellow-400 focus:ring-yellow-400 bg-black/50 border-yellow-400/30'
                            : 'text-blue-600 focus:ring-blue-500'
                        }`}
                      />
                    </th>
                    <th className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Contact
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
                      Uploaded
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
                  {filteredLeads.map((lead) => (
                    <tr key={lead.id} className={`transition-colors ${
                      theme === 'gold' ? 'hover:bg-yellow-400/5' : 'hover:bg-gray-50'
                    }`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedLeads.has(lead.id)}
                          onChange={() => toggleLeadSelection(lead.id)}
                          className={`rounded ${
                            theme === 'gold'
                              ? 'text-yellow-400 focus:ring-yellow-400 bg-black/50 border-yellow-400/30'
                              : 'text-blue-600 focus:ring-blue-500'
                          }`}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            isValidPhoneNumber(lead.phone)
                              ? theme === 'gold' ? 'bg-blue-500/20' : 'bg-blue-100'
                              : theme === 'gold' ? 'bg-red-500/20' : 'bg-red-100'
                          }`}>
                            <User className={`h-5 w-5 ${
                              isValidPhoneNumber(lead.phone)
                                ? theme === 'gold' ? 'text-blue-400' : 'text-blue-600'
                                : theme === 'gold' ? 'text-red-400' : 'text-red-600'
                            }`} />
                          </div>
                          <div className="ml-4">
                            <div className={`text-sm font-medium ${
                              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                            }`}>
                              {lead.name || 'No name'}
                            </div>
                            <div className={`text-sm space-y-1 ${
                              theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              {lead.phone && (
                                <div className={`flex items-center text-sm ${
                                  isValidPhoneNumber(lead.phone)
                                    ? theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                                    : theme === 'gold' ? 'text-red-400' : 'text-red-600'
                                }`}>
                                  <Phone className={`h-4 w-4 mr-1 ${
                                    !isValidPhoneNumber(lead.phone) ? 'animate-pulse' : ''
                                  }`} />
                                  {lead.phone}
                                  {!isValidPhoneNumber(lead.phone) && (
                                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                                      theme === 'gold'
                                        ? 'bg-red-500/20 text-red-400'
                                        : 'bg-red-100 text-red-800'
                                    }`}>
                                      Invalid
                                    </span>
                                  )}
                                </div>
                              )}
                              {lead.email && (
                                <div className="flex items-center">
                                  <Mail className="h-3 w-3 mr-1" />
                                  {lead.email}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className={`text-sm font-medium ${
                            theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                          }`}>
                            {lead.company_name || '-'}
                          </div>
                          <div className={`text-sm ${
                            theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            {lead.job_title || '-'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(lead.status)}`}>
                          {lead.status?.replace('_', ' ') || 'Pending'}
                        </span>
                        {lead.booking_url && (
                          <div className="mt-1">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${
                              theme === 'gold' ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-800'
                            }`}>
                              <Calendar className="h-3 w-3 mr-1" />
                              Booked
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm ${
                          theme === 'gold' ? 'text-gray-300' : 'text-gray-900'
                        }`}>
                          {lead.source_platform || '-'}
                        </div>
                        {lead.source_url && (
                          <a
                            href={lead.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`text-xs hover:underline ${
                              theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
                            }`}
                          >
                            View source
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm ${
                          theme === 'gold' ? 'text-gray-300' : 'text-gray-900'
                        }`}>
                          {new Date(lead.created_at).toLocaleDateString()}
                        </div>
                        <div className={`text-xs ${
                          theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                        }`}>
                          {new Date(lead.created_at).toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => deleteLead(lead.id)}
                            className={`p-2 rounded-lg transition-colors ${
                              theme === 'gold'
                                ? 'text-red-400 hover:bg-red-500/10'
                                : 'text-red-600 hover:bg-red-50'
                            }`}
                            title="Delete lead"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className={`px-6 py-4 border-t ${
              theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* Items per page */}
                <div className="flex items-center space-x-2">
                  <span className={`text-sm ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Show
                  </span>
                  <select
                    value={pagination.itemsPerPage}
                    onChange={(e) => handleItemsPerPageChange(parseInt(e.target.value))}
                    className={`px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 ${
                      theme === 'gold'
                        ? 'border-yellow-400/30 bg-black/50 text-gray-200 focus:ring-yellow-400'
                        : 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500'
                    }`}
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className={`text-sm ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    of {pagination.totalItems} leads
                  </span>
                </div>

                {/* Pagination info and controls */}
                <div className="flex items-center space-x-4">
                  <span className={`text-sm ${
                    theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    Page {pagination.currentPage} of {pagination.totalPages}
                  </span>
                  
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => handlePageChange(pagination.currentPage - 1)}
                      disabled={pagination.currentPage === 1}
                      className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        theme === 'gold'
                          ? 'text-gray-400 hover:bg-gray-800'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    
                    {/* Page numbers */}
                    {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                      let pageNum;
                      if (pagination.totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (pagination.currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.currentPage >= pagination.totalPages - 2) {
                        pageNum = pagination.totalPages - 4 + i;
                      } else {
                        pageNum = pagination.currentPage - 2 + i;
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => handlePageChange(pageNum)}
                          className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                            pagination.currentPage === pageNum
                              ? theme === 'gold'
                                ? 'gold-gradient text-black'
                                : 'bg-blue-600 text-white'
                              : theme === 'gold'
                                ? 'text-gray-400 hover:bg-gray-800'
                                : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    
                    <button
                      onClick={() => handlePageChange(pagination.currentPage + 1)}
                      disabled={pagination.currentPage === pagination.totalPages}
                      className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
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
            </div>
          </>
        )}
      </div>

      {/* Invalid Phone Numbers Dialog */}
      {showInvalidPhoneDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={`rounded-lg p-6 max-w-md w-full mx-4 ${
            theme === 'gold' ? 'black-card gold-border' : 'bg-white border border-gray-200'
          }`}>
            <h3 className={`text-lg font-semibold mb-4 ${
              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
            }`}>
              Invalid Phone Numbers Found
            </h3>
            <p className={`mb-6 ${
              theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Found {invalidPhoneLeads.length} leads with invalid phone numbers. These leads cannot be contacted via phone or SMS. Would you like to delete them?
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowInvalidPhoneDialog(false)}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  theme === 'gold'
                    ? 'text-gray-400 bg-gray-800 hover:bg-gray-700'
                    : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
                }`}
              >
                Keep Them
              </button>
              <button
                onClick={handleDeleteInvalidPhones}
                disabled={bulkActionLoading}
                className={`px-4 py-2 rounded-lg transition-colors disabled:opacity-50 ${
                  theme === 'gold'
                    ? 'text-red-400 bg-red-500/10 hover:bg-red-500/20'
                    : 'text-red-600 bg-red-50 hover:bg-red-100'
                }`}
              >
                {bulkActionLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    Deleting...
                  </div>
                ) : (
                  `Delete ${invalidPhoneLeads.length} Invalid Leads`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}