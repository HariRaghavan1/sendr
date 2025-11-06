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

    // Get Gemini API key from edge function secret
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    
    if (!geminiApiKey) {
      throw new Error('Gemini API key not configured in edge function secrets.');
    }

    console.log('Parsing campaign intent:', message);

    const systemPrompt = `You are a campaign configuration assistant. Extract campaign parameters from user requests.

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
}`;

    const response = await fetch(
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
              parts: [{ text: `${systemPrompt}\n\nUser request: ${message}\n\nExtract the campaign configuration and return ONLY valid JSON, no other text.` }]
            }
          ],
          tools: [{
            functionDeclarations: [{
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
                required: ["name", "target_criteria"]
              }
            }]
          }],
          generationConfig: {
            temperature: 0.3,
          }
        }),
      }
    );

    const data = await response.json();
    console.log('Gemini response:', JSON.stringify(data));

    if (!response.ok) {
      throw new Error(`Gemini API error: ${data.error?.message || 'Unknown error'}`);
    }

    // Extract function call from Gemini response
    const candidate = data.candidates?.[0];
    const functionCall = candidate?.content?.parts?.find((p: any) => p.functionCall)?.functionCall;
    
    if (!functionCall || functionCall.name !== 'create_campaign_config') {
      // Fallback: try to parse JSON from text response
      const text = candidate?.content?.parts?.find((p: any) => p.text)?.text;
      if (text) {
        try {
          const campaignConfig = JSON.parse(text);
          console.log('Extracted campaign config (from text):', campaignConfig);
          return new Response(JSON.stringify(campaignConfig), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        } catch (e) {
          console.error('Failed to parse JSON from text:', e);
        }
      }
      throw new Error('No function call in response');
    }

    const campaignConfig = functionCall.args || {};
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
