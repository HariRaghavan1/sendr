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

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    console.log('Campaign chat - messages count:', messages.length);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an efficient AI assistant for creating email outreach campaigns and workflows. Your goal is to help users build campaigns QUICKLY and VISUALLY.

WHEN USER DESCRIBES A WORKFLOW (e.g., "find professors to do research", "reach out to investors"):
1. Immediately create a visual workflow using create_workflow tool
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

WORKFLOW INSTRUCTIONS (MEGA-PROMPT):
When creating workflows, generate COMPREHENSIVE instructions that include:

1. TARGET CRITERIA DETAILS
   - Exact job titles, seniority levels
   - Company size, industry specifics
   - Geographic preferences
   - Any exclusions

2. EMAIL GENERATION GUIDANCE
   - Tone and style (professional, casual, etc.)
   - Key talking points to mention
   - Personalization strategy (mention their work, company, recent news)
   - Length guidelines (keep concise, 3-4 sentences)
   - Specific call-to-action

3. OUTREACH STRATEGY
   - When to send (time of day, day of week)
   - Batch size and frequency
   - Follow-up sequence (if any)
   - Stopping conditions (replied, bounced, etc.)

4. SPECIAL REQUIREMENTS
   - Any compliance needs
   - Custom variables to include

Example mega-prompt:
"Target computer science professors at R1 research universities in the US, focusing on those with active AI/ML research groups. Email should be professional but approachable, 3-4 sentences max. Open by referencing a recent paper or research area. Explain our research collaboration opportunity briefly. Close with specific ask for 15-min call. Send daily at 9 AM EST, 25 per batch. Stop if they reply or bounce. Include {first_name}, {university}, {research_area} variables."

RUNNING TEST RUNS:
When users want to run a test, look back through the conversation to find the workflow ID.

CRITICAL: The workflow ID will appear in previous messages in this format:
"Created campaign 'Name' (ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)"

Extract the UUID from that message and use it in your run_test call.

Parameters for run_test:
- workflow_id: The UUID found in the conversation (e.g., "193002f1-6870-420f-a3c3-7bb40243259c")
- max_prospects: Number of prospects to test with (default 5)
- skip_sending: Whether to skip actually sending emails (default true for testing)

Examples:
- User: "Run a test for 3 people"
  → Look for "Created campaign" message, extract the ID like "193002f1-6870-420f-a3c3-7bb40243259c"
  → Call run_test with workflow_id: "193002f1-6870-420f-a3c3-7bb40243259c", max_prospects: 3

- User: "Test again with 10 prospects"  
  → Find the most recent workflow ID from conversation history
  → Call run_test with that ID, max_prospects: 10

EMAIL TEMPLATES:
Users can create email templates with components via chat:
- "Add a template with background research and opening hook"
- "Create an email template that focuses on personalization"

Use add_email_template tool to create templates with these components:
- background_research: Research to do on each prospect
- opening_hook: How to open the email
- value_proposition: Main value/benefit
- personalization_strategy: How to personalize
- call_to_action: What action to request
- tone_guidelines: Tone and style instructions

EDITING CAMPAIGNS:
When users want to edit campaign details, use these patterns:

Natural Language → Action:
- "Change the tone to professional" → update_campaign with tone: "professional"
- "Update target to CTOs in NYC" → update_campaign with target_criteria: { job_titles: ["CTO"], location: "NYC" }
- "Make it run twice a day" → update_campaign with frequency_config: { type: "daily", batch_size: 50 }
- "Pause the campaign" → update_campaign with status: "paused"
- "Change the goal to booking demos" → update_campaign with goal: "demo"
- "Update the instructions to mention our new product" → update_campaign with custom_prompt: "..."

FINDING CAMPAIGN TO EDIT:
Look back in the conversation for:
1. Most recent "Created campaign" message with ID
2. Check for workflow_id that links to a campaign
3. Extract campaign_id or workflow_id from conversation history

You can edit EVERYTHING about a campaign through chat. Always confirm what you changed.

CLADO INTEGRATION:
When creating workflows/campaigns, understand these target criteria patterns:

User says → target_criteria:
- "CTOs in San Francisco" → { job_titles: ["CTO"], location: "San Francisco" }
- "founders at Y Combinator companies" → { job_titles: ["Founder", "Co-Founder"], companies: ["Y Combinator portfolio"] }
- "software engineers at FAANG" → { job_titles: ["Software Engineer"], companies: ["Google", "Meta", "Amazon", "Apple", "Netflix"] }
- "marketing directors in healthcare" → { job_titles: ["Marketing Director"], industry: "healthcare" }

