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
      // IMPORTANT: {Name} and [Name] should be replaced with "Mr./Ms. LastName" for proper addressing
      let replaced = text
        .replace(/\{first_name\}/gi, firstName)
        .replace(/\{firstname\}/gi, firstName)
        .replace(/\{Name\}/g, `${titlePrefix} ${lastName}`) // {Name} → "Mr. Smith" or "Ms. Johnson"
        .replace(/\[Name\]/g, `${titlePrefix} ${lastName}`) // [Name] → "Mr. Smith" or "Ms. Johnson"
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
      // Pattern 1: "Best, Hari Best, Hari" or "Best Hari Best Hari"
      const closingDuplicatePattern = new RegExp(
        `(Best|Regards|Thanks|Thank you|Sincerely)[,\\s]*${signatureName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\n]*(Best|Regards|Thanks|Thank you|Sincerely)[,\\s]*${signatureName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
        'gi'
      );
      replaced = replaced.replace(closingDuplicatePattern, (match) => {
        const closing = match.match(/(Best|Regards|Thanks|Thank you|Sincerely)/i)?.[0] || 'Best';
        return `${closing},\n${signatureName}`;
      });
      
      // Pattern 2: Multiple instances at the end (e.g., "Best,\nHari\nHari" or "Best Hari Hari")
      const endDuplicatePattern = new RegExp(`(${signatureName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?:[\\s\\n]+\\1)+\\s*$`, 'gi');
      replaced = replaced.replace(endDuplicatePattern, signatureName);
      
      // Pattern 3: "Best, Hari Hari" (same closing with duplicate name)
      const sameClosingDuplicatePattern = new RegExp(
        `(Best|Regards|Thanks|Thank you|Sincerely)[,\\s]*${signatureName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\n]+${signatureName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
        'gi'
      );
      replaced = replaced.replace(sameClosingDuplicatePattern, (match) => {
        const closing = match.match(/(Best|Regards|Thanks|Thank you|Sincerely)/i)?.[0] || 'Best';
        return `${closing},\n${signatureName}`;
      });
      
      // Final aggressive cleanup: Remove any remaining duplicate signature patterns
      // This catches cases like "Best, Hari Best, Hari" that might have slipped through
      const finalAggressivePattern = new RegExp(
        `((Best|Regards|Thanks|Thank you|Sincerely)[,\\s]*\\s*${signatureName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\n]*)+`,
        'gi'
      );
      const finalMatches = replaced.match(finalAggressivePattern);
      if (finalMatches && finalMatches.length > 0) {
        // Find the last occurrence of closing + signature
        const lastOccurrence = finalMatches[finalMatches.length - 1];
        const lastIndex = replaced.toLowerCase().lastIndexOf(lastOccurrence.toLowerCase());
        if (lastIndex !== -1) {
          // Remove everything after the last occurrence, then add proper closing + signature
          const beforeLast = replaced.substring(0, lastIndex).trim();
          const closing = lastOccurrence.match(/(Best|Regards|Thanks|Thank you|Sincerely)/i)?.[0] || 'Best';
          replaced = beforeLast + '\n\n' + closing + ',\n' + signatureName;
        }
      }
      
      // Clean up extra spaces and newlines (but preserve intentional line breaks)
      replaced = replaced.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines
      replaced = replaced.replace(/[ \t]{3,}/g, ' '); // Max 2 consecutive spaces/tabs (but keep newlines)
      
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
      // CRITICAL: Prefer workflows that have templates
      if (!workflow_id) {
        console.log('No workflow found from conversation/execution/campaign, finding most recent...');
        
        // First, try to find a workflow with a template (check recent workflows)
        const { data: recentWorkflows } = await supabase
          .from('workflows')
          .select('id, name, workflow_config')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10);
        
        // Check if any recent workflow has a template
        const workflowWithTemplate = recentWorkflows?.find(w => 
          w.workflow_config?.email_template?.example_email?.body
        );
        
        if (workflowWithTemplate) {
          workflow_id = workflowWithTemplate.id;
          console.log(`✅ Found workflow with template: ${workflowWithTemplate.name} (${workflow_id})`);
          await updateExecutionLog(supabase, execution_id, `✅ Using workflow with template: ${workflowWithTemplate.name}`);
        } else if (recentWorkflows && recentWorkflows.length > 0) {
          // Fallback to most recent workflow
          const recentWorkflow = recentWorkflows[0];
          workflow_id = recentWorkflow.id;
          console.log(`Using most recent workflow: ${recentWorkflow.name} (${workflow_id})`);
          await updateExecutionLog(supabase, execution_id, `Using most recent workflow: ${recentWorkflow.name} (no template found)`);
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
      await updateExecutionLog(supabase, execution_id, `❌ ERROR: Workflow not found (${workflow_id})`);
      return new Response(
        JSON.stringify({ execution_id, message: 'Workflow not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CRITICAL DEBUGGING - Log to execution log so user can see it
    await updateExecutionLog(supabase, execution_id, `🔍 Loading workflow: ${workflow.name || workflow_id}`);
    
    console.log('\n🔍 WORKFLOW LOADED:');
    console.log(`   Workflow ID: ${workflow_id}`);
    console.log(`   Workflow name: ${workflow.name || 'N/A'}`);
    console.log(`   Workflow config type: ${typeof workflow.workflow_config}`);
    console.log(`   Workflow config keys: ${workflow.workflow_config ? Object.keys(workflow.workflow_config).join(', ') : 'NONE'}`);
    console.log(`   Full workflow_config:`, JSON.stringify(workflow.workflow_config, null, 2));
    
    // Log to execution log so user can see in UI
    const configKeys = workflow.workflow_config ? Object.keys(workflow.workflow_config).join(', ') : 'NONE';
    await updateExecutionLog(supabase, execution_id, `🔍 Workflow config keys: ${configKeys}`);

    const config = workflow.workflow_config || {};
    const targetCriteria = config.target_criteria || {};
    const instructions = workflow.instructions || '';
    const emailTemplate = config.email_template || null; // Custom template/example from user
    
    console.log(`\n🔍 EXTRACTED VALUES:`);
    console.log(`   config exists: ${!!config}`);
    console.log(`   config.email_template exists: ${!!config.email_template}`);
    console.log(`   emailTemplate variable: ${emailTemplate ? 'EXISTS' : 'NULL'}`);
    if (emailTemplate) {
      console.log(`   emailTemplate type: ${emailTemplate.type}`);
      console.log(`   emailTemplate keys: ${Object.keys(emailTemplate).join(', ')}`);
    }
    
    // Log to execution log so user can see
    await updateExecutionLog(supabase, execution_id, `🔍 Template check: ${emailTemplate ? 'FOUND' : 'NOT FOUND'}`);
    if (emailTemplate) {
      await updateExecutionLog(supabase, execution_id, `🔍 Template type: ${emailTemplate.type}, has body: ${!!emailTemplate.example_email?.body}`);
    } else {
      await updateExecutionLog(supabase, execution_id, `⚠️ NO TEMPLATE IN WORKFLOW - will use AI generation`);
    }
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('🚀 WORKFLOW EXECUTION STARTED');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log('📋 Workflow config:', JSON.stringify(config));
    console.log('🎯 Target criteria:', JSON.stringify(targetCriteria));
    
    // CRITICAL: Validate template is properly configured
    const hasValidTemplate = emailTemplate && 
                             emailTemplate.type === 'example' && 
                             emailTemplate.example_email && 
                             emailTemplate.example_email.body &&
                             emailTemplate.example_email.body.trim() !== '';
    
    // EXTENSIVE TEMPLATE DEBUGGING
    console.log('\n🔍 TEMPLATE STATUS CHECK:');
    console.log('─────────────────────────────────────────────────────────');
    console.log(`  ✅ emailTemplate exists: ${!!emailTemplate}`);
    if (emailTemplate) {
      console.log(`  ✅ emailTemplate.type: ${emailTemplate.type}`);
      console.log(`  ✅ emailTemplate.example_email exists: ${!!emailTemplate.example_email}`);
      console.log(`  ✅ emailTemplate.example_email.body exists: ${!!emailTemplate.example_email?.body}`);
      console.log(`  ✅ emailTemplate.example_email.body length: ${emailTemplate.example_email?.body?.length || 0}`);
      console.log(`  ✅ emailTemplate.example_email.body trimmed length: ${emailTemplate.example_email?.body?.trim().length || 0}`);
      console.log(`  ✅ hasValidTemplate: ${hasValidTemplate}`);
      console.log(`  📧 Template preview (first 200 chars):`);
      console.log(`     "${emailTemplate.example_email?.body?.substring(0, 200) || 'N/A'}..."`);
      console.log(`  📝 Template instructions: ${emailTemplate.instructions || 'none'}`);
      console.log(`  📌 Template structure exists: ${!!emailTemplate.template_structure}`);
    } else {
      console.log(`  ❌ NO TEMPLATE PROVIDED - will use AI generation`);
    }
    console.log('─────────────────────────────────────────────────────────\n');
    
    if (emailTemplate) {
      if (!hasValidTemplate) {
        console.error('⚠️⚠️⚠️ TEMPLATE EXISTS BUT IS INVALID ⚠️⚠️⚠️');
        console.error('   Reason: Template missing required fields (type, example_email, or body)');
        console.error('   Action: Will use AI generation instead\n');
        await updateExecutionLog(
          supabase,
          execution_id,
          `⚠️ Template found but invalid - missing required fields. Using AI generation.`
        );
      } else {
        console.log('✅✅✅ VALID TEMPLATE FOUND ✅✅✅');
        console.log('   Template will be used for ALL prospects (including fallback contacts)');
        console.log('   AI generation will be SKIPPED - template will be used directly\n');
        await updateExecutionLog(
          supabase,
          execution_id,
          `✅✅✅ TEMPLATE MODE: Custom template found and validated. Template will be used for ALL emails (AI generation skipped).`
        );
      }
    } else {
      console.log('ℹ️  No custom template - will use AI generation with default template structure\n');
      await updateExecutionLog(
        supabase,
        execution_id,
        `ℹ️ AI MODE: No custom template found in workflow. Using AI generation with default template.`
      );
    }
    
    // CRITICAL: Store template check result at workflow level for later use
    // This ensures template detection happens once and is reused throughout
    const workflowTemplateBody = emailTemplate?.example_email?.body;
    const workflowHasTemplate = !!(workflowTemplateBody && workflowTemplateBody.trim().length > 0);
    
    // Log template status IMMEDIATELY so user can see it early
    if (workflowHasTemplate) {
      await updateExecutionLog(
        supabase,
        execution_id,
        `✅✅✅ WORKFLOW TEMPLATE DETECTED: Template will be used for ALL email generation (AI will be SKIPPED)`
      );
      await updateExecutionLog(
        supabase,
        execution_id,
        `📧 Template preview: "${workflowTemplateBody.substring(0, 150)}..."`
      );
    } else {
      await updateExecutionLog(
        supabase,
        execution_id,
        `❌❌❌ NO TEMPLATE IN WORKFLOW: Will use AI generation for all emails`
      );
    }
    
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
      // Build search query from target criteria with fallback strategies
      const buildQuery = (criteria: any, fallbackLevel: number = 0): string => {
        const queryParts: string[] = [];
        
        // Fallback levels:
        // 0: Full criteria (most specific)
        // 1: Job titles only (broader)
        // 2: Just job titles without location/company (broadest)
        
        if (fallbackLevel === 0) {
          // Original query with all criteria
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
        } else if (fallbackLevel === 1) {
          // Fallback: Just job titles
          if (criteria.job_titles && Array.isArray(criteria.job_titles) && criteria.job_titles.length > 0) {
            queryParts.push(criteria.job_titles.join(' or '));
          }
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
        // Validate criteria - must have at least job_titles to be useful
        const hasValidCriteria = strategy.criteria && 
                                 strategy.criteria.job_titles && 
                                 Array.isArray(strategy.criteria.job_titles) &&
                                 strategy.criteria.job_titles.length > 0 &&
                                 strategy.criteria.job_titles.some((title: string) => title && title.trim().length > 0);
        
        return hasValidCriteria
          ? (async () => {
              try {
                // Clean and validate criteria before searching
                const cleanCriteria = {
                  job_titles: strategy.criteria.job_titles
                    .filter((title: string) => title && title.trim().length > 0)
                    .map((title: string) => title.trim()),
                  ...(strategy.criteria.industry && strategy.criteria.industry.trim() ? { industry: strategy.criteria.industry.trim() } : {}),
                  ...(strategy.criteria.location && strategy.criteria.location.trim() ? { location: strategy.criteria.location.trim() } : {}),
                  ...(strategy.criteria.company_size ? { company_size: strategy.criteria.company_size } : {}),
                };
                
                const query = buildQuery(cleanCriteria);
                console.log(`🔍 Query "${strategy.description}": ${query}`);
                console.log(`🔍 Criteria for "${strategy.description}":`, JSON.stringify(cleanCriteria));
                const startTime = Date.now();
                
                const results = await searchCladoProspects(
                  cleanCriteria,
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
      
      // Check if any searches succeeded
      const successfulSearches = results.filter(r => r.status === 'fulfilled');
      const failedSearches = results.filter(r => r.status === 'rejected');
      
      if (failedSearches.length > 0) {
        console.log(`⚠️ ${failedSearches.length} search strategy(ies) failed, ${successfulSearches.length} succeeded`);
      }
      
      // Merge and deduplicate results from successful searches
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
      
      // If ALL searches failed, try a fallback broad search
      if (prospects.length === 0 && successfulSearches.length === 0 && targetCriteria.job_titles && targetCriteria.job_titles.length > 0) {
        await updateExecutionLog(
          supabase, 
          execution_id, 
          `[2/3] ⚠️ All searches failed, trying fallback broad search...`
        );
        
        try {
          // Fallback: Very broad search with just job titles
          const fallbackCriteria = { job_titles: targetCriteria.job_titles };
          const fallbackResults = await searchCladoProspects(
            fallbackCriteria,
            cladoApiKey,
            {
              limit: limit * 2, // Get more for fallback
              advanced_filtering: false, // Disable advanced filtering for broader results
              initiateDeepResearch: true,
              enrichContacts: shouldEnrichEmails,
              enrichProfiles: true,
              useScrapeForProfiles: false,
            }
          );
          
          if (fallbackResults.length > 0) {
            prospects = fallbackResults.slice(0, limit);
            await updateExecutionLog(
              supabase, 
              execution_id, 
              `[2/3] ✅ Fallback search: ${prospects.length} prospects found`
            );
          }
        } catch (fallbackError: any) {
          console.error('Fallback search also failed:', fallbackError);
        }
      }
      
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
        // Final fallback: Try an even broader search if we have job titles
        if (targetCriteria.job_titles && targetCriteria.job_titles.length > 0) {
          await updateExecutionLog(
            supabase, 
            execution_id, 
            `[2/3] ⚠️ No prospects found, trying ultra-broad fallback search...`
          );
          
          try {
            // Ultra-broad: Just the first job title, no other filters
            const ultraBroadCriteria = { job_titles: [targetCriteria.job_titles[0]] };
            const ultraBroadResults = await searchCladoProspects(
              ultraBroadCriteria,
              cladoApiKey,
              {
                limit: limit * 3,
                advanced_filtering: false,
                initiateDeepResearch: true,
                enrichContacts: shouldEnrichEmails,
                enrichProfiles: false, // Skip profile enrichment for speed
                useScrapeForProfiles: false,
              }
            );
            
            if (ultraBroadResults.length > 0) {
              prospects = ultraBroadResults.slice(0, limit);
              await updateExecutionLog(
                supabase, 
                execution_id, 
                `[2/3] ✅ Ultra-broad fallback: ${prospects.length} prospects found`
              );
            } else {
              await updateExecutionLog(
                supabase, 
                execution_id, 
                `[2/3] ⚠️ Clado: No prospects found even with ultra-broad search. Please try:\n1. Broader job titles\n2. Remove location/industry filters\n3. Check your Clado API credits`
              );
            }
          } catch (ultraBroadError: any) {
            console.error('Ultra-broad fallback failed:', ultraBroadError);
            await updateExecutionLog(
              supabase, 
              execution_id, 
              `[2/3] ⚠️ Clado: No prospects found matching criteria. Try broadening your search or check API credits.`
            );
          }
        } else {
          await updateExecutionLog(
            supabase, 
            execution_id, 
            `[2/3] ⚠️ Clado: No prospects found matching criteria. Try broadening your search.`
          );
        }
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

    // CRITICAL: Use the workflow-level template check from above
    // This ensures we use the same template detection logic
    const templateCheckBody = workflowTemplateBody; // Use the one we checked earlier
    const templateExists = workflowHasTemplate; // Use the flag we set earlier
    
    if (templateExists) {
      await updateExecutionLog(supabase, execution_id, `[3/3] ✅✅✅ TEMPLATE MODE: Template found! Will use template for ALL ${prospects.length} prospects (AI generation will be SKIPPED)`);
      await updateExecutionLog(supabase, execution_id, `[3/3] 📧 Template preview: "${templateCheckBody.substring(0, 100)}..."`);
    } else {
      await updateExecutionLog(supabase, execution_id, `[3/3] ❌❌❌ AI MODE: NO TEMPLATE FOUND - Will use AI generation for ${prospects.length} prospects`);
      if (!emailTemplate) {
        await updateExecutionLog(supabase, execution_id, `[3/3] ⚠️ Reason: emailTemplate is NULL - no template in workflow_config`);
      } else if (!emailTemplate.example_email) {
        await updateExecutionLog(supabase, execution_id, `[3/3] ⚠️ Reason: emailTemplate.example_email is missing`);
      } else if (!emailTemplate.example_email.body) {
        await updateExecutionLog(supabase, execution_id, `[3/3] ⚠️ Reason: emailTemplate.example_email.body is missing or empty`);
      }
    }

    await updateExecutionLog(supabase, execution_id, `[3/3] 📧 Starting email generation for ${prospects.length} prospects...`);

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
        // Initialize variables
        let parsedSubject = '';
        let parsedBody = '';
        const senderName = 'Hari'; // Default sender name
        
        // SIMPLE LOGIC: Use template if it exists, otherwise generate
        // Check multiple sources to ensure we find the template
        const templateFromEmailTemplate = emailTemplate?.example_email?.body?.trim();
        const templateFromCheckBody = templateCheckBody?.trim();
        const templateBody = templateFromEmailTemplate || templateFromCheckBody || null;
        
        // DEBUG: Log what we found
        console.log(`\n🔍 TEMPLATE CHECK FOR ${prospect.name}:`);
        console.log(`   emailTemplate exists: ${!!emailTemplate}`);
        console.log(`   emailTemplate.example_email exists: ${!!emailTemplate?.example_email}`);
        console.log(`   emailTemplate.example_email.body exists: ${!!emailTemplate?.example_email?.body}`);
        console.log(`   templateFromEmailTemplate: ${templateFromEmailTemplate ? `YES (${templateFromEmailTemplate.length} chars)` : 'NO'}`);
        console.log(`   templateCheckBody: ${templateCheckBody ? `YES (${templateCheckBody.length} chars)` : 'NO'}`);
        console.log(`   templateBody (final): ${templateBody ? `YES (${templateBody.length} chars)` : 'NO'}`);
        
        if (templateBody) {
          // Use template - simple and direct
          parsedBody = templateBody;
          parsedSubject = emailTemplate?.example_email?.subject 
            ? replacePlaceholders(emailTemplate.example_email.subject, prospect, senderName)
            : 'Quick question';
          
          console.log(`   ✅ USING TEMPLATE - parsedBody set to template (${parsedBody.length} chars)`);
          await updateExecutionLog(supabase, execution_id, `[3/3] 📧 Using template for ${prospect.name} (${templateBody.length} chars)...`);
        } else {
          console.log(`   ❌ NO TEMPLATE - will use AI generation`);
          // No template - generate with AI
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
          const safeConversationContext = Array.isArray(conversationContext) ? conversationContext : [];
          if (safeConversationContext.length > 0) {
            const relevantMessages = safeConversationContext
              .filter((msg: any) => msg && msg.role && (msg.role === 'user' || (msg.role === 'assistant' && msg.content && msg.content.length < 500)))
              .slice(-10);
            if (relevantMessages.length > 0) {
              contextSummary = `\n\nCAMPAIGN CONTEXT FROM CONVERSATION:\n${relevantMessages.map((m: any) => `${m.role}: ${m.content}`).join('\n')}\n`;
            }
          }

          // Build enriched profile data section for personalization
          let enrichedProfileSection = '';
          if (prospect.profile_data) {
            const pd = prospect.profile_data;
            const profileParts: string[] = [];
            
            if (pd.profile?.headline) profileParts.push(`Headline: ${pd.profile.headline}`);
            if (pd.profile?.summary) profileParts.push(`Summary: ${pd.profile.summary.substring(0, 300)}`);
            if (pd.profile?.location) profileParts.push(`Location: ${pd.profile.location}`);
            if (pd.profile?.skills && Array.isArray(pd.profile.skills) && pd.profile.skills.length > 0) {
              profileParts.push(`Skills: ${pd.profile.skills.slice(0, 10).join(', ')}`);
            }
            if (pd.experience && Array.isArray(pd.experience) && pd.experience.length > 0) {
              const recentExp = pd.experience.slice(0, 3).map((exp: any) => {
                let expStr = `${exp?.title || 'Role'} at ${exp?.company_name || 'Company'}`;
                if (exp?.description) expStr += ` - ${exp.description.substring(0, 150)}`;
                return expStr;
              }).join('\n');
              profileParts.push(`Recent Experience:\n${recentExp}`);
            }
            if (pd.education && Array.isArray(pd.education) && pd.education.length > 0) {
              const edu = pd.education.slice(0, 2).map((ed: any) => {
                return `${ed?.degree || 'Degree'} in ${ed?.field_of_study || 'Field'} from ${ed?.school_name || 'School'}`;
              }).join(', ');
              profileParts.push(`Education: ${edu}`);
            }
            if (pd.profile?.posts) {
              profileParts.push(`Recent Activity/Posts: ${pd.profile.posts.substring(0, 200)}`);
            }
            
            if (profileParts.length > 0) {
              enrichedProfileSection = `\n\nENRICHED PROFILE DATA (from LinkedIn):\n${profileParts.join('\n\n')}\n`;
            }
          }

          const systemPrompt = `You are an elite cold email writer. Write personalized, compelling emails.

CRITICAL: Follow this exact structure:
- Greeting: "Dear {mr_ms} {last_name},"
- Opening: 1 sentence (15-25 words) with value/insight
- Body: 2-3 sentences (40-60 words total)
- CTA: 1 sentence (10-15 words) with clear ask
- Closing: "Best," or "Regards,"
- Signature: {signature} placeholder

REQUIREMENTS:
- Subject: Under 50 characters, curiosity-driven
- Word count: 80-120 words total
- Tone: ${toneInstruction}
- Goal: ${goalInstruction}
- Use {first_name}, {company}, {title} placeholders
- Reference enriched profile data when available
- Include line breaks (\\n) between sections`;

          const userPrompt = `${contextSummary}

PROSPECT DETAILS:
Name: ${prospect.name}
Title: ${prospect.title || 'Professional'}
Company: ${prospect.company || 'their organization'}${enrichedProfileSection}

TARGET CRITERIA:
${JSON.stringify(targetCriteria, null, 2)}

${instructions ? `CAMPAIGN INSTRUCTIONS:\n${instructions}\n` : ''}

Return ONLY a JSON object:
{
  "subject": "curiosity-driven subject under 50 chars",
  "body": "Dear {mr_ms} {last_name},\\n\\n[Opening sentence]\\n\\n[Body paragraph]\\n\\n[CTA]\\n\\nBest,\\n{signature}"
}`;

          // Generate email using Gemini
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
            throw new Error(`Gemini API error (${geminiResponse.status}): ${errorText}`);
          }

          const geminiData = await geminiResponse.json();
          const generatedContent = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
          
          if (!generatedContent) {
            throw new Error(`No content generated from Gemini`);
          }

          // Parse JSON response from Gemini
          try {
            const jsonMatch = generatedContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              parsedSubject = parsed.subject || '';
              parsedBody = parsed.body || '';
              parsedBody = parsedBody.replace(/\\n/g, '\n');
            }
          } catch (e) {
            // Fallback parsing
            const lines = generatedContent.split('\n');
            for (let j = 0; j < lines.length; j++) {
              if (lines[j] && lines[j].toLowerCase().startsWith('subject:')) {
                parsedSubject = lines[j].replace(/^subject:\s*/i, '').trim();
              } else if (parsedSubject && lines[j] && lines[j].trim()) {
                parsedBody = lines.slice(j).join('\n').trim();
                break;
              }
            }
          }

          if (!parsedSubject) parsedSubject = 'Quick question';
          if (!parsedBody) parsedBody = generatedContent;
        }

        // Validate and enforce template structure ONLY if no custom template is provided
        if (!templateBody) {
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
            
            // Ensure greeting format uses Mr./Ms. with last name
            if (!parsedBody.match(/^Dear (Mr\.|Ms\.|{mr_ms})/i)) {
              const nameParts = prospect.name?.split(' ') || [];
              const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '{last_name}';
              const firstName = nameParts[0] || '{first_name}';
              // Determine title prefix (Mr./Ms.) based on first name
              const femaleEndings = ['a', 'ia', 'ana', 'ina', 'ella', 'ette', 'elle', 'i', 'y'];
              const firstNameLower = firstName.toLowerCase();
              const useTitle = femaleEndings.some(ending => firstNameLower.endsWith(ending));
              const titlePrefix = useTitle ? 'Ms.' : 'Mr.';
              parsedBody = `Dear ${titlePrefix} ${lastName},\n\n${parsedBody}`;
            }
            
            // Ensure closing format
            if (!parsedBody.match(/(Best|Regards|Thanks|Thank you|Sincerely)[,\s]*$/i)) {
              parsedBody = parsedBody.trim() + '\n\nBest,\n{signature}';
            }
          }
        } else {
          // For custom templates, only ensure signature placeholder is present
          if (templateBody && !parsedBody.includes('{signature}') && !parsedBody.match(/\[Your Name\]|\[your name\]/i)) {
            const closingMatch = parsedBody.match(/(Best|Regards|Thanks|Thank you|Sincerely|Yours|Cheers)[,\s]*$/i);
            if (closingMatch) {
              parsedBody = parsedBody.replace(closingMatch[0], `${closingMatch[0]}\n{signature}`);
            } else {
              parsedBody = parsedBody.trim() + '\n\n{signature}';
            }
          }
        }
        
        // Replace placeholders and clean up
        // DEBUG: Log before placeholder replacement
        const wasTemplate = templateBody !== null;
        const bodyBeforePlaceholders = parsedBody;
        parsedBody = replacePlaceholders(parsedBody, prospect, senderName);
        
        // DEBUG: Log after placeholder replacement
        if (wasTemplate) {
          console.log(`   ✅ Template used: body length ${bodyBeforePlaceholders.length} → ${parsedBody.length} after placeholders`);
          await updateExecutionLog(supabase, execution_id, `✅ Template applied for ${prospect.name}, placeholders replaced`);
        }
        
        // COMPREHENSIVE duplicate signature removal - catch ALL variations
        // Strategy: Find the LAST occurrence of senderName, then remove any duplicates after that
        
        // First, normalize whitespace (but PRESERVE newlines for proper email formatting)
        // Normalize line endings first
        parsedBody = parsedBody.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        // Collapse multiple spaces to single space (but preserve newlines)
        parsedBody = parsedBody.replace(/[ \t]+/g, ' ');
        // Clean up spaces around newlines (but keep the newlines)
        parsedBody = parsedBody.replace(/[ \t]*\n[ \t]*/g, '\n');
        // Limit excessive consecutive newlines (max 3 for paragraph breaks)
        parsedBody = parsedBody.replace(/\n{4,}/g, '\n\n\n');
        
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
        // Pattern 1: "Best, Hari Best, Hari" - duplicate closing + signature combo
        const closingDuplicatePattern = new RegExp(
          `(Best|Regards|Thanks|Thank you|Sincerely)[,\\s]*${senderName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\n]*(Best|Regards|Thanks|Thank you|Sincerely)[,\\s]*${senderName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
          'gi'
        );
        parsedBody = parsedBody.replace(closingDuplicatePattern, (match) => {
          const closing = match.match(/(Best|Regards|Thanks|Thank you|Sincerely)/i)?.[0] || 'Best';
          return `${closing},\n${senderName}`;
        });
        
        // Pattern 2: Multiple instances at the end (e.g., "Best,\nHari\nHari" or "Best Hari Hari")
        const endDuplicatePattern = new RegExp(`(${senderName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?:[\\s\\n]+\\1)+\\s*$`, 'gi');
        parsedBody = parsedBody.replace(endDuplicatePattern, senderName);
        
        // Pattern 3: "Best, Hari Hari" (same closing with duplicate name)
        const sameClosingDuplicatePattern = new RegExp(
          `(Best|Regards|Thanks|Thank you|Sincerely)[,\\s]*${senderName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\n]+${senderName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
          'gi'
        );
        parsedBody = parsedBody.replace(sameClosingDuplicatePattern, (match) => {
          const closing = match.match(/(Best|Regards|Thanks|Thank you|Sincerely)/i)?.[0] || 'Best';
          return `${closing},\n${senderName}`;
        });
        
        // Final pass: Aggressively remove duplicate signatures
        // Count all occurrences of the signature name in the entire body
        const signatureRegex = new RegExp(senderName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const allMatches = parsedBody.match(signatureRegex);
        if (allMatches && allMatches.length > 1) {
          // Find the last occurrence of "Best," or similar closing followed by signature
          const lastClosingPattern = new RegExp(
            `(Best|Regards|Thanks|Thank you|Sincerely)[,\\s]*\\s*${senderName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`,
            'gi'
          );
          const lastMatch = parsedBody.match(lastClosingPattern);
          if (lastMatch) {
            // Keep everything up to and including the last closing + signature
            const lastIndex = parsedBody.toLowerCase().lastIndexOf(lastMatch[0].toLowerCase());
            if (lastIndex !== -1) {
              parsedBody = parsedBody.substring(0, lastIndex + lastMatch[0].length);
            }
          } else {
            // Fallback: keep only the last occurrence of the signature name
            const lastSigIndex = parsedBody.toLowerCase().lastIndexOf(senderName.toLowerCase());
            if (lastSigIndex !== -1) {
              // Keep everything before the last signature, then add proper closing + signature
              const beforeLast = parsedBody.substring(0, lastSigIndex).trim();
              // Check if there's already a closing before the signature
              const hasClosing = beforeLast.match(/(Best|Regards|Thanks|Thank you|Sincerely)[,\\s]*$/i);
              if (hasClosing) {
                parsedBody = beforeLast + '\n' + senderName;
              } else {
                parsedBody = beforeLast + '\n\nBest,\n' + senderName;
              }
            }
          }
        }
        
        // Final aggressive cleanup: Remove any remaining "Best, Hari Best, Hari" patterns
        const aggressivePattern = new RegExp(
          `((Best|Regards|Thanks|Thank you|Sincerely)[,\\s]*\\s*${senderName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\n]*)+`,
          'gi'
        );
        const matches = parsedBody.match(aggressivePattern);
        if (matches && matches.length > 0) {
          // Replace all matches with a single "Best,\nHari"
          parsedBody = parsedBody.replace(aggressivePattern, (match) => {
            const closing = match.match(/(Best|Regards|Thanks|Thank you|Sincerely)/i)?.[0] || 'Best';
            return `${closing},\n${senderName}`;
          });
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
          summaryBody += `Subject: ${email.subject}\n\n`;
          // Preserve line breaks in email body (ensure newlines are displayed properly)
          const formattedBody = email.body.replace(/\n/g, '\n'); // Ensure newlines are preserved
          summaryBody += `${formattedBody}\n`;
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
