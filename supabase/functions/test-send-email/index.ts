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
    const { recipient_email, subject, body } = await req.json();
    
    if (!recipient_email) {
      return new Response(
        JSON.stringify({ error: 'recipient_email is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Not authenticated', details: authError?.message || 'User not found' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's Composio API key and connected account ID
    const { data: settings, error: settingsError } = await supabaseClient
      .from('user_settings')
      .select('composio_api_key, composio_connected_account_id')
      .eq('user_id', user.id)
      .single();

    if (settingsError) {
      console.error('Error fetching user settings:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Failed to load user settings', details: settingsError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!settings?.composio_api_key || settings.composio_api_key.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Composio API key not configured. Please set it in Settings.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare email content
    const emailSubject = subject || 'Test Email from Bork';
    const emailBody = body || 'This is a test email from the Bork email outreach platform.';
    
    console.log(`Sending test email to ${recipient_email} via Composio...`);
    
    // Always search for the connection first to get the actual UUID
    // This ensures we use the most up-to-date connection info
    let connectedAccountId: string | null = null;
    console.log('Searching for active Gmail connection...');
    
    // Always search for connections (don't rely solely on saved ID)
    try {
      console.log('No connected account ID found in settings, searching for Gmail connections...');
      
      // Try listing all connections (not just Gmail) to see what we get
      let connections: any[] = [];
      
      // Method 1: List Gmail connections specifically
      try {
        const listResponse = await fetch(
          `https://backend.composio.dev/api/v3/connected_accounts?toolkit_slugs=GMAIL`,
          {
            headers: {
              'x-api-key': settings.composio_api_key,
              'Content-Type': 'application/json',
            },
          }
        );
        
        if (listResponse.ok) {
          const listData = await listResponse.json();
          connections = listData.items || listData.data || [];
          console.log(`Method 1 - Found ${connections.length} Gmail connections via toolkit_slugs filter`);
        } else {
          const errorText = await listResponse.text();
          console.error('Method 1 failed:', listResponse.status, errorText);
        }
      } catch (error) {
        console.error('Method 1 error:', error);
      }
      
      // Method 2: If no results, try listing ALL connections
      if (connections.length === 0) {
        try {
          const allResponse = await fetch(
            `https://backend.composio.dev/api/v3/connected_accounts`,
            {
              headers: {
                'x-api-key': settings.composio_api_key,
                'Content-Type': 'application/json',
              },
            }
          );
          
          if (allResponse.ok) {
            const allData = await allResponse.json();
            const allConnections = allData.items || allData.data || [];
            console.log(`Method 2 - Found ${allConnections.length} total connections`);
            
            // Filter for Gmail
            connections = allConnections.filter((c: any) => 
              c.toolkit?.slug?.toLowerCase() === 'gmail' ||
              c.toolkit?.name?.toLowerCase() === 'gmail' ||
              c.appName === 'GMAIL' ||
              c.appName === 'gmail'
            );
            console.log(`Method 2 - Filtered to ${connections.length} Gmail connections`);
          } else {
            const errorText = await allResponse.text();
            console.error('Method 2 failed:', allResponse.status, errorText);
          }
        } catch (error) {
          console.error('Method 2 error:', error);
        }
      }
      
      // Log what we found
      if (connections.length > 0) {
        console.log(`Found ${connections.length} Gmail connections:`, JSON.stringify(connections.map((c: any) => ({
          id: c.connected_account_id || c.id,
          status: c.status,
          toolkit: c.toolkit?.slug || c.toolkit?.name || c.appName,
          entityId: c.entityId
        })), null, 2));
        
        // Find an active Gmail connection
        const activeGmail = connections.find((c: any) => 
          (c.toolkit?.slug?.toLowerCase() === 'gmail' ||
           c.toolkit?.name?.toLowerCase() === 'gmail' ||
           c.appName === 'GMAIL') &&
          c.status === 'ACTIVE'
        );
        
        // Try to find the UUID in any field - check multiple possible field names
        const possibleId = activeGmail.id || 
                           activeGmail.connected_account_id || 
                           activeGmail.connectedAccountId ||
                           activeGmail.accountId ||
                           activeGmail.connectedAccount?.id;
        
        console.log(`Active Gmail connection found. Checking for UUID...`);
        console.log(`Full connection object:`, JSON.stringify(activeGmail, null, 2));
        console.log(`Possible ID fields:`, {
          id: activeGmail.id,
          connected_account_id: activeGmail.connected_account_id,
          connectedAccountId: activeGmail.connectedAccountId,
          accountId: activeGmail.accountId,
          extracted: possibleId
        });
        
        if (activeGmail) {
          // The UUID is in the 'uuid' field, not 'id'!
          // Also check deprecated.uuid as fallback
          const possibleUUID = activeGmail.uuid || 
                               activeGmail.deprecated?.uuid ||
                               activeGmail.connected_account_id || 
                               activeGmail.connectedAccountId ||
                               activeGmail.accountId ||
                               activeGmail.connectedAccount?.id;
          
          console.log(`Active Gmail connection found. Checking for UUID...`);
          console.log(`Connection fields:`, {
            id: activeGmail.id,
            uuid: activeGmail.uuid,
            deprecated_uuid: activeGmail.deprecated?.uuid,
            user_id: activeGmail.user_id,
            status: activeGmail.status
          });
          
          if (possibleUUID) {
            // Check if it's a valid UUID
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(possibleUUID);
            console.log(`Extracted UUID candidate: ${possibleUUID}, is UUID: ${isUUID}`);
            
            if (isUUID) {
              connectedAccountId = possibleUUID;
              console.log(`✅ Found valid UUID: ${connectedAccountId}`);
              
              // Save it for future use
              await supabaseClient
                .from('user_settings')
                .update({ composio_connected_account_id: connectedAccountId })
                .eq('user_id', user.id);
            } else {
              console.log(`⚠️ UUID candidate found but not a valid UUID format: ${possibleUUID}`);
            }
          } else {
            console.log(`⚠️ No UUID field found in connection object`);
            console.log(`Full connection object:`, JSON.stringify(activeGmail, null, 2));
          }
        } else {
          console.log('No active Gmail connection found. Available connections:', connections);
          // Try to find any Gmail connection (even inactive)
          const anyGmail = connections.find((c: any) => 
            c.toolkit?.slug?.toLowerCase() === 'gmail' ||
            c.toolkit?.name?.toLowerCase() === 'gmail' ||
            c.appName === 'GMAIL'
          );
          if (anyGmail?.connected_account_id || anyGmail?.id) {
            const accountId = anyGmail.connected_account_id || anyGmail.id;
            const status = anyGmail.status;
            console.log(`Found inactive Gmail connection: ${accountId}, status: ${status}`);
            throw new Error(`Gmail connection found but status is ${status}. Please ensure your Gmail connection is ACTIVE in the Composio dashboard.`);
          }
        }
      } else {
        console.log('No Gmail connections found at all');
      }
    } catch (error) {
      console.error('Error searching for connections:', error);
    }
    
    // If we don't have a connected account ID, we can't proceed
    if (!connectedAccountId) {
      throw new Error(
        'GMAIL_NOT_CONNECTED: No active Gmail connection found. Please:\n' +
        '1. Go to Settings and click "Test Gmail Connection" to verify your connection\n' +
        '2. Make sure your Gmail connection is ACTIVE in the Composio dashboard\n' +
        '3. If using Entity ID, ensure it matches your Supabase user ID: ' + user.id
      );
    }
    
    // Build request body
    const requestBody: any = {
      input: {
        recipient_email: recipient_email,
        subject: emailSubject,
        body: emailBody + '\n\n---\nUnsubscribe: [unsubscribe link]',
      },
      connectedAccountId: connectedAccountId,
    };
    
    console.log(`✅ Using connected account UUID: ${connectedAccountId}`);
    
    // Send via Composio
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
      
      // Provide helpful error messages
      if (composioResponse.status === 401) {
        throw new Error('Composio authentication failed. Please check your API key in Settings.');
      } else if (composioResponse.status === 403 || composioResponse.status === 404) {
        throw new Error('GMAIL_NOT_CONNECTED: Your Gmail account is not connected or authentication has expired. Please reconnect your Gmail account to send emails.');
      } else if (composioResponse.status === 429) {
        throw new Error('Rate limit exceeded. Please wait and try again.');
      }
      
      throw new Error(`Composio API error (${composioResponse.status}): ${errorText}`);
    }

    const result = await composioResponse.json();
    console.log('✅ Email sent successfully via Composio!');
    console.log('Composio response:', JSON.stringify(result, null, 2));
    console.log('Recipient:', recipient_email);
    console.log('Subject:', emailSubject);
    console.log('Request body used:', JSON.stringify(requestBody, null, 2));

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email sent successfully',
        recipient: recipient_email,
        subject: emailSubject,
        result: result
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in test-send-email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

