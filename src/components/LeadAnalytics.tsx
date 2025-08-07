import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { 
  AlertTriangle, 
  Database, 
  Trash2, 
  Search, 
  Phone, 
  Mail, 
  Users,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download
} from 'lucide-react';

interface LeadAnalysis {
  totalLeads: number;
  leadsWithPhone: number;
  leadsWithEmail: number;
  leadsWithBoth: number;
  leadsWithNeither: number;
  emptyPhoneLeads: number;
  invalidPhoneLeads: number;
  invalidEmailLeads: number;
  duplicateLeads: number;
}

interface InvalidLead {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  campaign_id: string;
  issues: string[];
}

export function LeadAnalytics() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [analysis, setAnalysis] = useState<LeadAnalysis | null>(null);
  const [invalidLeads, setInvalidLeads] = useState<InvalidLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      analyzeLeads();
    }
  }, [user]);

  const analyzeLeads = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get duplicate statistics for all user campaigns
      const duplicateStats = await LeadDeduplicationManager.getCampaignDuplicateStats(
        '', // Empty string to analyze all campaigns
        user.id,
        supabase
      );

      // Get all leads for this user
      const { data: uploadedLeads, error: uploadedError } = await supabase
        .from('uploaded_leads')
        .select('*')
        .eq('user_id', user.id);

      const { data: leadsTableData, error: leadsError } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', user.id);

      if (uploadedError) throw uploadedError;
      if (leadsError) throw leadsError;

      const allLeads = uploadedLeads || [];
      const leadsInLeadsTable = leadsTableData || [];

      // Analyze data quality
      let leadsWithPhone = 0;
      let leadsWithEmail = 0;
      let leadsWithBoth = 0;
      let leadsWithNeither = 0;
      let emptyPhoneLeads = 0;
      let invalidPhoneLeads = 0;
      let invalidEmailLeads = 0;
      const invalidLeadsArray: InvalidLead[] = [];

      // Phone validation regex
      const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      allLeads.forEach(lead => {
        const issues: string[] = [];
        let hasValidPhone = false;
        let hasValidEmail = false;

        // Check phone
        if (!lead.phone || lead.phone.trim() === '' || lead.phone === 'EMPTY') {
          emptyPhoneLeads++;
          issues.push('No phone number');
        } else if (!phoneRegex.test(lead.phone.replace(/\s/g, ''))) {
          invalidPhoneLeads++;
          issues.push('Invalid phone format');
        } else {
          hasValidPhone = true;
          leadsWithPhone++;
        }

        // Check email
        if (!lead.email || lead.email.trim() === '' || lead.email === 'EMPTY') {
          issues.push('No email');
        } else if (!emailRegex.test(lead.email)) {
          invalidEmailLeads++;
          issues.push('Invalid email format');
        } else {
          hasValidEmail = true;
          leadsWithEmail++;
        }

        // Count combinations
        if (hasValidPhone && hasValidEmail) {
          leadsWithBoth++;
        } else if (!hasValidPhone && !hasValidEmail) {
          leadsWithNeither++;
        }

        // Add to invalid leads if has issues
        if (issues.length > 0) {
          invalidLeadsArray.push({
            id: lead.id,
            name: lead.name,
            phone: lead.phone,
            email: lead.email,
            campaign_id: lead.campaign_id,
            issues
          });
        }
      });

      // Check for duplicates (same phone or email)
      const phoneMap = new Map();
      const emailMap = new Map();
      let duplicateLeads = 0;

      allLeads.forEach(lead => {
        if (lead.phone && lead.phone !== 'EMPTY') {
          const cleanPhone = lead.phone.replace(/\s/g, '');
          if (phoneMap.has(cleanPhone)) {
            duplicateLeads++;
          } else {
            phoneMap.set(cleanPhone, lead.id);
          }
        }
        if (lead.email && lead.email !== 'EMPTY') {
          if (emailMap.has(lead.email)) {
            duplicateLeads++;
          } else {
            emailMap.set(lead.email, lead.id);
          }
        }
      });

      setAnalysis({
        totalLeads: allLeads.length,
        leadsWithPhone,
        leadsWithEmail,
        leadsWithBoth,
        leadsWithNeither,
        emptyPhoneLeads,
        invalidPhoneLeads,
        invalidEmailLeads,
        duplicateLeads
      });

      // Add duplicate groups to analysis
      setAnalysis(prev => prev ? {
        ...prev,
        duplicateGroups: duplicateStats.duplicateGroups
      } : null);

      setInvalidLeads(invalidLeadsArray.slice(0, 100)); // Show first 100 invalid leads

    } catch (error) {
      console.error('Error analyzing leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const cleanupInvalidLeads = async () => {
    if (!user || !analysis) return;

    setCleaning(true);
    setCleanupResult(null);

    try {
      // First, get all leads with no valid contact info
      const { data: leadsToDelete, error: fetchError } = await supabase
        .from('uploaded_leads')
        .select('id')
        .eq('user_id', user.id)
        .or('phone.is.null,phone.eq.,phone.eq.EMPTY')
        .or('email.is.null,email.eq.,email.eq.EMPTY');

      if (fetchError) throw fetchError;

      if (!leadsToDelete || leadsToDelete.length === 0) {
        setCleanupResult('No invalid leads found to clean up.');
        return;
      }

      // Delete in batches to avoid timeout
      const batchSize = 100;
      let totalDeleted = 0;

      for (let i = 0; i < leadsToDelete.length; i += batchSize) {
        const batch = leadsToDelete.slice(i, i + batchSize);
        const idsToDelete = batch.map(lead => lead.id);

        // Delete from uploaded_leads (this will cascade to leads table)
        const { error: deleteError } = await supabase
          .from('uploaded_leads')
          .delete()
          .in('id', idsToDelete);

        if (deleteError) {
          console.error('Error deleting batch:', deleteError);
          continue;
        }

        totalDeleted += batch.length;
      }

      setCleanupResult(`Successfully deleted ${totalDeleted} leads with no valid contact information.`);
      
      // Refresh analysis
      setTimeout(() => {
        analyzeLeads();
      }, 1000);

    } catch (error) {
      console.error('Error cleaning up leads:', error);
      setCleanupResult('Error occurred during cleanup. Please try again.');
    } finally {
      setCleaning(false);
    }
  };

  const exportInvalidLeads = () => {
    if (invalidLeads.length === 0) return;

    const csvContent = [
      ['ID', 'Name', 'Phone', 'Email', 'Campaign ID', 'Issues'],
      ...invalidLeads.map(lead => [
        lead.id,
        lead.name || '',
        lead.phone || '',
        lead.email || '',
        lead.campaign_id,
        lead.issues.join('; ')
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invalid_leads_analysis.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className={`animate-spin rounded-full h-12 w-12 border-4 border-transparent ${
          theme === 'gold'
            ? 'border-t-yellow-400'
            : 'border-t-blue-600'
        }`}></div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className={`h-12 w-12 mx-auto mb-4 ${
          theme === 'gold' ? 'text-yellow-400' : 'text-red-500'
        }`} />
        <p className={theme === 'gold' ? 'text-gray-400' : 'text-gray-600'}>
          Failed to analyze leads data
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-lg font-semibold ${
            theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
          }`}>
            Lead Data Quality Analysis
          </h3>
          <p className={`text-sm ${
            theme === 'gold' ? 'text-gray-400' : 'text-gray-600'
          }`}>
            Analyze and clean up your lead database
          </p>
        </div>
        <button
          onClick={analyzeLeads}
          className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            theme === 'gold'
              ? 'gold-gradient text-black hover-gold'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Analysis
        </button>
      </div>

      {/* Cleanup Result */}
      {cleanupResult && (
        <div className={`rounded-lg border p-4 ${
          cleanupResult.includes('Successfully')
            ? theme === 'gold'
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : 'bg-green-50 border-green-200 text-green-800'
            : theme === 'gold'
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {cleanupResult.includes('Successfully') ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                <XCircle className="h-5 w-5" />
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{cleanupResult}</p>
            </div>
            <button
              onClick={() => setCleanupResult(null)}
              className="ml-auto text-current hover:opacity-70"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className={`p-4 rounded-lg border ${
          theme === 'gold'
            ? 'border-yellow-400/20 bg-black/20'
            : 'border-gray-200 bg-white'
        }`}>
          <div className="flex items-center">
            <Users className={`h-5 w-5 mr-2 ${
              theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
            }`} />
            <span className={`text-sm font-medium ${
              theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Total Leads
            </span>
          </div>
          <p className={`text-2xl font-bold mt-1 ${
            theme === 'gold' ? 'text-yellow-400' : 'text-blue-600'
          }`}>
            {analysis.totalLeads.toLocaleString()}
          </p>
        </div>

        <div className={`p-4 rounded-lg border ${
          theme === 'gold'
            ? 'border-yellow-400/20 bg-black/20'
            : 'border-gray-200 bg-white'
        }`}>
          <div className="flex items-center">
            <Phone className={`h-5 w-5 mr-2 ${
              theme === 'gold' ? 'text-yellow-400' : 'text-green-600'
            }`} />
            <span className={`text-sm font-medium ${
              theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Valid Phone
            </span>
          </div>
          <p className={`text-2xl font-bold mt-1 ${
            theme === 'gold' ? 'text-yellow-400' : 'text-green-600'
          }`}>
            {analysis.leadsWithPhone.toLocaleString()}
          </p>
          <p className={`text-xs ${
            theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
          }`}>
            {((analysis.leadsWithPhone / analysis.totalLeads) * 100).toFixed(1)}%
          </p>
        </div>

        <div className={`p-4 rounded-lg border ${
          theme === 'gold'
            ? 'border-yellow-400/20 bg-black/20'
            : 'border-gray-200 bg-white'
        }`}>
          <div className="flex items-center">
            <Mail className={`h-5 w-5 mr-2 ${
              theme === 'gold' ? 'text-yellow-400' : 'text-purple-600'
            }`} />
            <span className={`text-sm font-medium ${
              theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
            }`}>
              Valid Email
            </span>
          </div>
          <p className={`text-2xl font-bold mt-1 ${
            theme === 'gold' ? 'text-yellow-400' : 'text-purple-600'
          }`}>
            {analysis.leadsWithEmail.toLocaleString()}
          </p>
          <p className={`text-xs ${
            theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
          }`}>
            {((analysis.leadsWithEmail / analysis.totalLeads) * 100).toFixed(1)}%
          </p>
        </div>

        <div className={`p-4 rounded-lg border ${
          theme === 'gold'
            ? 'border-red-500/20 bg-red-500/5'
            : 'border-red-200 bg-red-50'
        }`}>
          <div className="flex items-center">
            <XCircle className={`h-5 w-5 mr-2 ${
              theme === 'gold' ? 'text-red-400' : 'text-red-600'
            }`} />
            <span className={`text-sm font-medium ${
              theme === 'gold' ? 'text-red-300' : 'text-red-700'
            }`}>
              No Contact Info
            </span>
          </div>
          <p className={`text-2xl font-bold mt-1 ${
            theme === 'gold' ? 'text-red-400' : 'text-red-600'
          }`}>
            {analysis.leadsWithNeither.toLocaleString()}
          </p>
          <p className={`text-xs ${
            theme === 'gold' ? 'text-red-500' : 'text-red-500'
          }`}>
            {((analysis.leadsWithNeither / analysis.totalLeads) * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Detailed Issues */}
      <div className={`p-6 rounded-lg border ${
        theme === 'gold'
          ? 'border-yellow-400/20 bg-black/20'
          : 'border-gray-200 bg-gray-50'
      }`}>
        <h4 className={`text-md font-semibold mb-4 ${
          theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
        }`}>
          Data Quality Issues
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className={`p-4 rounded-lg ${
            theme === 'gold' ? 'bg-red-500/10' : 'bg-red-50'
          }`}>
            <div className={`text-lg font-bold ${
              theme === 'gold' ? 'text-red-400' : 'text-red-600'
            }`}>
              {analysis.emptyPhoneLeads.toLocaleString()}
            </div>
            <div className={`text-sm ${
              theme === 'gold' ? 'text-red-300' : 'text-red-700'
            }`}>
              Empty Phone Numbers
            </div>
          </div>

          <div className={`p-4 rounded-lg ${
            theme === 'gold' ? 'bg-orange-500/10' : 'bg-orange-50'
          }`}>
            <div className={`text-lg font-bold ${
              theme === 'gold' ? 'text-orange-400' : 'text-orange-600'
            }`}>
              {analysis.invalidPhoneLeads.toLocaleString()}
            </div>
            <div className={`text-sm ${
              theme === 'gold' ? 'text-orange-300' : 'text-orange-700'
            }`}>
              Invalid Phone Format
            </div>
          </div>

          <div className={`p-4 rounded-lg ${
            theme === 'gold' ? 'bg-purple-500/10' : 'bg-purple-50'
          }`}>
            <div className={`text-lg font-bold ${
              theme === 'gold' ? 'text-purple-400' : 'text-purple-600'
            }`}>
              {analysis.invalidEmailLeads.toLocaleString()}
            </div>
            <div className={`text-sm ${
              theme === 'gold' ? 'text-purple-300' : 'text-purple-700'
            }`}>
              Invalid Email Format
            </div>
          </div>

          <div className={`p-4 rounded-lg ${
            theme === 'gold' ? 'bg-yellow-500/10' : 'bg-yellow-50'
          }`}>
            <div className={`text-lg font-bold ${
              theme === 'gold' ? 'text-yellow-400' : 'text-yellow-600'
            }`}>
              {analysis.duplicateLeads.toLocaleString()}
            </div>
            <div className={`text-sm ${
              theme === 'gold' ? 'text-yellow-300' : 'text-yellow-700'
            }`}>
              Potential Duplicates
            </div>
          </div>
        </div>

        {/* Root Cause Analysis */}
        <div className={`p-4 rounded-lg mb-4 ${
          theme === 'gold'
            ? 'bg-blue-500/10 border border-blue-500/20'
            : 'bg-blue-50 border border-blue-200'
        }`}>
          <h5 className={`text-sm font-medium mb-2 ${
            theme === 'gold' ? 'text-blue-400' : 'text-blue-700'
          }`}>
            🔍 Root Cause Analysis
          </h5>
          <div className={`text-sm space-y-1 ${
            theme === 'gold' ? 'text-blue-300' : 'text-blue-600'
          }`}>
            <p>• <strong>Empty phone numbers:</strong> Likely from CSV uploads with missing phone columns or data scraping that didn't capture phone numbers</p>
            <p>• <strong>Invalid formats:</strong> Phone numbers without proper country codes or email addresses with typos</p>
            <p>• <strong>EMPTY values:</strong> Placeholder text from data sources instead of actual empty fields</p>
            <p>• <strong>Foreign key constraints:</strong> Can't delete leads that have activity history or sequence progress</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={cleanupInvalidLeads}
            disabled={cleaning || analysis.leadsWithNeither === 0}
            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              theme === 'gold'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-red-600 text-white hover:bg-red-700'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {cleaning ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            {cleaning ? 'Cleaning...' : `Clean Up ${analysis.leadsWithNeither} Invalid Leads`}
          </button>

          <button
            onClick={exportInvalidLeads}
            disabled={invalidLeads.length === 0}
            className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              theme === 'gold'
                ? 'border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/10'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            } disabled:opacity-50`}
          >
            <Download className="h-4 w-4 mr-2" />
            Export Invalid Leads
          </button>
        </div>
      </div>

      {/* Sample Invalid Leads */}
      {invalidLeads.length > 0 && (
        <div className={`p-6 rounded-lg border ${
          theme === 'gold'
            ? 'border-yellow-400/20 bg-black/20'
            : 'border-gray-200 bg-gray-50'
        }`}>
          <h4 className={`text-md font-semibold mb-4 ${
            theme === 'gold' ? 'text-gray-200' : 'text-gray-900'
          }`}>
            Sample Invalid Leads (First 10)
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
                    Issues
                  </th>
                </tr>
              </thead>
              <tbody>
                {invalidLeads.slice(0, 10).map((lead, index) => (
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
                      {lead.phone || 'EMPTY'}
                    </td>
                    <td className={`py-2 px-3 text-sm ${
                      theme === 'gold' ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {lead.email || 'EMPTY'}
                    </td>
                    <td className={`py-2 px-3 text-sm ${
                      theme === 'gold' ? 'text-red-400' : 'text-red-600'
                    }`}>
                      {lead.issues.join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {invalidLeads.length > 10 && (
            <p className={`text-xs mt-2 ${
              theme === 'gold' ? 'text-gray-500' : 'text-gray-500'
            }`}>
              Showing 10 of {invalidLeads.length} invalid leads. Export full list for complete analysis.
            </p>
          )}
        </div>
      )}

      {/* Recommendations */}
      <div className={`p-4 rounded-lg ${
        theme === 'gold'
          ? 'bg-yellow-400/10 border border-yellow-400/20'
          : 'bg-blue-50 border border-blue-200'
      }`}>
        <h5 className={`text-sm font-medium mb-2 ${
          theme === 'gold' ? 'text-yellow-400' : 'text-blue-700'
        }`}>
          💡 Recommendations
        </h5>
        <ul className={`text-sm space-y-1 ${
          theme === 'gold' ? 'text-yellow-300' : 'text-blue-600'
        }`}>
          <li>• Clean up leads with no contact information to improve database performance</li>
          <li>• Review your data sources to ensure phone numbers are properly formatted</li>
          <li>• Consider implementing stricter validation during CSV uploads</li>
          <li>• Use phone number normalization to standardize formats</li>
          <li>• Remove duplicates to avoid contacting the same person multiple times</li>
        </ul>
      </div>
    </div>
  );
}