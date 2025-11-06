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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    console.log('Composio auth request for user:', user.id);

    // Get Composio API key from user settings
    const { data: settings, error: settingsError } = await supabaseClient
      .from('user_settings')
      .select('composio_api_key')
      .eq('user_id', user.id)
      .single();

    if (settingsError) {
      console.error('Settings error:', settingsError);
      throw new Error('Failed to fetch user settings');
    }

    if (!settings?.composio_api_key) {
      return new Response(
        JSON.stringify({ error: 'Composio API key not configured. Please add it in Settings.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating Composio connection with entity_id:', user.id);

    // Create connection request with Composio using auth config ID
    const composioResponse = await fetch('https://backend.composio.dev/api/v2/connected-accounts/new', {
      method: 'POST',
      headers: {
        'X-API-Key': settings.composio_api_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entityId: user.id,
        authConfig: {
          id: 'ac_cgGVa0xmNPL9'  // Gmail auth config ID
        }
      }),
    });

    if (!composioResponse.ok) {
      const errorText = await composioResponse.text();
      console.error('Composio API error:', composioResponse.status, errorText);
      throw new Error(`Composio error ${composioResponse.status}: ${errorText}`);
    }

    const data = await composioResponse.json();
    console.log('Composio response:', JSON.stringify(data));

    // Extract redirect URL from various possible response structures
    const redirectUrl = data.connectionData?.val?.redirect_url || 
                       data.connectionData?.redirect_url || 
                       data.redirect_url ||
                       data.redirectUrl;

    if (!redirectUrl) {
      console.error('No redirect URL found in response:', JSON.stringify(data));
      throw new Error('No redirect URL received from Composio');
    }

    console.log('Returning redirect URL:', redirectUrl);

    return new Response(
      JSON.stringify({ redirect_url: redirectUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in composio-auth:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
