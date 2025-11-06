// Database table names
export const TABLES = {
  CAMPAIGNS: 'campaigns',
  CAMPAIGN_CONVERSATIONS: 'campaign_conversations',
  CONVERSATION_MESSAGES: 'conversation_messages',
  CAMPAIGN_EXECUTIONS: 'campaign_executions',
  WORKFLOW_EXECUTIONS: 'workflow_executions',
  WORKFLOWS: 'workflows',
  PROSPECTS: 'prospects',
  USER_SETTINGS: 'user_settings',
} as const;

// Campaign status values
export const CAMPAIGN_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
} as const;

// Execution status values
export const EXECUTION_STATUS = {
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

// Execution types
export const EXECUTION_TYPE = {
  TEST: 'test',
  PRODUCTION: 'production',
  MANUAL: 'manual',
} as const;

// Campaign tones
export const CAMPAIGN_TONE = {
  FORMAL: 'formal',
  CASUAL: 'casual',
  WITTY: 'witty',
} as const;

// Campaign goals
export const CAMPAIGN_GOAL = {
  DEMO: 'demo',
  MEETING: 'meeting',
  PARTNERSHIP: 'partnership',
  CALL: 'call',
  INFORMATION: 'information',
  OTHER: 'other',
} as const;

// Frequency types
export const FREQUENCY_TYPE = {
  HOURLY: 'hourly',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
} as const;

// Message roles
export const MESSAGE_ROLE = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
} as const;

// Routes
export const ROUTES = {
  AUTH: '/auth',
  DASHBOARD: '/dashboard',
  WORKFLOWS: '/workflows',
  SETTINGS: '/settings',
  CAMPAIGNS_NEW: '/campaigns/new',
  CAMPAIGNS_AI_CREATE: '/campaigns/ai-create',
  CAMPAIGNS_DETAIL: '/campaigns/:id',
} as const;

// Query keys for React Query
export const QUERY_KEYS = {
  CAMPAIGNS: 'campaigns',
  CAMPAIGN: 'campaign',
  CONVERSATIONS: 'conversations',
  CONVERSATION: 'conversation',
  EXECUTIONS: 'executions',
  EXECUTION: 'execution',
  SETTINGS: 'settings',
  PROSPECTS: 'prospects',
} as const;

// Local storage keys
export const STORAGE_KEYS = {
  SUPABASE_AUTH: 'supabase.auth.token',
} as const;

// API endpoints
export const API_ENDPOINTS = {
  CAMPAIGN_CHAT: '/functions/v1/campaign-chat',
  EXECUTE_WORKFLOW: '/functions/v1/execute-workflow',
} as const;
