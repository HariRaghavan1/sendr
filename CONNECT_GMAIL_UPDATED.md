# Connect Gmail to Composio - Updated Instructions

## Updated Method (Based on Current Composio Dashboard)

The dashboard interface has changed. Here's the updated way:

### Step 1: Access Composio Dashboard
1. Go to: **https://app.composio.dev**
2. Log in with your Composio account

### Step 2: Navigate to Integrations
1. Look for **"Integrations"** in the sidebar (NOT "Connections")
2. Or click **"Add an Integration"** button on the dashboard
3. Or look for **"Integrations"** or **"Apps"** in the top navigation

### Step 3: Add Gmail Integration
1. Click **"Add an Integration"** or **"Add Integration"**
2. Search for or select **"Gmail"** from the list
3. Click **"Connect with Gmail"** or **"Add Gmail"**

### Step 4: Set Entity ID (Important!)
When connecting, you may see an option for **"Entity ID"** or **"Entity"**:
- Set it to: `0f34bc2b-8151-4699-8875-576fe9d4edfb` (your UUID)
- If you don't see this option, the connection may create a default entity
- You can set it later in the connection settings

### Step 5: Authorize Gmail
1. Click **"Authorize"** or **"Connect"**
2. A popup/window will open with Google's OAuth flow
3. Select your Gmail account
4. Grant the necessary permissions
5. Complete the authorization

### Step 6: Verify Connection
1. Return to your app at http://localhost:8080/settings
2. Click **"Test Gmail Connection"** to verify

## Alternative: Use API Method (Easier!)

Instead of navigating the dashboard, you can use the app's built-in connection:

1. **Add your Composio API key** in Settings
2. **Try to send an email** - you'll see a "Connect Gmail" button
3. **Click "Connect Gmail"** - it will handle everything automatically

This is much easier than navigating the dashboard!

## If You Still Can't Find It

Try these locations:
- **Sidebar**: "Integrations", "Apps", "Connected Apps"
- **Dashboard**: "Add Integration" button
- **Search**: Type "Gmail" in the search bar
- **Settings**: Check "API Settings" or "Account Settings"

## Need Help?

If you can't find it, I can:
1. Help you add your Composio API key
2. Then use the automated connection method (much easier!)

Just provide your Composio API key and I'll set it up!

