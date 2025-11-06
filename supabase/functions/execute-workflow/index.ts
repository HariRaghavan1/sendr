import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';
import {
  ExecuteWorkflowSchema,
  validateInput,
  extractAuthToken,
  checkRateLimit,
} from '../_shared/schemas.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to calculate email quality score (0-100)
function calculateEmailQuality(subject: string, body: string): number {
  let score = 50; // Start at 50

  // Subject line quality (0-30 points)
  if (subject.length >= 30 && subject.length <= 60) score += 15; // Optimal length
  else if (subject.length > 60) score -= 10; // Too long
  if (!subject.match(/^(re:|fwd:)/i)) score += 5; // Not a reply/forward
  if (subject.match(/\?/)) score += 5; // Has a question
  if (!subject.match(/[!]{2,}/)) score += 5; // No excessive exclamation

  // Body quality (0-50 points)
  const wordCount = body.split(/\s+/).length;
  if (wordCount >= 50 && wordCount <= 150) score += 20; // Optimal length
  else if (wordCount < 30) score -= 15; // Too short
  else if (wordCount > 200) score -= 10; // Too long

  // Check for personalization
  if (body.match(/\{|\[/)) score += 10; // Has personalization variables

  // Check for call-to-action
  if (body.match(/(schedule|call|meeting|demo|chat)/i)) score += 10;

  // Penalize spammy words
  if (body.match(/(guaranteed|free|act now|limited time)/i)) score -= 15;

  // Ensure score is between 0-100
  return Math.max(0, Math.min(100, score));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables');
    }

    // Extract and validate auth token
    const token = extractAuthToken(req.headers);
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: 10 workflow executions per minute per user
    const rateLimitResult = checkRateLimit(`workflow:${user.id}`, 10, 60000);
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Rate limit exceeded',
          resetAt: new Date(rateLimitResult.resetAt).toISOString(),
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResult.resetAt.toString(),
          },
        }
      );
    }

    // Parse and validate request body
    const requestBody = await req.json();
    const { workflow_id, execution_id } = validateInput(ExecuteWorkflowSchema, requestBody);

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
    await updateExecutionLog(supabase, execution_id, '[1/3] 🚀 Test run started - Initializing...');

    // Get user's API keys
    await updateExecutionLog(supabase, execution_id, '[1/3] 🔑 Checking API configuration...');

    const { data: settings } = await supabase
      .from('user_settings')
      .select('clado_api_key')
      .eq('user_id', user.id)
      .single();

    // OpenAI key is stored as edge function secret, not in user settings
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!settings?.clado_api_key) {
      const errorMsg = 'Missing: Clado API key. Please configure in Settings.';
      await updateExecutionLog(supabase, execution_id, `❌ ${errorMsg}`);
      await failExecution(supabase, execution_id, errorMsg);

      return new Response(
        JSON.stringify({ execution_id, message: errorMsg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!openaiApiKey) {
      const errorMsg = 'OpenAI API key not configured in edge function secrets.';
      await updateExecutionLog(supabase, execution_id, `❌ ${errorMsg}`);
      await failExecution(supabase, execution_id, errorMsg);

      return new Response(
        JSON.stringify({ execution_id, message: errorMsg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await updateExecutionLog(supabase, execution_id, '[1/3] ✅ API keys validated');

    // Find prospects (limit to 5 for test runs)
    // Find prospects using PARALLEL multi-query strategy
    await updateExecutionLog(supabase, execution_id, '[2/3] 🔍 Clado: Launching parallel searches...');
    console.log('Calling Clado with criteria:', targetCriteria);

    const searchStartTime = Date.now();
    let prospects: any[] = [];
    
    try {
      // Helper function to build query from criteria
      const buildQuery = (criteria: any) => {
        const queryParts: string[] = [];

        if (criteria.job_titles) {
          const titles = Array.isArray(criteria.job_titles)
            ? criteria.job_titles.join(' or ')
            : criteria.job_titles;
          queryParts.push(titles);
        }
        if (criteria.industry) {
          queryParts.push(`in ${criteria.industry}`);
        }
        if (criteria.location) {
          queryParts.push(`located in ${criteria.location}`);
        }
        if (criteria.company_size) {
          queryParts.push(`at ${criteria.company_size} companies`);
        }

        return queryParts.join(' ') || 'professionals';
      };

      // Helper function to try Clado search with timeout
      const trySearchWithTimeout = async (query: string, description: string, timeoutMs: number = 30000) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
          await updateExecutionLog(supabase, execution_id, `[2/3] 🔍 Query "${description}": ${query}`);
          console.log(`Launching query: ${description}`);

          const cladoApiUrl = new URL('https://search.clado.ai/api/search');
          cladoApiUrl.searchParams.append('query', query);
          cladoApiUrl.searchParams.append('limit', '5');

          const startTime = Date.now();
          const cladoResponse = await fetch(cladoApiUrl.toString(), {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${settings.clado_api_key}`,
            },
            signal: controller.signal,
          });

          clearTimeout(timeout);
          const duration = ((Date.now() - startTime) / 1000).toFixed(1);

          if (!cladoResponse.ok) {
            const errorText = await cladoResponse.text();
            console.error(`Clado error for ${description}:`, errorText);
            await updateExecutionLog(supabase, execution_id, `[2/3] ❌ Query "${description}" failed (${duration}s)`);
            return [];
          }

          const cladoData = await cladoResponse.json();
          const results = (cladoData.results || []).map((result: any) => {
            const profile = result.profile || {};
            const experience = result.experience?.[0] || {};

            return {
              id: profile.id || crypto.randomUUID(),
              name: profile.name || 'Unknown',
              email: '',
              title: experience.title || profile.headline || '',
              company: experience.company_name || '',
              linkedin_url: profile.linkedin_url || '',
            };
          });

          if (results.length > 0) {
            await updateExecutionLog(
              supabase, 
              execution_id, 
              `[2/3] ✅ Query "${description}": ${results.length} prospects (${duration}s)`
            );
          } else {
            await updateExecutionLog(
              supabase, 
              execution_id, 
              `[2/3] ⚠️ Query "${description}": 0 prospects (${duration}s)`
            );
          }

          console.log(`Query ${description} completed: ${results.length} prospects in ${duration}s`);
          return results;

        } catch (error: any) {
          clearTimeout(timeout);
          if (error.name === 'AbortError') {
            console.error(`Query ${description} timed out`);
            await updateExecutionLog(supabase, execution_id, `[2/3] ⏱️ Query "${description}" timed out`);
          } else {
            console.error(`Query ${description} failed:`, error);
          }
          return [];
        }
      };

      // Generate 5 query variations for parallel execution
      const queryStrategies = [
        { criteria: targetCriteria, description: 'Full criteria' },
        { 
          criteria: { 
            job_titles: targetCriteria.job_titles, 
            industry: targetCriteria.industry, 
            location: targetCriteria.location 
          }, 
          description: 'No company size' 
        },
        { 
          criteria: { 
            job_titles: targetCriteria.job_titles, 
            industry: targetCriteria.industry 
          }, 
          description: 'Job + industry' 
        },
        { 
          criteria: { 
            job_titles: targetCriteria.job_titles, 
            location: targetCriteria.location 
          }, 
          description: 'Job + location' 
        },
        { 
          criteria: { 
            job_titles: targetCriteria.job_titles 
          }, 
          description: 'Job titles only' 
        },
      ];

      // Execute all queries in parallel
      await updateExecutionLog(
        supabase, 
        execution_id, 
        `[2/3] 🚀 Launching ${queryStrategies.length} parallel Clado searches...`
      );

      const searchPromises = queryStrategies.map(strategy => {
        const query = buildQuery(strategy.criteria);
        return query && query !== 'professionals' 
          ? trySearchWithTimeout(query, strategy.description)
          : Promise.resolve([]);
      });

      const results = await Promise.allSettled(searchPromises);
      
      // Merge and deduplicate results
      const allProspects: any[] = [];
      const seen = new Set<string>();

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.length > 0) {
          result.value.forEach((prospect: any) => {
            // Deduplicate by LinkedIn URL or name+company
            const key = prospect.linkedin_url || `${prospect.name}|${prospect.company}`;
            if (!seen.has(key)) {
              seen.add(key);
              allProspects.push(prospect);
            }
          });
        }
      });

      prospects = allProspects.slice(0, 5); // Limit to 5 for test runs
      
      const searchDuration = ((Date.now() - searchStartTime) / 1000).toFixed(1);
      
      if (prospects.length > 0) {
        await updateExecutionLog(
          supabase, 
          execution_id, 
          `[2/3] ✅ Clado: Found ${prospects.length} unique prospects in ${searchDuration}s`
        );

        // Store structured prospect data for UI with real-time updates
        for (let i = 0; i < prospects.length; i++) {
          const prospectData = {
            id: prospects[i].id,
            name: prospects[i].name,
            title: prospects[i].title,
            company: prospects[i].company,
            linkedin_url: prospects[i].linkedin_url,
            found_at: new Date().toISOString(),
            index: i
          };

          // Add to prospects_data array
          await supabase.rpc('add_prospect_to_execution', {
            p_execution_id: execution_id,
            p_prospect: prospectData
          });

          // Log individual prospect found (for real-time UI updates)
          await updateExecutionLog(
            supabase,
            execution_id,
            JSON.stringify({
              type: 'prospect_found',
              data: prospectData
            })
          );
        }
      } else {
        await updateExecutionLog(
          supabase, 
          execution_id, 
          `[2/3] ⚠️ No prospects found after ${searchDuration}s`
        );
      }

      // Update performance metrics
      await supabase
        .from('workflow_executions')
        .update({ 
          performance_metrics: {
            clado_search_ms: Date.now() - searchStartTime,
            queries_executed: queryStrategies.length,
            prospects_found: prospects.length
          }
        })
        .eq('id', execution_id);

      console.log(`Parallel search completed: ${prospects.length} prospects in ${searchDuration}s`);
      
    } catch (error: any) {
      let errorMsg = `Clado API error: ${error.message}`;

      // Provide helpful guidance for common errors
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        errorMsg = `Clado API Authentication Error - Your API key is invalid or expired. Please check:\n` +
                   `1. API key starts with 'lk_'\n` +
                   `2. Key is valid at https://www.clado.ai/dashboard\n` +
                   `3. Update key in Settings if needed`;
      } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
        errorMsg = `Clado API Access Error - Your account may not have access to this feature or has insufficient credits`;
      } else if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
        errorMsg = `Clado API Rate Limit - You've exceeded the rate limit. Please wait and try again`;
      }

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

    await updateExecutionLog(supabase, execution_id, `[3/3] 📧 OpenAI: Generating emails for ${prospects.length} prospects...`);

    // Process each prospect
    let successCount = 0;
    let failCount = 0;

        for (let i = 0; i < prospects.length; i++) {
          const prospect = prospects[i];

          try {
            await updateExecutionLog(
              supabase,
              execution_id,
              `[3/3] 🤖 OpenAI: Generating email ${i + 1}/${prospects.length} for ${prospect.name}...`
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
                'Authorization': `Bearer ${openaiApiKey}`,
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
              `[3/3] ✅ OpenAI: Generated email ${i + 1}/${prospects.length}\n📧 To: ${prospect.email}\n📝 Subject: ${subject}\n(Test mode - not sent)`
            );

            // Store structured email data for UI
            const emailData = {
              prospect_id: prospect.id,
              prospect_name: prospect.name,
              subject: subject,
              body: body,
              generated_at: new Date().toISOString(),
              index: i,
              word_count: body.split(/\s+/).length,
              quality_score: calculateEmailQuality(subject, body)
            };

            // Add to emails_data array
            await supabase.rpc('add_email_to_execution', {
              p_execution_id: execution_id,
              p_email: emailData
            });

            // Log individual email generated (for real-time UI updates)
            await updateExecutionLog(
              supabase,
              execution_id,
              JSON.stringify({
                type: 'email_generated',
                data: emailData
              })
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
              emails_generated: successCount
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
    .select('progress_logs')
    .eq('id', executionId)
    .single();

  const logs = execution?.progress_logs || [];
  logs.push({
    message,
    timestamp: new Date().toISOString(),
  });

  await supabase
    .from('workflow_executions')
    .update({ progress_logs: logs })
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
