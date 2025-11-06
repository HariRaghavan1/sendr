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
      return new Response(
        JSON.stringify({ execution_id, message: 'Workflow not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const config = workflow.workflow_config || {};
    const targetCriteria = config.target_criteria || {};
    const instructions = workflow.instructions || '';

    // Start log
    await updateExecutionLog(supabase, execution_id, '🚀 Test run started');

    // Get user's API keys
    await updateExecutionLog(supabase, execution_id, '🔑 Checking API configuration...');
    
    const { data: settings } = await supabase
      .from('user_settings')
      .select('clado_api_key, openai_api_key')
      .eq('user_id', user.id)
      .single();

    if (!settings?.clado_api_key || !settings?.openai_api_key) {
      const missing = [];
      if (!settings?.clado_api_key) missing.push('Clado API key');
      if (!settings?.openai_api_key) missing.push('OpenAI API key');
      
      const errorMsg = `Missing: ${missing.join(', ')}. Please configure in Settings.`;
      await updateExecutionLog(supabase, execution_id, `❌ ${errorMsg}`);
      await failExecution(supabase, execution_id, errorMsg);
      
      return new Response(
        JSON.stringify({ execution_id, message: errorMsg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    await updateExecutionLog(supabase, execution_id, '✅ API keys validated');

    // Find prospects (limit to 5 for test runs)
    await updateExecutionLog(supabase, execution_id, '🔍 Searching for prospects via Clado API...');
    console.log('Calling Clado with criteria:', targetCriteria);
    
    let prospects: any[] = [];
    try {
      const cladoResponse = await fetch('https://api.clado.ai/v1/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.clado_api_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          criteria: targetCriteria,
          limit: 5,
        }),
      });

      console.log('Clado response status:', cladoResponse.status);

      if (!cladoResponse.ok) {
        const errorText = await cladoResponse.text();
        console.error('Clado error response:', errorText);
        throw new Error(`Clado API returned ${cladoResponse.status}: ${errorText}`);
      }

      const cladoData = await cladoResponse.json();
      prospects = (cladoData.results || []).map((result: any) => ({
        id: crypto.randomUUID(),
        name: result.name || 'Unknown',
        email: result.email || '',
        title: result.title || '',
        company: result.company || '',
        linkedin_url: result.linkedin_url || '',
      }));
      
      await updateExecutionLog(supabase, execution_id, `✅ Found ${prospects.length} prospects from Clado`);
      console.log(`Retrieved ${prospects.length} prospects`);
      
    } catch (error: any) {
      const errorMsg = `Clado API error: ${error.message}`;
      console.error('Clado fetch failed:', error);
      await updateExecutionLog(supabase, execution_id, `❌ ${errorMsg}`);
      await failExecution(supabase, execution_id, errorMsg);
      
      return new Response(
        JSON.stringify({ execution_id, message: errorMsg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (prospects.length === 0) {
      await updateExecutionLog(supabase, execution_id, '⚠️ No prospects found matching criteria. Test complete.');
      await completeExecution(supabase, execution_id);
      return new Response(
        JSON.stringify({ execution_id, message: 'No prospects found', prospects_processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update total prospects
    await supabase
      .from('workflow_executions')
      .update({ total_prospects: prospects.length, prospects_found: prospects.length })
      .eq('id', execution_id);

    await updateExecutionLog(supabase, execution_id, `📧 Starting email generation for ${prospects.length} prospects...`);

    // Process each prospect
    let successCount = 0;
    let failCount = 0;

        for (let i = 0; i < prospects.length; i++) {
          const prospect = prospects[i];
          
          try {
            await updateExecutionLog(
              supabase, 
              execution_id, 
              `🤖 Generating email ${i + 1}/${prospects.length} for ${prospect.name}...`
            );
            
            console.log(`Processing prospect ${i + 1}: ${prospect.name}`);

            // Build prompts
            const toneMap: Record<string, string> = {
              formal: 'professional and formal',
              casual: 'friendly and conversational',
              witty: 'playful and witty',
            };
            const toneInstruction = toneMap[config.tone] || 'friendly and conversational';

            const goalMap: Record<string, string> = {
              demo: 'book a product demo',
              meeting: 'schedule a quick meeting',
              partnership: 'explore a potential partnership',
              other: 'start a conversation',
            };
            const goalInstruction = goalMap[config.goal] || 'start a conversation';

            const systemPrompt = `You are an expert cold email writer. Write personalized, compelling emails that feel human and conversational. \n\nGuidelines:\n- Keep it under 120 words\n- Use a ${toneInstruction} tone\n- Goal is to ${goalInstruction}\n- Create curiosity, don't hard sell\n- Focus on the prospect's role and potential pain points\n- End with a clear, low-pressure call to action`;

            const userPrompt = `Write a cold email to ${prospect.name}, ${prospect.title || 'professional'} at ${prospect.company || 'their company'}.\n\n${instructions ? `Campaign instructions: ${instructions}` : ''}\n\nTarget criteria:\n${JSON.stringify(targetCriteria, null, 2)}\n\nWrite a compelling subject line and email body that opens a conversation.`;

            // Generate email using OpenAI
            console.log(`Calling OpenAI for prospect ${i + 1}`);
            
            const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${settings.openai_api_key}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gpt-5-2025-08-07',
                messages: [
                  { role: 'system', content: systemPrompt },
                  { role: 'user', content: userPrompt }
                ],
                max_completion_tokens: 300,
              }),
            });

            console.log(`OpenAI response status for prospect ${i + 1}:`, openaiResponse.status);

            if (!openaiResponse.ok) {
              const errorText = await openaiResponse.text();
              console.error(`OpenAI error for prospect ${i + 1}:`, errorText);
              throw new Error(`OpenAI API error: ${errorText}`);
            }

            const openaiData = await openaiResponse.json();
            const generatedContent = openaiData.choices[0].message.content;

            // Parse subject and body
            const lines = generatedContent.split('\n');
            let subject = '';
            let body = '';
            
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].toLowerCase().startsWith('subject:')) {
                subject = lines[i].replace(/^subject:\\s*/i, '').trim();
              } else if (subject && lines[i].trim()) {
                body = lines.slice(i).join('\n').trim();
                break;
              }
            }

            if (!subject) {
              subject = 'Quick question';
              body = generatedContent;
            }

            // For test runs, we DON'T save to database or send
            await updateExecutionLog(
              supabase, 
              execution_id, 
              `✅ Generated email ${i + 1}/${prospects.length}\n📧 To: ${prospect.email}\n📝 Subject: ${subject}\n(Test mode - not sent)`
            );
            
            console.log(`Successfully generated email for ${prospect.name}`);
            successCount++;

          } catch (error: any) {
            console.error(`Error processing prospect ${prospect.name}:`, error);
            await updateExecutionLog(
              supabase, 
              execution_id, 
              `❌ Failed for ${prospect.name}: ${error.message}`
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
          `🎉 Test run complete!\n✅ ${successCount} emails generated\n❌ ${failCount} failed`
        );
        
        console.log(`Test run finished: ${successCount} success, ${failCount} failed`);
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
    // Don't fail the HTTP call; surface error in body and let UI read logs realtime
    return new Response(
      JSON.stringify({ error: error.message, ok: false }),
      { 
        status: 200,
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
