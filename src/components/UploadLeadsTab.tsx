import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLoadingState } from '../hooks/useLoadingState';
import { ErrorMessage } from './common/ErrorMessage';
import { supabase } from '../lib/supabase';
import { SecurityManager } from '../utils/security';
import { InputValidator } from '../utils/validation';
import { LeadDeduplicationManager, DeduplicationUtils } from '../utils/leadDeduplication';
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
  Trash2
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
  const [uploading, setUploading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<UploadPreview | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [removingDuplicates, setRemovingDuplicates] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<string | null>(null);

  useEffect(() => {
    if (campaignId) {
      fetchLeads();
    }
  }, [campaignId]);

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
        name: row.name || row.full_name || row.first_name || null,
        phone: row.phone || row.phone_number || row.mobile || null,
        email: row.email || row.email_address || null,
        company_name: row.company || row.company_name || row.organization || null,
        job_title: row.title || row.job_title || row.position || null,
        campaign_id: campaignId,
        user_id: user?.id,
      }));

      // Validate and deduplicate leads
      const validation = await LeadDeduplicationManager.validateLeadsForUpload(
        rawLeads,
        campaignId,
        user?.id || '',
        supabase
      );

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

      // Upload valid leads in batches
      const batchSize = 100;
      let totalUploaded = 0;

      for (let i = 0; i < uploadPreview.validLeads.length; i += batchSize) {
        const batch = uploadPreview.validLeads.slice(i, i + batchSize);
        
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
      successMessage: `Successfully uploaded ${uploadPreview.validLeads.length} unique leads!`,
      errorMessage: 'Failed to upload leads'
    });

    setUploading(false);
  };

  const removeCampaignDuplicates = async () => {
    if (!user) return;

    setRemovingDuplicates(true);
    setDuplicateResult(null);

    try {
      const result = await LeadDeduplicationManager.removeDuplicatesFromCampaign(
        campaignId,
        user.id,
        supabase
      );

      if (result.success) {
        setDuplicateResult(`Successfully removed ${result.removedCount} duplicate leads from this campaign.`);
        fetchLeads(); // Refresh the leads list
      } else {
        setDuplicateResult(result.error || 'Failed to remove duplicates');
      }

    } catch (error) {
      console.error('Error removing duplicates:', error);
      setDuplicateResult('Error occurred during duplicate removal. Please try again.');
    } finally {
      setRemovingDuplicates(false);
    }
  };

  const downloadDuplicateReport = () => {
    if (!uploadPreview || uploadPreview.duplicates.length === 0) return;
    
    DeduplicationUtils.downloadDuplicateReport(
      uploadPreview.duplicates,
      'upload_preview'
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-lg font-semibold ${
            theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
          }`}>
            Campaign Leads ({leads.length})
          </h3>
          <p className={`text-sm ${
            theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Upload and manage leads for this campaign
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={removeCampaignDuplicates}
            disabled={removingDuplicates || leads.length === 0}
            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              theme === 'gold'
                ? 'bg-purple-600 text-white hover:bg-purple-700'
                : 'bg-purple-600 text-white hover:bg-purple-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {removingDuplicates ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Filter className="h-4 w-4 mr-2" />
            )}
            {removingDuplicates ? 'Removing...' : 'Remove Duplicates'}
          </button>
        </div>
      </div>

      {/* Duplicate Removal Result */}
      {duplicateResult && (
        <div className={`rounded-lg border p-4 ${
          duplicateResult.includes('Successfully')
            ? theme === 'gold'
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-green-50 border-green-200 text-green-800'
            : theme === 'gold'
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {duplicateResult.includes('Successfully') ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{duplicateResult}</p>
            </div>
            <button
              onClick={() => setDuplicateResult(null)}
              className="ml-auto text-current hover:opacity-70"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Upload Section */}
      <div className={`p-6 rounded-lg border-2 border-dashed ${
        theme === 'gold'
          ? 'border-yellow-400/30 bg-yellow-400/5'
          : 'border-gray-300 bg-gray-50'
      }`}>
        <div className="text-center">
          <Upload className={`h-12 w-12 mx-auto mb-4 ${
            theme === 'gold' ? 'text-yellow-400' : 'text-gray-400'
          }`} />
          <h3 className={`text-lg font-medium mb-2 ${
            theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
          }`}>
            Upload Leads CSV
          </h3>
          <p className={`text-sm mb-4 ${
            theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Upload a CSV file with your leads. Duplicates will be automatically detected and filtered.
          </p>
          
          <label className={`inline-flex items-center px-6 py-3 text-sm font-medium rounded-lg cursor-pointer transition-colors ${
            theme === 'gold'
              ? 'gold-gradient text-black hover-gold'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}>
            <Upload className="h-4 w-4 mr-2" />
            Choose CSV File
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
          
          {uploading && (
            <div className="mt-4">
              <div className={`animate-spin rounded-full h-6 w-6 border-2 border-transparent mx-auto ${
                theme === 'gold'
                  ? 'border-t-yellow-400'
                  : 'border-t-blue-600'
              }`}></div>
              <p className={`text-sm mt-2 ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                Processing file and checking for duplicates...
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Upload Preview */}
      {showPreview && uploadPreview && (
        <div className={`p-6 rounded-lg border ${
          theme === 'gold'
            ? 'border-yellow-400/20 bg-black/20'
            : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <h4 className={`text-lg font-semibold ${
              theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
            }`}>
              Upload Preview
            </h4>
            <div className="flex items-center space-x-2">
              {uploadPreview.duplicates.length > 0 && (
                <button
                  onClick={() => setShowDuplicates(!showDuplicates)}
                  className={`inline-flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                    theme === 'gold'
                      ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {showDuplicates ? 'Hide' : 'View'} Duplicates
                </button>
              )}
              {uploadPreview.duplicates.length > 0 && (
                <button
                  onClick={downloadDuplicateReport}
                  className={`inline-flex items-center px-3 py-2 text-sm rounded-lg transition-colors ${
                    theme === 'gold'
                      ? 'border border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Duplicates
                </button>
              )}
            </div>
          </div>

          {/* Upload Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className={`p-4 rounded-lg ${
              theme === 'gold' ? 'bg-blue-500/10' : 'bg-blue-50'
            }`}>
              <div className={`text-lg font-bold ${
                theme === 'gold' ? 'text-blue-400' : 'text-blue-600'
              }`}>
                {uploadPreview.stats.total}
              </div>
              <div className={`text-sm ${
                theme === 'gold' ? 'text-blue-300' : 'text-blue-700'
              }`}>
                Total Rows
              </div>
            </div>

            <div className={`p-4 rounded-lg ${
              theme === 'gold' ? 'bg-green-500/10' : 'bg-green-50'
            }`}>
              <div className={`text-lg font-bold ${
                theme === 'gold' ? 'text-green-400' : 'text-green-600'
              }`}>
                {uploadPreview.stats.valid}
              </div>
              <div className={`text-sm ${
                theme === 'gold' ? 'text-green-300' : 'text-green-700'
              }`}>
                Valid & Unique
              </div>
            </div>

            <div className={`p-4 rounded-lg ${
              theme === 'gold' ? 'bg-red-500/10' : 'bg-red-50'
            }`}>
              <div className={`text-lg font-bold ${
                theme === 'gold' ? 'text-red-400' : 'text-red-600'
              }`}>
                {uploadPreview.stats.duplicates}
              </div>
              <div className={`text-sm ${
                theme === 'gold' ? 'text-red-300' : 'text-red-700'
              }`}>
                Total Duplicates
              </div>
            </div>

            <div className={`p-4 rounded-lg ${
              theme === 'gold' ? 'bg-orange-500/10' : 'bg-orange-50'
            }`}>
              <div className={`text-lg font-bold ${
                theme === 'gold' ? 'text-orange-400' : 'text-orange-600'
              }`}>
                {uploadPreview.stats.existingDuplicates}
              </div>
              <div className={`text-sm ${
                theme === 'gold' ? 'text-orange-300' : 'text-orange-700'
              }`}>
                Already in Campaign
              </div>
            </div>

            <div className={`p-4 rounded-lg ${
              theme === 'gold' ? 'bg-purple-500/10' : 'bg-purple-50'
            }`}>
              <div className={`text-lg font-bold ${
                theme === 'gold' ? 'text-purple-400' : 'text-purple-600'
              }`}>
                {uploadPreview.stats.internalDuplicates}
              </div>
              <div className={`text-sm ${
                theme === 'gold' ? 'text-purple-300' : 'text-purple-700'
              }`}>
                Within Upload
              </div>
            </div>
          </div>

          {/* Duplicate Details */}
          {showDuplicates && uploadPreview.duplicates.length > 0 && (
            <div className={`mb-6 p-4 rounded-lg border ${
              theme === 'gold'
                ? 'border-red-500/20 bg-red-500/5'
                : 'border-red-200 bg-red-50'
            }`}>
              <h5 className={`text-sm font-medium mb-3 ${
                theme === 'gold' ? 'text-red-400' : 'text-red-700'
              }`}>
                Duplicate Leads (First 10)
              </h5>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {uploadPreview.duplicates.slice(0, 10).map((duplicate, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg ${
                      theme === 'gold' ? 'bg-black/20' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className={`text-sm font-medium ${
                          theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
                        }`}>
                          {duplicate.lead.name || 'No name'}
                        </div>
                        <div className={`text-xs ${
                          theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {duplicate.lead.phone} • {duplicate.lead.email}
                        </div>
                      </div>
                      <div className={`text-xs px-2 py-1 rounded-full ${
                        theme === 'gold'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {duplicate.reason}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {uploadPreview.duplicates.length > 10 && (
                <p className={`text-xs mt-2 ${
                  theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                }`}>
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
              className={`flex-1 px-4 py-2 text-sm rounded-lg transition-colors ${
                theme === 'gold'
                  ? 'text-gray-400 bg-gray-800 border border-gray-600 hover:bg-gray-700'
                  : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
              }`}
            >
              Cancel
            </button>
            
            <button
              onClick={confirmUpload}
              disabled={uploading || uploadPreview.stats.valid === 0}
              className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                theme === 'gold'
                  ? 'gold-gradient text-black hover-gold'
                  : 'bg-green-600 text-white hover:bg-green-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {uploading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
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

      {/* Error Message */}
      {loadingError && (
        <ErrorMessage
          message={loadingError}
          onDismiss={() => {}}
        />
      )}

      {/* Existing Leads List */}
      <div className={`rounded-lg border ${
        theme === 'gold'
          ? 'border-yellow-400/20 bg-black/20'
          : 'border-gray-200 bg-gray-50'
      }`}>
        <div className={`p-4 border-b ${
          theme === 'gold' ? 'border-yellow-400/20' : 'border-gray-200'
        }`}>
          <h4 className={`text-md font-semibold ${
            theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
          }`}>
            Current Leads ({leads.length})
          </h4>
        </div>

        <div className="p-4">
          {leads.length === 0 ? (
            <div className="text-center py-8">
              <Users className={`h-12 w-12 mx-auto mb-4 ${
                theme === 'gold' ? 'text-gray-600' : 'text-gray-400'
              }`} />
              <p className={`text-sm ${
                theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
              }`}>
                No leads uploaded yet. Upload a CSV file to get started.
              </p>
            </div>
          ) : (
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
                      Phone
                    </th>
                    <th className={`text-left py-2 px-3 text-xs font-medium ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Email
                    </th>
                    <th className={`text-left py-2 px-3 text-xs font-medium ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Company
                    </th>
                    <th className={`text-left py-2 px-3 text-xs font-medium ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Status
                    </th>
                    <th className={`text-left py-2 px-3 text-xs font-medium ${
                      theme === 'gold' ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Uploaded
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leads.slice(0, 50).map((lead) => (
                    <tr key={lead.id} className={`border-b ${
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
                        {lead.phone || 'No phone'}
                      </td>
                      <td className={`py-2 px-3 text-sm ${
                        theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        {lead.email || 'No email'}
                      </td>
                      <td className={`py-2 px-3 text-sm ${
                        theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        {lead.company_name || 'No company'}
                      </td>
                      <td className={`py-2 px-3 text-sm ${
                        theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          lead.status === 'pending'
                            ? theme === 'gold' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-800'
                            : lead.status === 'contacted'
                            ? theme === 'gold' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-800'
                            : theme === 'gold' ? 'bg-gray-500/20 text-gray-400' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {lead.status || 'pending'}
                        </span>
                      </td>
                      <td className={`py-2 px-3 text-xs ${
                        theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                      }`}>
                        {new Date(lead.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {leads.length > 50 && (
                <p className={`text-xs mt-2 text-center ${
                  theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
                }`}>
                  Showing 50 of {leads.length} leads
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* CSV Format Guide */}
      <div className={`p-4 rounded-lg ${
        theme === 'gold'
          ? 'bg-yellow-400/10 border border-yellow-400/20'
          : 'bg-blue-50 border border-blue-200'
      }`}>
        <h4 className={`text-sm font-medium mb-2 ${
          theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
        }`}>
          📋 CSV Format Requirements
        </h4>
        <div className={`text-sm space-y-1 ${
          theme === 'gold' ? 'text-yellow-300' : 'text-blue-600'
        }`}>
          <p><strong>Required columns:</strong> name, phone, email (at least one contact method)</p>
          <p><strong>Optional columns:</strong> company, company_name, job_title, title, position</p>
          <p><strong>Duplicate detection:</strong> Matches on phone number and/or email address</p>
          <p><strong>Phone format:</strong> Any format accepted (+1234567890, (123) 456-7890, etc.)</p>
          <p><strong>Email format:</strong> Standard email validation applied</p>
        </div>
      </div>
    </div>
  );
}