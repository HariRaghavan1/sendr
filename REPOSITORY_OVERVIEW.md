# Repository Overview & Clado Integration Guide

## 📋 Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [How Clado Works](#how-clado-works)
3. [Complete Data Flow](#complete-data-flow)
4. [Database Schema](#database-schema)
5. [Key Components](#key-components)
6. [API Integrations](#api-integrations)

---

## 🏗️ Architecture Overview

### **Tech Stack**
- **Frontend**: React 18 + TypeScript + Vite (port 8080)
- **UI**: shadcn/ui (51 components) + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Real-time + Edge Functions)
- **State Management**: TanStack React Query
- **Routing**: React Router v6
- **Validation**: Zod schemas

### **Project Structure**
```
scratch-forge-art/
├── src/                          # Frontend React application
│   ├── pages/                   # Page components
│   │   ├── ConversationView.tsx    # AI chat interface (main campaign builder)
│   │   ├── Dashboard.tsx            # Main dashboard
│   │   ├── Settings.tsx              # API key management
│   │   ├── TestEmail.tsx            # Test email sending
│   │   └── ...
│   ├── components/              # Reusable components
│   │   ├── ExecutionMonitor.tsx     # Real-time execution tracking
│   │   ├── ConversationList.tsx    # Sidebar conversation list
│   │   └── ui/                      # shadcn/ui components
│   ├── hooks/                   # Custom React hooks
│   │   ├── useConversation.ts       # Conversation state
│   │   └── useRealtimeExecution.ts  # Real-time updates
│   └── integrations/
│       └── supabase/             # Supabase client & types
│
└── supabase/
    └── functions/               # Supabase Edge Functions (Deno)
        ├── execute-workflow/        # Main campaign execution
        ├── campaign-chat/            # AI chat backend (Gemini)
        ├── send-email/              # Email sending via Composio
        ├── test-send-email/         # Test email functionality
        ├── find-prospects/          # Prospect search wrapper
        └── _shared/
            ├── clado-helpers.ts     # Clado API integration
            └── schemas.ts            # Zod validation schemas
```

---

## 🔍 How Clado Works

### **What is Clado?**
**Clado** is a B2B lead discovery API that:
- **Searches** for prospects based on criteria (job titles, companies, locations, industries)
- **Enriches** prospects with contact information (email addresses, phone numbers)
- **Provides** deep research capabilities for prospects
- **Uses** a credit-based system (each search/enrichment costs credits)

### **Clado API Endpoints Used**

#### 1. **Search Prospects** (`GET /api/search`)
```typescript
// Location: supabase/functions/_shared/clado-helpers.ts
// Function: searchCladoProspects()

URL: https://search.clado.ai/api/search
Query Parameters:
  - query: "CTOs in technology located in San Francisco"
  - limit: 5
  - advanced_filtering: true
  - companies: ["Google", "Microsoft"] (optional)
  - schools: ["Stanford"] (optional)

Response Format:
{
  results: [
    {
      profile: {
        name: "John Doe",
        linkedin_url: "https://linkedin.com/in/johndoe"
      },
      experience: [{
        title: "CTO",
        company_name: "Tech Corp"
      }]
    }
  ]
}
```

**What it does:**
- Searches LinkedIn and other sources for professionals matching criteria
- Returns basic info: name, title, company, LinkedIn URL
- Does NOT return email addresses by default

#### 2. **Enrich Contacts** (`GET /api/enrich/contacts`)
```typescript
// Location: supabase/functions/_shared/clado-helpers.ts
// Function: enrichProspectContacts()

URL: https://search.clado.ai/api/enrich/contacts?linkedin_url=...&email_enrichment=true&phone_enrichment=true

Response Format:
{
  data: [{
    error: false,
    contacts: [
      {
        type: "email",
        value: "john@techcorp.com",
        rating: 100,
        subType: "work"  // or "verified", "personal"
      },
      {
        type: "phone",
        value: "+1-555-123-4567",
        rating: 90,
        subType: "mobile"  // or "work_phone"
      }
    ]
  }]
}
```

**What it does:**
- Takes a LinkedIn URL
- Finds email addresses and phone numbers for that person
- Returns multiple contact options with confidence ratings (0-100)
- Prioritizes work emails over personal emails
- **Costs credits** (typically 4 credits per enrichment)

#### 3. **Initiate Deep Research** (`POST /api/search/deep_research`)
```typescript
// Location: supabase/functions/_shared/clado-helpers.ts
// Function: initiateDeepResearch()

URL: https://search.clado.ai/api/search/deep_research
Body: {
  query: "CTOs in technology",
  limit: 30
}

Response Format:
{
  job_id: "8ac2f9e8-2545-4608-a11f-058696521894",
  status: "initiated",
  message: "Deep research job started"
}
```

**What it does:**
- Starts an async deep research job
- Gathers more detailed information about prospects
- Returns a `job_id` for tracking (not used synchronously in our code)

#### 4. **Check Credits** (`GET /api/credits`)
```typescript
// Location: supabase/functions/_shared/clado-helpers.ts
// Function: checkCladoCredits()

URL: https://search.clado.ai/api/credits

Response Format:
{
  credits: 247,
  last_topup_at: "2024-01-15T10:30:00Z"
}
```

**What it does:**
- Returns remaining credits for the API key
- Used before searches to prevent failed operations

### **How Clado is Integrated**

#### **1. Search Flow** (in `execute-workflow/index.ts`)
```typescript
// Step 1: Check credits
const creditsInfo = await checkCladoCredits(cladoApiKey);
if (creditsInfo.credits === 0) {
  throw new Error('No credits remaining');
}

// Step 2: Build query from target criteria
// Example: "CTOs in technology located in San Francisco"

// Step 3: Search for prospects (returns basic info only)
const prospects = await searchCladoProspects(
  targetCriteria,
  cladoApiKey,
  {
    limit: 5,
    advanced_filtering: true,
    initiateDeepResearch: true,  // Start deep research in parallel
    enrichContacts: true          // Enrich emails/phones in parallel
  }
);

// The searchCladoProspects function:
// - Calls /api/search to get prospect list
// - Runs deep research initiation in PARALLEL
// - Runs contact enrichment for each prospect in PARALLEL
// - Returns prospects with emails/phones filled in
```

#### **2. Parallel Processing**
The system runs **3 operations in parallel** for performance:
1. **Prospect Search** - Finds matching professionals
2. **Deep Research** - Initiates background research job
3. **Contact Enrichment** - Finds emails/phones for each prospect

```typescript
// From clado-helpers.ts
const parallelPromises = [];

// Deep research (runs in background)
if (options.initiateDeepResearch) {
  parallelPromises.push(initiateDeepResearch(...));
}

// Contact enrichment (runs for all prospects)
if (options.enrichContacts) {
  const enrichmentPromises = prospects.map(prospect => 
    enrichProspectContacts(prospect.linkedin_url, cladoApiKey)
  );
  parallelPromises.push(Promise.allSettled(enrichmentPromises));
}

// Wait for all to complete
await Promise.allSettled(parallelPromises);
```

#### **3. Contact Enrichment Logic**
```typescript
// From clado-helpers.ts - enrichProspectContacts()
// Priority order for emails:
1. Work emails (subType: "work" or "verified")
2. Higher rating (confidence 0-100)
3. Personal emails as fallback

// Priority order for phones:
1. Mobile phones (subType: "mobile")
2. Higher rating
3. Work phones as fallback
```

### **Clado API Key Requirements**
- **Format**: Must start with `lk_` (e.g., `lk_abc123...`)
- **Storage**: Stored in `user_settings.clado_api_key`
- **Authentication**: Bearer token in `Authorization` header
- **Credits**: Each operation consumes credits (search + enrichment)

---

## 🔄 Complete Data Flow

### **Scenario: User Runs Test Campaign**

#### **Step 1: User Initiates Test**
```
User → ConversationView.tsx
  - User types: "run a test with 5 prospects"
  - AI (Gemini via campaign-chat) responds with tool call: run_test
```

#### **Step 2: Frontend Creates Execution**
```typescript
// ConversationView.tsx
const { data: execution } = await supabase
  .from('workflow_executions')
  .insert({
    workflow_id,
    user_id,
    status: 'running',
    max_prospects: 5,
    skip_sending: true,
    enrich_emails: true,
    send_drafts_to_email: 'hariraghavan2023@gmail.com'
  });

// Adds ExecutionMonitor message to chat
const execMessage = {
  role: 'assistant',
  content: 'Starting test run...',
  metadata: { type: 'execution', executionId: execution.id }
};
```

#### **Step 3: Backend Execution Starts**
```typescript
// execute-workflow/index.ts
1. Validate API keys (Clado, Composio)
2. Check Clado credits
3. Find workflow config (target criteria, instructions)
4. Search Clado for prospects:
   - Build query: "CTOs in technology"
   - Call Clado /api/search
   - Get 5 prospects (name, title, company, LinkedIn URL)
5. Enrich contacts in parallel:
   - For each prospect's LinkedIn URL
   - Call Clado /api/enrich/contacts
   - Get email addresses and phone numbers
6. Save prospects to database (if campaign_id exists)
```

#### **Step 4: Generate Emails**
```typescript
// execute-workflow/index.ts
For each prospect:
1. Call Gemini API (via campaign-chat):
   - Prompt: "Generate email for {prospect.name} at {company}..."
   - Include workflow instructions
   - Include prospect details
2. Parse response (JSON with subject/body)
3. Replace placeholders:
   - {first_name} → "John"
   - {company} → "Tech Corp"
   - {mr_ms} → "Mr." or "Ms."
   - [Your Name] → "Hari"
4. Calculate quality score (0-100)
5. Save email to database (if campaign_id exists)
```

#### **Step 5: Send Summary Email**
```typescript
// execute-workflow/index.ts
If send_drafts_to_email is set:
1. Compile all generated emails
2. Format summary:
   - List each prospect with email
   - Include subject and body
   - Show enrichment status
3. Send via Composio:
   - Find Gmail connection UUID
   - Call Composio /api/v2/actions/GMAIL_SEND_EMAIL/execute
   - Send to hariraghavan2023@gmail.com
```

#### **Step 6: Real-time Updates**
```typescript
// Frontend subscribes to execution updates
// ExecutionMonitor.tsx
const channel = supabase
  .channel(`execution:${executionId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'workflow_executions',
    filter: `id=eq.${executionId}`
  }, (payload) => {
    // Update UI with new logs/progress
    setLogs(payload.new.progress_logs);
  });
```

---

## 💾 Database Schema

### **Core Tables**

#### **1. `user_settings`**
```sql
- user_id (UUID, FK to auth.users)
- clado_api_key (TEXT)          -- Clado API key (starts with lk_)
- composio_api_key (TEXT)       -- Composio API key
- composio_connected_account_id (TEXT)  -- Gmail connection UUID
```

#### **2. `campaigns`**
```sql
- id (UUID, PK)
- user_id (UUID, FK)
- name (TEXT)
- status (ENUM: draft, active, paused, completed)
- target_criteria (JSONB)       -- {job_titles: [...], location: "...", ...}
- tone (ENUM: formal, casual, witty)
- goal (ENUM: demo, meeting, partnership, ...)
- conversation_context (JSONB)  -- AI chat history
```

#### **3. `workflows`**
```sql
- id (UUID, PK)
- user_id (UUID, FK)
- campaign_id (UUID, FK to campaigns)
- conversation_id (UUID, FK to campaign_conversations)
- name (TEXT)
- config (JSONB)                -- Workflow configuration
- instructions (TEXT)           -- AI instructions for email generation
```

#### **4. `workflow_executions`**
```sql
- id (UUID, PK)
- workflow_id (UUID, FK)
- campaign_id (UUID, FK, nullable)
- conversation_id (UUID, FK, nullable)
- user_id (UUID, FK)
- status (ENUM: running, completed, failed)
- max_prospects (INTEGER)
- skip_sending (BOOLEAN)
- progress_logs (JSONB)          -- Real-time execution logs
- results (JSONB)               -- Final results summary
```

#### **5. `prospects`**
```sql
- id (UUID, PK)
- campaign_id (UUID, FK)
- user_id (UUID, FK)
- name (TEXT)
- email (TEXT)                   -- From Clado enrichment
- phone (TEXT)                   -- From Clado enrichment
- title (TEXT)
- company (TEXT)
- linkedin_url (TEXT)
- status (ENUM: pending, sent, opened, replied, ...)
```

#### **6. `emails`**
```sql
- id (UUID, PK)
- prospect_id (UUID, FK)
- campaign_id (UUID, FK)
- user_id (UUID, FK)
- subject (TEXT)
- body (TEXT)
- sent_at (TIMESTAMPTZ)
- quality_score (INTEGER)       -- 0-100
```

### **Relationships**
```
users (auth.users)
  ├── user_settings (1:1)
  ├── campaigns (1:many)
  ├── workflows (1:many)
  └── prospects (1:many)

campaigns
  ├── prospects (1:many)
  ├── emails (through prospects)
  └── workflows (1:many)

workflows
  ├── workflow_executions (1:many)
  └── campaign_id → campaigns

prospects
  └── emails (1:many)
```

---

## 🧩 Key Components

### **Frontend Components**

#### **1. ConversationView.tsx** (Main AI Chat)
- **Purpose**: AI-powered campaign creation interface
- **Key Features**:
  - Chat with Gemini AI to describe campaigns
  - AI suggests workflows and runs tests
  - Handles tool calls: `create_campaign`, `create_workflow`, `run_test`
  - Displays `ExecutionMonitor` for real-time tracking
- **Flow**:
  1. User types message
  2. Sends to `campaign-chat` edge function (Gemini)
  3. Gemini responds with tool calls
  4. Frontend executes tool calls (create DB records, invoke `execute-workflow`)

#### **2. ExecutionMonitor.tsx**
- **Purpose**: Real-time execution progress display
- **Features**:
  - Subscribes to `workflow_executions` table updates
  - Shows progress logs in real-time
  - Displays step indicators (🔍 Finding Prospects, 📧 Generating Emails)
  - Shows final results (success/failure counts)

#### **3. Settings.tsx**
- **Purpose**: API key management
- **Features**:
  - Store Clado API key (starts with `lk_`)
  - Store Composio API key
  - Test Gmail connection
  - Check Clado credits

### **Backend Edge Functions**

#### **1. execute-workflow/index.ts** (Main Execution)
- **Purpose**: Orchestrates entire campaign execution
- **Steps**:
  1. Validates API keys
  2. Checks Clado credits
  3. Finds prospects via Clado (search + enrichment)
  4. Generates emails via Gemini
  5. Sends summary email via Composio
  6. Updates execution logs in real-time

#### **2. campaign-chat/index.ts** (AI Chat Backend)
- **Purpose**: Powers the AI conversation interface
- **Uses**: Google Gemini API
- **Tools Available**:
  - `create_campaign`: Creates campaign + workflow
  - `create_workflow`: Creates workflow
  - `run_test`: Triggers test execution
- **System Prompt**: Instructs AI to help users create campaigns

#### **3. _shared/clado-helpers.ts** (Clado Integration)
- **Purpose**: All Clado API interactions
- **Functions**:
  - `searchCladoProspects()`: Search + enrichment + deep research
  - `enrichProspectContacts()`: Get email/phone for LinkedIn URL
  - `initiateDeepResearch()`: Start deep research job
  - `checkCladoCredits()`: Check remaining credits
  - `buildCladoQuery()`: Convert criteria to search query

---

## 🔌 API Integrations

### **1. Clado API** (B2B Lead Discovery)
- **Base URL**: `https://search.clado.ai/api`
- **Auth**: Bearer token (API key starts with `lk_`)
- **Endpoints**:
  - `/search` - Find prospects
  - `/enrich/contacts` - Get email/phone
  - `/search/deep_research` - Start deep research
  - `/credits` - Check credits
- **Cost**: Credit-based (search + enrichment cost credits)

### **2. Composio API** (Email Sending)
- **Base URL**: `https://backend.composio.dev/api`
- **Auth**: `X-API-Key` header
- **Endpoints**:
  - `/v2/actions/GMAIL_SEND_EMAIL/execute` - Send email
  - `/v3/connected_accounts` - List/manage Gmail connections
- **Purpose**: Sends emails via connected Gmail account

### **3. Google Gemini API** (AI Email Generation)
- **Used via**: `campaign-chat` edge function
- **Purpose**: Generates personalized email content
- **Input**: Prospect details + workflow instructions
- **Output**: JSON with subject and body

### **4. Supabase** (Backend)
- **Database**: PostgreSQL
- **Auth**: User authentication
- **Real-time**: WebSocket subscriptions for live updates
- **Edge Functions**: Deno runtime for serverless functions

---

## 🎯 Key Workflows

### **Workflow 1: Create Campaign via Chat**
```
User: "I want to reach out to CTOs at tech companies in SF"
  ↓
AI (Gemini): Analyzes intent, calls create_campaign tool
  ↓
Frontend: Creates campaign + workflow in DB
  ↓
AI: Suggests running a test
  ↓
Frontend: Calls run_test tool
  ↓
Backend (execute-workflow): 
  1. Finds 5 CTOs via Clado
  2. Enriches with emails
  3. Generates emails via Gemini
  4. Sends summary to user's email
```

### **Workflow 2: Test Email Sending**
```
User: Clicks "Send Test Email" in TestEmail.tsx
  ↓
Frontend: Calls test-send-email edge function
  ↓
Backend: 
  1. Finds Gmail connection UUID
  2. Calls Composio API
  3. Sends email via user's Gmail
  ↓
Response: Success/failure
```

---

## 🔐 Security & Authentication

- **User Auth**: Supabase Auth (email/password)
- **API Keys**: Stored in `user_settings` table (encrypted at rest)
- **Row Level Security (RLS)**: All tables have RLS policies
- **Edge Functions**: Require valid JWT token
- **Rate Limiting**: 10 workflow executions per minute per user

---

## 📊 Real-time Features

- **Execution Monitoring**: WebSocket subscriptions to `workflow_executions`
- **Live Logs**: Progress logs update in real-time
- **Status Updates**: Execution status changes propagate immediately

---

## 🚀 Deployment

- **Frontend**: Vite build → Static files (hosted on Vercel/Lovable)
- **Backend**: Supabase Edge Functions (Deno runtime)
- **Database**: Supabase PostgreSQL
- **Secrets**: Stored in Supabase dashboard (OPENAI_API_KEY, etc.)

---

This repository implements a complete AI-powered email outreach platform with:
- **Clado** for prospect discovery and contact enrichment
- **Composio** for email sending via Gmail
- **Gemini** for AI-powered email generation
- **Supabase** for backend, database, and real-time features

