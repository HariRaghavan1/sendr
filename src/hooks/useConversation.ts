import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    type?: 'workflow' | 'campaign' | 'execution';
    workflowId?: string;
    workflowData?: any;
    campaignId?: string;
    executionId?: string;
  };
}

export const useConversation = (conversationId?: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [title, setTitle] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (conversationId) {
      loadConversation(conversationId);
    }
  }, [conversationId]);

  const loadConversation = async (id: string) => {
    setLoading(true);
    try {
      // Load conversation details
      const { data: conversation } = await supabase
        .from('campaign_conversations')
        .select('*')
        .eq('id', id)
        .single();

      if (conversation) {
        setTitle(conversation.title);
      }

      // Load messages
      const { data: msgs } = await supabase
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });

      if (msgs) {
        setMessages(msgs as Message[]);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  const createConversation = async (firstMessage: string, campaignId?: string) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      // Generate title from first message
      const generatedTitle = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? '...' : '');

      const { data: conversation, error } = await supabase
        .from('campaign_conversations')
        .insert({
          user_id: user.user.id,
          title: generatedTitle,
          campaign_id: campaignId,
        })
        .select()
        .single();

      if (error) throw error;

      setTitle(generatedTitle);
      return conversation.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  };

  const saveMessage = async (
    conversationId: string, 
    role: 'user' | 'assistant', 
    content: string,
    metadata?: Message['metadata']
  ) => {
    try {
      const { error } = await supabase
        .from('conversation_messages')
        .insert({
          conversation_id: conversationId,
          role,
          content,
          metadata,
        });

      if (error) throw error;

      // Update local state
      setMessages(prev => [...prev, { role, content, metadata }]);
    } catch (error) {
      console.error('Error saving message:', error);
      throw error;
    }
  };

  return {
    messages,
    title,
    loading,
    setMessages,
    createConversation,
    saveMessage,
    loadConversation,
  };
};
