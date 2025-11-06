import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useConversation } from './useConversation';
import { supabase } from '@/integrations/supabase/client';

// Mock data
const mockUser = {
  user: {
    id: 'user-123',
    email: 'test@example.com',
  },
};

const mockConversation = {
  id: 'conv-123',
  title: 'Test Conversation',
  user_id: 'user-123',
  created_at: new Date().toISOString(),
};

const mockMessages = [
  {
    id: 'msg-1',
    conversation_id: 'conv-123',
    role: 'user',
    content: 'Hello',
    metadata: null,
    created_at: new Date().toISOString(),
  },
  {
    id: 'msg-2',
    conversation_id: 'conv-123',
    role: 'assistant',
    content: 'Hi there!',
    metadata: null,
    created_at: new Date().toISOString(),
  },
];

describe('useConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial state', () => {
    it('should initialize with empty messages and title', () => {
      const { result } = renderHook(() => useConversation());

      expect(result.current.messages).toEqual([]);
      expect(result.current.title).toBe('');
      expect(result.current.loading).toBe(false);
    });
  });

  describe('loadConversation', () => {
    it('should load conversation and messages from database', async () => {
      // Mock Supabase responses
      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const singleMock = vi.fn()
        .mockResolvedValueOnce({ data: mockConversation, error: null })
        .mockResolvedValueOnce({ data: null, error: null });
      const orderMock = vi.fn().mockResolvedValue({ data: mockMessages, error: null });

      vi.mocked(supabase.from).mockImplementation((table: string) => ({
        select: selectMock.mockReturnValue({
          eq: eqMock.mockReturnValue(
            table === 'campaign_conversations'
              ? { single: singleMock }
              : { order: orderMock }
          ),
        }),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        upsert: vi.fn(),
      }) as any);

      const { result } = renderHook(() => useConversation('conv-123'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.title).toBe('Test Conversation');
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0].role).toBe('user');
      expect(result.current.messages[1].role).toBe('assistant');
    });

    it('should filter out invalid messages', async () => {
      const invalidMessages = [
        { id: 'msg-1', role: 'user', content: 'Valid message', created_at: new Date().toISOString() },
        { id: 'msg-2', role: null, content: 'Invalid - no role', created_at: new Date().toISOString() },
        { id: 'msg-3', role: 'assistant', content: undefined, created_at: new Date().toISOString() },
        { id: 'msg-4', role: 'assistant', content: 'Another valid', created_at: new Date().toISOString() },
      ];

      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const singleMock = vi.fn().mockResolvedValue({ data: mockConversation, error: null });
      const orderMock = vi.fn().mockResolvedValue({ data: invalidMessages, error: null });

      vi.mocked(supabase.from).mockImplementation((table: string) => ({
        select: selectMock.mockReturnValue({
          eq: eqMock.mockReturnValue(
            table === 'campaign_conversations'
              ? { single: singleMock }
              : { order: orderMock }
          ),
        }),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        upsert: vi.fn(),
      }) as any);

      const { result } = renderHook(() => useConversation('conv-123'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should only have 2 valid messages
      expect(result.current.messages).toHaveLength(2);
      expect(result.current.messages[0].content).toBe('Valid message');
      expect(result.current.messages[1].content).toBe('Another valid');
    });

    it('should handle errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const selectMock = vi.fn().mockReturnThis();
      const eqMock = vi.fn().mockReturnThis();
      const singleMock = vi.fn().mockResolvedValue({
        data: null,
        error: new Error('Database error'),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: selectMock.mockReturnValue({
          eq: eqMock.mockReturnValue({
            single: singleMock,
          }),
        }),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        upsert: vi.fn(),
      } as any);

      const { result } = renderHook(() => useConversation('conv-123'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error loading conversation:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('createConversation', () => {
    it('should create a new conversation with generated title', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: mockUser, error: null } as any);

      const insertMock = vi.fn().mockReturnThis();
      const selectMock = vi.fn().mockReturnThis();
      const singleMock = vi.fn().mockResolvedValue({
        data: { ...mockConversation, id: 'new-conv-id' },
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(),
        insert: insertMock.mockReturnValue({
          select: selectMock.mockReturnValue({
            single: singleMock,
          }),
        }),
        update: vi.fn(),
        delete: vi.fn(),
        upsert: vi.fn(),
      } as any);

      const { result } = renderHook(() => useConversation());

      let conversationId: string | undefined;
      await act(async () => {
        conversationId = await result.current.createConversation(
          'This is a test message',
          'campaign-123'
        );
      });

      expect(conversationId).toBe('new-conv-id');
      expect(result.current.title).toBe('This is a test message');
      expect(insertMock).toHaveBeenCalledWith({
        user_id: 'user-123',
        title: 'This is a test message',
        campaign_id: 'campaign-123',
      });
    });

    it('should truncate long titles', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: mockUser, error: null } as any);

      const insertMock = vi.fn().mockReturnThis();
      const selectMock = vi.fn().mockReturnThis();
      const singleMock = vi.fn().mockResolvedValue({
        data: mockConversation,
        error: null,
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(),
        insert: insertMock.mockReturnValue({
          select: selectMock.mockReturnValue({
            single: singleMock,
          }),
        }),
        update: vi.fn(),
        delete: vi.fn(),
        upsert: vi.fn(),
      } as any);

      const { result } = renderHook(() => useConversation());

      const longMessage = 'A'.repeat(100);
      await act(async () => {
        await result.current.createConversation(longMessage);
      });

      expect(result.current.title).toBe('A'.repeat(50) + '...');
    });

    it('should throw error if user not authenticated', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      } as any);

      const { result } = renderHook(() => useConversation());

      await expect(
        result.current.createConversation('Test message')
      ).rejects.toThrow('Not authenticated');
    });
  });

  describe('saveMessage', () => {
    it('should save message to database and update local state', async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(),
        insert: insertMock,
        update: vi.fn(),
        delete: vi.fn(),
        upsert: vi.fn(),
      } as any);

      const { result } = renderHook(() => useConversation());

      await act(async () => {
        await result.current.saveMessage(
          'conv-123',
          'user',
          'Hello world',
          { type: 'campaign', campaignId: 'camp-123' }
        );
      });

      expect(insertMock).toHaveBeenCalledWith({
        conversation_id: 'conv-123',
        role: 'user',
        content: 'Hello world',
        metadata: { type: 'campaign', campaignId: 'camp-123' },
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]).toEqual({
        role: 'user',
        content: 'Hello world',
        metadata: { type: 'campaign', campaignId: 'camp-123' },
      });
    });

    it('should handle database errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const insertMock = vi.fn().mockResolvedValue({
        error: new Error('Insert failed'),
      });

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn(),
        insert: insertMock,
        update: vi.fn(),
        delete: vi.fn(),
        upsert: vi.fn(),
      } as any);

      const { result } = renderHook(() => useConversation());

      await expect(
        result.current.saveMessage('conv-123', 'user', 'Test')
      ).rejects.toThrow('Insert failed');

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error saving message:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('setMessages', () => {
    it('should allow manual message updates', () => {
      const { result } = renderHook(() => useConversation());

      const newMessages = [
        { role: 'user' as const, content: 'Test 1' },
        { role: 'assistant' as const, content: 'Test 2' },
      ];

      act(() => {
        result.current.setMessages(newMessages);
      });

      expect(result.current.messages).toEqual(newMessages);
    });
  });
});
