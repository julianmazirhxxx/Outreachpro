// Lead deduplication utilities for preventing and managing duplicate leads

export interface LeadData {
  id?: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  company_name?: string | null;
  job_title?: string | null;
  campaign_id?: string;
  user_id?: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  duplicateField: 'phone' | 'email' | 'both' | null;
  existingLeadId?: string;
  matchedValue?: string;
}

export interface DeduplicationResult {
  uniqueLeads: LeadData[];
  duplicates: Array<{
    lead: LeadData;
    reason: string;
    existingLeadId?: string;
  }>;
  stats: {
    total: number;
    unique: number;
    duplicates: number;
    phoneMatches: number;
    emailMatches: number;
  };
}

export class LeadDeduplicationManager {
  // Normalize phone number for comparison
  static normalizePhone(phone: string | null): string {
    if (!phone) return '';
    return phone.replace(/[\s\-\(\)\+]/g, '').toLowerCase();
  }

  // Normalize email for comparison
  static normalizeEmail(email: string | null): string {
    if (!email) return '';
    return email.toLowerCase().trim();
  }

  // Check if a lead is a duplicate within a campaign
  static checkDuplicateInCampaign(
    newLead: LeadData,
    existingLeads: LeadData[]
  ): DuplicateCheckResult {
    const newPhone = this.normalizePhone(newLead.phone);
    const newEmail = this.normalizeEmail(newLead.email);

    // Skip leads with no contact info
    if (!newPhone && !newEmail) {
      return { isDuplicate: false, duplicateField: null };
    }

    for (const existingLead of existingLeads) {
      const existingPhone = this.normalizePhone(existingLead.phone);
      const existingEmail = this.normalizeEmail(existingLead.email);

      let phoneMatch = false;
      let emailMatch = false;

      // Check phone match (only if both have phones)
      if (newPhone && existingPhone && newPhone === existingPhone) {
        phoneMatch = true;
      }

      // Check email match (only if both have emails)
      if (newEmail && existingEmail && newEmail === existingEmail) {
        emailMatch = true;
      }

      // Determine duplicate status
      if (phoneMatch && emailMatch) {
        return {
          isDuplicate: true,
          duplicateField: 'both',
          existingLeadId: existingLead.id,
          matchedValue: `${newPhone} & ${newEmail}`
        };
      } else if (phoneMatch) {
        return {
          isDuplicate: true,
          duplicateField: 'phone',
          existingLeadId: existingLead.id,
          matchedValue: newPhone
        };
      } else if (emailMatch) {
        return {
          isDuplicate: true,
          duplicateField: 'email',
          existingLeadId: existingLead.id,
          matchedValue: newEmail
        };
      }
    }

    return { isDuplicate: false, duplicateField: null };
  }

  // Deduplicate an array of leads
  static deduplicateLeads(leads: LeadData[]): DeduplicationResult {
    const uniqueLeads: LeadData[] = [];
    const duplicates: Array<{
      lead: LeadData;
      reason: string;
      existingLeadId?: string;
    }> = [];

    const phoneMap = new Map<string, number>(); // phone -> index in uniqueLeads
    const emailMap = new Map<string, number>(); // email -> index in uniqueLeads

    let phoneMatches = 0;
    let emailMatches = 0;

    leads.forEach((lead, index) => {
      const normalizedPhone = this.normalizePhone(lead.phone);
      const normalizedEmail = this.normalizeEmail(lead.email);

      let isDuplicate = false;
      let duplicateReason = '';
      let existingIndex = -1;

      // Check phone duplicates
      if (normalizedPhone && phoneMap.has(normalizedPhone)) {
        isDuplicate = true;
        existingIndex = phoneMap.get(normalizedPhone)!;
        duplicateReason = `Duplicate phone: ${normalizedPhone}`;
        phoneMatches++;
      }

      // Check email duplicates
      if (normalizedEmail && emailMap.has(normalizedEmail)) {
        if (isDuplicate) {
          duplicateReason += ` and email: ${normalizedEmail}`;
        } else {
          isDuplicate = true;
          existingIndex = emailMap.get(normalizedEmail)!;
          duplicateReason = `Duplicate email: ${normalizedEmail}`;
        }
        emailMatches++;
      }

      if (isDuplicate) {
        duplicates.push({
          lead,
          reason: duplicateReason,
          existingLeadId: uniqueLeads[existingIndex]?.id
        });
      } else {
        // Add to unique leads
        const uniqueIndex = uniqueLeads.length;
        uniqueLeads.push(lead);

        // Track in maps
        if (normalizedPhone) {
          phoneMap.set(normalizedPhone, uniqueIndex);
        }
        if (normalizedEmail) {
          emailMap.set(normalizedEmail, uniqueIndex);
        }
      }
    });

    return {
      uniqueLeads,
      duplicates,
      stats: {
        total: leads.length,
        unique: uniqueLeads.length,
        duplicates: duplicates.length,
        phoneMatches,
        emailMatches
      }
    };
  }

