import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MessageSquare, Plus, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

export const ConversationList = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const { data } = await supabase
        .from('campaign_conversations')
        .select('id, title, updated_at')
        .order('updated_at', { ascending: false })
        .limit(20);

      if (data) {
        setConversations(data);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const handleDelete = async (e: React.MouseEvent, conversationIdToDelete: string) => {
    e.stopPropagation(); // Prevent navigation when clicking delete
    
    if (!confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('campaign_conversations')
        .delete()
        .eq('id', conversationIdToDelete);

      if (error) {
        throw error;
      }

      // Remove from local state
      setConversations(prev => prev.filter(conv => conv.id !== conversationIdToDelete));
      
      // If we're currently viewing this conversation, navigate away
      if (location.pathname.includes(conversationIdToDelete)) {
        navigate('/campaigns/ai-create');
      }

      toast.success('Conversation deleted successfully');
    } catch (error: any) {
      console.error('Error deleting conversation:', error);
      toast.error('Failed to delete conversation: ' + (error.message || 'Unknown error'));
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <Button 
          onClick={() => navigate('/campaigns/ai-create')}
          className="w-full justify-start gap-2"
          variant="default"
        >
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1 pr-2">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className="relative w-full hover:bg-accent rounded-lg transition-colors group"
              onMouseEnter={() => setHoveredId(conv.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {hoveredId === conv.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(e, conv.id);
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="absolute left-1 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-all hover:bg-destructive/10 hover:text-destructive text-destructive z-50 flex items-center justify-center bg-background border border-destructive/20 shadow-md"
                  title="Delete conversation"
                  type="button"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => navigate(`/campaigns/ai-create/${conv.id}`)}
                className="w-full text-left p-3 rounded-lg flex items-start gap-2 relative"
                style={{ paddingLeft: hoveredId === conv.id ? '36px' : '12px' }}
              >
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <MessageSquare className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate text-foreground">
                      {conv.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};
