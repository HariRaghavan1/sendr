# Easy Way to Connect Gmail

## Use Method 1 (Automated) - Much Easier! ✅

Instead of navigating the Composio dashboard, use the app's built-in connection:

### Step 1: Add Your Composio API Key

1. Go to Settings in the app (http://localhost:8080/settings)
2. Add your **Composio API Key**
3. Click **"Save Settings"**

### Step 2: Connect Gmail from the App

The app has a built-in connection button that handles everything!

1. **Option A**: When you try to send an email, you'll see a "Connect Gmail" button
2. **Option B**: Or I can help you trigger the connection programmatically

### What Happens

- The app calls the `composio-auth` edge function
- It creates a connection request with your Entity ID automatically
- Opens a popup with Composio's OAuth flow
- You log in with Gmail and grant permissions
- Connection is verified automatically

## Alternative: Use Composio API Directly

If you prefer to use the API directly, you can:

1. Get your Composio API key
2. Use the Composio API to create a connection
3. Set Entity ID to your UUID

But the automated method is much easier!

## Need Help?

If you want, I can:
- Add your Composio API key to the database
- Then trigger the Gmail connection for you

Just provide your Composio API key and I'll set it up!

