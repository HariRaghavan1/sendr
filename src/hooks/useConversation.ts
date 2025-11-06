import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  id?: string;
  metadata?: {
    type?: 'workflow' | 'campaign' | 'execution' | 'template' | 'gmail_connect';
    workflowId?: string;
    workflowData?: any;
    campaignId?: string;
    executionId?: string;
    templateId?: string;
    templateData?: any;
    reason?: string;
  };
}

// Global message cache to persist messages across conversation switches
const messageCache = new Map<string, Message[]>();
const titleCache = new Map<string, string>();

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
  const loadedConversations = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (conversationId) {
      // Check cache first for instant loading
      if (messageCache.has(conversationId)) {
        const cachedMessages = messageCache.get(conversationId) || [];
        const cachedTitle = titleCache.get(conversationId) || '';
        setMessages(cachedMessages);
        setTitle(cachedTitle);
        
        // Still load from DB in background to ensure we have latest (but don't clear cache)
        if (!loadedConversations.current.has(conversationId)) {
          loadConversation(conversationId);
        }
      } else {
        // Load from database if not in cache
        loadConversation(conversationId);
      }
    } else {
      // For new conversations, use empty array but don't clear cache
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
        const conversationTitle = conversation.title || '';
        setTitle(conversationTitle);
        titleCache.set(id, conversationTitle);
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
          .filter(msg => msg && msg.role && msg.content != null && msg.content !== '')
          .map(msg => ({
            id: msg.id,
            role: msg.role as 'user' | 'assistant' | 'system',
            content: msg.content,
            metadata: msg.metadata as Message['metadata']
          }));
        
        // Update cache and state
        messageCache.set(id, mappedMessages);
        setMessages(mappedMessages);
        loadedConversations.current.add(id);
      } else {
        // If no messages found, ensure we have an empty array in cache
        messageCache.set(id, []);
        setMessages([]);
        loadedConversations.current.add(id);
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
  const createConversation = async (firstMessage?: string, campaignId?: string) => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      // Generate title from first message or use default
      // Ensure messageText is always a string
      const messageText = (firstMessage && typeof firstMessage === 'string') ? firstMessage : 'New Campaign';
      const generatedTitle = messageText.slice(0, 50) + (messageText.length > 50 ? '...' : '');

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
      titleCache.set(conversation.id, generatedTitle);
      messageCache.set(conversation.id, []); // Initialize empty cache for new conversation
      return conversation.id;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  };

  /**
   * Saves a message to the database and updates local state and cache
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
      const { data, error } = await supabase
        .from('conversation_messages')
        .insert({
          conversation_id: conversationId,
          role,
          content,
          metadata,
        })
        .select()
        .single();

      if (error) throw error;

      const newMessage: Message = {
        id: data.id,
        role,
        content,
        metadata
      };

      // Update cache
      const cachedMessages = messageCache.get(conversationId) || [];
      messageCache.set(conversationId, [...cachedMessages, newMessage]);

      // Update local state if this is the current conversation
      setMessages(prev => {
        // Check for duplicates
        const exists = prev.some(m => m.id === newMessage.id || 
          (m.role === newMessage.role && m.content === newMessage.content));
        return exists ? prev : [...prev, newMessage];
      });
    } catch (error) {
      console.error('Error saving message:', error);
      throw error;
    }
  };

  // Enhanced setMessages that also updates cache
  const setMessagesWithCache = (updater: Message[] | ((prev: Message[]) => Message[])) => {
    setMessages(prev => {
      const newMessages = typeof updater === 'function' ? updater(prev) : updater;
      
      // Update cache if we have a conversation ID
      if (conversationId) {
        messageCache.set(conversationId, newMessages);
      }
      
      return newMessages;
    });
  };

  return {
    messages,
    title,
    loading,
    setMessages: setMessagesWithCache,
    createConversation,
    saveMessage,
    loadConversation,
  };
};
