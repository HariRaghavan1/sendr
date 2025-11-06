import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// CORS headers - defined FIRST before any other imports that might fail
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

// Handle OPTIONS immediately - before any other code runs
serve(async (req) => {
  // Handle CORS preflight - MUST be the very first thing
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: corsHeaders
    });
  }

  // Now import everything else AFTER OPTIONS is handled
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.75.1');
    const {
      ExecuteWorkflowSchema,
      validateInput,
      extractAuthToken,
      checkRateLimit,
    } = await import('../_shared/schemas.ts');
    const { searchCladoProspects, checkCladoCredits } = await import('../_shared/clado-helpers.ts');
    const { STANDARD_EMAIL_TEMPLATE } = await import('../_shared/email-template.ts');

    // Helper function to calculate email quality score (0-100)
    /**
     * Replace placeholders in email subject and body with actual prospect data
     */
    function replacePlaceholders(text: string, prospect: any, senderName?: string): string {
      if (!text) return text;
      
      // Extract first name from full name
      const nameParts = prospect.name?.split(' ') || [];
      const firstName = nameParts[0] || prospect.name || '';
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      const fullName = prospect.name || '';
      const company = prospect.company || '';
      const title = prospect.title || '';
      
      // Determine title prefix (Mr./Ms.) based on first name
      // Simple heuristic: names ending in common female endings get "Ms.", others get "Mr."
      const femaleEndings = ['a', 'ia', 'ana', 'ina', 'ella', 'ette', 'elle', 'i', 'y'];
      const firstNameLower = firstName.toLowerCase();
      const useTitle = firstNameLower.length > 2 && 
                       femaleEndings.some(ending => firstNameLower.endsWith(ending));
      const titlePrefix = useTitle ? 'Ms.' : 'Mr.';
      
      // Use senderName if provided, otherwise default to "Hari"
      const signatureName = senderName || 'Hari';
      
      // FIRST: Remove any instances where Gemini already wrote "Best Hari" or similar (without placeholder)
      // This prevents double signatures when Gemini ignores the {signature} placeholder
      const signatureAlreadyPresentPattern = new RegExp(`(Best|Regards|Thanks|Thank you|Sincerely),\\s*${signatureName}\\s*$`, 'i');
      const hasExistingSignature = signatureAlreadyPresentPattern.test(text.trim());
      
      // Replace common placeholders
      let replaced = text
        .replace(/\{first_name\}/gi, firstName)
        .replace(/\{firstname\}/gi, firstName)
        .replace(/\{name\}/gi, fullName)
        .replace(/\{full_name\}/gi, fullName)
        .replace(/\{last_name\}/gi, lastName)
        .replace(/\{company\}/gi, company)
        .replace(/\{title\}/gi, title)
        .replace(/\{job_title\}/gi, title)
        .replace(/\{mr_ms\}/gi, titlePrefix)
        .replace(/\{mr\.ms\.\}/gi, titlePrefix)
        .replace(/\{title_prefix\}/gi, titlePrefix)
        // Replace signature placeholders with sender name
        replaced = replaced
          .replace(/\[Your Name\]/gi, signatureName)
          .replace(/\[your name\]/gi, signatureName)
          .replace(/\[Your name\]/gi, signatureName)
          .replace(/\{your_name\}/gi, signatureName)
          .replace(/\{signature\}/gi, signatureName)
          // Common patterns at end of emails
          .replace(/Best,\s*\[Your Name\]/gi, `Best,\n${signatureName}`)
          .replace(/Best,\s*\[your name\]/gi, `Best,\n${signatureName}`)
          .replace(/Regards,\s*\[Your Name\]/gi, `Regards,\n${signatureName}`)
          .replace(/Sincerely,\s*\[Your Name\]/gi, `Sincerely,\n${signatureName}`)
          .replace(/Thanks,\s*\[Your Name\]/gi, `Thanks,\n${signatureName}`)
          .replace(/Thank you,\s*\[Your Name\]/gi, `Thank you,\n${signatureName}`);
      
      // Replace bracket placeholders like [mention...] with more specific content
      // Remove generic placeholders that weren't filled in
      replaced = replaced.replace(/\[mention[^\]]+\]/gi, '');
      replaced = replaced.replace(/\[mention a[^\]]+\]/gi, '');
      
      // Now check if signature is already present AFTER placeholder replacement
      const trimmedReplaced = replaced.trim();
      const commonClosings = /(Best|Regards|Sincerely|Thanks|Thank you|Cheers),\s*$/i;
      
      // Count how many times signatureName appears (case-insensitive)
      const signatureRegex = new RegExp(signatureName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      const signatureMatches = trimmedReplaced.match(signatureRegex);
      const signatureCount = signatureMatches ? signatureMatches.length : 0;
      
      // If signature appears 0 times, add it
      if (signatureCount === 0) {
        const closingMatch = trimmedReplaced.match(commonClosings);
        if (closingMatch) {
          replaced = trimmedReplaced.replace(commonClosings, (match) => match + `\n${signatureName}`);
        } else if (!trimmedReplaced.match(/\[Your Name\]/i)) {
          replaced = trimmedReplaced + `\n\nBest,\n${signatureName}`;
        }
      } else if (signatureCount > 1) {
        // Multiple signatures found - keep only the last one
        const lastIndex = trimmedReplaced.toLowerCase().lastIndexOf(signatureName.toLowerCase());
        if (lastIndex !== -1) {
          const beforeLast = trimmedReplaced.substring(0, lastIndex);
          const afterLast = trimmedReplaced.substring(lastIndex + signatureName.length);
          const afterCleaned = afterLast.replace(signatureRegex, '').trim();
          replaced = beforeLast + signatureName + (afterCleaned ? '\n' + afterCleaned : '');
          
          // Normalize closing format
          const closingMatch = replaced.match(commonClosings);
          if (closingMatch) {
            const afterClosing = replaced.substring(replaced.indexOf(closingMatch[0]) + closingMatch[0].length).trim();
            if (afterClosing.toLowerCase().startsWith(signatureName.toLowerCase())) {
              replaced = replaced.replace(commonClosings, (match) => match + '\n' + signatureName);
            }
          }
        }
      } else {
        // Exactly one signature - normalize format
        const existingSignaturePattern = new RegExp(`(Best|Regards|Thanks|Thank you|Sincerely),\\s*${signatureName}\\s*$`, 'i');
        if (existingSignaturePattern.test(trimmedReplaced)) {
          replaced = trimmedReplaced.replace(existingSignaturePattern, (match) => {
            const closing = match.match(/(Best|Regards|Thanks|Thank you|Sincerely)/i)?.[0] || 'Best';
            return `${closing},\n${signatureName}`;
          });
        }
      }
      
      // Final cleanup: Remove any remaining duplicate signatures
      const endDuplicatePattern = new RegExp(`(${signatureName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?:[\\s\\n]+\\1)+\\s*$`, 'gi');
      replaced = replaced.replace(endDuplicatePattern, signatureName);
      
      const closingDuplicatePattern = new RegExp(`(Best|Regards|Thanks|Thank you|Sincerely)[,\\s]*${signatureName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s]+${signatureName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'gi');
      replaced = replaced.replace(closingDuplicatePattern, (match) => {
        const closing = match.match(/(Best|Regards|Thanks|Thank you|Sincerely)/i)?.[0] || 'Best';
        return `${closing},\n${signatureName}`;
      });
      
      // Clean up extra spaces and newlines
      replaced = replaced.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines
      replaced = replaced.replace(/\s{3,}/g, ' '); // Max 2 consecutive spaces
      
      return replaced.trim();
    }

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

    // Validate environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Missing required environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
    let { workflow_id, campaign_id, execution_id, max_prospects, skip_sending, enrich_emails, send_drafts_to_email, conversation_id } = validateInput(ExecuteWorkflowSchema, requestBody);

    // Set defaults and clamp max_prospects
    const limit = Math.max(1, Math.min(25, max_prospects || 5));
    const shouldSkipSending = skip_sending !== undefined ? skip_sending : true;
    // ALWAYS enrich emails for test runs - this is critical for finding contact information
    const shouldEnrichEmails = enrich_emails !== undefined ? enrich_emails : true;

    console.log(`=== EXECUTION REQUEST ===`);
    console.log(`Execution ID: ${execution_id}`);
    console.log(`Workflow ID: ${workflow_id || 'none (will auto-detect)'}`);
    console.log(`Campaign ID: ${campaign_id || 'none'}`);
    console.log(`Conversation ID: ${conversation_id || 'none'}`);
    console.log(`Max prospects: ${limit}`);
    console.log(`Skip sending: ${shouldSkipSending}`);
    console.log(`Enrich emails: ${shouldEnrichEmails}`);
    console.log(`Send drafts to: ${send_drafts_to_email || 'none'}`);

    // Helper functions for execution logging
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

    async function completeExecution(supabase: any, executionId: string, prospectsData?: any[], emailsData?: any[]) {
      const updateData: any = {
        status: 'completed',
        completed_at: new Date().toISOString(),
      };
      
      // Update prospects_found count
      if (prospectsData && prospectsData.length > 0) {
        updateData.prospects_found = prospectsData.length;
        updateData.prospects_data = prospectsData;
      }
      
      // Update emails_generated count
      if (emailsData && emailsData.length > 0) {
        updateData.emails_generated = emailsData.length;
        updateData.emails_data = emailsData;
      }
      
      await supabase
        .from('workflow_executions')
        .update(updateData)
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

    // Find or create workflow
    if (!workflow_id) {
      console.log('No workflow_id provided, attempting to find from conversation...');
      
      // Try to find workflow from conversation_id
      if (conversation_id) {
        const { data: workflowFromConv } = await supabase
          .from('workflows')
          .select('id, name')
          .eq('conversation_id', conversation_id)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (workflowFromConv) {
          workflow_id = workflowFromConv.id;
          console.log(`Found workflow from conversation: ${workflowFromConv.name} (${workflow_id})`);
        }
      }
      
      // Try to find workflow from execution
      if (!workflow_id && execution_id) {
        const { data: execution } = await supabase
          .from('workflow_executions')
          .select('workflow_id')
          .eq('id', execution_id)
          .single();
        
        if (execution?.workflow_id) {
          workflow_id = execution.workflow_id;
          console.log(`Found workflow from execution: ${workflow_id}`);
        }
      }
      
      // Try to find workflow from campaign
      if (!workflow_id && campaign_id) {
        const { data: campaign } = await supabase
          .from('campaigns')
          .select('id')
          .eq('id', campaign_id)
          .single();
        
        if (campaign) {
          const { data: workflowFromCampaign } = await supabase
            .from('workflows')
            .select('id, name')
            .eq('campaign_id', campaign_id)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (workflowFromCampaign) {
            workflow_id = workflowFromCampaign.id;
            console.log(`Found workflow from campaign: ${workflowFromCampaign.name} (${workflow_id})`);
          }
        }
      }
      
      // Fallback: find most recent workflow for this user
      if (!workflow_id) {
        console.log('No workflow found from conversation/execution/campaign, finding most recent...');
        const { data: recentWorkflow } = await supabase
          .from('workflows')
          .select('id, name')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (recentWorkflow) {
          workflow_id = recentWorkflow.id;
          console.log(`Using most recent workflow: ${recentWorkflow.name} (${workflow_id})`);
        }
      }
      
      // Last resort: create a default workflow with better default criteria
      if (!workflow_id) {
        console.log('No workflow found, creating default workflow...');
        const { data: newWorkflow, error: workflowError } = await supabase
          .from('workflows')
          .insert({
            user_id: user.id,
            conversation_id: conversation_id || null,
            name: 'Test Workflow',
            description: 'Auto-created workflow for test execution',
            workflow_config: {
              target_criteria: { 
                job_titles: ['Software Engineer', 'Product Manager', 'Marketing Manager', 'Sales Manager', 'Data Scientist']
              },
              tone: 'casual',
              goal: 'meeting'
            },
            instructions: 'Generate personalized cold emails',
            schedule_config: { frequency: 'daily', time: '09:00', batch_size: 25 },
            status: 'draft'
          })
          .select()
          .single();
        
        if (workflowError || !newWorkflow) {
          return new Response(
            JSON.stringify({ execution_id, message: 'Failed to create default workflow', error: workflowError?.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        workflow_id = newWorkflow.id;
        console.log(`✅ Created default workflow: ${workflow_id}`);
        
        // Update execution with the new workflow_id
        await supabase
          .from('workflow_executions')
          .update({ workflow_id })
          .eq('id', execution_id);
      }
    }

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
    const emailTemplate = config.email_template || null; // Custom template/example from user
    
    console.log('Workflow config:', JSON.stringify(config));
    console.log('Target criteria:', JSON.stringify(targetCriteria));
    console.log('Email template:', emailTemplate ? `${emailTemplate.type} template` : 'default template');
    
    // If no criteria, create a default search with specific job titles
    if (!targetCriteria || Object.keys(targetCriteria).length === 0 || !targetCriteria.job_titles || targetCriteria.job_titles.length === 0) {
      console.log('⚠️ No target criteria found, using default search with specific job titles');
      targetCriteria = {
        job_titles: ['Software Engineer', 'Product Manager', 'Marketing Manager', 'Sales Manager', 'Data Scientist']
      };
    }
    
    // Get conversation context and ID for chat notifications
    let conversationContext: any[] = [];
    let conversationId: string | null = null;
    const campaignId = campaign_id || (config as any).campaign_id || null;
    
    if (campaignId) {
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('conversation_context')
        .eq('id', campaignId)
        .single();
      
      // Ensure conversation_context is always an array
      if (campaign?.conversation_context) {
        conversationContext = Array.isArray(campaign.conversation_context) 
          ? campaign.conversation_context 
          : [];
      } else {
        conversationContext = [];
      }
      
      // Get conversation ID
      const { data: convData } = await supabase
        .from('campaign_conversations')
        .select('id')
        .eq('campaign_id', campaignId)
        .single();
      conversationId = convData?.id || null;
    }

    // Start log
    await updateExecutionLog(supabase, execution_id, `[1/3] 🚀 Test run started - ${limit} prospect${limit === 1 ? '' : 's'}, ${shouldSkipSending ? 'dry run (no sending)' : 'will send emails'}`);
    console.log(`=== EXECUTION STARTED ===`);
    console.log(`Execution ID: ${execution_id}`);
    console.log(`Limit: ${limit}, Skip sending: ${shouldSkipSending}, Enrich emails: ${shouldEnrichEmails}`);

    // Check API configuration
    await updateExecutionLog(supabase, execution_id, `[1/3] 🔑 Checking API configuration...`);
    
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('clado_api_key, composio_api_key, composio_connected_account_id')
      .eq('user_id', user.id)
      .single();
    
    if (settingsError) {
      console.error('Error fetching user settings:', settingsError);
      const errorMsg = `Failed to load user settings: ${settingsError.message}`;
      await updateExecutionLog(supabase, execution_id, `❌ ${errorMsg}`);
      await failExecution(supabase, execution_id, errorMsg);
      return new Response(
        JSON.stringify({ execution_id, message: errorMsg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log('User settings loaded:', {
      has_clado_key: !!settings?.clado_api_key,
      clado_key_length: settings?.clado_api_key?.length || 0,
      has_composio_key: !!settings?.composio_api_key
    });
    
    // Default sender name to "Hari"
    const senderName = 'Hari';
    console.log(`✅ Using default sender name: ${senderName}`);

    // Gemini key is stored as edge function secret, not in user settings
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      const errorMsg = 'Gemini API key not configured in edge function secrets';
      await updateExecutionLog(supabase, execution_id, `❌ ${errorMsg}`);
      await failExecution(supabase, execution_id, errorMsg);
      return new Response(
        JSON.stringify({ execution_id, message: errorMsg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate Clado API key
    const cladoApiKey = settings?.clado_api_key?.trim();
    if (!cladoApiKey || cladoApiKey === '') {
      const errorMsg = 'Missing: Clado API key. Please configure in Settings.';
      await updateExecutionLog(supabase, execution_id, `❌ ${errorMsg}`);
      await failExecution(supabase, execution_id, errorMsg);
      return new Response(
        JSON.stringify({ execution_id, message: errorMsg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await updateExecutionLog(supabase, execution_id, `[1/3] ✅ API keys validated`);

    // Check Clado credits before starting
    await updateExecutionLog(supabase, execution_id, `[1/3] 💳 Checking Clado API credits...`);
    const creditsInfo = await checkCladoCredits(cladoApiKey);
    
    if (!creditsInfo) {
      const errorMsg = 'Failed to check Clado credits. Please verify your API key.';
      await updateExecutionLog(supabase, execution_id, `❌ ${errorMsg}`);
      await failExecution(supabase, execution_id, errorMsg);
      return new Response(
        JSON.stringify({ execution_id, message: errorMsg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const credits = creditsInfo.credits || 0;
    console.log(`Clado credits: ${credits}`);
    await updateExecutionLog(supabase, execution_id, `✅ Clado credits: ${credits} remaining`);

    if (credits === 0) {
      const errorMsg = 'Insufficient Clado credits. Please purchase credits at https://www.clado.ai/dashboard';
      await updateExecutionLog(supabase, execution_id, `❌ ${errorMsg}`);
      await failExecution(supabase, execution_id, errorMsg);
      return new Response(
        JSON.stringify({ execution_id, message: errorMsg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (credits < 5) {
      const errorMsg = `Low credits (${credits} remaining). Please purchase more credits.`;
      await updateExecutionLog(supabase, execution_id, `❌ ${errorMsg}`);
      await failExecution(supabase, execution_id, errorMsg);
      return new Response(
        JSON.stringify({ execution_id, message: errorMsg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (credits < 10) {
      await updateExecutionLog(supabase, execution_id, `⚠️ Warning: Low credits (${credits} remaining)`);
    }

    // Search for prospects using Clado
    await updateExecutionLog(supabase, execution_id, `[2/3] 🔍 Clado: Launching parallel searches...`);
    const searchStartTime = Date.now();
    let prospects: any[] = [];

    try {
      // Build search query from target criteria
      const buildQuery = (criteria: any): string => {
        const queryParts: string[] = [];
        
        if (criteria.job_titles && Array.isArray(criteria.job_titles) && criteria.job_titles.length > 0) {
          queryParts.push(criteria.job_titles.join(' or '));
        }
        
        if (criteria.industry) {
          queryParts.push(`in ${criteria.industry} industry`);
        }
        
        if (criteria.location) {
          queryParts.push(`located in ${criteria.location}`);
        }
        
        if (criteria.company_size) {
          queryParts.push(`at companies with ${criteria.company_size}`);
        }
        
        return queryParts.join(' ') || 'professionals';
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
        return strategy.criteria && Object.keys(strategy.criteria).length > 0
          ? (async () => {
              try {
                const query = buildQuery(strategy.criteria);
                console.log(`🔍 Query "${strategy.description}": ${query}`);
                const startTime = Date.now();
                
                const results = await searchCladoProspects(
                  strategy.criteria,
                  cladoApiKey,
                  {
                    limit: Math.ceil(limit * 1.5), // Get more than needed for deduplication
                    advanced_filtering: true,
                    initiateDeepResearch: true,
                    enrichContacts: shouldEnrichEmails,
                    enrichProfiles: true,
                    useScrapeForProfiles: false,
                  }
                );
                
                const duration = ((Date.now() - startTime) / 1000).toFixed(1);
                const enrichedCount = results.filter((p: any) => p.email && p.email.trim() !== '').length;
                
                if (results.length === 0) {
                  await updateExecutionLog(supabase, execution_id, `[2/3] ⚠️ Query "${strategy.description}": 0 prospects (${duration}s)`);
                } else {
                  const deepResearchJobIds = [...new Set(results.map((p: any) => p.deep_research_job_id).filter(Boolean))];
                  const deepResearchMsg = deepResearchJobIds.length > 0 
                    ? ` (Deep research job: ${deepResearchJobIds[0]})` 
                    : '';
                  await updateExecutionLog(
                    supabase, 
                    execution_id, 
                    `[2/3] ✅ Query "${strategy.description}": ${results.length} prospects, ${enrichedCount} enriched${deepResearchMsg} (${duration}s)`
                  );
                }
                
                return results;
              } catch (error: any) {
                console.error(`Search error for "${strategy.description}":`, error);
                await updateExecutionLog(
                  supabase, 
                  execution_id, 
                  `[2/3] ❌ Query "${strategy.description}" failed: ${error.message || error}`
                );
                return [];
              }
            })()
          : Promise.resolve([]);
      });

      const results = await Promise.allSettled(searchPromises);
      
      // Merge and deduplicate results
      const allProspects: any[] = [];
      const seen = new Set<string>();

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && Array.isArray(result.value) && result.value.length > 0) {
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

      prospects = Array.isArray(allProspects) ? allProspects.slice(0, limit) : []; // Limit based on max_prospects parameter
      
      const searchDuration = ((Date.now() - searchStartTime) / 1000).toFixed(1);
      
      if (prospects.length > 0) {
        await updateExecutionLog(
          supabase, 
          execution_id, 
          `[2/3] ✅ Clado: Found ${prospects.length} unique prospects in ${searchDuration}s`
        );
        
        // Log each prospect found
        prospects.forEach((prospect, index) => {
          console.log(JSON.stringify({
            type: 'prospect_found',
            data: {
              id: prospect.id || `temp-${index}`,
              name: prospect.name || 'Unknown',
              email: prospect.email || '',
              title: prospect.title || '',
              company: prospect.company || '',
              linkedin_url: prospect.linkedin_url || '',
              found_at: new Date().toISOString(),
              index
            }
          }));
        });
      } else {
        await updateExecutionLog(
          supabase, 
          execution_id, 
          `[2/3] ⚠️ Clado: No prospects found matching criteria. Try broadening your search.`
        );
      }

      // Log enrichment summary
      if (prospects.length > 0) {
        const enrichedCount = prospects.filter((p: any) => p.email && p.email.trim() !== '').length;
        const emailCount = prospects.filter((p: any) => p.email && p.email.trim() !== '').length;
        const phoneCount = prospects.filter((p: any) => p.phone && p.phone.trim() !== '').length;
        const profileEnrichedCount = prospects.filter((p: any) => p.profile_data).length;
        const deepResearchJobIds = [...new Set(prospects.map((p: any) => p.deep_research_job_id).filter(Boolean))];
        
        let enrichmentMsg = `[2.5/3] ✅ Enrichment complete: ${enrichedCount}/${prospects.length} contacts enriched (${emailCount} emails, ${phoneCount} phones)`;
        if (profileEnrichedCount > 0) {
          enrichmentMsg += `, ${profileEnrichedCount} profiles enriched for personalization`;
        }
        if (Array.isArray(deepResearchJobIds) && deepResearchJobIds.length > 0) {
          enrichmentMsg += ` | Deep research jobs: ${deepResearchJobIds.slice(0, 3).join(', ')}${deepResearchJobIds.length > 3 ? '...' : ''}`;
        }
        await updateExecutionLog(supabase, execution_id, enrichmentMsg);
      }

      console.log(`Parallel search completed: ${prospects.length} prospects in ${searchDuration}s`);
      
    } catch (error: any) {
      let errorMsg = `Clado API error: ${error.message}`;

      // Provide helpful guidance for common errors
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        errorMsg = `Clado API Authentication Error - Your API key is invalid or expired. Please check:\n` +
                   `1. API key starts with 'lk_'\n` +
                   `2. Key is valid at https://www.clado.ai/dashboard\n` +
                   `3. Key is correctly saved in Settings`;
      } else if (error.message.includes('402') || error.message.includes('Payment')) {
        errorMsg = `Clado API Payment Error - Insufficient credits. Please purchase credits at https://www.clado.ai/dashboard`;
      } else if (error.message.includes('429') || error.message.includes('Rate limit')) {
        errorMsg = `Clado API Rate Limit - Too many requests. Please wait a moment and try again.`;
      }

      await updateExecutionLog(supabase, execution_id, `❌ ${errorMsg}`);
      await failExecution(supabase, execution_id, errorMsg);
      return new Response(
        JSON.stringify({ execution_id, message: errorMsg }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    await updateExecutionLog(supabase, execution_id, `[3/3] 📧 Gemini: Generating emails for ${prospects.length} prospects...`);

    // Generate emails for each prospect
    const generatedEmails: any[] = [];
    let successCount = 0;
    let failCount = 0;

    if (prospects.length === 0) {
      await updateExecutionLog(supabase, execution_id, `⚠️ No prospects found. Test run complete with 0 emails.`);
      await completeExecution(supabase, execution_id, [], []);
      return new Response(
        JSON.stringify({
          execution_id,
          message: 'Test run completed (no prospects found)',
          prospects_processed: 0,
          success_count: 0,
          fail_count: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    for (let i = 0; i < prospects.length; i++) {
      const prospect = prospects[i];
      
      try {
        await updateExecutionLog(supabase, execution_id, `[3/3] 🤖 Gemini: Generating email ${i + 1}/${prospects.length} for ${prospect.name}...`);

        // Build tone and goal instructions
        const toneMap: Record<string, string> = {
          professional: 'professional and polished',
          casual: 'conversational and friendly',
          friendly: 'warm and approachable',
        };
        const toneInstruction = toneMap[config.tone] || 'conversational';

        const goalMap: Record<string, string> = {
          meeting: 'schedule a meeting',
          demo: 'book a demo',
          call: 'schedule a call',
          information: 'gather information',
          partnership: 'explore a potential partnership',
          other: 'start a conversation',
        };
        const goalInstruction = goalMap[config.goal] || 'start a conversation';

        // Build conversation context summary
        let contextSummary = '';
        // Ensure conversationContext is an array (defensive check)
        const safeConversationContext = Array.isArray(conversationContext) ? conversationContext : [];
        if (safeConversationContext.length > 0) {
          const relevantMessages = safeConversationContext
            .filter((msg: any) => msg && msg.role && (msg.role === 'user' || (msg.role === 'assistant' && msg.content && msg.content.length < 500)))
            .slice(-10);
          if (relevantMessages.length > 0) {
            contextSummary = `\n\nCAMPAIGN CONTEXT FROM CONVERSATION:\n${relevantMessages.map((m: any) => `${m.role}: ${m.content}`).join('\n')}\n`;
          }
        }

        // Build custom template instructions if provided
        let customTemplateSection = '';
        if (emailTemplate) {
          if (emailTemplate.type === 'example' && emailTemplate.example_email) {
            customTemplateSection = `

CRITICAL: USER HAS PROVIDED A CUSTOM EXAMPLE EMAIL TEMPLATE. YOU MUST FOLLOW THIS EXACT STRUCTURE AND STYLE.

EXAMPLE EMAIL TEMPLATE:
Subject: ${emailTemplate.example_email.subject || 'Example subject'}

Body:
${emailTemplate.example_email.body || ''}

${emailTemplate.instructions ? `ADDITIONAL TEMPLATE INSTRUCTIONS:\n${emailTemplate.instructions}\n` : ''}

REQUIREMENTS FOR USING THIS TEMPLATE:
1. Follow the EXACT structure and style of the example email above
2. Use the same greeting format, tone, and closing style
3. Maintain the same paragraph structure and flow
4. Keep the same level of formality and word count
5. Use {first_name}, {company}, {title} placeholders where the example uses them
6. Personalize the content based on the prospect's profile data
7. DO NOT deviate from this template structure - use it as the foundation for ALL emails

This example template takes precedence over the standard template structure below.`;
          } else if (emailTemplate.type === 'structured' && emailTemplate.template_structure) {
            const structure = emailTemplate.template_structure;
            customTemplateSection = `

CRITICAL: USER HAS PROVIDED A CUSTOM STRUCTURED TEMPLATE. YOU MUST FOLLOW THESE EXACT REQUIREMENTS.

CUSTOM TEMPLATE STRUCTURE:
${structure.greeting ? `Greeting: ${structure.greeting}` : ''}
${structure.opening ? `Opening: ${structure.opening}` : ''}
${structure.body ? `Body: ${structure.body}` : ''}
${structure.cta ? `CTA: ${structure.cta}` : ''}
${structure.closing ? `Closing: ${structure.closing}` : ''}

${emailTemplate.instructions ? `ADDITIONAL TEMPLATE INSTRUCTIONS:\n${emailTemplate.instructions}\n` : ''}

REQUIREMENTS FOR USING THIS TEMPLATE:
1. Follow the EXACT structure requirements above
2. Use the specified greeting, opening, body, CTA, and closing formats
3. Personalize content while maintaining the structure
4. Use {first_name}, {company}, {title} placeholders as needed
5. DO NOT deviate from these structure requirements

This custom structured template takes precedence over the standard template structure below.`;
          }
        }

        const systemPrompt = `You are an elite cold email writer who crafts highly personalized, contextually relevant emails that feel like they were written specifically for each individual prospect.

${customTemplateSection ? customTemplateSection : `CRITICAL: YOU MUST FOLLOW THE EXACT EMAIL TEMPLATE STRUCTURE BELOW. NO EXCEPTIONS.

${STANDARD_EMAIL_TEMPLATE.structure}

TEMPLATE ENFORCEMENT RULES:
1. ALWAYS use the exact structure: Greeting → Opening → Body → CTA → Closing → Signature
2. Greeting MUST be "Hi {first_name}," for casual tone OR "Dear {mr_ms} {last_name}," for formal tone
3. Opening MUST be exactly 1 sentence (15-25 words), leading with value/insight
4. Body MUST be 2-3 sentences (40-60 words total)
5. CTA MUST be exactly 1 sentence (10-15 words) with a clear, low-pressure ask
6. Closing MUST be "Best," OR "Regards," OR "Thanks," followed by signature
7. Signature MUST use {signature} placeholder (will be replaced automatically)`}

PERSONALIZATION REQUIREMENTS:
- Use {first_name}, {company}, {title} variables throughout
- Reference specific details from ENRICHED PROFILE DATA when available
- NEVER use generic phrases like "I noticed" or "I came across your profile"
- Lead with value or insight, not your needs

WRITING QUALITY:
- Subject line: Under 50 characters, curiosity-driven, no clickbait
- Word count: 80-120 words total (strictly enforced, unless custom template specifies otherwise)
- Tone: Match the requested style perfectly (casual/formal/witty)
- Grammar: Flawless spelling and grammar
- Personalization: Feel deeply researched, not templated

ABSOLUTE REQUIREMENTS:
✓ Follow exact template structure (custom template if provided, otherwise standard template)
✓ Use {signature} placeholder (never "[Your Name]" or actual name)
✓ Replace {first_name}, {company}, {title} with placeholders (will be replaced automatically)
✓ Ensure word count is between 80-120 words (unless custom template specifies otherwise)
✓ Include clear call to action`;

        // Build enriched profile data section for personalization
        let enrichedProfileSection = '';
        if (prospect.profile_data) {
          const pd = prospect.profile_data;
          const profileParts: string[] = [];
          
          // Profile summary and headline
          if (pd.profile?.headline) {
            profileParts.push(`Headline: ${pd.profile.headline}`);
          }
          if (pd.profile?.summary) {
            profileParts.push(`Summary: ${pd.profile.summary.substring(0, 300)}`);
          }
          if (pd.profile?.location) {
            profileParts.push(`Location: ${pd.profile.location}`);
          }
          
          // Skills (top 10)
          if (pd.profile?.skills && Array.isArray(pd.profile.skills) && pd.profile.skills.length > 0) {
            profileParts.push(`Skills: ${pd.profile.skills.slice(0, 10).join(', ')}`);
          }
          
          // Recent experience (last 3 roles)
          if (pd.experience && Array.isArray(pd.experience) && pd.experience.length > 0) {
            const recentExp = pd.experience.slice(0, 3).map((exp: any) => {
              let expStr = `${exp?.title || 'Role'} at ${exp?.company_name || 'Company'}`;
              if (exp?.description) {
                expStr += ` - ${exp.description.substring(0, 150)}`;
              }
              return expStr;
            }).join('\n');
            profileParts.push(`Recent Experience:\n${recentExp}`);
          }
          
          // Education
          if (pd.education && Array.isArray(pd.education) && pd.education.length > 0) {
            const edu = pd.education.slice(0, 2).map((ed: any) => {
              return `${ed?.degree || 'Degree'} in ${ed?.field_of_study || 'Field'} from ${ed?.school_name || 'School'}`;
            }).join(', ');
            profileParts.push(`Education: ${edu}`);
          }
          
          // Recent posts (if available, first 200 chars)
          if (pd.profile?.posts) {
            profileParts.push(`Recent Activity/Posts: ${pd.profile.posts.substring(0, 200)}`);
          }
          
          if (profileParts.length > 0) {
            enrichedProfileSection = `\n\nENRICHED PROFILE DATA (from LinkedIn):\n${profileParts.join('\n\n')}\n`;
          }
        }

        // Build template-specific instructions
        let templateGuidance = '';
        if (emailTemplate) {
          if (emailTemplate.type === 'example' && emailTemplate.example_email) {
            templateGuidance = `

CUSTOM EXAMPLE TEMPLATE TO FOLLOW:
Subject pattern: "${emailTemplate.example_email.subject}"
Body structure: Follow the exact style and format of:
${emailTemplate.example_email.body}

Use this example as your guide - maintain the same structure, tone, and flow while personalizing for ${prospect.name}.`;
          } else if (emailTemplate.type === 'structured' && emailTemplate.template_structure) {
            const struct = emailTemplate.template_structure;
            templateGuidance = `

CUSTOM STRUCTURED TEMPLATE REQUIREMENTS:
${struct.greeting ? `- Greeting: ${struct.greeting}` : ''}
${struct.opening ? `- Opening: ${struct.opening}` : ''}
${struct.body ? `- Body: ${struct.body}` : ''}
${struct.cta ? `- CTA: ${struct.cta}` : ''}
${struct.closing ? `- Closing: ${struct.closing}` : ''}
${emailTemplate.instructions ? `- Additional instructions: ${emailTemplate.instructions}` : ''}

Follow these exact requirements while personalizing for ${prospect.name}.`;
          }
        } else {
          templateGuidance = `

STANDARD TEMPLATE STRUCTURE (use if no custom template):
- Line 1: Greeting (Hi {first_name},)
- Line 2: Empty line
- Line 3: Opening sentence (value/insight)
- Line 4: Empty line
- Line 5: Body paragraph (2-3 sentences)
- Line 6: Empty line
- Line 7: CTA sentence
- Line 8: Empty line
- Line 9: Closing (Best,)
- Line 10: Signature ({signature})`;
        }

        const userPrompt = `${contextSummary}

PROSPECT DETAILS:
Name: ${prospect.name}
Title: ${prospect.title || 'Professional'}
Company: ${prospect.company || 'their organization'}${enrichedProfileSection}

TARGET CRITERIA:
${JSON.stringify(targetCriteria, null, 2)}

${instructions ? `CAMPAIGN INSTRUCTIONS:\n${instructions}\n` : ''}
${templateGuidance}

REQUIRED STYLE:
Tone: ${toneInstruction}
Goal: ${goalInstruction}
Word Count: ${emailTemplate?.instructions?.match(/under (\d+)|(\d+) words/i) ? 'Follow custom template instructions' : '80-120 words'}

IMPORTANT:
- Reference their specific role (${prospect.title}) and company (${prospect.company})
${prospect.profile_data ? '- Use the ENRICHED PROFILE DATA above to make highly personalized references:\n  * Mention specific skills they have\n  * Reference their recent experience or career trajectory\n  * Note their education background if relevant\n  * Reference any recent posts or activity if available\n  * Make it feel like you\'ve deeply researched them' : '- Make it feel like you\'ve done research on them specifically'}
- Use conversational language that matches the tone
- Subject line must be under 50 characters
- Focus on THEIR potential benefit, not your offering
- If instructed to use titles (Mr./Ms.), use them appropriately (e.g., "Dear Mr. Smith" or "Hi Ms. Johnson")
- ALWAYS sign the email with the sender's name (extracted from Gmail account) - NEVER use "[Your Name]", "[your name]", or any placeholder
- Replace {first_name}, {company}, {title} variables with actual values
- Use the placeholder variables in the body, they will be replaced automatically
- The signature will be automatically filled in with the Gmail account name

CRITICAL OUTPUT FORMAT - FOLLOW EXACTLY:

Return ONLY a JSON object with this exact format:
{
  "subject": "curiosity-driven subject under 50 chars",
  "body": "${emailTemplate?.type === 'example' && emailTemplate.example_email?.body 
    ? emailTemplate.example_email.body
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\{first_name\}/g, '{first_name}')
        .replace(/\{company\}/g, '{company}')
        .replace(/\{title\}/g, '{title}')
        .replace(/\[Your Name\]/gi, '{signature}')
        .replace(/\[your name\]/gi, '{signature}')
    : 'Hi {first_name},\\n\\n[Opening sentence - 15-25 words with value/insight]\\n\\n[Body paragraph - 2-3 sentences, 40-60 words total]\\n\\n[CTA sentence - 10-15 words with clear ask]\\n\\nBest,\\n{signature}'}"
}

${emailTemplate ? 'CRITICAL: USE THE CUSTOM TEMPLATE PROVIDED ABOVE. Follow its exact structure, style, tone, and format while personalizing the content for this specific prospect. The template structure is non-negotiable - maintain it exactly.' : 'Follow the standard template structure. Every email must follow this exact format.'}`;

        // Generate email using Gemini
        console.log(`Calling Gemini for prospect ${i + 1}`);
        
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
                }
              ],
              generationConfig: {
                maxOutputTokens: 300,
                temperature: 0.7,
              }
            })
          }
        );

        if (!geminiResponse.ok) {
          const errorText = await geminiResponse.text();
          console.error(`Gemini API error for prospect ${i + 1}:`, errorText);
          // Log detailed error information
          await updateExecutionLog(
            supabase,
            execution_id,
            `❌ Gemini API error for ${prospect.name} (${geminiResponse.status}): ${errorText.substring(0, 200)}`
          );
          
          throw new Error(`Gemini API error (${geminiResponse.status}): ${errorText}`);
        }

        const geminiData = await geminiResponse.json();
        console.log(`Gemini response data for prospect ${i + 1}:`, JSON.stringify(geminiData).substring(0, 500));
        
        const generatedContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        if (!generatedContent) {
          console.error(`No content in Gemini response for prospect ${i + 1}:`, JSON.stringify(geminiData));
          await updateExecutionLog(
            supabase,
            execution_id,
            `❌ No content generated from Gemini for ${prospect.name}. Response: ${JSON.stringify(geminiData).substring(0, 200)}`
          );
          throw new Error(`No content generated from Gemini for prospect ${i + 1}`);
        }

        // Parse JSON response from Gemini
        let parsedSubject = '';
        let parsedBody = '';
        
        try {
          // Try to parse as JSON first (expected format)
          const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            parsedSubject = parsed.subject || '';
            parsedBody = parsed.body || '';
          }
        } catch (e) {
          console.log('Failed to parse as JSON, trying text parsing...');
        }
        
        // Fallback to text parsing if JSON parsing failed
        if (!parsedSubject || !parsedBody) {
          const lines = generatedContent ? generatedContent.split('\n') : [];
          for (let i = 0; i < lines.length; i++) {
            if (lines[i] && lines[i].toLowerCase().startsWith('subject:')) {
              parsedSubject = lines[i].replace(/^subject:\\s*/i, '').trim();
            } else if (parsedSubject && lines[i] && lines[i].trim()) {
              parsedBody = Array.isArray(lines) ? lines.slice(i).join('\n').trim() : '';
              break;
            }
          }
        }

        // Final fallback
        if (!parsedSubject) {
          parsedSubject = 'Quick question';
        }
        if (!parsedBody) {
          parsedBody = generatedContent;
        }

        // Validate and enforce template structure
        const validation = STANDARD_EMAIL_TEMPLATE.validateStructure(parsedBody);
        
        if (!validation.valid) {
          console.log(`⚠️ Email template validation failed for ${prospect.name}:`, validation.errors);
          await updateExecutionLog(
            supabase,
            execution_id,
            `⚠️ Template validation warnings for ${prospect.name}: ${validation.errors.join(', ')}`
          );
          
          // Ensure signature placeholder is present
          if (!parsedBody.includes('{signature}') && !parsedBody.match(/\[Your Name\]|\[your name\]/i)) {
            // Add signature if missing
            const closingMatch = parsedBody.match(/(Best|Regards|Thanks|Thank you|Sincerely)[,\s]*$/i);
            if (closingMatch) {
              parsedBody = parsedBody.replace(closingMatch[0], `${closingMatch[0]}\n{signature}`);
            } else {
              parsedBody = parsedBody.trim() + '\n\nBest,\n{signature}';
            }
          }
          
          // Ensure greeting format
          if (!parsedBody.match(/^(Hi|Dear|Hello)/i)) {
            const firstName = prospect.name?.split(' ')[0] || '{first_name}';
            parsedBody = `Hi ${firstName},\n\n${parsedBody}`;
          }
          
          // Ensure closing format
          if (!parsedBody.match(/(Best|Regards|Thanks|Thank you|Sincerely)[,\s]*$/i)) {
            parsedBody = parsedBody.trim() + '\n\nBest,\n{signature}';
          }
        }

        // Default sender name to "Hari" (as per user request)
        const senderName = 'Hari';
        
        // Replace placeholders and clean up
        parsedBody = replacePlaceholders(parsedBody, prospect, senderName);
        
        // COMPREHENSIVE duplicate signature removal - catch ALL variations
        // Strategy: Find the LAST occurrence of senderName, then remove any duplicates after that
        
        // First, normalize whitespace
        parsedBody = parsedBody.replace(/\s+/g, ' ').replace(/\n\s+/g, '\n').replace(/\s+\n/g, '\n');
        
        // Find the last occurrence of the signature name
        const lastIndex = parsedBody.toLowerCase().lastIndexOf(senderName.toLowerCase());
        
        if (lastIndex !== -1) {
          // Get everything before the last signature
          const beforeLast = parsedBody.substring(0, lastIndex);
          const afterLast = parsedBody.substring(lastIndex + senderName.length);
          
          // Check if there's a duplicate immediately after
          const afterTrimmed = afterLast.trim();
          const duplicatePattern = new RegExp(`^[\\s\\n]*${senderName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\n]*`, 'i');
          
          if (duplicatePattern.test(afterTrimmed)) {
            // Remove the duplicate and everything after it
            parsedBody = beforeLast + senderName;
          } else {
            // Check if signature appears again later (maybe with "Best" or other closing)
            const remainingText = afterLast.trim();
            if (remainingText.length > 0) {
              // Check if remaining text contains another instance of senderName
              const hasDuplicate = new RegExp(senderName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(remainingText);
              if (hasDuplicate) {
                // Remove everything after the first signature occurrence
                parsedBody = beforeLast + senderName;
              }
            }
          }
        }
        
        // Additional cleanup: Remove any duplicate signatures using regex patterns
        // Pattern 1: Multiple instances at the end (e.g., "Best,\nHari\nHari" or "Best Hari Hari")
        const endDuplicatePattern = new RegExp(`(${senderName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?:[\\s\\n]+\\1)+\\s*$`, 'gi');
        parsedBody = parsedBody.replace(endDuplicatePattern, senderName);
        
        // Pattern 2: "Best Hari Hari" or "Best, Hari Hari"
        const closingDuplicatePattern = new RegExp(`(Best|Regards|Thanks|Thank you|Sincerely)[,\\s]*${senderName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s]+${senderName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'gi');
        parsedBody = parsedBody.replace(closingDuplicatePattern, (match) => {
          const closing = match.match(/(Best|Regards|Thanks|Thank you|Sincerely)/i)?.[0] || 'Best';
          return `${closing},\n${senderName}`;
        });
        
        // Final pass: If senderName appears more than once in the last 50 characters, keep only the last one
        const last50Chars = parsedBody.slice(-50);
        const signatureMatches = last50Chars.match(new RegExp(senderName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'));
        if (signatureMatches && signatureMatches.length > 1) {
          // Find the position of the last signature
          const lastSigIndex = parsedBody.toLowerCase().lastIndexOf(senderName.toLowerCase());
          if (lastSigIndex !== -1) {
            // Remove everything after the last signature
            parsedBody = parsedBody.substring(0, lastSigIndex + senderName.length);
          }
        }

        const subject = parsedSubject;
        const body = parsedBody;

        // Calculate email quality
        const qualityScore = calculateEmailQuality(subject, body);

        await updateExecutionLog(
          supabase,
          execution_id,
          `[3/3] ✅ Gemini: Generated email ${i + 1}/${prospects.length} (Quality: ${qualityScore})`
        );

        // First, save prospect to database to get a proper UUID
        let prospectUuid = prospect.id;
        
        // Check if prospect.id is already a UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        
        if (!uuidRegex.test(prospect.id)) {
          // Prospect ID is not a UUID (likely from Clado)
          // Always try to save prospect if we have campaign_id, otherwise use temp ID
          if (campaign_id) {
            // Save prospect to database
            console.log('Saving prospect to database:', prospect.name, 'Email:', prospect.email || 'none');
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
                enrichment_data: {
                  clado_id: prospect.id,
                  found_at: new Date().toISOString()
                },
                status: 'pending'
              })
              .select()
              .single();

            if (prospectError) {
              console.error('Failed to save prospect:', prospectError);
              // Don't throw - continue with temp ID in preview mode
              prospectUuid = `temp-${Date.now()}-${i}`;
              await updateExecutionLog(
                supabase,
                execution_id,
                `⚠️ Could not save prospect ${prospect.name} to DB, using temp ID: ${prospectError.message}`
              );
            } else {
              prospectUuid = savedProspect.id;
              console.log('Saved prospect with UUID:', prospectUuid);
            }
          } else {
            // No campaign_id: run in preview mode without DB insert
            prospectUuid = `temp-${Date.now()}-${i}`;
            await updateExecutionLog(
              supabase,
              execution_id,
              `ℹ️ Preview mode: using temp ID for prospect ${prospect.name}`
            );
          }
        }

        // Save email to database first
        let savedEmail = null;
        let sendStatus = 'skipped';
        let emailSendError = null;

        // Check if prospect has email AND if we should send
        const noProspectEmail = !prospect.email || prospect.email.trim() === '';
        const skipSending = shouldSkipSending || noProspectEmail;

        if (noProspectEmail) {
          await updateExecutionLog(
            supabase,
            execution_id,
            `⚠️ Skipping send for ${prospect.name} - no email address`
          );
        }

        // Only save email to DB if we have a valid campaign_id and prospectUuid is a real UUID
        const isValidProspectUuid = uuidRegex.test(prospectUuid);
        if (campaign_id && isValidProspectUuid) {
          try {
            const { data: emailData, error: emailError } = await supabase
              .from('emails')
              .insert({
                prospect_id: prospectUuid,
                campaign_id: campaign_id,
                user_id: user.id,
                subject: subject,
                body: body,
                quality_score: qualityScore,
                send_status: skipSending ? 'skipped' : 'pending'
              })
              .select()
              .single();

            if (emailError) {
              console.error(`Failed to save email for ${prospect.name}:`, emailError);
              await updateExecutionLog(
                supabase,
                execution_id,
                `⚠️ Could not save email to DB for ${prospect.name}: ${emailError.message}`
              );
            } else {
              savedEmail = emailData;
              console.log(`Saved email ${savedEmail.id} for prospect ${prospect.name}`);
            }
          } catch (saveErr: any) {
            console.error(`Error saving email for ${prospect.name}:`, saveErr);
            await updateExecutionLog(
              supabase,
              execution_id,
              `⚠️ Error saving email for ${prospect.name}: ${saveErr.message}`
            );
          }
        } else {
          console.log(`ℹ️ Preview mode: not saving email to DB for ${prospect.name} (no campaign_id or temp prospect ID)`);
        }

        // Send email if not skipping
        if (!skipSending && prospect.email && prospect.email.trim() !== '') {
          try {
            await updateExecutionLog(
              supabase,
              execution_id,
              `📤 Sending email to ${prospect.name} (${prospect.email})...`
            );

            // Get Composio settings
            const composioApiKey = settings?.composio_api_key?.trim();
            if (!composioApiKey) {
              throw new Error('Composio API key not configured');
            }

            // Find connected account ID
            let connectedAccountId = settings?.composio_connected_account_id;
            
            // Check if saved ID is a valid UUID
            const isSavedIdValid = connectedAccountId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(connectedAccountId);

            // If saved ID is not a valid UUID, search for the connection
            if (!isSavedIdValid && composioApiKey) {
              console.log('Saved connected account ID is not a valid UUID, searching for connection...');

              try {
                const listResponse = await fetch(
                  `https://backend.composio.dev/api/v3/connected_accounts?toolkit_slugs=GMAIL`,
                  {
                    headers: {
                      'x-api-key': composioApiKey,
                      'Content-Type': 'application/json',
                    },
                  }
                );

                if (listResponse.ok) {
                  const listData = await listResponse.json();
                  const connections = listData.items || listData.data || [];
                  const activeGmail = connections.find((c: any) =>
                    (c.toolkit?.slug?.toLowerCase() === 'gmail' ||
                     c.toolkit?.name?.toLowerCase() === 'gmail') &&
                    c.status === 'ACTIVE'
                  );

                  if (activeGmail?.uuid) {
                    connectedAccountId = activeGmail.uuid;
                    console.log(`✅ Found valid UUID: ${connectedAccountId}`);

                    // Save it for future use
                    await supabase
                      .from('user_settings')
                      .update({ composio_connected_account_id: connectedAccountId })
                      .eq('user_id', user.id);
                  }
                }
              } catch (error) {
                console.error('Error searching for connection:', error);
              }
            }

            const requestBody: any = {
              input: {
                recipient_email: prospect.email,
                subject: subject,
                body: body + '\n\n---\nUnsubscribe: [unsubscribe link]',
              },
            };

            // Use connectedAccountId if we have a valid UUID
            if (connectedAccountId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(connectedAccountId)) {
              requestBody.connectedAccountId = connectedAccountId;
              console.log(`Using connected account UUID: ${requestBody.connectedAccountId}`);
            } else {
              throw new Error('GMAIL_NOT_CONNECTED: No valid Gmail connection found. Please go to Settings and click "Test Gmail Connection" to verify your connection.');
            }

            // Send via Composio
            const composioResponse = await fetch('https://backend.composio.dev/api/v2/actions/GMAIL_SEND_EMAIL/execute', {
              method: 'POST',
              headers: {
                'X-API-Key': composioApiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
            });

            if (!composioResponse.ok) {
              const errorText = await composioResponse.text();
              throw new Error(`Composio API error (${composioResponse.status}): ${errorText}`);
            }

            const composioData = await composioResponse.json();
            console.log('Composio send response:', JSON.stringify(composioData).substring(0, 200));

            sendStatus = 'sent';
            await updateExecutionLog(
              supabase,
              execution_id,
              `✅ Email sent to ${prospect.name} (${prospect.email})`
            );

            // Update email status if saved
            if (savedEmail) {
              await supabase
                .from('emails')
                .update({
                  send_status: 'sent',
                  sent_at: new Date().toISOString()
                })
                .eq('id', savedEmail.id);
            }
          } catch (sendError: any) {
            emailSendError = sendError.message || sendError.toString();
            sendStatus = 'failed';
            console.error(`Error sending email to ${prospect.name}:`, sendError);
            await updateExecutionLog(
              supabase,
              execution_id,
              `❌ Failed to send email to ${prospect.name}: ${emailSendError}`
            );

            // Update email status if saved
            if (savedEmail) {
              await supabase
                .from('emails')
                .update({
                  send_status: 'failed',
                  send_error: emailSendError
                })
                .eq('id', savedEmail.id);
            }
          }
        }

        // Add to generated emails list for summary
        generatedEmails.push({
          prospect_name: prospect.name,
          prospect_email: prospect.email || '❌ No email found',
          subject: subject,
          body: body,
          quality_score: qualityScore,
          send_status: sendStatus,
          error: emailSendError || null
        });

        // Update execution with prospect and email data in real-time so UI shows them
        try {
          const { data: currentExecution } = await supabase
            .from('workflow_executions')
            .select('prospects_data, emails_data')
            .eq('id', execution_id)
            .single();

          const currentProspects = (currentExecution?.prospects_data || []) as any[];
          const currentEmails = (currentExecution?.emails_data || []) as any[];

          // Add prospect if not already present
          const prospectExists = currentProspects.some((p: any) => 
            (p.id && p.id === prospectUuid) || 
            (p.linkedin_url && p.linkedin_url === prospect.linkedin_url) ||
            (p.name === prospect.name && p.company === prospect.company)
          );

          if (!prospectExists) {
            currentProspects.push({
              id: prospectUuid,
              name: prospect.name,
              email: prospect.email || '',
              title: prospect.title || '',
              company: prospect.company || '',
              linkedin_url: prospect.linkedin_url || '',
              found_at: new Date().toISOString()
            });
          }

          // Add email
          currentEmails.push({
            prospect_id: prospectUuid,
            prospect_name: prospect.name,
            prospect_email: prospect.email || '',
            subject: subject,
            body: body,
            quality_score: qualityScore,
            send_status: sendStatus,
            generated_at: new Date().toISOString(),
            error: emailSendError || null
          });

          await supabase
            .from('workflow_executions')
            .update({
              prospects_data: currentProspects,
              emails_data: currentEmails,
              prospects_found: currentProspects.length,
              emails_generated: currentEmails.length
            })
            .eq('id', execution_id);
        } catch (updateError) {
          console.error('Error updating execution data:', updateError);
          // Don't fail the execution if real-time update fails
        }

        successCount++;
        console.log(`✅ Successfully generated email ${i + 1}/${prospects.length} for ${prospect.name}`);
      } catch (error: any) {
        failCount++;
        const errorMsg = error.message || error.toString();
        console.error(`Error processing prospect ${i + 1} (${prospect.name}):`, error);
        await updateExecutionLog(
          supabase,
          execution_id,
          `❌ General error for ${prospect.name}: ${errorMsg}`
        );

        // Add failed email to list
        generatedEmails.push({
          prospect_name: prospect.name,
          prospect_email: prospect.email || '❌ No email found',
          subject: 'Failed to generate',
          body: `Error: ${errorMsg}`,
          quality_score: 0,
          send_status: 'failed',
          error: errorMsg
        });
      }
    }

    // Send summary email if send_drafts_to_email is provided
    const draftsEmail = send_drafts_to_email;
    const hasGeneratedEmails = generatedEmails.length > 0;

    if (draftsEmail && hasGeneratedEmails) {
      try {
        await updateExecutionLog(
          supabase,
          execution_id,
          `📧 Compiling ${generatedEmails.length} email drafts to send to ${draftsEmail}...`
        );

        // Get Composio settings for sending summary
        const composioApiKey = settings?.composio_api_key?.trim();
        if (!composioApiKey) {
          throw new Error('Composio API key not configured - cannot send summary email');
        }

        // Find connected account ID (same logic as test-send-email)
        let connectedAccountId = settings?.composio_connected_account_id;

        // Check if saved ID is a valid UUID
        const isSavedIdValid = connectedAccountId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(connectedAccountId);

        // If saved ID is not a valid UUID, search for the connection
        if (!isSavedIdValid && composioApiKey) {
          console.log('Searching for Gmail connection for summary email...');

          try {
            const listResponse = await fetch(
              `https://backend.composio.dev/api/v3/connected_accounts?toolkit_slugs=GMAIL`,
              {
                headers: {
                  'x-api-key': composioApiKey,
                  'Content-Type': 'application/json',
                },
              }
            );

            if (listResponse.ok) {
              const listData = await listResponse.json();
              const connections = listData.items || listData.data || [];
              const activeGmail = connections.find((c: any) =>
                (c.toolkit?.slug?.toLowerCase() === 'gmail' ||
                 c.toolkit?.name?.toLowerCase() === 'gmail') &&
                c.status === 'ACTIVE'
              );

              if (activeGmail) {
                // Try to find the UUID in any field - check multiple possible field names
                const possibleUUID = activeGmail.uuid ||
                                   activeGmail.deprecated?.uuid ||
                                   activeGmail.connected_account_id ||
                                   activeGmail.connectedAccountId ||
                                   activeGmail.accountId ||
                                   activeGmail.connectedAccount?.id ||
                                   activeGmail.id;

                console.log(`Active Gmail connection found. Checking for UUID...`);
                console.log(`Connection fields:`, {
                  id: activeGmail.id,
                  uuid: activeGmail.uuid,
                  deprecated_uuid: activeGmail.deprecated?.uuid,
                  user_id: activeGmail.user_id,
                  status: activeGmail.status
                });

                if (possibleUUID) {
                  // Check if it's a valid UUID
                  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(possibleUUID);
                  console.log(`Extracted UUID candidate: ${possibleUUID}, is UUID: ${isUUID}`);

                  if (isUUID) {
                    connectedAccountId = possibleUUID;
                    console.log(`✅ Found valid UUID: ${connectedAccountId}`);

                    // Save it for future use (same as test-send-email)
                    await supabase
                      .from('user_settings')
                      .update({ composio_connected_account_id: connectedAccountId })
                      .eq('user_id', user.id);
                    console.log('Updated saved connected account ID');
                  } else {
                    console.log(`⚠️ UUID candidate found but not a valid UUID format: ${possibleUUID}`);
                  }
                } else {
                  console.log(`⚠️ No UUID field found in connection object`);
                  console.log(`Full connection object:`, JSON.stringify(activeGmail, null, 2));
                }
              } else {
                // Check if there are any inactive Gmail connections
                const anyGmail = connections.find((c: any) => 
                  (c.toolkit?.slug?.toLowerCase() === 'gmail' ||
                   c.toolkit?.name?.toLowerCase() === 'gmail')
                );
                
                if (anyGmail) {
                  console.log(`⚠️ Gmail connection found but status is: ${anyGmail.status}`);
                  await updateExecutionLog(
                    supabase,
                    execution_id,
                    `⚠️ Cannot send drafts summary: Gmail connection found but status is ${anyGmail.status} (not ACTIVE). Please reconnect Gmail in Settings or check Composio dashboard.`
                  );
                  throw new Error(`Gmail connection status: ${anyGmail.status}`);
                } else {
                  console.log('⚠️ No Gmail connections found');
                }
              }
            } else {
              const errorText = await listResponse.text();
              console.error('Failed to list connections:', listResponse.status, errorText);
              await updateExecutionLog(
                supabase,
                execution_id,
                `⚠️ Failed to check Gmail connection: ${listResponse.status} ${errorText.substring(0, 100)}`
              );
            }
          } catch (error) {
            console.error('Error searching for connections:', error);
          }
        }
        
        // Check if we have a valid connected account ID
        if (!connectedAccountId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(connectedAccountId)) {
          await updateExecutionLog(
            supabase,
            execution_id,
            `⚠️ Cannot send drafts summary: No valid Gmail connection found. Please go to Settings and click "Test Gmail Connection" to verify your connection.`
          );
          throw new Error('GMAIL_NOT_CONNECTED: No valid Gmail connection found. Please go to Settings and click "Test Gmail Connection" to verify your connection.');
        }

        // Build summary email body
        let summaryBody = `Here are ${generatedEmails.length} email draft${generatedEmails.length === 1 ? '' : 's'} generated for your test campaign:\n\n`;
        summaryBody += `Total Prospects: ${prospects.length}\n`;
        summaryBody += `Emails Generated: ${generatedEmails.length}\n`;
        summaryBody += `Emails with Contact Info: ${generatedEmails.filter(e => e.prospect_email && !e.prospect_email.includes('❌')).length}\n`;
        summaryBody += `========================================\n\n`;

        generatedEmails.forEach((email, index) => {
          summaryBody += `--- Draft ${index + 1} ---\n`;
          summaryBody += `To: ${email.prospect_name}\n`;
          summaryBody += `Email: ${email.prospect_email}\n`;
          summaryBody += `Subject: ${email.subject}\n`;
          summaryBody += `\n${email.body}\n`;
          summaryBody += `\n========================================\n\n`;
        });

        // Send summary email via Composio
        const summaryRequestBody: any = {
          input: {
            recipient_email: draftsEmail,
            subject: `Email Drafts for Test Campaign - ${generatedEmails.length} Draft${generatedEmails.length === 1 ? '' : 's'}`,
            body: summaryBody,
          },
        };

        summaryRequestBody.connectedAccountId = connectedAccountId;
        console.log(`✅ Using connected account UUID for summary: ${summaryRequestBody.connectedAccountId}`);

        const summaryResponse = await fetch('https://backend.composio.dev/api/v2/actions/GMAIL_SEND_EMAIL/execute', {
          method: 'POST',
          headers: {
            'X-API-Key': composioApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(summaryRequestBody),
        });

        if (!summaryResponse.ok) {
          const errorText = await summaryResponse.text();
          throw new Error(`Failed to send summary email: ${summaryResponse.status} ${errorText}`);
        }

        await updateExecutionLog(
          supabase,
          execution_id,
          `✅ Summary email sent to ${draftsEmail}`
        );
      } catch (summaryError: any) {
        console.error('Error sending summary email:', summaryError);
        await updateExecutionLog(
          supabase,
          execution_id,
          `⚠️ Error sending drafts summary: ${summaryError.message || summaryError}`
        );
        // Don't fail the entire execution if summary email fails
      }
    }
    
    // Prepare final prospect and email data for completion
    const finalProspectsData = prospects.map((p, idx) => ({
      id: p.id || `temp-${idx}`,
      name: p.name || 'Unknown',
      email: p.email || '',
      title: p.title || '',
      company: p.company || '',
      linkedin_url: p.linkedin_url || '',
      found_at: new Date().toISOString()
    }));

    const finalEmailsData = generatedEmails.map((email, idx) => ({
      prospect_id: prospects[idx]?.id || `temp-${idx}`,
      prospect_name: email.prospect_name,
      prospect_email: email.prospect_email,
      subject: email.subject,
      body: email.body,
      quality_score: email.quality_score,
      send_status: email.send_status,
      generated_at: new Date().toISOString(),
      error: email.error || null
    }));

    // Complete execution
    await updateExecutionLog(
      supabase, 
      execution_id, 
      `🎉 Test run complete!\n✅ ${successCount} emails generated\n❌ ${failCount} failed`
    );
    
    console.log(`Test run finished: ${successCount} success, ${failCount} failed`);
    await completeExecution(supabase, execution_id, finalProspectsData, finalEmailsData);

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
    // Always return CORS headers even on error
    const errorMessage = error?.message || error?.toString() || 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage, ok: false }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
