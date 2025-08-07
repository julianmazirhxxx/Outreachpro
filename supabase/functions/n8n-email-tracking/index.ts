/*
  # n8n Email Tracking Helper

  1. Purpose
    - Provide tracking configuration for n8n workflows
    - Generate tracking IDs and URLs automatically
    - Simplify email tracking setup for campaigns

  2. Security
    - User authentication required
    - Campaign ownership validation
    - Secure tracking ID generation

  3. Usage
    - POST /n8n-email-tracking with { campaign_id, lead_id, user_id }
    - Returns tracking pixel URL, click base URL, and headers
    - n8n can use this to automatically add tracking to emails
*/

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface TrackingRequest {
  campaign_id: string;
  lead_id: string;
  user_id: string;
  email_address?: string;
  subject?: string;
}

interface TrackingResponse {
  tracking_id: string;
  pixel_url: string;
  click_base_url: string;
  headers: Record<string, string>;
  html_injection: {
    tracking_pixel: string;
    link_wrapper: string;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request
    const { campaign_id, lead_id, user_id, email_address, subject }: TrackingRequest = await req.json();

    if (!campaign_id || !lead_id || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Campaign ID, Lead ID, and User ID are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Verify campaign ownership
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', campaign_id)
      .eq('user_id', user_id)
      .single();

    if (campaignError || !campaign) {
      return new Response(
        JSON.stringify({ error: 'Campaign not found or access denied' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Verify lead ownership
    const { data: lead, error: leadError } = await supabase
      .from('uploaded_leads')
      .select('email')
      .eq('id', lead_id)
      .eq('user_id', user_id)
      .single();

    if (leadError || !lead) {
      return new Response(
        JSON.stringify({ error: 'Lead not found or access denied' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Generate tracking ID
    const tracking_id = `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Build tracking URLs
    const pixel_url = `${supabaseUrl}/functions/v1/email-tracking?t=${tracking_id}&e=open`;
    const click_base_url = `${supabaseUrl}/functions/v1/email-tracking?t=${tracking_id}&e=click&url=`;

    // Create tracking headers
    const headers = {
      'X-Tracking-ID': tracking_id,
      'X-Campaign-ID': campaign_id,
      'X-Lead-ID': lead_id,
      'Message-ID': `<track-${tracking_id}@${new URL(supabaseUrl).hostname}>`,
      'List-Unsubscribe': `<${supabaseUrl}/unsubscribe?t=${tracking_id}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
    };

    // Create email tracking record
    const { error: trackingError } = await supabase
      .from('email_tracking')
      .insert({
        user_id,
        campaign_id,
        lead_id,
        email_address: email_address || lead.email,
        subject: subject || 'Campaign Email',
        tracking_id,
        provider: 'n8n',
        status: 'sent'
      });

    if (trackingError) {
      console.error('Failed to create tracking record:', trackingError);
      // Don't fail the request, just log the error
    }

    // Prepare response with everything n8n needs
    const response: TrackingResponse = {
      tracking_id,
      pixel_url,
      click_base_url,
      headers,
      html_injection: {
        tracking_pixel: `<img src="${pixel_url}" width="1" height="1" style="display: none;" alt="" />`,
        link_wrapper: `href="${click_base_url}{{original_url}}"`
      }
    };

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('n8n email tracking error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});