Clado will automatically:
1. Find LinkedIn profiles matching the criteria using natural language search
2. Enrich with email addresses (when enabled - costs 4 credits per email)
3. Return full profile data (experience, education, skills, posts)

If user asks about prospects without emails, suggest:
"I'll enable email enrichment through Clado - this costs 4 credits per email found but significantly improves deliverability."

WORKFLOW:
1. If user provides target audience, ask about their goal
2. Once you have target + goal, CREATE immediately using the appropriate tool
3. Use reasonable defaults for any missing details
4. Keep it to 2-3 messages MAX

Be direct and action-oriented. Don't ask unnecessary questions.`
          },
          ...messages
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_campaign",
              description: "Create a new email campaign when you have gathered enough information from the user",
              parameters: {
                type: "object",
                properties: {
                  name: { 
                    type: "string", 
                    description: "A descriptive name for the campaign" 
                  },
                  target_criteria: {
                    type: "object",
                    description: "Criteria for finding prospects",
                    properties: {
                      job_titles: { 
                        type: "array", 
                        items: { type: "string" },
                        description: "Array of job titles to target"
                      },
                      industry: { 
                        type: "string",
                        description: "Industry to target"
                      },
                      location: { 
                        type: "string",
                        description: "Geographic location"
                      },
                      company_size: { 
                        type: "string",
                        description: "Company size range"
                      }
                    }
                  },
                  tone: {
                    type: "string",
                    enum: ["professional", "casual"],
                    description: "Email tone to use"
                  },
                  goal: {
                    type: "string",
                    enum: ["meeting", "demo", "call", "information"],
                    description: "Campaign goal"
                  },
                  custom_prompt: { 
                    type: "string", 
                    description: "Additional instructions for email generation" 
                  }
                },
                required: ["name", "target_criteria", "tone", "goal"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "create_workflow",
              description: "Create a visual workflow for complex campaigns. Use this when user describes a multi-step outreach process.",
              parameters: {
                type: "object",
                properties: {
                  name: { 
                    type: "string", 
                    description: "Descriptive workflow name" 
                  },
                  description: {
                    type: "string",
                    description: "Brief 1-2 sentence summary of what this workflow does and who it targets"
                  },
                  goal: {
                    type: "string",
                    enum: ["meeting", "demo", "call", "information"],
                    description: "Campaign goal"
                  },
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
                  tone: {
                    type: "string",
                    enum: ["professional", "casual"],
                    description: "Email tone"
                  },
                  instructions: {
                    type: "string",
                    description: "Comprehensive mega-prompt with detailed step-by-step instructions covering target criteria, email generation guidance, personalization tactics, outreach strategy, and special requirements. Be thorough and specific."
                  },
                  schedule: {
                    type: "object",
                    description: "Campaign execution schedule",
                    properties: {
                      frequency: {
                        type: "string",
                        enum: ["daily", "weekly", "monthly"],
                        description: "How often to run the campaign"
                      },
                      time: {
                        type: "string",
                        description: "Time to run in HH:MM format (e.g., '09:00')"
                      },
                      batch_size: {
                        type: "number",
                        description: "Number of prospects to process per run"
                      }
                    }
                  },
                  steps: {
                    type: "array",
                    description: "Workflow steps",
                    items: {
                      type: "object",
                      properties: {
                        action: { 
                          type: "string",
                          enum: ["find_prospects", "generate_email", "send_email"],
                          description: "Step action"
                        },
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
              description: "Run a test execution of a workflow with specified parameters. Use this when user wants to test a campaign. IMPORTANT: workflow_id must be the UUID returned from create_workflow, NOT the workflow name. Note: Workflows are automatically linked to campaigns. Set skip_sending=false if the user explicitly asks to 'send' emails (requires Composio setup with Gmail connected). By default, skip_sending=true for safety (dry run mode).",
              parameters: {
                type: "object",
                properties: {
                  workflow_id: {
                    type: "string",
                    description: "UUID of the workflow to test (from the 'id' field returned by create_workflow)"
                  },
                  max_prospects: {
                    type: "number",
                    description: "Number of prospects to test with (default: 5)",
                    default: 5
                  },
                  skip_sending: {
                    type: "boolean",
                    description: "Whether to skip actually sending emails (default: true for testing)",
                    default: true
                  },
                  use_template: {
                    type: "boolean",
                    description: "Whether to use an email template",
                    default: false
                  },
                  template_id: {
                    type: "string",
                    description: "ID of template to use (if use_template is true)"
                  }
                },
                required: ["workflow_id"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "add_email_template",
              description: "Create a new email template with structured components for a workflow",
              parameters: {
                type: "object",
                properties: {
                  workflow_id: {
                    type: "string",
                    description: "ID of workflow this template is for"
                  },
                  name: {
                    type: "string",
                    description: "Template name"
                  },
                  subject: {
                    type: "string",
                    description: "Email subject line with variables like {name}, {company}, {title}"
                  },
                  body: {
                    type: "string",
                    description: "Email body with variables like {name}, {company}, {title}"
                  },
                  components: {
                    type: "object",
                    description: "Structured template components",
                    properties: {
                      background_research: {
                        type: "string",
                        description: "What background research to do on prospects"
                      },
                      opening_hook: {
                        type: "string",
                        description: "How to open the email"
                      },
                      value_proposition: {
                        type: "string",
                        description: "Main value proposition"
                      },
                      personalization_strategy: {
                        type: "string",
                        description: "How to personalize the email"
                      },
                      call_to_action: {
                        type: "string",
                        description: "What action to request"
                      },
                      tone_guidelines: {
                        type: "string",
                        description: "Tone and style guidelines"
                      }
                    }
                  }
                },
                required: ["workflow_id", "name", "subject", "body", "components"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "edit_email_template",
              description: "Edit an existing email template",
              parameters: {
                type: "object",
                properties: {
                  template_id: {
                    type: "string",
                    description: "ID of template to edit"
                  },
                  updates: {
                    type: "object",
                    description: "Fields to update",
                    properties: {
                      name: { type: "string" },
                      subject: { type: "string" },
                      body: { type: "string" },
                      components: { type: "object" }
                    }
                  }
                },
                required: ["template_id", "updates"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "update_campaign",
              description: "Update campaign settings when user wants to change campaign details, schedule, or status. CRITICAL: Look back through the conversation to find the campaign_id from the most recent 'Created campaign' message that shows an ID.",
              parameters: {
                type: "object",
                properties: {
                  campaign_id: {
                    type: "string",
                    description: "Campaign UUID (find from conversation history)"
                  },
                  updates: {
                    type: "object",
                    description: "Fields to update",
                    properties: {
                      name: { type: "string", description: "Campaign name" },
                      status: {
                        type: "string",
                        enum: ["draft", "active", "paused", "completed"],
                        description: "Campaign status"
                      },
                      target_criteria: {
                        type: "object",
                        description: "Target audience criteria"
                      },
                      tone: {
                        type: "string",
                        enum: ["professional", "casual"],
                        description: "Email tone"
                      },
                      goal: {
                        type: "string",
                        enum: ["meeting", "demo", "call", "information"],
                        description: "Campaign goal"
                      },
                      custom_prompt: {
                        type: "string",
                        description: "Additional email generation instructions"
                      },
                      frequency_config: {
                        type: "object",
                        description: "Schedule configuration",
                        properties: {
                          type: {
                            type: "string",
                            enum: ["daily", "weekly", "monthly"]
                          },
                          time: { type: "string" },
                          batch_size: { type: "number" }
                        }
                      }
                    }
                  }
                },
                required: ["campaign_id", "updates"]
              }
            }
          },
          {
            type: "function",
            function: {
              name: "update_workflow",
              description: "Update an existing workflow based on user feedback",
              parameters: {
                type: "object",
                properties: {
                  workflow_id: { 
                    type: "string",
                    description: "ID of workflow to update"
                  },
                  updates: {
                    type: "object",
                    description: "Fields to update (partial workflow object)",
                    properties: {
                      name: { type: "string" },
                      description: { type: "string" },
                      target_criteria: { type: "object" },
                      tone: { type: "string" },
                      goal: { type: "string" },
                      instructions: { type: "string" },
                      schedule: { type: "object" },
                      steps: { 
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            action: { 
                              type: "string",
                              enum: ["find_prospects", "generate_email", "send_email"]
                            },
                            description: { type: "string" }
                          }
                        }
                      }
                    }
                  }
                },
                required: ["workflow_id", "updates"]
              }
            }
          }
        ],
        stream: true
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    // Return streaming response
    return new Response(response.body, {
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
