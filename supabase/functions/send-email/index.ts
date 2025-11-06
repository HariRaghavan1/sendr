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
    const { email_id } = await req.json();
    
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

    // Get user's Composio API key
    const { data: settings } = await supabaseClient
      .from('user_settings')
      .select('composio_api_key')
      .eq('user_id', user.id)
      .single();

    if (!settings?.composio_api_key) {
      return new Response(
        JSON.stringify({ error: 'Composio API key not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get email and prospect details
    const { data: email } = await supabaseClient
      .from('emails')
      .select('*, prospects(*)')
      .eq('id', email_id)
      .single();

    if (!email) {
      throw new Error('Email not found');
    }

    // Send via Composio using GMAIL_SEND_EMAIL action
    // Note: Users must first connect their Gmail account via Composio dashboard at app.composio.dev
    // and configure an entity_id for multi-user support
    console.log(`Sending email to ${email.prospects.email} via Composio...`);
    
    const composioResponse = await fetch('https://backend.composio.dev/api/v2/actions/GMAIL_SEND_EMAIL/execute', {
      method: 'POST',
      headers: {
        'X-API-Key': settings.composio_api_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        entityId: user.id, // Using user ID as entity ID - users must connect Gmail first
        input: {
          recipient_email: email.prospects.email,
          subject: email.subject,
          body: email.body + '\n\n---\nUnsubscribe: [unsubscribe link]',
        },
      }),
    });

    if (!composioResponse.ok) {
      const errorText = await composioResponse.text();
      console.error('Composio API error:', composioResponse.status, errorText);
      
      // Update email status to failed
      await supabaseClient
        .from('emails')
        .update({
          send_status: 'failed',
          send_error: `Composio error ${composioResponse.status}: ${errorText}`,
          send_attempted_at: new Date().toISOString()
        })
        .eq('id', email_id);
      
      // Provide helpful error messages
      if (composioResponse.status === 401) {
        throw new Error('Composio authentication failed. Please check your API key in Settings.');
      } else if (composioResponse.status === 403) {
        throw new Error('Gmail not connected. Visit app.composio.dev → Connections → Add Gmail → Use Entity ID: ' + user.id);
      } else if (composioResponse.status === 404) {
        throw new Error('Gmail connection not found. Visit app.composio.dev and connect Gmail with Entity ID: ' + user.id);
      } else if (composioResponse.status === 429) {
        throw new Error('Rate limit exceeded. Please wait and try again.');
      }
      
      throw new Error(`Composio API error (${composioResponse.status}): ${errorText}`);
    }

    const result = await composioResponse.json();
    console.log('Email sent successfully via Composio:', result);

    // Update email record
    const { error: updateError } = await supabaseClient
      .from('emails')
      .update({
        sent_at: new Date().toISOString(),
        external_id: result.id || result.messageId,
        send_status: 'sent',
        send_attempted_at: new Date().toISOString()
      })
      .eq('id', email_id);

    if (updateError) {
      console.error('Failed to update email:', updateError);
    }

    // Update prospect status
    await supabaseClient
      .from('prospects')
      .update({ status: 'sent' })
      .eq('id', email.prospect_id);

    // Update campaign stats
    await supabaseClient.rpc('increment', {
      table_name: 'campaigns',
      row_id: email.campaign_id,
      column_name: 'total_sent',
    });

    return new Response(
      JSON.stringify({ success: true, message: 'Email sent successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in send-email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
