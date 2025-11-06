import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prospect_id, campaign_id } = await req.json();
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    // Get user's OpenAI API key
    const { data: settings } = await supabaseClient
      .from('user_settings')
      .select('openai_api_key')
      .eq('user_id', user.id)
      .single();

    if (!settings?.openai_api_key) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get prospect and campaign details
    const { data: prospect } = await supabaseClient
      .from('prospects')
      .select('*')
      .eq('id', prospect_id)
      .single();

    const { data: campaign } = await supabaseClient
      .from('campaigns')
      .select('*')
      .eq('id', campaign_id)
      .single();

    if (!prospect || !campaign) {
      throw new Error('Prospect or campaign not found');
    }

    // Build context for email generation
    const toneMap: Record<string, string> = {
      formal: 'professional and formal',
      casual: 'friendly and conversational',
      witty: 'playful and witty',
    };
    const toneInstruction = toneMap[campaign.tone] || 'friendly and conversational';

    const goalMap: Record<string, string> = {
      demo: 'book a product demo',
      meeting: 'schedule a quick meeting',
      partnership: 'explore a potential partnership',
      other: 'start a conversation',
    };
    const goalInstruction = goalMap[campaign.goal] || 'start a conversation';

    const systemPrompt = `You are an expert cold email writer. Write personalized, compelling emails that feel human and conversational. 
    
Guidelines:
- Keep it under 120 words
- Use a ${toneInstruction} tone
- Goal is to ${goalInstruction}
- Create curiosity, don't hard sell
- Focus on the prospect's role and potential pain points
- End with a clear, low-pressure call to action`;

    const userPrompt = `Write a cold email to ${prospect.name}, ${prospect.title || 'professional'} at ${prospect.company || 'their company'}.

Target criteria for this campaign:
${JSON.stringify(campaign.target_criteria, null, 2)}

${campaign.custom_prompt ? `Additional instructions: ${campaign.custom_prompt}` : ''}

Write a compelling subject line and email body that opens a conversation.`;

    // Generate email using OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.openai_api_key}`,
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

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenAI API error:', error);
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const generatedContent = data.choices[0].message.content;

    // Parse subject and body (expect format: "Subject: ...\n\nBody...")
    const lines = generatedContent.split('\n');
    let subject = '';
    let body = '';
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().startsWith('subject:')) {
        subject = lines[i].replace(/^subject:\s*/i, '').trim();
      } else if (subject && lines[i].trim()) {
        body = lines.slice(i).join('\n').trim();
        break;
      }
    }

    if (!subject) {
      subject = 'Quick question';
      body = generatedContent;
    }

    // Save email to database
    const { data: email, error: emailError } = await supabaseClient
      .from('emails')
      .insert({
        prospect_id,
        campaign_id,
        user_id: user.id,
        subject,
        body,
      })
      .select()
      .single();

    if (emailError) {
      throw new Error(`Failed to save email: ${emailError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, email }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in generate-email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
