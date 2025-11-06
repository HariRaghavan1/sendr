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

    const { workflow_id, execution_id } = await req.json();

    console.log('Starting workflow execution:', { workflow_id, execution_id });

    // Get workflow details
    const { data: workflow, error: workflowError } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflow_id)
      .single();

    if (workflowError || !workflow) {
      throw new Error('Workflow not found');
    }

    const config = workflow.workflow_config || {};
    const targetCriteria = config.target_criteria || {};
    const instructions = workflow.instructions || '';

    // Add initial log
    await updateExecutionLog(supabase, execution_id, 'Test run started');

    // Find prospects (limit to 5 for test runs)
    await updateExecutionLog(supabase, execution_id, 'Finding prospects...');
    
    // For test runs, create mock prospects instead of calling external API
    const mockProspects = [
      {
        id: crypto.randomUUID(),
        name: 'Dr. Sarah Johnson',
        email: 'sarah.johnson@example.edu',
        title: 'Associate Professor',
        company: 'University of California',
        linkedin_url: 'https://linkedin.com/in/sarahjohnson',
      },
      {
        id: crypto.randomUUID(),
        name: 'Prof. Michael Chen',
        email: 'michael.chen@example.edu',
        title: 'Professor',
        company: 'Stanford University',
        linkedin_url: 'https://linkedin.com/in/michaelchen',
      },
      {
        id: crypto.randomUUID(),
        name: 'Dr. Emily Rodriguez',
        email: 'emily.rodriguez@example.edu',
        title: 'Assistant Professor',
        company: 'MIT',
        linkedin_url: 'https://linkedin.com/in/emilyrodriguez',
      },
    ];
    
    const prospects = mockProspects;

    if (prospects.length === 0) {
      await updateExecutionLog(supabase, execution_id, 'No prospects found matching criteria');
      await completeExecution(supabase, execution_id);
      
      return new Response(
        JSON.stringify({ 
          execution_id,
          message: 'No prospects found',
          prospects_processed: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update total prospects
    await supabase
      .from('workflow_executions')
      .update({ 
        total_prospects: prospects.length,
        prospects_found: prospects.length 
      })
      .eq('id', execution_id);

    await updateExecutionLog(supabase, execution_id, `Found ${prospects.length} prospects`);

    // Process each prospect
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < prospects.length; i++) {
      const prospect = prospects[i];
      
      try {
        await updateExecutionLog(
          supabase, 
          execution_id, 
          `Processing prospect ${i + 1}/${prospects.length}: ${prospect.name || 'Unknown'}`
        );

        // Generate email using workflow instructions
        await updateExecutionLog(supabase, execution_id, `Generating email for ${prospect.name}...`);
        
        const { data: emailData, error: emailError } = await supabase.functions.invoke('generate-email', {
          body: {
            prospect,
            campaign: {
              ...workflow,
              custom_prompt: instructions,
              goal: config.goal || 'meeting',
              tone: config.tone || 'professional',
            },
          },
        });

        if (emailError) {
          throw new Error(`Email generation failed: ${emailError.message}`);
        }

        const { subject, body } = emailData;

        // For test runs, we don't save to emails table or send
        await updateExecutionLog(
          supabase, 
          execution_id, 
          `✓ Email generated for ${prospect.email} (not sent - test run)`
        );

        successCount++;

      } catch (error: any) {
        console.error(`Error processing prospect ${prospect.name}:`, error);
        await updateExecutionLog(
          supabase, 
          execution_id, 
          `✗ Failed to process ${prospect.name}: ${error.message}`
        );
        failCount++;
      }

      // Update progress
      await supabase
        .from('workflow_executions')
        .update({ 
          emails_generated: successCount,
          execution_log: [] // Will be populated by updateExecutionLog
        })
        .eq('id', execution_id);
    }

    // Complete execution
    await updateExecutionLog(
      supabase, 
      execution_id, 
      `Test run completed: ${successCount} successful, ${failCount} failed`
    );
    
    await completeExecution(supabase, execution_id);

    return new Response(
      JSON.stringify({
        execution_id,
        message: 'Test run completed',
        prospects_processed: prospects.length,
        success_count: successCount,
        fail_count: failCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in execute-workflow:', error);
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
    .from('workflow_executions')
    .select('execution_log')
    .eq('id', executionId)
    .single();

  const logs = execution?.execution_log || [];
  logs.push({
    message,
    timestamp: new Date().toISOString(),
  });

  await supabase
    .from('workflow_executions')
    .update({ execution_log: logs })
    .eq('id', executionId);
}

async function completeExecution(supabase: any, executionId: string) {
  await supabase
    .from('workflow_executions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', executionId);
}

async function failExecution(supabase: any, executionId: string, message: string) {
  await updateExecutionLog(supabase, executionId, `Error: ${message}`);
  
  await supabase
    .from('workflow_executions')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: message,
    })
    .eq('id', executionId);
}
