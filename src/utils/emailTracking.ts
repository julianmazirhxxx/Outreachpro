// Email tracking utilities for adding tracking pixels and links

export interface EmailTrackingConfig {
  trackingId: string;
  baseUrl: string;
  originalEmail: string;
  campaignId: string;
  leadId: string;
}

export class EmailTrackingManager {
  private static instance: EmailTrackingManager;
  
  static getInstance(): EmailTrackingManager {
    if (!EmailTrackingManager.instance) {
      EmailTrackingManager.instance = new EmailTrackingManager();
    }
    return EmailTrackingManager.instance;
  }

  // Generate unique tracking ID
  generateTrackingId(): string {
    return `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Add tracking pixel to HTML email
  addTrackingPixel(htmlContent: string, config: EmailTrackingConfig): string {
    const pixelUrl = `${config.baseUrl}/functions/v1/email-tracking?t=${config.trackingId}&e=open`;
    const trackingPixel = `<img src="${pixelUrl}" width="1" height="1" style="display: none;" alt="" />`;
    
    // Add pixel before closing body tag
    if (htmlContent.includes('</body>')) {
      return htmlContent.replace('</body>', `${trackingPixel}</body>`);
    } else {
      return htmlContent + trackingPixel;
    }
  }

  // Convert links to tracking links
  addLinkTracking(htmlContent: string, config: EmailTrackingConfig): { 
    html: string; 
    trackedLinks: Array<{ original: string; tracking: string; text: string }> 
  } {
    const trackedLinks: Array<{ original: string; tracking: string; text: string }> = [];
    let linkPosition = 0;

    const linkRegex = /<a\s+([^>]*href\s*=\s*["']([^"']+)["'][^>]*)>([^<]*)<\/a>/gi;
    
    const trackedHtml = htmlContent.replace(linkRegex, (match, attributes, originalUrl, linkText) => {
      linkPosition++;
      
      // Skip if already a tracking link
      if (originalUrl.includes('/functions/v1/email-tracking')) {
        return match;
      }
      
      // Create tracking URL
      const trackingUrl = `${config.baseUrl}/functions/v1/email-tracking?t=${config.trackingId}&e=click&url=${encodeURIComponent(originalUrl)}`;
      
      trackedLinks.push({
        original: originalUrl,
        tracking: trackingUrl,
        text: linkText.trim()
      });
      
      // Replace with tracking URL
      return `<a ${attributes.replace(/href\s*=\s*["'][^"']+["']/, `href="${trackingUrl}"`)}>${linkText}</a>`;
    });

    return { html: trackedHtml, trackedLinks };
  }

  // Add tracking headers to email for reply detection
  addTrackingHeaders(config: EmailTrackingConfig): Record<string, string> {
    return {
      'X-Tracking-ID': config.trackingId,
      'X-Campaign-ID': config.campaignId,
      'X-Lead-ID': config.leadId,
      'Message-ID': `<track-${config.trackingId}@${new URL(config.baseUrl).hostname}>`,
      'List-Unsubscribe': `<${config.baseUrl}/unsubscribe?t=${config.trackingId}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    };
  }

  // Add tracking to subject line for reply detection
  addSubjectTracking(subject: string, trackingId: string): string {
    // Add hidden tracking marker to subject
    return `${subject} [TRACK:${trackingId}]`;
  }

  // Process email content for full tracking
  processEmailForTracking(
    htmlContent: string, 
    subject: string,
    config: EmailTrackingConfig
  ): {
    html: string;
    subject: string;
    headers: Record<string, string>;
    trackedLinks: Array<{ original: string; tracking: string; text: string }>;
  } {
    // Auto-enable tracking for all emails without user configuration
    // Add tracking pixel
    const htmlWithPixel = this.addTrackingPixel(htmlContent, config);
    
    // Add link tracking
    const { html: trackedHtml, trackedLinks } = this.addLinkTracking(htmlWithPixel, config);
    
    // Add tracking headers
    const headers = this.addTrackingHeaders(config);
    
    // Add subject tracking (hidden from user)
    const trackedSubject = subject; // Keep original subject, tracking ID in headers

    return {
      html: trackedHtml,
      subject: subject, // Original subject for user
      headers,
      trackedLinks
    };
  }

  // Auto-process emails for tracking (called automatically by email sending functions)
  autoProcessEmailForTracking(
    htmlContent: string,
    subject: string,
    campaignId: string,
    leadId: string,
    userEmail: string
  ): {
    html: string;
    subject: string;
    headers: Record<string, string>;
    trackingId: string;
  } {
    const trackingId = this.generateTrackingId();
    const baseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-app.supabase.co';
    
    const config: EmailTrackingConfig = {
      trackingId,
      baseUrl,
      originalEmail: userEmail,
      campaignId,
      leadId
    };

    const processed = this.processEmailForTracking(htmlContent, subject, config);
    
    return {
      html: processed.html,
      subject: processed.subject,
      headers: processed.headers,
      trackingId
    };
  }
  // Create email tracking record in database
  async createTrackingRecord(
    config: EmailTrackingConfig,
    emailData: {
      subject: string;
      recipient: string;
      provider: string;
      messageId?: string;
    },
    supabase: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('email_tracking')
        .insert([{
          user_id: config.originalEmail, // This should be user_id, not email
          campaign_id: config.campaignId,
          lead_id: config.leadId,
          email_address: emailData.recipient,
          subject: emailData.subject,
          tracking_id: config.trackingId,
          message_id: emailData.messageId,
          provider: emailData.provider,
          status: 'sent'
        }]);

      if (error) {
        console.error('Failed to create tracking record:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error creating tracking record:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Store tracked links in database
  async storeTrackedLinks(
    trackingId: string,
    trackedLinks: Array<{ original: string; tracking: string; text: string }>,
    supabase: any
  ): Promise<void> {
    if (trackedLinks.length === 0) return;

    try {
      const linkData = trackedLinks.map((link, index) => ({
        tracking_id: trackingId,
        original_url: link.original,
        tracking_url: link.tracking,
        link_text: link.text,
        position_in_email: index + 1
      }));

      const { error } = await supabase
        .from('tracked_links')
        .insert(linkData);

      if (error) {
        console.error('Failed to store tracked links:', error);
      }
    } catch (error) {
      console.error('Error storing tracked links:', error);
    }
  }
}

// Export singleton instance
export const emailTracking = EmailTrackingManager.getInstance();

// Utility functions for email tracking
export const EmailTrackingUtils = {
  // Validate tracking ID format
  isValidTrackingId: (trackingId: string): boolean => {
    return /^track_\d+_[a-z0-9]+$/.test(trackingId);
  },

  // Extract email address from various formats
  extractEmailAddress: (emailString: string): string => {
    const emailMatch = emailString.match(/<([^>]+)>/) || emailString.match(/([^\s<>]+@[^\s<>]+)/);
    return emailMatch ? emailMatch[1] : emailString;
  },

  // Clean email body for storage
  cleanEmailBody: (body: string): string => {
    // Remove excessive whitespace and normalize line breaks
    return body
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .substring(0, 5000); // Limit to 5000 characters
  },

  // Check if email is likely a reply
  isEmailReply: (subject: string, body: string): boolean => {
    const replyIndicators = [
      /^re:/i,
      /^fwd?:/i,
      /^reply/i,
      /wrote:/i,
      /on.*wrote:/i,
      /-----original message-----/i,
      /from:.*sent:/i
    ];

    return replyIndicators.some(pattern => 
      pattern.test(subject) || pattern.test(body)
    );
  },

  // Generate webhook URL for email provider setup
  generateWebhookUrl: (baseUrl: string): string => {
    return `${baseUrl}/functions/v1/email-webhook-handler`;
  }
};