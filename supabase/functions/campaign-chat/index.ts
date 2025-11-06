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
                required: ["name", "goal", "target_criteria", "steps"]
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
                      target_criteria: { type: "object" },
                      tone: { type: "string" },
                      goal: { type: "string" },
                      steps: { type: "array" }
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
