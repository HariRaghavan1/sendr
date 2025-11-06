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

    // Build natural language query from target criteria
    const queryParts: string[] = [];
    
    if (target_criteria.job_titles?.length) {
      queryParts.push(target_criteria.job_titles.join(' or '));
    }
    
    if (target_criteria.companies?.length) {
      queryParts.push(`at ${target_criteria.companies.join(' or ')}`);
    }
    
    if (target_criteria.location) {
      queryParts.push(`in ${target_criteria.location}`);
    }
    
    if (target_criteria.industry) {
      queryParts.push(`in ${target_criteria.industry} industry`);
    }
    
    const query = queryParts.join(' ') || 'professionals';
    const searchUrl = `https://search.clado.ai/api/search?query=${encodeURIComponent(query)}&limit=100&advanced_filtering=true`;
    
    console.log('Clado search:', query);

    // Call new Clado Search API
    const cladoResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${settings.clado_api_key}`,
        'Content-Type': 'application/json',
      },
    });

    if (!cladoResponse.ok) {
      const errorText = await cladoResponse.text();
      throw new Error(`Clado API error (${cladoResponse.status}): ${errorText}`);
    }

    const cladoData = await cladoResponse.json();

    // Parse new response format
    const normalizedProspects = (cladoData.results || []).map((result: any) => ({
      name: result.profile?.name || 'Unknown',
      email: '', // Will be enriched separately if requested
      title: result.experience?.[0]?.title || '',
      company: result.experience?.[0]?.company_name || '',
      linkedin_url: result.profile?.linkedin_url || '',
    }));

    console.log(`Found ${normalizedProspects.length} prospects from Clado`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        prospects: normalizedProspects,
        count: normalizedProspects.length,
        message: `Found ${normalizedProspects.length} prospects` 
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
