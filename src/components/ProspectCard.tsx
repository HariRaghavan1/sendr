import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { ExternalLink, Briefcase, Building2, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Prospect {
  id: string;
  name: string;
  title?: string;
  company?: string;
  linkedin_url?: string;
  found_at?: string;
  index?: number;
}

interface ProspectCardProps {
  prospect: Prospect;
  loading?: boolean;
  className?: string;
  variant?: 'default' | 'compact';
  showStatus?: boolean;
  status?: 'researching' | 'found' | 'emailed';
}

/**
 * ProspectCard - Displays prospect information with rich formatting
 *
 * Features:
 * - Avatar with initials
 * - LinkedIn link
 * - Status indicators
 * - Loading state
 * - Responsive design
 * - Accessible (ARIA labels, keyboard navigation)
 *
 * @example
 * ```tsx
 * <ProspectCard
 *   prospect={{
 *     name: "John Doe",
 *     title: "CTO",
 *     company: "Acme Inc",
 *     linkedin_url: "https://linkedin.com/in/johndoe"
 *   }}
 *   status="found"
 * />
 * ```
 */
export function ProspectCard({
  prospect,
  loading = false,
  className,
  variant = 'default',
  showStatus = true,
  status = 'found',
}: ProspectCardProps) {
  // Generate initials from name for avatar
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Generate color based on name (consistent color per person)
  const getAvatarColor = (name: string): string => {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-teal-500',
      'bg-orange-500',
      'bg-cyan-500',
    ];
    const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'researching':
        return <Loader2 className="h-3 w-3 animate-spin" />;
      case 'found':
        return <CheckCircle2 className="h-3 w-3" />;
      case 'emailed':
        return <CheckCircle2 className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getStatusBadge = () => {
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
      researching: { label: 'Researching...', variant: 'outline' },
      found: { label: 'Found', variant: 'secondary' },
      emailed: { label: 'Email Generated', variant: 'default' },
    };

    const config = variants[status];
    return (
      <Badge variant={config.variant} className="text-xs">
        {getStatusIcon()}
        <span className="ml-1">{config.label}</span>
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card className={cn('border-border/50', className)}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isCompact = variant === 'compact';

  return (
    <Card
      className={cn(
        'border-border/50 hover:border-primary/30 transition-all group animate-fade-in',
        'hover:shadow-md',
        status === 'researching' && 'animate-pulse',
        className
      )}
      role="article"
      aria-label={`Prospect: ${prospect.name}`}
    >
      <CardContent className={cn(isCompact ? 'p-3' : 'p-4')}>
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div
            className={cn(
              'rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0',
              getAvatarColor(prospect.name),
              isCompact ? 'h-10 w-10 text-sm' : 'h-12 w-12 text-base'
            )}
            aria-hidden="true"
          >
            {getInitials(prospect.name)}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Name & Status */}
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className={cn(
                'font-semibold text-foreground truncate',
                isCompact ? 'text-sm' : 'text-base'
              )}>
                {prospect.name}
              </h3>
              {showStatus && (
                <div className="flex-shrink-0">
                  {getStatusBadge()}
                </div>
              )}
            </div>

            {/* Title */}
            {prospect.title && (
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <Briefcase className={cn('flex-shrink-0', isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
                <span className={cn('truncate', isCompact ? 'text-xs' : 'text-sm')}>
                  {prospect.title}
                </span>
              </div>
            )}

            {/* Company */}
            {prospect.company && (
              <div className="flex items-center gap-1.5 text-muted-foreground mb-2">
                <Building2 className={cn('flex-shrink-0', isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
                <span className={cn('truncate', isCompact ? 'text-xs' : 'text-sm')}>
                  {prospect.company}
                </span>
              </div>
            )}

            {/* LinkedIn Link */}
            {prospect.linkedin_url && (
              <a
                href={prospect.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors',
                  isCompact ? 'text-xs' : 'text-sm'
                )}
                aria-label={`View ${prospect.name}'s LinkedIn profile`}
              >
                <ExternalLink className="h-3 w-3" />
                <span className="hover:underline">View LinkedIn</span>
              </a>
            )}

            {/* Found timestamp (if available) */}
            {prospect.found_at && !isCompact && (
              <p className="text-xs text-muted-foreground mt-2">
                Found {new Date(prospect.found_at).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * ProspectCardSkeleton - Loading state for ProspectCard
 */
export function ProspectCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('border-border/50', className)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * ProspectGrid - Display multiple prospects in a responsive grid
 */
interface ProspectGridProps {
  prospects: Prospect[];
  loading?: boolean;
  className?: string;
  variant?: 'default' | 'compact';
  showStatus?: boolean;
  emptyMessage?: string;
}

export function ProspectGrid({
  prospects,
  loading = false,
  className,
  variant = 'default',
  showStatus = true,
  emptyMessage = 'No prospects found yet...',
}: ProspectGridProps) {
  if (loading) {
    return (
      <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-3', className)}>
        {[...Array(3)].map((_, i) => (
          <ProspectCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (prospects.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-3', className)}>
      {prospects.map((prospect, index) => (
        <ProspectCard
          key={prospect.id || index}
          prospect={prospect}
          variant={variant}
          showStatus={showStatus}
        />
      ))}
    </div>
  );
}
