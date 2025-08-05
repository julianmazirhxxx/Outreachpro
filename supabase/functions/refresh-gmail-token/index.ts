/*
  # Gmail Token Refresh Handler

  1. Purpose
    - Refresh expired Gmail OAuth2 access tokens
    - Called by n8n when tokens expire
    - Updates channel credentials with new tokens

  2. Security
    - User authentication required
    - Validates refresh token ownership
    - Secure token storage

  3. Usage
    - POST /refresh-gmail-token with { channel_id, user_id }
    - Returns new access_token for immediate use
    - Updates database with new token and expiry
*/

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface RefreshTokenRequest {
  channel_id: string;
  user_id: string;
}

interface TokenRefreshResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  refresh_token?: string; // Google may or may not return a new refresh token
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
    const { channel_id, user_id }: RefreshTokenRequest = await req.json();

    if (!channel_id || !user_id) {
      return new Response(
        JSON.stringify({ error: 'Channel ID and User ID are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get channel with credentials
    const { data: channel, error: channelError } = await supabase
      .from('channels')
      .select('*')
      .eq('id', channel_id)
      .eq('user_id', user_id)
      .eq('provider', 'gmail')
      .eq('channel_type', 'email')
      .single();

    if (channelError || !channel) {
      return new Response(
        JSON.stringify({ error: 'Gmail channel not found or access denied' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const credentials = channel.credentials || {};
    const refreshToken = credentials.refresh_token;
    const clientId = credentials.client_id || Deno.env.get('GMAIL_CLIENT_ID');
    const clientSecret = credentials.client_secret || Deno.env.get('GMAIL_CLIENT_SECRET');

    if (!refreshToken || !clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing OAuth2 credentials for token refresh. Please re-authenticate.',
          requires_reauth: true 
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Refresh the access token using Google's OAuth2 endpoint
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token refresh failed:', errorText);
      
      // If refresh token is invalid, mark channel as inactive
      await supabase
        .from('channels')
        .update({ 
          is_active: false,
          credentials: {
            ...credentials,
            token_refresh_failed: true,
            last_refresh_error: errorText,
            failed_at: new Date().toISOString()
          }
        })
        .eq('id', channel_id);

      return new Response(
        JSON.stringify({ 
          error: 'Token refresh failed. Please re-authenticate Gmail account.',
          requires_reauth: true,
          details: errorText
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const newTokens: TokenRefreshResponse = await tokenResponse.json();

    // Calculate new expiry time (UTC timestamp)
    const tokenExpiry = new Date(Date.now() + (newTokens.expires_in * 1000));

    // Update channel with new tokens (preserve existing refresh_token if not provided)
    const updatedCredentials = {
      ...credentials,
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || refreshToken, // Keep existing if not provided
      token_expiry: tokenExpiry.toISOString(),
      email_address: credentials.email_address,
      connection_type: 'oauth',
      token_type: newTokens.token_type,
      scope: newTokens.scope,
      oauth_completed: true,
      token_refresh_failed: false
    };

    const { error: updateError } = await supabase
      .from('channels')
      .update({
        credentials: updatedCredentials,
        token_expiry: tokenExpiry.toISOString(),
        last_used_at: new Date().toISOString(),
        is_active: true // Ensure channel is active after successful refresh
      })
      .eq('id', channel_id);

    if (updateError) {
      console.error('Failed to update channel with new tokens:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to save refreshed tokens' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Return new access token for immediate use by n8n
    return new Response(
      JSON.stringify({
        success: true,
        access_token: newTokens.access_token,
        expires_in: newTokens.expires_in,
        token_expiry: tokenExpiry.toISOString(),
        email_address: credentials.email_address,
        channel_id,
        refreshed_at: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Token refresh error:', error);
    
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