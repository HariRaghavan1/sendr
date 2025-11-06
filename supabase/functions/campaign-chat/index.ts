import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
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
    const { messages } = await req.json();
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: { Authorization: authHeader }
      }
    });

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('Gemini API key not configured');
    }

    console.log('Campaign chat - messages count:', messages.length);

    // System prompt
    const systemMessage = `You are an efficient AI assistant for creating email outreach campaigns and workflows. Your goal is to help users build campaigns QUICKLY and VISUALLY.

The system will automatically extract the sender's first name from their Gmail account for email signatures. If the user wants to use a different name (e.g., "use Hari instead" or "change my name to John"), use the set_sender_name tool to save their preference. Otherwise, the default Gmail name will be used.

EMAIL TEMPLATE MANAGEMENT:
- Users can set custom email templates or provide example emails
- When a user says things like:
  * "use this email as a template" or "generate emails like this" → Use set_email_template with example_email
  * "use a formal template" or "always start with a question" → Use set_email_template with template_structure
  * "I want emails to follow this format" → Extract the format and use set_email_template
- ALWAYS use set_email_template tool when users provide:
  * Example emails (copy/paste an email)
  * Template preferences (formal, casual, specific structure)
  * Format requirements (e.g., "always end with a question")

WHEN USER DESCRIBES A WORKFLOW AND ASKS TO TEST IT (e.g., "find 5 executive directors and draft emails", "find prospects and send me drafts"):
1. IMMEDIATELY create a campaign using create_campaign tool
2. IMMEDIATELY run a test using run_test tool right after creating the campaign
3. Extract email address from user's message if they mention sending drafts to an email (e.g., "send to hariraghavan2023@gmail.com")
4. For test runs, ALWAYS set:
   - send_drafts_to_email: Extract from user message OR default to 'hariraghavan2023@gmail.com'
   - enrich_emails: true (so we can find prospect emails)
   - skip_sending: true (don't actually send to prospects, just generate drafts)
   - max_prospects: Extract number from user message OR default to 5

WHEN USER DESCRIBES A WORKFLOW WITHOUT TESTING (e.g., "find professors to do research"):
1. Create a visual workflow using create_workflow tool
2. Ask 1-2 clarifying questions about target criteria
3. Update the workflow using update_workflow tool based on their responses
4. Show the workflow so users can see what they're building

REQUIRED INFO for campaigns:
- Target audience (job titles, industry, or company type)
- Campaign goal (meeting, demo, call, or information)

OPTIONAL INFO (use smart defaults):
- Tone: default to "casual" if not specified
- Location: default to "United States" if not specified
- Company size: default to "50-200 employees" if not specified
- Schedule: default to daily at 9 AM, 25 prospects per batch

CRITICAL: If user mentions "draft emails", "send me drafts", "test it", "run a test", or provides an email address to send drafts to, you MUST:
1. Create the campaign first
2. Then IMMEDIATELY call run_test with the appropriate parameters
3. Extract the email address from their message if provided
4. This should all happen in ONE response - don't wait for confirmation

Be direct and action-oriented. Don't ask unnecessary questions.`;

    // Define tools for Gemini function calling
    const tools = [
      {
        type: "function",
        function: {
          name: "create_campaign",
          description: "Create a new email campaign when you have gathered enough information from the user. After creating, if the user asked to test it or send drafts, IMMEDIATELY call run_test tool.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "A descriptive name for the campaign" },
              target_criteria: {
                type: "object",
                description: "Criteria for finding prospects",
                properties: {
                  job_titles: { type: "array", items: { type: "string" }, description: "Array of job titles to target" },
                  industry: { type: "string", description: "Industry to target" },
                  location: { type: "string", description: "Geographic location" },
                  company_size: { type: "string", description: "Company size range" }
                }
              },
              tone: { type: "string", enum: ["professional", "casual"], description: "Email tone to use" },
              goal: { type: "string", enum: ["meeting", "demo", "call", "information"], description: "Campaign goal" },
              custom_prompt: { type: "string", description: "Additional instructions for email generation" }
            },
            required: ["name", "target_criteria", "tone", "goal"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "create_workflow",
          description: "Create a visual workflow for complex campaigns",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "Descriptive workflow name" },
              description: { type: "string", description: "Brief summary of what this workflow does" },
              goal: { type: "string", enum: ["meeting", "demo", "call", "information"], description: "Campaign goal" },
              target_criteria: {
                type: "object",
                description: "Target audience criteria",
                properties: {
                  job_titles: { type: "array", items: { type: "string" } },
                  industry: { type: "string" },
                  location: { type: "string" },
                  company_size: { type: "string" }
                }
              },
              tone: { type: "string", enum: ["professional", "casual"], description: "Email tone" },
              instructions: { type: "string", description: "Comprehensive instructions" },
              schedule: {
                type: "object",
                description: "Campaign execution schedule",
                properties: {
                  frequency: { type: "string", enum: ["daily", "weekly", "monthly"] },
                  time: { type: "string", description: "Time to run in HH:MM format" },
                  batch_size: { type: "number", description: "Number of prospects per run" }
                }
              },
              steps: {
                type: "array",
                description: "Workflow steps",
                items: {
                  type: "object",
                  properties: {
                    action: { type: "string", enum: ["find_prospects", "generate_email", "send_email"] },
                    description: { type: "string" }
                  }
                }
              }
            },
            required: ["name", "description", "goal", "target_criteria", "instructions", "schedule", "steps"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "run_test",
          description: "Run a test execution of a workflow. CRITICAL: Extract the email address from the user's message if they mention sending drafts to an email (e.g., 'send to hariraghavan2023@gmail.com' or 'draft emails that you send to X'). If no email is mentioned, default to 'hariraghavan2023@gmail.com'. ALWAYS set enrich_emails=true so we can find prospect email addresses. Set skip_sending=true so we don't actually send to prospects, just generate drafts. Extract the number of prospects from user message (e.g., 'find 5 executive directors' = max_prospects: 5). If workflow_id is not provided, the system will automatically find the workflow from the conversation context. IMPORTANT: Call this IMMEDIATELY after create_campaign if the user asked to test or draft emails.",
          parameters: {
            type: "object",
            properties: {
              workflow_id: { type: "string", description: "UUID of the workflow to test. Optional - if not provided, will automatically find the workflow from the conversation." },
              max_prospects: { type: "number", description: "Number of prospects to test with (default: 5)", default: 5 },
              skip_sending: { type: "boolean", description: "Whether to skip actually sending emails. Set to false if user wants to actually send emails. Default: true for safety.", default: true },
              enrich_emails: { type: "boolean", description: "Whether to enrich prospects with email addresses via Clado (costs 4 credits per email). Set to true if user wants to send emails. Default: false.", default: false },
              send_drafts_to_email: { type: "string", description: "Email address to send all generated email drafts to for review. For test runs, ALWAYS set this to 'hariraghavan2023@gmail.com' so the user can review the drafts. This sends a summary email with all drafts instead of sending to prospects." }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "connect_gmail",
          description: "Prompt user to connect their Gmail account via Composio",
          parameters: {
            type: "object",
            properties: {
              reason: { type: "string", description: "Why Gmail connection is needed" }
            },
            required: ["reason"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "set_sender_name",
          description: "Save a custom name for email signatures. Call this when the user explicitly wants to override the default Gmail name (e.g., 'use Hari instead', 'change my name to John', 'I want to sign as Dr. Smith'). If they just mention their name casually, you don't need to use this tool - the system will use their Gmail name by default.",
          parameters: {
            type: "object",
            properties: {
              name: { type: "string", description: "The custom name to use when signing emails instead of the default Gmail name (e.g., 'Hari', 'John Smith', 'Dr. Smith', etc.)" }
            },
            required: ["name"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "set_email_template",
          description: "Set a custom email template or example email for the workflow. Use this when the user wants to: 1) Use a specific email template (e.g., 'use a formal template', 'use a casual template'), 2) Provide an example email to follow (e.g., 'use this email as a template', 'generate emails like this'), 3) Specify template requirements (e.g., 'always start with a question', 'end with a call to action'). This template will be used for ALL emails generated in this workflow.",
          parameters: {
            type: "object",
            properties: {
              workflow_id: { type: "string", description: "UUID of the workflow to update. If not provided, will find the workflow from the conversation context." },
              template_type: { 
                type: "string", 
                enum: ["structured", "example"], 
                description: "Type of template: 'structured' for a structured template with sections, 'example' for a complete example email to follow" 
              },
              template_structure: {
                type: "object",
                description: "For structured templates: define the structure with sections (greeting, opening, body, cta, closing). Each section can have instructions.",
                properties: {
                  greeting: { type: "string", description: "Greeting format instructions (e.g., 'Always use Hi {first_name},')" },
                  opening: { type: "string", description: "Opening line instructions (e.g., 'Start with a question about their role')" },
                  body: { type: "string", description: "Body paragraph instructions (e.g., 'Mention their company and how we can help')" },
                  cta: { type: "string", description: "Call to action instructions (e.g., 'Ask for a 15-minute call')" },
                  closing: { type: "string", description: "Closing format (e.g., 'Always use Best,')" }
                }
              },
              example_email: {
                type: "object",
                description: "For example emails: provide a complete example email that should be used as a template",
                properties: {
                  subject: { type: "string", description: "Example subject line" },
                  body: { type: "string", description: "Example email body (use {first_name}, {company}, {title} as placeholders)" }
                }
              },
              template_instructions: {
                type: "string",
                description: "Additional instructions for how to use this template (e.g., 'Always personalize the opening based on their role', 'Keep it under 100 words')"
              }
            },
            required: ["template_type"]
          }
        }
      }
    ];

    // Convert OpenAI tools format to Gemini function declarations
    const functionDeclarations = tools.map((tool: any) => ({
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters
    }));

    // Convert OpenAI messages format to Gemini contents format
    const geminiContents: any[] = [];
    
    // Add system message as first user message
    geminiContents.push({
      role: 'user',
      parts: [{ text: systemMessage }]
    });
    
    // Add model response acknowledging system message
    geminiContents.push({
      role: 'model',
      parts: [{ text: 'I understand. I\'m ready to help you create email outreach campaigns and workflows.' }]
    });
    
    // Convert conversation messages
    for (const msg of messages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        geminiContents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content || '' }]
        });
      }
    }

    // Build Gemini request
    const geminiRequest: any = {
      contents: geminiContents,
      generationConfig: {
        temperature: 0.7,
      }
    };

    // Add tools if available
    if (functionDeclarations.length > 0) {
      geminiRequest.tools = [{
        functionDeclarations: functionDeclarations
      }];
    }

    // Call Gemini API with streaming
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:streamGenerateContent?alt=sse`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY,
        },
        body: JSON.stringify(geminiRequest),
      }
    );

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      let errorJson: any = null;
      try {
        errorJson = JSON.parse(errorText);
      } catch (e) {
        // If parsing fails, use the raw text
      }
      
      console.error('Gemini API error:', geminiResponse.status, errorText);
      
      // Handle specific error codes
      if (geminiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (geminiResponse.status === 503 || geminiResponse.status === 500) {
        const errorMessage = errorJson?.error?.message || 'The AI service is temporarily unavailable';
        return new Response(JSON.stringify({ 
          error: `${errorMessage}. This is usually temporary - please try again in a few moments.`,
          code: errorJson?.error?.code || 'SERVICE_UNAVAILABLE',
          retryable: true
        }), {
          status: geminiResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // For other errors, return a more user-friendly message
      const errorMessage = errorJson?.error?.message || errorText || 'An error occurred';
      throw new Error(`Gemini API error: ${errorMessage}`);
    }

    // Transform Gemini SSE format to OpenAI SSE format
    const reader = geminiResponse.body?.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    
    if (!reader) {
      throw new Error('No response body from Gemini API');
    }

    // Create a transform stream to convert Gemini SSE to OpenAI SSE format
    const transformStream = new ReadableStream({
      async start(controller) {
        let buffer = '';
        let chunkId = 0;
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            
            // Process complete SSE lines
            let newlineIndex: number;
            while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
              const line = buffer.slice(0, newlineIndex).trim();
              buffer = buffer.slice(newlineIndex + 1);
              
              if (!line.startsWith('data: ')) continue;
              
              const jsonStr = line.slice(6);
              if (jsonStr === '{}' || jsonStr.trim() === '') continue;
              
              try {
                const geminiData = JSON.parse(jsonStr);
                
                // Transform Gemini format to OpenAI format
                if (geminiData.candidates && geminiData.candidates[0]) {
                  const candidate = geminiData.candidates[0];
                  
                  // Handle text content
                  if (candidate.content && candidate.content.parts) {
                    const textPart = candidate.content.parts.find((p: any) => p.text);
                    if (textPart && textPart.text) {
                      const openaiFormat = {
                        id: `chatcmpl-${chunkId++}`,
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: 'gemini-2.5-flash-lite',
                        choices: [{
                          index: 0,
                          delta: { content: textPart.text },
                          finish_reason: null
                        }]
                      };
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiFormat)}\n\n`));
                    }
                  }
                  
                  // Handle function calls
                  if (candidate.content && candidate.content.parts) {
                    const functionCallPart = candidate.content.parts.find((p: any) => p.functionCall);
                    if (functionCallPart && functionCallPart.functionCall) {
                      const fc = functionCallPart.functionCall;
                      const openaiFormat = {
                        id: `chatcmpl-${chunkId++}`,
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model: 'gemini-2.5-flash-lite',
                        choices: [{
                          index: 0,
                          delta: {
                            role: 'assistant',
                            tool_calls: [{
                              index: 0,
                              id: `call_${chunkId}`,
                              type: 'function',
                              function: {
                                name: fc.name,
                                arguments: JSON.stringify(fc.args || {})
                              }
                            }]
                          },
                          finish_reason: null
                        }]
                      };
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiFormat)}\n\n`));
                    }
                  }
                  
                  // Handle finish
                  if (candidate.finishReason && candidate.finishReason !== '') {
                    const openaiFormat = {
                      id: `chatcmpl-${chunkId++}`,
                      object: 'chat.completion.chunk',
                      created: Math.floor(Date.now() / 1000),
                        model: 'gemini-2.5-flash-lite',
                      choices: [{
                        index: 0,
                        delta: {},
                        finish_reason: candidate.finishReason === 'STOP' ? 'stop' : 'function_call'
                      }]
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiFormat)}\n\n`));
                  }
                }
              } catch (e) {
                console.error('Error parsing Gemini SSE:', e);
              }
            }
          }
          
          // Send final [DONE] marker
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });

    // Return transformed streaming response
    return new Response(transformStream, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      },
    });

  } catch (error) {
    console.error('Error in campaign-chat:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
