# Apply Migration to Your Supabase Project

## Quick Setup (5 minutes)

Your project: `hstziwxrodpuuzjtvold`

### Step 1: Open Supabase SQL Editor
Go to: **https://supabase.com/dashboard/project/hstziwxrodpuuzjtvold/sql/new**

### Step 2: Copy the Migration
Open the file `SUPABASE_SETUP_MIGRATION.sql` in this project and copy **ALL** of its contents.

### Step 3: Paste and Run
1. Paste the SQL into the SQL Editor
2. Click **Run** (or press Cmd+Enter)
3. Wait for it to complete (should take ~30 seconds)

### Step 4: Set OpenAI Secret
1. Go to: **https://supabase.com/dashboard/project/hstziwxrodpuuzjtvold/settings/secrets**
2. Click **Add New Secret**
3. Name: `OPENAI_API_KEY`
4. Value: `sk-proj-HVuUsnZNc83MLZWU-F6lPPMd3NKPrPEMr9-1OyzWLuxWQP3zxxITY20iqT4E1FfMSbGIEEiblET3BlbkFJLrqB6Uzjx19K6Oj-ucpleQsfZxKGVbBUBDauHSiYDBvHZjS9dKAzNCwVq2sMFWjMT_Ok0i1oA`
5. Click **Add Secret**

### Step 5: Verify Setup
Go to: **https://supabase.com/dashboard/project/hstziwxrodpuuzjtvold/editor**

You should see these tables:
- ✅ `campaigns`
- ✅ `prospects`
- ✅ `emails`
- ✅ `workflows`
- ✅ `user_settings`
- ✅ `campaign_conversations`

## That's It! 🎉

Your database is now set up. You can now:
- Run `npm run dev` to start the app
- Create campaigns and workflows
- Use the AI email generation features

## Need Help?

If you encounter any errors, check:
1. Make sure you're in the correct project (`hstziwxrodpuuzjtvold`)
2. Check the SQL Editor for any error messages
3. Verify all tables were created successfully

