import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { campaign_id, execution_type, max_prospects = 10, skip_sending = false, email_template = null } = await req.json();

    console.log('Starting campaign execution:', { campaign_id, execution_type, max_prospects, skip_sending });

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single();

    if (campaignError || !campaign) {
      throw new Error('Campaign not found');
    }

    // Create execution record
    const { data: execution, error: execError } = await supabase
      .from('campaign_executions')
      .insert({
        campaign_id,
        user_id: user.id,
        execution_type,
        status: 'running',
        total_prospects: 0,
        processed_prospects: 0,
        progress_logs: [],
      })
      .select()
      .single();

    if (execError) {
      throw new Error('Failed to create execution record');
    }

    // Add initial log
    await updateExecutionLog(supabase, execution.id, 'Execution started');

    // Find prospects
    await updateExecutionLog(supabase, execution.id, 'Finding prospects...');
    
    const { data: prospectsData, error: findError } = await supabase.functions.invoke('find-prospects', {
      body: {
        campaign_id,
        target_criteria: campaign.target_criteria,
        limit: max_prospects,
      },
    });

    if (findError) {
      await failExecution(supabase, execution.id, `Failed to find prospects: ${findError.message}`);
      throw findError;
    }

    const prospects = prospectsData?.prospects || [];
    
    if (prospects.length === 0) {
      await updateExecutionLog(supabase, execution.id, 'No prospects found matching criteria');
      await completeExecution(supabase, execution.id);
      
      return new Response(
        JSON.stringify({ 
          execution_id: execution.id,
          message: 'No prospects found',
          prospects_processed: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update total prospects
    await supabase
      .from('campaign_executions')
      .update({ total_prospects: prospects.length })
      .eq('id', execution.id);

    await updateExecutionLog(supabase, execution.id, `Found ${prospects.length} prospects`);

    // Process each prospect
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < prospects.length; i++) {
      const prospect = prospects[i];
      
      try {
        await updateExecutionLog(
          supabase, 
          execution.id, 
          `Processing prospect ${i + 1}/${prospects.length}: ${prospect.name || 'Unknown'}`
        );

        // Insert prospect into database to get UUID
        const { data: savedProspect, error: prospectError } = await supabase
          .from('prospects')
          .insert({
            campaign_id: campaign_id,
            user_id: user.id,
            name: prospect.name,
            email: prospect.email || '',
            title: prospect.title || '',
            company: prospect.company || '',
            linkedin_url: prospect.linkedin_url || '',
          })
          .select()
          .single();

        if (prospectError || !savedProspect) {
          throw new Error(`Failed to save prospect: ${prospectError?.message || 'Unknown error'}`);
        }

        console.log(`Saved prospect ${savedProspect.name} with ID ${savedProspect.id}`);

        // Generate email
        let subject, body;
        
        if (email_template) {
          // Use template with basic personalization
          await updateExecutionLog(supabase, execution.id, `Using template for ${prospect.name}...`);
          
          subject = email_template.subject
            .replace(/\{name\}/gi, prospect.name || '')
            .replace(/\{company\}/gi, prospect.company || '')
            .replace(/\{title\}/gi, prospect.title || '');
          
          body = email_template.body
            .replace(/\{name\}/gi, prospect.name || '')
            .replace(/\{company\}/gi, prospect.company || '')
            .replace(/\{title\}/gi, prospect.title || '');
        } else {
          // Generate custom email using AI
          await updateExecutionLog(supabase, execution.id, `Generating email for ${prospect.name}...`);
          
          const { data: emailData, error: emailError } = await supabase.functions.invoke('generate-email', {
            body: {
              prospect: savedProspect,
              campaign,
            },
          });

          if (emailError) {
            throw new Error(`Email generation failed: ${emailError.message}`);
          }

          subject = emailData.subject;
          body = emailData.body;
        }

        // Save email to database with the prospect_id
        const { data: savedEmail, error: saveError } = await supabase
          .from('emails')
          .insert({
            prospect_id: savedProspect.id,
            campaign_id: campaign_id,
            user_id: user.id,
            subject,
            body,
            send_status: 'pending',
          })
          .select()
          .single();

        if (saveError || !savedEmail) {
          throw new Error(`Failed to save email: ${saveError?.message || 'Unknown error'}`);
        }

        console.log(`Saved email ${savedEmail.id} for prospect ${savedProspect.name}`);

        // Send email (if not skipped and prospect has email)
        if (!skip_sending) {
          if (!prospect.email || prospect.email.trim() === '') {
            await updateExecutionLog(supabase, execution.id, `⚠️ Skipped sending for ${prospect.name} - no email address`);
            await supabase
              .from('emails')
              .update({ send_status: 'skipped', send_error: 'No email address' })
              .eq('id', savedEmail.id);
          } else {
            await updateExecutionLog(supabase, execution.id, `Sending email to ${prospect.email}...`);
            
            const { error: sendError } = await supabase.functions.invoke('send-email', {
              body: {
                email_id: savedEmail.id,
              },
            });

            if (sendError) {
              console.error(`Send failed for ${prospect.email}:`, sendError);
              await updateExecutionLog(supabase, execution.id, `✗ Failed to send to ${prospect.email}: ${sendError.message}`);
              throw new Error(`Email send failed: ${sendError.message}`);
            }

            await updateExecutionLog(supabase, execution.id, `✓ Email sent to ${prospect.email}`);
          }
        } else {
          await updateExecutionLog(supabase, execution.id, `✓ Email generated for ${prospect.name} (not sent - dry run)`);
          await supabase
            .from('emails')
            .update({ send_status: 'draft' })
            .eq('id', savedEmail.id);
        }

        successCount++;

      } catch (error: any) {
        console.error(`Error processing prospect ${prospect.name}:`, error);
        await updateExecutionLog(
          supabase, 
          execution.id, 
          `✗ Failed to process ${prospect.name}: ${error.message}`
        );
        failCount++;
      }

      // Update progress
      await supabase
        .from('campaign_executions')
        .update({ processed_prospects: i + 1 })
        .eq('id', execution.id);
    }

    // Complete execution
    await updateExecutionLog(
      supabase, 
      execution.id, 
      `Execution completed: ${successCount} successful, ${failCount} failed`
    );
    
    await completeExecution(supabase, execution.id);

    return new Response(
      JSON.stringify({
        execution_id: execution.id,
        message: 'Execution completed',
        prospects_processed: prospects.length,
        success_count: successCount,
        fail_count: failCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in execute-campaign:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function updateExecutionLog(supabase: any, executionId: string, message: string) {
  const { data: execution } = await supabase
    .from('campaign_executions')
    .select('progress_logs')
    .eq('id', executionId)
    .single();

  const logs = execution?.progress_logs || [];
  logs.push({
    message,
    timestamp: new Date().toISOString(),
  });

  await supabase
    .from('campaign_executions')
    .update({ progress_logs: logs })
    .eq('id', executionId);
}

async function completeExecution(supabase: any, executionId: string) {
  await supabase
    .from('campaign_executions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', executionId);
}

async function failExecution(supabase: any, executionId: string, message: string) {
  await updateExecutionLog(supabase, executionId, `Error: ${message}`);
  
  await supabase
    .from('campaign_executions')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', executionId);
}
