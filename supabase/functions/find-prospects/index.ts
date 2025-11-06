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
    const requestBody = await req.json();
    const { campaign_id, target_criteria, enrich_contacts, initiate_deep_research, limit } = requestBody;
    
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

    // Import Clado helpers
    const { searchCladoProspects } = await import('../_shared/clado-helpers.ts');
    
    // Search for prospects with deep research and contact enrichment
    const normalizedProspects = await searchCladoProspects(
      target_criteria,
      settings.clado_api_key,
      {
        limit: limit || 100,
        advanced_filtering: true,
        companies: target_criteria.companies,
        initiateDeepResearch: initiate_deep_research !== false, // Default to true
        enrichContacts: enrich_contacts !== false, // Default to true
      }
    );

    console.log(`Found ${normalizedProspects.length} prospects from Clado`);
    
    // Log deep research job IDs if available
    const deepResearchJobIds = [...new Set(normalizedProspects.map(p => p.deep_research_job_id).filter(Boolean))];
    if (deepResearchJobIds.length > 0) {
      console.log(`Deep research jobs initiated: ${deepResearchJobIds.join(', ')}`);
    }
    
    // Log contact enrichment stats
    const enrichedCount = normalizedProspects.filter(p => p.email || p.phone).length;
    const emailCount = normalizedProspects.filter(p => p.email).length;
    const phoneCount = normalizedProspects.filter(p => p.phone).length;
    console.log(`Contact enrichment: ${enrichedCount}/${normalizedProspects.length} prospects enriched (${emailCount} emails, ${phoneCount} phones)`);

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
