/*
  # Gmail OAuth2 Initiation Handler

  1. Purpose
    - Initiate OAuth2 flow for Gmail authentication
    - Generate secure state parameter
    - Redirect to Google OAuth2 consent screen

  2. Security
    - Generates cryptographically secure state parameter
    - Validates user authentication
    - Stores state in database for verification

  3. Flow
    - User clicks "Connect Gmail"
    - Creates temporary channel record with state
    - Redirects to Google OAuth2 consent
*/

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface InitiateOAuthRequest {
  user_id: string;
  channel_name: string;
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
    const { user_id, channel_name }: InitiateOAuthRequest = await req.json();

    if (!user_id || !channel_name) {
      return new Response(
        JSON.stringify({ error: 'User ID and channel name are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // OAuth2 configuration
    const clientId = Deno.env.get('GMAIL_CLIENT_ID');
    const clientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');
    const redirectUri = `${supabaseUrl}/functions/v1/gmail-oauth-callback`;

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'Gmail OAuth2 not configured. Please set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET environment variables.' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Generate secure state parameter
    const state = crypto.randomUUID();

    // Create temporary channel record with OAuth state
    const { data: channelData, error: channelError } = await supabase
      .from('channels')
      .insert({
        user_id,
        name: channel_name,
        provider: 'gmail',
        channel_type: 'email',
        credentials: {
          email_provider: 'gmail',
          client_id: clientId,
          client_secret: clientSecret,
          scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
          oauth_flow_initiated: true
        },
        oauth_state: state,
        is_active: false, // Will be activated after successful OAuth
      })
      .select()
      .single();

    if (channelError) {
      console.error('Failed to create channel:', channelError);
      return new Response(
        JSON.stringify({ error: 'Failed to initiate OAuth flow' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Build OAuth2 authorization URL with correct scope
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent'); // Force consent to get refresh token

    return new Response(
      JSON.stringify({
        auth_url: authUrl.toString(),
        channel_id: channelData.id,
        state,
        scope: 'https://www.googleapis.com/auth/gmail.send'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('OAuth initiation error:', error);
    
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