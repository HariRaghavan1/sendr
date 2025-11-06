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
    // Use connectedAccountId if available, otherwise fall back to entityId
    console.log(`Sending email to ${email.prospects.email} via Composio...`);
    
    // Get connected account ID from settings if available
    const { data: settingsWithAccount } = await supabaseClient
      .from('user_settings')
      .select('composio_connected_account_id, composio_api_key')
      .eq('user_id', user.id)
      .single();
    
    // Check if saved ID is a valid UUID
    let connectedAccountId = settingsWithAccount?.composio_connected_account_id;
    const isSavedIdValid = connectedAccountId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(connectedAccountId);
    
    // If saved ID is not a valid UUID, search for the connection
    if (!isSavedIdValid && settingsWithAccount?.composio_api_key) {
      console.log('Saved connected account ID is not a valid UUID, searching for connection...');
      
      try {
        const listResponse = await fetch(
          `https://backend.composio.dev/api/v3/connected_accounts?toolkit_slugs=GMAIL`,
          {
            headers: {
              'x-api-key': settingsWithAccount.composio_api_key,
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
            await supabaseClient
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
        recipient_email: email.prospects.email,
        subject: email.subject,
        body: email.body + '\n\n---\nUnsubscribe: [unsubscribe link]',
      },
    };
    
    // Use connectedAccountId if we have a valid UUID
    if (connectedAccountId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(connectedAccountId)) {
      requestBody.connectedAccountId = connectedAccountId;
      console.log(`Using connected account UUID: ${requestBody.connectedAccountId}`);
    } else {
      throw new Error('GMAIL_NOT_CONNECTED: No valid Gmail connection found. Please go to Settings and click "Test Gmail Connection" to verify your connection.');
    }
    
    const composioResponse = await fetch('https://backend.composio.dev/api/v2/actions/GMAIL_SEND_EMAIL/execute', {
      method: 'POST',
      headers: {
        'X-API-Key': settings.composio_api_key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
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
      } else if (composioResponse.status === 403 || composioResponse.status === 404) {
        // Gmail not connected - this should trigger connect_gmail in chat
        throw new Error('GMAIL_NOT_CONNECTED: Your Gmail account is not connected or authentication has expired. Please reconnect your Gmail account to send emails.');
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
