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
    const { campaign_id, target_criteria } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get user's API key
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: settings } = await supabaseClient
      .from('user_settings')
      .select('clado_api_key')
      .eq('user_id', user.id)
      .single();

    if (!settings?.clado_api_key) {
      return new Response(
        JSON.stringify({ error: 'Clado API key not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Clado API (example - adjust based on actual API)
    const cladoResponse = await fetch('https://api.clado.ai/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.clado_api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        industry: target_criteria.industry,
        location: target_criteria.location,
        job_titles: target_criteria.job_titles,
        limit: 100,
      }),
    });

    if (!cladoResponse.ok) {
      throw new Error(`Clado API error: ${cladoResponse.statusText}`);
    }

    const prospects = await cladoResponse.json();

    // Insert prospects into database
    const prospectsToInsert = prospects.results?.map((p: any) => ({
      campaign_id,
      user_id: user.id,
      name: p.name,
      email: p.email,
      title: p.title,
      company: p.company,
      linkedin_url: p.linkedin_url,
    })) || [];

    if (prospectsToInsert.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('prospects')
        .insert(prospectsToInsert);

      if (insertError) {
        console.error('Error inserting prospects:', insertError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: prospectsToInsert.length,
        message: `Found ${prospectsToInsert.length} prospects` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in find-prospects:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
