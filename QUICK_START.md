# 🚀 Quick Start Guide

## ✅ What's Done

- ✅ Database migration applied
- ✅ All tables created (campaigns, prospects, emails, workflows, etc.)
- ✅ Row Level Security enabled
- ✅ Environment file created (`.env.local`)
- ✅ MCP server installed and configured

## 📋 Next Steps (5 minutes)

### Step 1: Set OpenAI Secret (Required)
1. Go to: **https://supabase.com/dashboard/project/hstziwxrodpuuzjtvold/settings/secrets**
2. Click **"Add New Secret"**
3. Enter:
   - **Name**: `OPENAI_API_KEY`
   - **Value**: `sk-proj-HVuUsnZNc83MLZWU-F6lPPMd3NKPrPEMr9-1OyzWLuxWQP3zxxITY20iqT4E1FfMSbGIEEiblET3BlbkFJLrqB6Uzjx19K6Oj-ucpleQsfZxKGVbBUBDauHSiYDBvHZjS9dKAzNCwVq2sMFWjMT_Ok0i1oA`
4. Click **"Add Secret"**

### Step 2: Start the App
```bash
npm install  # If you haven't already
npm run dev
```

### Step 3: Sign Up / Log In
1. Open http://localhost:5173 (or the port shown)
2. Create an account or sign in
3. You'll be redirected to the Dashboard

### Step 4: Add Your API Keys (Optional - for full functionality)
1. Go to **Settings** in the app
2. Add your API keys:
   - **Clado API Key** (for prospect finding) - starts with `lk_`
   - **Composio API Key** (for email sending)
3. Click **Save**

## 🎯 What You Can Do Now

### Without Clado/Composio Keys:
- ✅ Browse the app
- ✅ Create campaigns (manually)
- ✅ View workflows
- ✅ See the UI

### With Clado/Composio Keys:
- ✅ Find prospects automatically
- ✅ Generate AI emails
- ✅ Send emails via Gmail
- ✅ Run full workflows

## 🔧 Troubleshooting

**"OpenAI API key not found" error?**
- Make sure you set the secret in Step 1
- Edge functions need this to generate emails

**Can't see tables?**
- Refresh Supabase dashboard
- Check: https://supabase.com/dashboard/project/hstziwxrodpuuzjtvold/editor

**App won't start?**
- Check `.env.local` exists
- Make sure ports aren't blocked
- Try `npm install` again

## 📚 Next: Deploy Edge Functions (Optional)

If you want to use the full features:
1. Install Supabase CLI: `npm install -g supabase`
2. Login: `supabase login`
3. Link project: `supabase link --project-ref hstziwxrodpuuzjtvold`
4. Deploy functions: `supabase functions deploy <function-name>`

Or deploy from dashboard:
- https://supabase.com/dashboard/project/hstziwxrodpuuzjtvold/functions

## 🎉 You're Ready!

Your email outreach platform is set up and ready to use!

