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

/**
 * Custom hook for managing campaign conversation state and persistence
 *
 * @param conversationId - Optional ID of an existing conversation to load
 * @returns Object containing conversation state and methods
 *
 * @example
 * ```tsx
 * const { messages, createConversation, saveMessage } = useConversation();
 * ```
 */
export const useConversation = (conversationId?: string) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [title, setTitle] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (conversationId) {
      loadConversation(conversationId);
    } else {
      // Reset state for new conversation
      setMessages([]);
      setTitle('');
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
        // Map database records to Message interface, filtering out invalid messages
        const mappedMessages: Message[] = msgs
          .filter(msg => msg.role && msg.content != null && msg.content !== '')
          .map(msg => ({
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
            metadata: msg.metadata as Message['metadata']
          }));
        setMessages(mappedMessages);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Creates a new conversation in the database
   *
   * @param firstMessage - The first user message to generate a title from
   * @param campaignId - Optional campaign ID to associate with this conversation
   * @returns The ID of the newly created conversation
   * @throws Error if user is not authenticated or database operation fails
   */
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

  /**
   * Saves a message to the database and updates local state
   *
   * @param conversationId - The conversation to add the message to
   * @param role - The role of the message sender ('user' or 'assistant')
   * @param content - The message content
   * @param metadata - Optional metadata about workflow, campaign, or execution
   * @throws Error if database operation fails
   */
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
