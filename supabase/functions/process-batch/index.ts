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
    const { campaign_id } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get campaign
    const { data: campaign } = await supabaseClient
      .from('campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single();

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const batchSize = campaign.frequency_config.batch_size || 25;

    // Get pending prospects
    const { data: prospects } = await supabaseClient
      .from('prospects')
      .select('*')
      .eq('campaign_id', campaign_id)
      .eq('status', 'pending')
      .limit(batchSize);

    if (!prospects || prospects.length === 0) {
      console.log('No pending prospects for campaign:', campaign_id);
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'No pending prospects' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing ${prospects.length} prospects for campaign ${campaign_id}`);

    // Process each prospect
    for (const prospect of prospects) {
      try {
        // 1. Enrich prospect (if needed)
        if (!prospect.enrichment_data?.summary) {
          await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/enrich-prospect`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            },
            body: JSON.stringify({
              prospect_id: prospect.id,
              company: prospect.company,
            }),
          });
        }

        // 2. Generate email
        const generateResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          },
          body: JSON.stringify({
            prospect_id: prospect.id,
            campaign_id: campaign_id,
          }),
        });

        if (!generateResponse.ok) {
          console.error('Failed to generate email for prospect:', prospect.id);
          continue;
        }

        const { email } = await generateResponse.json();

        // 3. Send email
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          },
          body: JSON.stringify({
            email_id: email.id,
          }),
        });

        console.log('Successfully processed prospect:', prospect.id);
      } catch (error) {
        console.error('Error processing prospect:', prospect.id, error);
      }
    }

    // Update campaign last_run_at
    await supabaseClient
      .from('campaigns')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', campaign_id);

    return new Response(
      JSON.stringify({ success: true, processed: prospects.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in process-batch:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
