export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.5"
  }
  public: {
    Tables: {
      campaign_conversations: {
        Row: {
          campaign_id: string | null
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_conversations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          clado_api_key: string | null
          composio_api_key: string | null
          composio_connected_account_id: string | null
          created_at: string
          email_provider_config: Json | null
          id: string
          openai_api_key: string | null
          perplexity_api_key: string | null
          sender_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          clado_api_key?: string | null
          composio_api_key?: string | null
          composio_connected_account_id?: string | null
          created_at?: string
          email_provider_config?: Json | null
          id?: string
          openai_api_key?: string | null
          perplexity_api_key?: string | null
          sender_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          clado_api_key?: string | null
          composio_api_key?: string | null
          composio_connected_account_id?: string | null
          created_at?: string
          email_provider_config?: Json | null
          id?: string
          openai_api_key?: string | null
          perplexity_api_key?: string | null
          sender_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      // ... other tables truncated for brevity
    }
  }
}

// This is a simplified version - the full types file would have all tables
// The key thing is that sender_name is now included in user_settings
