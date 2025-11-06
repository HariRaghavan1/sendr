# Deployment Guide

This guide walks through deploying Bork (AI Email Outreach Platform) to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Frontend Deployment](#frontend-deployment)
4. [Edge Functions Deployment](#edge-functions-deployment)
5. [Database Setup](#database-setup)
6. [Monitoring & Logging](#monitoring--logging)
7. [Post-Deployment Checklist](#post-deployment-checklist)
8. [Rollback Procedures](#rollback-procedures)

## Prerequisites

### Required Accounts

- [x] Supabase account with project created
- [x] OpenAI API key
- [x] Frontend hosting (Vercel/Netlify/Cloudflare Pages)
- [ ] Sentry account (optional, for error tracking)
- [ ] Domain name configured

### Required Tools

```bash
# Install Node.js 18+
node --version  # Should be v18.0.0 or higher

# Install Supabase CLI
brew install supabase/tap/supabase

# Verify installation
supabase --version
```

## Environment Setup

### 1. Supabase Project Setup

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Verify connection
supabase status
```

### 2. Environment Variables

#### Frontend (.env.production)

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

#### Edge Function Secrets

```bash
# Set OpenAI API key
supabase secrets set OPENAI_API_KEY=sk-your-openai-key

# Verify secrets
supabase secrets list
```

### 3. Database Configuration

```bash
# Run migrations
supabase db push

# Or apply specific migration
supabase db push --file supabase/migrations/20250119_add_performance_indexes.sql

# Verify migration status
supabase db diff
```

## Frontend Deployment

### Option 1: Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
# Settings > Environment Variables
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_ANON_KEY
```

### Option 2: Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Login
netlify login

# Build
npm run build

# Deploy
netlify deploy --prod --dir=dist

# Set environment variables
netlify env:set VITE_SUPABASE_URL "https://..."
netlify env:set VITE_SUPABASE_ANON_KEY "..."
```

### Option 3: Cloudflare Pages

```bash
# Install Wrangler
npm i -g wrangler

# Login
wrangler login

# Deploy
wrangler pages deploy dist

# Set environment variables in Cloudflare dashboard
```

## Edge Functions Deployment

### Deploy All Functions

```bash
# Set access token
export SUPABASE_ACCESS_TOKEN=your-access-token

# Deploy all functions
supabase functions deploy execute-workflow
supabase functions deploy execute-campaign
supabase functions deploy send-email

# Or deploy all at once
for func in execute-workflow execute-campaign send-email; do
  supabase functions deploy $func
done
```

### Set Edge Function Environment Variables

```bash
# Set secrets (already done in Environment Setup)
supabase secrets set OPENAI_API_KEY=sk-...

# Verify
supabase secrets list
```

### Test Edge Functions

```bash
# Test locally first
supabase functions serve execute-workflow

# Test deployed function
curl -i --location --request POST \
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/execute-workflow' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{"workflow_id":"...","execution_id":"..."}'
```

## Database Setup

### 1. Row Level Security (RLS)

Verify RLS is enabled on all tables:

```sql
-- Check RLS status
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Enable RLS if needed
ALTER TABLE campaign_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
```

### 2. Performance Indexes

```bash
# Apply performance indexes
supabase db push --file supabase/migrations/20250119_add_performance_indexes.sql

# Verify indexes
psql $DATABASE_URL -c "
  SELECT tablename, indexname
  FROM pg_indexes
  WHERE schemaname = 'public'
  ORDER BY tablename, indexname;
"
```

### 3. Database Backups

```bash
# Enable automatic backups in Supabase dashboard
# Settings > Database > Backups

# Manual backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore from backup
psql $DATABASE_URL < backup_20250119.sql
```

## Monitoring & Logging

### 1. Supabase Logs

```bash
# Stream edge function logs
supabase functions logs execute-workflow

# Stream database logs
supabase db logs
```

### 2. Sentry Setup (Optional)

```bash
# Install Sentry SDK
npm install @sentry/react @sentry/vite-plugin

# Add to main.tsx
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: "YOUR_SENTRY_DSN",
  environment: "production",
  tracesSampleRate: 0.1,
});
```

### 3. Metrics Dashboard

Monitor these metrics:

- **API Requests**: Track edge function invocations
- **Error Rate**: Monitor failed requests
- **Response Time**: Track P50, P95, P99 latencies
- **Database Performance**: Query times, connection pool
- **User Activity**: Active users, campaigns created

## Post-Deployment Checklist

### Smoke Tests

- [ ] User can sign up/login
- [ ] User can configure API keys in Settings
- [ ] User can create a campaign via chat
- [ ] Test run executes successfully
- [ ] Clado API integration works
- [ ] OpenAI email generation works
- [ ] Real-time execution monitoring updates

### Security Verification

- [ ] HTTPS enforced on all requests
- [ ] API keys not exposed in responses
- [ ] Rate limiting working correctly
- [ ] RLS policies enforced
- [ ] CORS configured correctly

### Performance Checks

```bash
# Run Lighthouse audit
npx lighthouse https://yourdomain.com --view

# Should achieve:
# - Performance: >90
# - Accessibility: >90
# - Best Practices: >90
# - SEO: >90
```

### Database Health

```sql
-- Check table sizes
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check slow queries
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

## Rollback Procedures

### Frontend Rollback

#### Vercel

```bash
# List deployments
vercel ls

# Rollback to previous deployment
vercel rollback [DEPLOYMENT_URL]
```

#### Netlify

```bash
# List deployments
netlify deploy:list

# Rollback to specific deploy
netlify deploy:rollback --site-id [SITE_ID] --deploy-id [DEPLOY_ID]
```

### Edge Function Rollback

```bash
# Edge functions don't have automatic rollback
# Keep previous version in git and redeploy

git checkout HEAD~1 -- supabase/functions/execute-workflow
supabase functions deploy execute-workflow
```

### Database Rollback

```bash
# Restore from backup
psql $DATABASE_URL < backup_20250119.sql

# Or revert specific migration
supabase db reset
```

## Continuous Deployment

### GitHub Actions Setup

1. Add secrets to GitHub repository:
   - `PRODUCTION_SUPABASE_ACCESS_TOKEN`
   - `PRODUCTION_SUPABASE_PROJECT_REF`
   - `PRODUCTION_DEPLOYMENT_TOKEN` (for Vercel/Netlify)

2. Push to `main` branch triggers production deployment

3. Push to `develop` branch triggers staging deployment

See `.github/workflows/ci-cd.yml` for full workflow.

## Monitoring Dashboards

### Supabase Dashboard

1. Go to `app.supabase.com`
2. Select your project
3. Monitor:
   - **Database**: Connections, query performance
   - **Edge Functions**: Invocations, errors, logs
   - **Auth**: User signups, logins

### Custom Metrics

Set up custom dashboards to track:

- Campaign creation rate
- Test run success rate
- Prospect discovery success
- Email generation success
- API error rates

## Scaling Considerations

### Database

```sql
-- Monitor connection pool
ALTER SYSTEM SET max_connections = 100;

-- Increase pool size if needed
ALTER SYSTEM SET shared_buffers = '256MB';

-- Add read replicas for heavy read workloads
```

### Edge Functions

- Supabase auto-scales edge functions
- Monitor cold starts and optimize if needed
- Consider caching for frequently accessed data

### Rate Limiting

Adjust rate limits based on usage:

```typescript
// In _shared/schemas.ts
checkRateLimit(`workflow:${user.id}`, 20, 60000); // 20 per minute
```

## Support & Troubleshooting

### Common Issues

**Issue**: Edge function timeout

```
Solution: Optimize API calls, add caching, increase timeout in Supabase dashboard
```

**Issue**: Rate limit exceeded

```
Solution: Adjust rate limits or implement user-based tiers
```

**Issue**: Database connection pool exhausted

```sql
-- Increase connection limit
ALTER SYSTEM SET max_connections = 200;
```

### Get Help

- Supabase Discord: https://discord.supabase.com
- GitHub Issues: https://github.com/your-repo/issues
- Email: support@yourdomain.com

## Maintenance

### Weekly

- [ ] Review error logs in Sentry
- [ ] Check database performance metrics
- [ ] Review edge function invocation patterns

### Monthly

- [ ] Audit security logs
- [ ] Review and update dependencies
- [ ] Optimize database indexes
- [ ] Review and archive old data

### Quarterly

- [ ] Full security audit
- [ ] Performance optimization review
- [ ] Disaster recovery drill
- [ ] Update documentation

---

**Last Updated**: 2025-01-19
