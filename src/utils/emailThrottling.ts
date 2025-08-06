// Email throttling utilities for deliverability protection

export interface ThrottlingResult {
  canSend: boolean;
  waitSeconds: number;
  waitMinutes: number;
  lastSentAt: string | null;
  emailsSentToday: number;
  dailyLimit: number;
  timeSinceLastMinutes: number;
}

export interface EmailThrottlingConfig {
  minDelayMinutes: number;
  dailyLimit: number;
  senderEmail: string;
  channelId?: string;
}

export class EmailThrottlingManager {
  private static instance: EmailThrottlingManager;
  
  static getInstance(): EmailThrottlingManager {
    if (!EmailThrottlingManager.instance) {
      EmailThrottlingManager.instance = new EmailThrottlingManager();
    }
    return EmailThrottlingManager.instance;
  }

  // Check if email can be sent based on throttling rules
  async checkThrottling(
    userId: string,
    config: EmailThrottlingConfig
  ): Promise<ThrottlingResult> {
    try {
      const { data, error } = await supabase.rpc('check_email_throttling', {
        p_user_id: userId,
        p_sender_email: config.senderEmail,
        p_channel_id: config.channelId || null
      });

      if (error) {
        console.error('Throttling check error:', error);
        // Default to allowing send if check fails
        return {
          canSend: true,
          waitSeconds: 0,
          waitMinutes: 0,
          lastSentAt: null,
          emailsSentToday: 0,
          dailyLimit: config.dailyLimit,
          timeSinceLastMinutes: 0
        };
      }

      return {
        canSend: data.can_send,
        waitSeconds: data.wait_seconds || 0,
        waitMinutes: data.wait_minutes || 0,
        lastSentAt: data.last_sent_at,
        emailsSentToday: data.emails_sent_today || 0,
        dailyLimit: data.daily_limit || config.dailyLimit,
        timeSinceLastMinutes: data.time_since_last_minutes || 0
      };
    } catch (error) {
      console.error('Email throttling check failed:', error);
      // Default to allowing send if check fails
      return {
        canSend: true,
        waitSeconds: 0,
        waitMinutes: 0,
        lastSentAt: null,
        emailsSentToday: 0,
        dailyLimit: config.dailyLimit,
        timeSinceLastMinutes: 0
      };
    }
  }

  // Update throttling state after successful email send
  async updateThrottlingState(
    userId: string,
    senderEmail: string,
    channelId?: string
  ): Promise<void> {
    try {
      const { error } = await supabase.rpc('update_email_throttling_state', {
        p_user_id: userId,
        p_sender_email: senderEmail,
        p_channel_id: channelId || null
      });

      if (error) {
        console.error('Failed to update throttling state:', error);
      }
    } catch (error) {
      console.error('Email throttling state update failed:', error);
    }
  }

  // Calculate optimal send time for email sequence
  calculateOptimalSendTime(
    baseTime: Date,
    stepNumber: number,
    waitSeconds: number,
    throttlingMinutes: number = 5
  ): Date {
    // Base calculation from sequence timing
    const sequenceTime = new Date(baseTime.getTime() + (waitSeconds * 1000));
    
    // For email steps, ensure minimum throttling delay
    if (stepNumber > 1) {
      const throttlingTime = new Date(baseTime.getTime() + (throttlingMinutes * 60 * 1000));
      
      // Use whichever is later - sequence timing or throttling requirement
      return sequenceTime > throttlingTime ? sequenceTime : throttlingTime;
    }
    
    return sequenceTime;
  }

  // Distribute emails across time to avoid bursts
  distributeEmailTiming(
    emails: Array<{ leadId: string; scheduledAt: Date }>,
    minDelayMinutes: number = 5
  ): Array<{ leadId: string; scheduledAt: Date }> {
    if (emails.length <= 1) return emails;

    const distributed = [...emails];
    distributed.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());

    // Ensure minimum delay between consecutive emails
    for (let i = 1; i < distributed.length; i++) {
      const prevTime = distributed[i - 1].scheduledAt;
      const currentTime = distributed[i].scheduledAt;
      const minNextTime = new Date(prevTime.getTime() + (minDelayMinutes * 60 * 1000));

      if (currentTime < minNextTime) {
        distributed[i].scheduledAt = minNextTime;
      }
    }

    return distributed;
  }

  // Get throttling status for UI display
  async getThrottlingStatus(
    userId: string,
    senderEmail: string
  ): Promise<{
    isThrottled: boolean;
    nextAvailableTime: Date | null;
    emailsSentToday: number;
    dailyLimit: number;
  }> {
    try {
      const result = await this.checkThrottling(userId, {
        minDelayMinutes: 5,
        dailyLimit: 100,
        senderEmail
      });

      return {
        isThrottled: !result.canSend,
        nextAvailableTime: result.waitSeconds > 0 
          ? new Date(Date.now() + (result.waitSeconds * 1000))
          : null,
        emailsSentToday: result.emailsSentToday,
        dailyLimit: result.dailyLimit
      };
    } catch (error) {
      console.error('Failed to get throttling status:', error);
      return {
        isThrottled: false,
        nextAvailableTime: null,
        emailsSentToday: 0,
        dailyLimit: 100
      };
    }
  }
}

// Export singleton instance
export const emailThrottling = EmailThrottlingManager.getInstance();

// Utility functions for common throttling operations
export const EmailThrottlingUtils = {
  // Format wait time for user display
  formatWaitTime: (waitSeconds: number): string => {
    if (waitSeconds <= 0) return 'Ready to send';
    
    const minutes = Math.floor(waitSeconds / 60);
    const seconds = waitSeconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  },

  // Check if sender needs throttling protection
  needsThrottling: (senderEmail: string, channelType: string): boolean => {
    return channelType === 'email' && senderEmail.includes('@');
  },

  // Calculate recommended delay for email sequences
  getRecommendedEmailDelay: (stepNumber: number): number => {
    // First email: immediate
    if (stepNumber === 1) return 0;
    
    // Subsequent emails: minimum 5 minutes, recommended longer delays
    const baseDelayMinutes = 5;
    const recommendedDelays = [0, 5, 30, 120, 1440]; // 0, 5min, 30min, 2h, 24h
    
    return (recommendedDelays[stepNumber - 1] || 1440) * 60; // Convert to seconds
  },

  // Validate email sequence timing
  validateSequenceTiming: (
    sequences: Array<{ stepNumber: number; waitSeconds: number; type: string }>
  ): { isValid: boolean; warnings: string[] } => {
    const warnings: string[] = [];
    let isValid = true;

    sequences.forEach((sequence, index) => {
      if (sequence.type === 'email') {
        const waitMinutes = sequence.waitSeconds / 60;
        
        if (sequence.stepNumber > 1 && waitMinutes < 5) {
          warnings.push(
            `Step ${sequence.stepNumber}: Email delay (${waitMinutes}min) is below recommended 5-minute minimum`
          );
          isValid = false;
        }
        
        // Check for consecutive email steps
        const nextSequence = sequences[index + 1];
        if (nextSequence && nextSequence.type === 'email') {
          const totalDelay = (sequence.waitSeconds + nextSequence.waitSeconds) / 60;
          if (totalDelay < 10) {
            warnings.push(
              `Steps ${sequence.stepNumber}-${nextSequence.stepNumber}: Consecutive emails should have 10+ minute total delay`
            );
          }
        }
      }
    });

    return { isValid, warnings };
  }
};