  // Validate leads before upload to prevent duplicates
  static async validateLeadsForUpload(
    leads: LeadData[],
    campaignId: string,
    userId: string,
    supabase: any
  ): Promise<{
    validLeads: LeadData[];
    duplicates: Array<{
      lead: LeadData;
      reason: string;
    }>;
    stats: {
      total: number;
      valid: number;
      duplicates: number;
      existingDuplicates: number;
      internalDuplicates: number;
    };
  }> {
    try {
      // Get existing leads in this campaign
      const { data: existingLeads, error: fetchError } = await supabase
        .from('uploaded_leads')
        .select('id, phone, email')
        .eq('campaign_id', campaignId)
        .eq('user_id', userId);

      if (fetchError) throw fetchError;

      // First, deduplicate within the new leads array
      const internalDeduplication = this.deduplicateLeads(leads);
      
      // Then check against existing leads in the campaign
      const validLeads: LeadData[] = [];
      const duplicates: Array<{
        lead: LeadData;
        reason: string;
      }> = [];

      // Add internal duplicates to the duplicates array
      duplicates.push(...internalDeduplication.duplicates.map(dup => ({
        lead: dup.lead,
        reason: `Internal duplicate: ${dup.reason}`
      })));

      // Check unique leads against existing campaign leads
      internalDeduplication.uniqueLeads.forEach(lead => {
        const duplicateCheck = this.checkDuplicateInCampaign(lead, existingLeads || []);
        
        if (duplicateCheck.isDuplicate) {
          duplicates.push({
            lead,
            reason: `Existing duplicate: ${duplicateCheck.duplicateField} (${duplicateCheck.matchedValue})`
          });
        } else {
          validLeads.push(lead);
        }
      });

      return {
        validLeads,
        duplicates,
        stats: {
          total: leads.length,
          valid: validLeads.length,
          duplicates: duplicates.length,
          existingDuplicates: duplicates.filter(d => d.reason.includes('Existing')).length,
          internalDuplicates: duplicates.filter(d => d.reason.includes('Internal')).length
        }
      };

    } catch (error) {
      console.error('Error validating leads:', error);
      return {
        validLeads: [],
        duplicates: leads.map(lead => ({
          lead,
          reason: 'Validation error'
        })),
        stats: {
          total: leads.length,
          valid: 0,
          duplicates: leads.length,
          existingDuplicates: 0,
          internalDuplicates: 0
        }
      };
    }
  }

