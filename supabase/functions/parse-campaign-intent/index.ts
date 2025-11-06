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
    const { message } = await req.json();
    
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
      .single();

    if (settingsError || !settings?.openai_api_key) {
      throw new Error('OpenAI API key not configured. Please add it in Settings.');
    }

    const OPENAI_API_KEY = settings.openai_api_key;
    console.log('Parsing campaign intent:', message);

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
            content: `You are a campaign configuration assistant. Extract campaign parameters from user requests.
            
Return a JSON object with:
- name: Campaign name (string)
- target_criteria: Object with fields like industry, job_titles (array), location, company_size, etc.
- tone: One of "professional", "casual", "friendly" (default: "casual")
- goal: One of "meeting", "demo", "call", "information" (default: "meeting")
- custom_prompt: Additional instructions for email generation (string)

Examples:
"Find professors and send them emails" → 
{
  "name": "Professor Outreach Campaign",
  "target_criteria": {"job_titles": ["Professor", "Associate Professor", "Assistant Professor"]},
  "tone": "professional",
  "goal": "meeting",
  "custom_prompt": "Focus on research collaboration opportunities"
}

"Reach out to CTOs at tech startups in San Francisco" →
{
  "name": "SF Tech CTO Campaign",
  "target_criteria": {"job_titles": ["CTO", "Chief Technology Officer"], "location": "San Francisco", "industry": "Technology"},
  "tone": "professional",
  "goal": "demo"
}`
          },
          {
            role: 'user',
            content: message
          }
        ],
        tools: [
          {
            type: "function",
            name: "create_campaign_config",
            description: "Extract campaign configuration from user intent",
            parameters: {
              type: "object",
              properties: {
                name: { type: "string", description: "Campaign name" },
                target_criteria: {
                  type: "object",
                  description: "Criteria for finding prospects",
                  properties: {
                    job_titles: { type: "array", items: { type: "string" } },
                    industry: { type: "string" },
                    location: { type: "string" },
                    company_size: { type: "string" }
                  }
                },
                tone: {
                  type: "string",
                  enum: ["professional", "casual", "friendly"],
                  description: "Email tone"
                },
                goal: {
                  type: "string",
                  enum: ["meeting", "demo", "call", "information"],
                  description: "Campaign goal"
                },
                custom_prompt: { type: "string", description: "Additional instructions" }
              },
              required: ["name", "target_criteria"],
              additionalProperties: false
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "create_campaign_config" } }
      }),
    });

    const data = await response.json();
    console.log('OpenAI response:', JSON.stringify(data));

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${data.error?.message || 'Unknown error'}`);
    }

    const toolCall = data.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in response');
    }

    const campaignConfig = JSON.parse(toolCall.function.arguments);
    console.log('Extracted campaign config:', campaignConfig);

    return new Response(JSON.stringify(campaignConfig), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in parse-campaign-intent:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
