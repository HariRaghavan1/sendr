# Test Email Function

A simple test function has been deployed to send a test email.

## How to Test

### Option 1: Browser Console (Easiest)

1. Open your app in the browser (http://localhost:8080)
2. Log in
3. Open the browser console (F12 or Cmd+Option+I)
4. Paste and run this code:

```javascript
// Get your Supabase session
const { data: { session } } = await supabase.auth.getSession();

// Send test email
const response = await fetch('https://hstziwxrodpuuzjtvold.supabase.co/functions/v1/test-send-email', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  },
  body: JSON.stringify({
    recipient_email: 'nbillimo@ucsc.edu',
    subject: 'Test Email from Bork',
    body: 'This is a test email from the Bork email outreach platform. If you receive this, email sending is working correctly!'
  })
});

const result = await response.json();
console.log('Result:', result);
```

### Option 2: Using curl

```bash
# First, get your session token from the browser:
# 1. Open browser console
# 2. Run: await supabase.auth.getSession()
# 3. Copy the access_token

curl -X POST 'https://hstziwxrodpuuzjtvold.supabase.co/functions/v1/test-send-email' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN_HERE' \
  -d '{
    "recipient_email": "nbillimo@ucsc.edu",
    "subject": "Test Email from Bork",
    "body": "This is a test email from the Bork email outreach platform."
  }'
```

### Option 3: Create a Test Page

I can create a simple test page component in the app if you prefer.

## What to Check

1. ✅ **Composio API Key** - Make sure it's set in Settings
2. ✅ **Gmail Connected** - Make sure Gmail is connected (check Settings page)
3. ✅ **Email Sent** - Check the response in console
4. ✅ **Inbox** - Check nbillimo@ucsc.edu inbox for the email

## Troubleshooting

**"Composio API key not configured"**
- Go to Settings and add your Composio API key

**"GMAIL_NOT_CONNECTED"**
- Go to Settings and click "Test Gmail Connection"
- If it fails, reconnect Gmail via Composio dashboard

**"Rate limit exceeded"**
- Wait a few minutes and try again


