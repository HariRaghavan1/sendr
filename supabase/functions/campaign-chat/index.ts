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
        model: 'gpt-5-mini-2025-08-07',
        messages: [
          {
            role: 'system',
            content: `You are an efficient AI assistant for creating email outreach campaigns. Your goal is to gather the MINIMUM information needed and create campaigns QUICKLY.

REQUIRED INFO (ask for these first):
- Target audience (job titles, industry, or company type)
- Campaign goal (meeting, demo, call, or information)

OPTIONAL INFO (use smart defaults if not provided):
- Tone: default to "casual" if not specified
- Location: default to "United States" if not specified
- Company size: default to "50-200 employees" if not specified

WORKFLOW:
1. If user provides target audience in their first message, ask about their goal
2. Once you have target + goal, CREATE THE CAMPAIGN immediately using the tool
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
          }
        ],
        // no streaming to avoid org verification requirement
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message || {};
    const content = message.content || '';
    const tool_calls = message.tool_calls || [];

    return new Response(JSON.stringify({ content, tool_calls }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
