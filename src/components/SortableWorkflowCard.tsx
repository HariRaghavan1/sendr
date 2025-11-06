import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Copy,
  Edit,
  Trash2,
  MoreHorizontal,
  TestTube,
  Mail,
  Eye,
  Reply,
  GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Campaign } from './WorkflowKanban';

interface SortableWorkflowCardProps {
  campaign: Campaign;
  onEdit?: (campaign: Campaign) => void;
  onDuplicate?: (campaign: Campaign) => void;
  onDelete?: (campaign: Campaign) => void;
  onTestRun?: (campaign: Campaign) => void;
}

/**
 * SortableWorkflowCard - Draggable campaign card for Kanban view
 *
 * Features:
 * - Drag-and-drop via @dnd-kit/sortable
 * - Compact display of campaign info
 * - Quick actions dropdown
 * - Campaign stats (sent, opened, replied)
 * - Smooth animations
 */
export function SortableWorkflowCard({
  campaign,
  onEdit,
  onDuplicate,
  onDelete,
  onTestRun,
}: SortableWorkflowCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: campaign.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'transition-opacity',
        isDragging && 'opacity-50'
      )}
    >
      <Card
        className={cn(
          'group hover:shadow-md transition-all cursor-grab active:cursor-grabbing',
          'hover:border-primary/30 border-border/50'
        )}
      >
        <CardHeader className="p-3 pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              {/* Drag Handle */}
              <button
                className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </button>

              {/* Campaign Name */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold line-clamp-2 leading-tight">
                  {campaign.name}
                </h4>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                  {campaign.goal} • {campaign.tone}
                </p>
              </div>
            </div>

            {/* Actions Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(campaign);
                    }}
                  >
                    <Edit className="mr-2 h-3.5 w-3.5" />
                    Edit
                  </DropdownMenuItem>
                )}
                {onTestRun && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onTestRun(campaign);
                    }}
                  >
                    <TestTube className="mr-2 h-3.5 w-3.5" />
                    Test Run
                  </DropdownMenuItem>
                )}
                {onDuplicate && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicate(campaign);
                    }}
                  >
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    Duplicate
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(campaign);
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="p-3 pt-0">
          {/* Campaign Stats */}
          {(campaign.total_sent || campaign.total_opened || campaign.total_replied) ? (
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-muted/30 rounded-lg p-2">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                </div>
                <p className="text-lg font-bold text-foreground">
                  {campaign.total_sent || 0}
                </p>
                <p className="text-xs text-muted-foreground">Sent</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-2">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Eye className="h-3 w-3 text-muted-foreground" />
                </div>
                <p className="text-lg font-bold text-foreground">
                  {campaign.total_opened || 0}
                </p>
                <p className="text-xs text-muted-foreground">Opened</p>
              </div>
              <div className="bg-muted/30 rounded-lg p-2">
                <div className="flex items-center justify-center gap-1 mb-0.5">
                  <Reply className="h-3 w-3 text-muted-foreground" />
                </div>
                <p className="text-lg font-bold text-foreground">
                  {campaign.total_replied || 0}
                </p>
                <p className="text-xs text-muted-foreground">Replied</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-2 bg-muted/20 rounded-lg">
              <p className="text-xs text-muted-foreground">No activity yet</p>
            </div>
          )}

          {/* Created Date */}
          {campaign.created_at && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Created {new Date(campaign.created_at).toLocaleDateString()}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
