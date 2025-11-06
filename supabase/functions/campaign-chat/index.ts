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

    const { data: settings, error: settingsError } = await supabaseClient
      .from('user_settings')
      .select('openai_api_key')
      .eq('user_id', user.id)
      .maybeSingle();

    if (settingsError || !settings?.openai_api_key) {
      throw new Error('OpenAI API key not configured. Please add it in Settings.');
    }

    const OPENAI_API_KEY = settings.openai_api_key;

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
            content: `You are a helpful AI assistant that helps users create email outreach campaigns. Your job is to have a conversation with the user to understand what kind of campaign they want to create.

Ask them questions to understand:
- Who they want to target (job titles, industries, locations, company size)
- What tone they want (professional, casual, friendly)
- What their goal is (meeting, demo, call, information)
- Any specific instructions for the email content

Have a natural conversation. Ask ONE question at a time. Don't overwhelm them with too many questions at once.

When you have enough information to create a campaign (at minimum: target audience and campaign goal), you can call the create_campaign tool.

Be friendly, concise, and helpful.`
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
                    enum: ["professional", "casual", "friendly"],
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
