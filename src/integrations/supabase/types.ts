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
    PostgrestVersion: "13.0.4"
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
      campaign_executions: {
        Row: {
          campaign_id: string
          completed_at: string | null
          execution_type: Database["public"]["Enums"]["execution_type"]
          id: string
          processed_prospects: number
          progress_logs: Json
          started_at: string
          status: Database["public"]["Enums"]["execution_status"]
          total_prospects: number
          user_id: string
        }
        Insert: {
          campaign_id: string
          completed_at?: string | null
          execution_type?: Database["public"]["Enums"]["execution_type"]
          id?: string
          processed_prospects?: number
          progress_logs?: Json
          started_at?: string
          status?: Database["public"]["Enums"]["execution_status"]
          total_prospects?: number
          user_id: string
        }
        Update: {
          campaign_id?: string
          completed_at?: string | null
          execution_type?: Database["public"]["Enums"]["execution_type"]
          id?: string
          processed_prospects?: number
          progress_logs?: Json
          started_at?: string
          status?: Database["public"]["Enums"]["execution_status"]
          total_prospects?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_executions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          created_at: string
          custom_prompt: string | null
          frequency_config: Json
          goal: Database["public"]["Enums"]["email_goal"]
          id: string
          last_run_at: string | null
          name: string
          next_run_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          target_criteria: Json
          tone: Database["public"]["Enums"]["email_tone"]
          total_bounced: number
          total_opened: number
          total_replied: number
          total_sent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_prompt?: string | null
          frequency_config?: Json
          goal?: Database["public"]["Enums"]["email_goal"]
          id?: string
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          target_criteria?: Json
          tone?: Database["public"]["Enums"]["email_tone"]
          total_bounced?: number
          total_opened?: number
          total_replied?: number
          total_sent?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_prompt?: string | null
          frequency_config?: Json
          goal?: Database["public"]["Enums"]["email_goal"]
          id?: string
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          target_criteria?: Json
          tone?: Database["public"]["Enums"]["email_tone"]
          total_bounced?: number
          total_opened?: number
          total_replied?: number
          total_sent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversation_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "campaign_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      emails: {
        Row: {
          body: string
          bounce_reason: string | null
          campaign_id: string
          created_at: string
          external_id: string | null
          id: string
          opened_at: string | null
          prospect_id: string
          replied_at: string | null
          sent_at: string | null
          subject: string
          user_id: string
        }
        Insert: {
          body: string
          bounce_reason?: string | null
          campaign_id: string
          created_at?: string
          external_id?: string | null
          id?: string
          opened_at?: string | null
          prospect_id: string
          replied_at?: string | null
          sent_at?: string | null
          subject: string
          user_id: string
        }
        Update: {
          body?: string
          bounce_reason?: string | null
          campaign_id?: string
          created_at?: string
          external_id?: string | null
          id?: string
          opened_at?: string | null
          prospect_id?: string
          replied_at?: string | null
          sent_at?: string | null
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "emails_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "emails_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      follow_ups: {
        Row: {
          body: string | null
          campaign_id: string
          created_at: string
          email_id: string
          id: string
          prospect_id: string
          scheduled_for: string
          sent_at: string | null
          sequence_number: number
          status: string
          subject: string | null
        }
        Insert: {
          body?: string | null
          campaign_id: string
          created_at?: string
          email_id: string
          id?: string
          prospect_id: string
          scheduled_for: string
          sent_at?: string | null
          sequence_number?: number
          status?: string
          subject?: string | null
        }
        Update: {
          body?: string | null
          campaign_id?: string
          created_at?: string
          email_id?: string
          id?: string
          prospect_id?: string
          scheduled_for?: string
          sent_at?: string | null
          sequence_number?: number
          status?: string
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "follow_ups_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "emails"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follow_ups_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prospects: {
        Row: {
          campaign_id: string
          company: string | null
          created_at: string
          email: string
          enrichment_data: Json | null
          id: string
          linkedin_url: string | null
          name: string
          notes: string | null
          status: Database["public"]["Enums"]["prospect_status"]
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          campaign_id: string
          company?: string | null
          created_at?: string
          email: string
          enrichment_data?: Json | null
          id?: string
          linkedin_url?: string | null
          name: string
          notes?: string | null
          status?: Database["public"]["Enums"]["prospect_status"]
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          campaign_id?: string
          company?: string | null
          created_at?: string
          email?: string
          enrichment_data?: Json | null
          id?: string
          linkedin_url?: string | null
          name?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["prospect_status"]
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospects_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          clado_api_key: string | null
          composio_api_key: string | null
          created_at: string
          email_provider_config: Json | null
          id: string
          openai_api_key: string | null
          perplexity_api_key: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          clado_api_key?: string | null
          composio_api_key?: string | null
          created_at?: string
          email_provider_config?: Json | null
          id?: string
          openai_api_key?: string | null
          perplexity_api_key?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          clado_api_key?: string | null
          composio_api_key?: string | null
          created_at?: string
          email_provider_config?: Json | null
          id?: string
          openai_api_key?: string | null
          perplexity_api_key?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      campaign_status: "draft" | "active" | "paused" | "completed"
      email_goal: "demo" | "meeting" | "partnership" | "other"
      email_tone: "formal" | "casual" | "witty"
      execution_status: "running" | "completed" | "failed" | "cancelled"
      execution_type: "test" | "production"
      prospect_status:
        | "pending"
        | "sent"
        | "opened"
        | "replied"
        | "bounced"
        | "unsubscribed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      campaign_status: ["draft", "active", "paused", "completed"],
      email_goal: ["demo", "meeting", "partnership", "other"],
      email_tone: ["formal", "casual", "witty"],
      execution_status: ["running", "completed", "failed", "cancelled"],
      execution_type: ["test", "production"],
      prospect_status: [
        "pending",
        "sent",
        "opened",
        "replied",
        "bounced",
        "unsubscribed",
      ],
    },
  },
} as const
