import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    console.log('Campaign scheduler running...');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const now = new Date();

    // Get all active campaigns that are due to run
    const { data: campaigns, error } = await supabaseClient
      .from('campaigns')
      .select('*')
      .eq('status', 'active')
      .or(`next_run_at.is.null,next_run_at.lt.${now.toISOString()}`);

    if (error) {
      console.error('Error fetching campaigns:', error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    if (!campaigns || campaigns.length === 0) {
      console.log('No campaigns due to run');
      return new Response(JSON.stringify({ success: true, processed: 0 }), { status: 200 });
    }

    console.log(`Found ${campaigns.length} campaigns to process`);

    // Process each campaign
    for (const campaign of campaigns) {
      try {
        console.log(`Triggering batch for campaign: ${campaign.id}`);
        
        // Trigger batch processing
        await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-batch`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
          },
          body: JSON.stringify({
            campaign_id: campaign.id,
          }),
        });

        // Calculate next run time
        const frequency = campaign.frequency_config.type;
        const nextRun = new Date();
        
        switch (frequency) {
          case 'hourly':
            nextRun.setHours(nextRun.getHours() + 1);
            break;
          case 'daily':
            nextRun.setDate(nextRun.getDate() + 1);
            // Set to configured time
            const [hours, minutes] = campaign.frequency_config.time.split(':');
            nextRun.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            break;
          case 'weekly':
            nextRun.setDate(nextRun.getDate() + 7);
            break;
          default:
            nextRun.setDate(nextRun.getDate() + 1);
        }

        // Update next_run_at
        await supabaseClient
          .from('campaigns')
          .update({ next_run_at: nextRun.toISOString() })
          .eq('id', campaign.id);

        console.log(`Campaign ${campaign.id} scheduled for next run at ${nextRun.toISOString()}`);
      } catch (error) {
        console.error(`Error processing campaign ${campaign.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: campaigns.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in campaign-scheduler:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
