import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Play,
  Pause,
  Copy,
  Edit,
  Trash2,
  MoreHorizontal,
  TestTube,
  FileEdit,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SortableWorkflowCard } from './SortableWorkflowCard';

export interface Campaign {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  goal: string;
  tone: string;
  total_sent?: number;
  total_opened?: number;
  total_replied?: number;
  created_at: string;
  updated_at?: string;
}

interface WorkflowKanbanProps {
  campaigns: Campaign[];
  onStatusChange: (campaignId: string, newStatus: Campaign['status']) => Promise<void>;
  onEdit?: (campaign: Campaign) => void;
  onDuplicate?: (campaign: Campaign) => void;
  onDelete?: (campaign: Campaign) => void;
  onTestRun?: (campaign: Campaign) => void;
  loading?: boolean;
}

interface KanbanColumn {
  id: Campaign['status'];
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    id: 'draft',
    title: 'Draft',
    icon: FileEdit,
    color: 'text-gray-500',
    bgColor: 'bg-gray-500/10',
  },
  {
    id: 'active',
    title: 'Active',
    icon: Play,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  {
    id: 'paused',
    title: 'Paused',
    icon: Pause,
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
  },
  {
    id: 'completed',
    title: 'Completed',
    icon: CheckCircle2,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
];

/**
 * WorkflowKanban - Kanban board view for campaign workflows
 *
 * Features:
 * - Drag-and-drop to change workflow status
 * - Visual columns for each status (Draft, Active, Paused, Completed)
 * - Quick actions (edit, duplicate, delete, test run)
 * - Campaign stats (sent, opened, replied)
 * - Real-time updates via Supabase
 *
 * @example
 * ```tsx
 * <WorkflowKanban
 *   campaigns={campaigns}
 *   onStatusChange={handleStatusChange}
 *   onEdit={handleEdit}
 *   onTestRun={handleTestRun}
 * />
 * ```
 */
export function WorkflowKanban({
  campaigns,
  onStatusChange,
  onEdit,
  onDuplicate,
  onDelete,
  onTestRun,
  loading = false,
}: WorkflowKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Group campaigns by status
  const groupedCampaigns = KANBAN_COLUMNS.reduce((acc, column) => {
    acc[column.id] = campaigns.filter((c) => c.status === column.id);
    return acc;
  }, {} as Record<Campaign['status'], Campaign[]>);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      setActiveId(null);
      return;
    }

    const campaignId = active.id as string;
    const newStatus = over.id as Campaign['status'];

    // Find the campaign
    const campaign = campaigns.find((c) => c.id === campaignId);
    if (!campaign) {
      setActiveId(null);
      return;
    }

    // If status changed, update
    if (campaign.status !== newStatus) {
      await onStatusChange(campaignId, newStatus);
    }

    setActiveId(null);
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  // Get the active campaign for drag overlay
  const activeCampaign = activeId
    ? campaigns.find((c) => c.id === activeId)
    : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-full">
        {KANBAN_COLUMNS.map((column) => {
          const columnCampaigns = groupedCampaigns[column.id] || [];
          const ColumnIcon = column.icon;

          return (
            <SortableContext
              key={column.id}
              id={column.id}
              items={columnCampaigns.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <Card className="flex flex-col border-border/50 h-full">
                <CardHeader className="pb-3 border-b border-border/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn('p-1.5 rounded-lg', column.bgColor)}>
                        <ColumnIcon className={cn('h-4 w-4', column.color)} />
                      </div>
                      <CardTitle className="text-sm font-medium">
                        {column.title}
                      </CardTitle>
                    </div>
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                      {columnCampaigns.length}
                    </Badge>
                  </div>
                </CardHeader>

                <ScrollArea className="flex-1">
                  <CardContent className="p-3 space-y-2">
                    {loading ? (
                      // Loading skeletons
                      [...Array(2)].map((_, i) => (
                        <div
                          key={i}
                          className="h-32 rounded-lg bg-muted/30 animate-pulse"
                        />
                      ))
                    ) : columnCampaigns.length === 0 ? (
                      // Empty state
                      <div className="flex flex-col items-center justify-center h-32 text-center p-4">
                        <ColumnIcon
                          className={cn('h-8 w-8 mb-2 opacity-30', column.color)}
                        />
                        <p className="text-xs text-muted-foreground">
                          No {column.title.toLowerCase()} workflows
                        </p>
                      </div>
                    ) : (
                      // Campaign cards
                      columnCampaigns.map((campaign) => (
                        <SortableWorkflowCard
                          key={campaign.id}
                          campaign={campaign}
                          onEdit={onEdit}
                          onDuplicate={onDuplicate}
                          onDelete={onDelete}
                          onTestRun={onTestRun}
                        />
                      ))
                    )}
                  </CardContent>
                </ScrollArea>
              </Card>
            </SortableContext>
          );
        })}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeCampaign ? (
          <Card className="w-64 border-primary shadow-lg opacity-80">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm line-clamp-1">
                {activeCampaign.name}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {activeCampaign.goal}
              </p>
            </CardContent>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/**
 * WorkflowKanbanSkeleton - Loading state for WorkflowKanban
 */
export function WorkflowKanbanSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {KANBAN_COLUMNS.map((column) => (
        <Card key={column.id} className="border-border/50">
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div className="h-5 w-24 bg-muted rounded animate-pulse" />
              <div className="h-5 w-8 bg-muted rounded animate-pulse" />
            </div>
          </CardHeader>
          <CardContent className="p-3 space-y-2 mt-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-32 rounded-lg bg-muted/30 animate-pulse" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
