# Supabase Setup Instructions

## Current Status

✅ **MCP Server Installed**: Supabase MCP is installed and configured
❌ **MCP Connection**: Currently connected to wrong project (needs your access token)
⚠️ **Migration**: Needs to be applied to your project

## Your Project Details

- **Project Reference**: `hstziwxrodpuuzjtvold`
- **Project URL**: `https://hstziwxrodpuuzjtvold.supabase.co`
- **Anon Key**: Already provided ✅
- **Service Role Key**: Already provided ✅

## Step 1: Get Your Supabase Access Token

1. Go to: https://supabase.com/dashboard/account/tokens
2. Create a new access token (or use an existing one)
3. Copy the token (starts with `sbp_...`)

## Step 2: Update MCP Configuration

Edit `.cursor/mcp.json` and replace the access token:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "supabase-mcp-server",
      "env": {
        "SUPABASE_PROJECT_REF": "hstziwxrodpuuzjtvold",
        "SUPABASE_ACCESS_TOKEN": "YOUR_ACCESS_TOKEN_HERE"
      }
    }
  }
}
```

## Step 3: Restart Cursor

After updating the config, restart Cursor completely.

## Step 4: Apply Migration

Once the MCP is connected to your project, I can apply the migration automatically.

Alternatively, you can apply it manually:

1. Go to: https://supabase.com/dashboard/project/hstziwxrodpuuzjtvold/sql/new
2. Copy the contents of `SUPABASE_SETUP_MIGRATION.sql`
3. Paste and run it in the SQL Editor

## Step 5: Set OpenAI Secret

1. Go to: https://supabase.com/dashboard/project/hstziwxrodpuuzjtvold/settings/secrets
2. Add a new secret:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key (you already provided it)

## Alternative: Manual Setup

If you prefer to set everything up manually:

1. **Run Migration**: Copy `SUPABASE_SETUP_MIGRATION.sql` and run it in Supabase SQL Editor
2. **Set OpenAI Secret**: Add `OPENAI_API_KEY` as a secret in Supabase dashboard
3. **Update .env**: Create `.env.local` with:
   ```
   VITE_SUPABASE_URL=https://hstziwxrodpuuzjtvold.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzdHppd3hyb2RwdXV6anR2b2xkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjMxNDksImV4cCI6MjA3Nzc5OTE0OX0.bp4NgdGruA67gvz3FSXVC1JXnmGG8DQci0jIykvUo
   ```

## Next Steps After Setup

1. ✅ Database schema created
2. ✅ RLS policies enabled
3. ✅ Indexes created
4. ✅ Triggers configured
5. ⏳ OpenAI secret set (manual step)
6. ⏳ Test the application: `npm run dev`

## Need Help?

Once you provide your Supabase access token, I can:
- Connect the MCP to your project
- Apply the migration automatically
- Set up the OpenAI secret
- Verify everything is working