  // Get duplicate statistics for a campaign
  static async getCampaignDuplicateStats(
    campaignId: string,
    userId: string,
    supabase: any
  ): Promise<{
    totalLeads: number;
    phoneDuplicates: number;
    emailDuplicates: number;
    duplicateGroups: Array<{
      field: 'phone' | 'email';
      value: string;
      leadIds: string[];
      count: number;
    }>;
  }> {
    try {
      const { data: leads, error } = await supabase
        .from('uploaded_leads')
        .select('id, phone, email')
        .eq('campaign_id', campaignId)
        .eq('user_id', userId);

      if (error) throw error;

      const phoneGroups = new Map<string, string[]>();
      const emailGroups = new Map<string, string[]>();

      leads?.forEach(lead => {
        const normalizedPhone = this.normalizePhone(lead.phone);
        const normalizedEmail = this.normalizeEmail(lead.email);

        if (normalizedPhone) {
          if (!phoneGroups.has(normalizedPhone)) {
            phoneGroups.set(normalizedPhone, []);
          }
          phoneGroups.get(normalizedPhone)!.push(lead.id);
        }

        if (normalizedEmail) {
          if (!emailGroups.has(normalizedEmail)) {
            emailGroups.set(normalizedEmail, []);
          }
          emailGroups.get(normalizedEmail)!.push(lead.id);
        }
      });

      // Find groups with duplicates
      const duplicateGroups: Array<{
        field: 'phone' | 'email';
        value: string;
        leadIds: string[];
        count: number;
      }> = [];

      let phoneDuplicates = 0;
      phoneGroups.forEach((leadIds, phone) => {
        if (leadIds.length > 1) {
          duplicateGroups.push({
            field: 'phone',
            value: phone,
            leadIds,
            count: leadIds.length
          });
          phoneDuplicates += leadIds.length - 1; // Count extras as duplicates
        }
      });

      let emailDuplicates = 0;
      emailGroups.forEach((leadIds, email) => {
        if (leadIds.length > 1) {
          duplicateGroups.push({
            field: 'email',
            value: email,
            leadIds,
            count: leadIds.length
          });
          emailDuplicates += leadIds.length - 1; // Count extras as duplicates
        }
      });

      return {
        totalLeads: leads?.length || 0,
        phoneDuplicates,
        emailDuplicates,
        duplicateGroups
      };

    } catch (error) {
      console.error('Error getting duplicate stats:', error);
      return {
        totalLeads: 0,
        phoneDuplicates: 0,
        emailDuplicates: 0,
        duplicateGroups: []
      };
    }
  }
}

// Utility functions for common deduplication operations
export const DeduplicationUtils = {
  // Format duplicate statistics for display
  formatDuplicateStats: (stats: DeduplicationResult['stats']): string => {
    if (stats.duplicates === 0) {
      return 'No duplicates found';
    }
    
    const parts: string[] = [];
    if (stats.phoneMatches > 0) {
      parts.push(`${stats.phoneMatches} phone duplicates`);
    }
    if (stats.emailMatches > 0) {
      parts.push(`${stats.emailMatches} email duplicates`);
    }
    
    return `${stats.duplicates} duplicates found (${parts.join(', ')})`;
  },

  // Generate CSV content for duplicate report
  generateDuplicateReport: (duplicates: Array<{
    lead: LeadData;
    reason: string;
    existingLeadId?: string;
  }>): string => {
    const headers = ['Name', 'Phone', 'Email', 'Company', 'Job Title', 'Reason', 'Existing Lead ID'];
    const rows = duplicates.map(dup => [
      dup.lead.name || '',
      dup.lead.phone || '',
      dup.lead.email || '',
      dup.lead.company_name || '',
      dup.lead.job_title || '',
      dup.reason,
      dup.existingLeadId || ''
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  },

  // Download duplicate report as CSV
  downloadDuplicateReport: (duplicates: Array<{
    lead: LeadData;
    reason: string;
    existingLeadId?: string;
  }>, campaignName: string = 'campaign'): void => {
    if (duplicates.length === 0) return;

    const csvContent = DeduplicationUtils.generateDuplicateReport(duplicates);
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `duplicate_leads_${campaignName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
};