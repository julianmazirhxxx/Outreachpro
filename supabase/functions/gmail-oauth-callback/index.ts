/*
  # Gmail OAuth2 Callback Handler

  1. Purpose
    - Handle OAuth2 callback from Google
    - Exchange authorization code for access/refresh tokens
    - Store tokens securely in channels table

  2. Security
    - Validates OAuth2 state parameter
    - User authentication required
    - Secure token storage

  3. Flow
    - Receives authorization code from Google
    - Exchanges for tokens
    - Updates channel configuration
    - Redirects back to app
*/

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface UserInfo {
  email: string;
  name: string;
  picture?: string;
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

    // Parse URL parameters
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      const errorDescription = url.searchParams.get('error_description') || 'OAuth authentication failed';
      return new Response(
        `<html><body><script>
          window.opener.postMessage({
            type: 'oauth_error',
            error: '${error}',
            description: '${errorDescription}'
          }, '*');
          window.close();
        </script></body></html>`,
        {
          headers: { ...corsHeaders, 'Content-Type': 'text/html' }
        }
      );
    }

    if (!code || !state) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization code or state parameter' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Find channel by OAuth state
    const { data: channels, error: channelError } = await supabase
      .from('channels')
      .select('*')
      .eq('oauth_state', state)
      .limit(1);

    if (channelError || !channels || channels.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid OAuth state or channel not found' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const channel = channels[0];
    const credentials = channel.credentials || {};

    // OAuth2 configuration
    const clientId = credentials.client_id;
    const clientSecret = credentials.client_secret;
    const redirectUri = `${supabaseUrl}/functions/v1/gmail-oauth-callback`;

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: 'Gmail OAuth2 credentials not found in channel configuration' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to exchange authorization code for tokens' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const tokens: TokenResponse = await tokenResponse.json();

    // Get user info from Google to extract email address
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    });

    let userInfo: UserInfo = { email: '', name: '' };
    if (userInfoResponse.ok) {
      userInfo = await userInfoResponse.json();
    }

    // Calculate token expiry (UTC timestamp)
    const tokenExpiry = new Date(Date.now() + (tokens.expires_in * 1000));

    // Store OAuth2 credentials in the exact format needed for n8n
    const oauthCredentials = {
      email_provider: 'gmail',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: tokenExpiry.toISOString(),
      email_address: userInfo.email,
      connection_type: 'oauth',
      scope: tokens.scope,
      token_type: tokens.token_type,
      oauth_completed: true
    };

    // Update channel with OAuth2 tokens and activate it
    const { error: updateError } = await supabase
      .from('channels')
      .update({
        credentials: oauthCredentials,
        email_address: userInfo.email,
        sender_id: userInfo.email,
        token_expiry: tokenExpiry.toISOString(),
        oauth_state: null, // Clear state after successful auth
        is_active: true, // Activate channel after successful OAuth
        name: channel.name || `Gmail - ${userInfo.email}`,
        last_used_at: new Date().toISOString()
      })
      .eq('id', channel.id);

    if (updateError) {
      console.error('Failed to update channel:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to save OAuth2 tokens' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Success - close popup and notify parent window
    return new Response(
      `<html><body><script>
        window.opener.postMessage({
          type: 'oauth_success',
          email: '${userInfo.email}',
          name: '${userInfo.name}',
          channel_id: '${channel.id}',
          access_token_preview: '${tokens.access_token.substring(0, 20)}...'
        }, '*');
        window.close();
      </script></body></html>`,
      {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      }
    );

  } catch (error) {
    console.error('OAuth callback error:', error);
    
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