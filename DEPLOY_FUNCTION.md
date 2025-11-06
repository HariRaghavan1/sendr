# 🚀 Deploy execute-workflow Function

## Quick Deploy (Choose One Method)

### Method 1: Supabase Dashboard (Easiest)

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions** section
3. Find `execute-workflow` function
4. Click **Deploy** or **Redeploy**

### Method 2: Supabase CLI (Recommended)

```bash
# Make sure you're logged in
supabase login

# Link to your project (if not already linked)
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the function
supabase functions deploy execute-workflow
```

### Method 3: Using Access Token

```bash
# Set your access token (get it from Supabase dashboard > Settings > Access Tokens)
export SUPABASE_ACCESS_TOKEN=your-access-token-here

# Deploy
supabase functions deploy execute-workflow --project-ref YOUR_PROJECT_REF
```

## Verify Deployment

After deploying, check the logs:
- Go to Supabase Dashboard > Edge Functions > execute-workflow > Logs
- Run a test workflow
- Look for the template detection messages:
  - `✅✅✅ TEMPLATE MODE: Template found!` = Template detected correctly
  - `❌❌❌ AI MODE: NO TEMPLATE FOUND` = Template not detected

## Troubleshooting

**If you get a 403 error:**
- You need an access token with deploy permissions
- Get it from: Supabase Dashboard > Settings > Access Tokens > Create new token

**If template still not working after deploy:**
- Check that your workflow has `email_template` saved in `workflow_config`
- Verify the structure matches:
  ```json
  {
    "email_template": {
      "type": "example",
      "example_email": {
        "subject": "...",
        "body": "..."
      }
    }
  }
  ```

