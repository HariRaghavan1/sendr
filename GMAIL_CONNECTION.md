# How to Connect Gmail to Composio

## Method 1: Automated (Recommended) ✅

If you have your Composio API key set up:

1. **Add your Composio API key first**:
   - Go to Settings in the app
   - Add your Composio API key
   - Click "Save Settings"

2. **Connect Gmail from the app**:
   - When you try to send an email, you'll see a "Connect Gmail" button
   - Click "Connect Gmail"
   - A popup will open with Composio's OAuth flow
   - Log in with your Gmail account
   - Grant permissions
   - The connection will be verified automatically

## Method 2: Manual (Via Composio Dashboard)

If you prefer to connect manually:

1. **Go to Composio Dashboard**:
   - Visit: https://app.composio.dev
   - Log in with your Composio account

2. **Navigate to Connections**:
   - Click on **"Connections"** in the sidebar
   - Click **"Add Connection"**

3. **Select Gmail**:
   - Search for or select **"Gmail"** integration

4. **Set Entity ID**:
   - In the connection form, find **"Entity ID"** field
   - Set it to your UUID: `0f34bc2b-8151-4699-8875-576fe9d4edfb`
   - (This is shown in the Settings page of the app)

5. **Authorize**:
   - Click **"Authorize"** or **"Connect"**
   - Log in with your Gmail account
   - Grant the necessary permissions

6. **Verify**:
   - Return to your app
   - Go to Settings
   - Click **"Test Gmail Connection"** to verify

## Important Notes

- **Entity ID is required**: This tells Composio which user account this Gmail connection belongs to
- **Your UUID**: `0f34bc2b-8151-4699-8875-576fe9d4edfb` (shown in Settings page)
- **One Gmail per Entity ID**: Each user can connect one Gmail account per Entity ID
- **Permissions needed**: The app needs permission to send emails on your behalf

## Troubleshooting

**"Composio API key not configured"**:
- Add your Composio API key in Settings first

**"Gmail not connected"**:
- Make sure you set the Entity ID correctly when connecting
- Verify the connection in Composio dashboard

**"Connection expired"**:
- Reconnect Gmail in Composio dashboard
- Make sure Entity ID matches your UUID

## After Connecting

Once connected, you can:
- ✅ Send emails through your Gmail account
- ✅ Use the email sending features in workflows
- ✅ Track email delivery status

