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
    const { prospect_id, company } = await req.json();
    
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

    const { data: settings } = await supabaseClient
      .from('user_settings')
      .select('perplexity_api_key')
      .eq('user_id', user.id)
      .single();

    if (!settings?.perplexity_api_key) {
      return new Response(
        JSON.stringify({ error: 'Perplexity API key not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Perplexity Sonar for company enrichment
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.perplexity_api_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [
          {
            role: 'system',
            content: 'You are a research assistant. Provide a brief summary of recent company news, funding, and updates.'
          },
          {
            role: 'user',
            content: `Find recent news and updates about ${company}. Focus on funding, product launches, and key developments.`
          }
        ],
        max_tokens: 500,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.statusText}`);
    }

    const data = await response.json();
    const enrichment = data.choices[0].message.content;

    // Update prospect with enrichment data
    const { error: updateError } = await supabaseClient
      .from('prospects')
      .update({
        enrichment_data: { summary: enrichment, enriched_at: new Date().toISOString() }
      })
      .eq('id', prospect_id);

    if (updateError) {
      throw new Error(`Failed to update prospect: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, enrichment }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in enrich-prospect:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
