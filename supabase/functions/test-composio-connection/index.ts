import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's Composio API key and connected account ID
    const { data: settings, error: settingsError } = await supabaseClient
      .from('user_settings')
      .select('composio_api_key, composio_connected_account_id')
      .eq('user_id', user.id)
      .single();

    if (settingsError) {
      console.error('Settings error:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user settings', details: settingsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings?.composio_api_key) {
      return new Response(
        JSON.stringify({ error: 'Composio API key not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If we have a connected account ID, test it directly
    if (settings.composio_connected_account_id) {
      const response = await fetch(
        `https://backend.composio.dev/api/v3/connected_accounts/${settings.composio_connected_account_id}`,
        {
          headers: {
            'x-api-key': settings.composio_api_key,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        return new Response(
          JSON.stringify({ error: `API returned ${response.status}: ${errorText}` }),
          { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const account = await response.json();
      const isGmail = account.toolkit?.slug?.toLowerCase() === 'gmail' ||
                     account.toolkit?.name?.toLowerCase() === 'gmail';
      
      return new Response(
        JSON.stringify({
          success: true,
          isGmail,
          status: account.status,
          account,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Otherwise, list all Gmail accounts (since user_id might be different when connected via dashboard)
    // Use toolkit_slugs filter to only get Gmail connections
    const response = await fetch(
      `https://backend.composio.dev/api/v3/connected_accounts?toolkit_slugs=GMAIL`,
      {
        headers: {
          'x-api-key': settings.composio_api_key,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `API returned ${response.status}: ${errorText}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const connections = data.items || [];
    
    // Check if any Gmail connection exists and is ACTIVE
    const activeGmail = connections.find((c: any) => 
      (c.toolkit?.slug?.toLowerCase() === 'gmail' ||
       c.toolkit?.name?.toLowerCase() === 'gmail') &&
      c.status === 'ACTIVE'
    );

    if (activeGmail) {
      // Save the actual UUID (either from 'id' or 'connected_account_id' field)
      const accountId = activeGmail.id || activeGmail.connected_account_id;
      
      // Only update if we have a valid UUID and it's not already saved
      if (accountId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId)) {
        if (!settings.composio_connected_account_id || settings.composio_connected_account_id !== accountId) {
          await supabaseClient
            .from('user_settings')
            .update({ composio_connected_account_id: accountId })
            .eq('user_id', user.id);
          console.log(`Saved connected account UUID: ${accountId}`);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          isGmail: true,
          status: activeGmail.status,
          account: activeGmail,
          accountId: accountId, // Include the actual UUID in response
          connections,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If no active Gmail found, check if there are any inactive ones
    const anyGmail = connections.some((c: any) => 
      c.toolkit?.slug?.toLowerCase() === 'gmail' ||
      c.toolkit?.name?.toLowerCase() === 'gmail'
    );

    return new Response(
      JSON.stringify({
        success: true,
        isGmail: anyGmail,
        connections,
        message: anyGmail ? 'Gmail connection found but not active' : 'No Gmail connection found',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in test-composio-connection:', error);
    const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
    const errorDetails = error?.stack || error?.details || '';
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: errorDetails,
        type: error?.name || 'Error'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

