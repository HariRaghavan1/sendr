import { useState } from 'react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './ui/collapsible';
import {
  Mail,
  Copy,
  Check,
  ChevronDown,
  Sparkles,
  AlertCircle,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface EmailData {
  email_id?: string;
  prospect_id: string;
  prospect_name: string;
  prospect_email?: string;
  subject: string;
  body: string;
  generated_at?: string;
  index?: number;
  word_count?: number;
  quality_score?: number;
  send_status?: 'pending' | 'sending' | 'sent' | 'failed' | 'skipped';
  send_error?: string;
}

interface EmailPreviewCardProps {
  email: EmailData;
  loading?: boolean;
  className?: string;
  variant?: 'default' | 'compact';
  defaultExpanded?: boolean;
}

/**
 * EmailPreviewCard - Rich email preview with quality scoring and copy functionality
 *
 * Features:
 * - Subject line highlighting
 * - Body with syntax highlighting for personalization
 * - Quality score (0-100)
 * - Copy to clipboard
 * - Word count
 * - Expandable/collapsible
 * - XSS protection (sanitized HTML)
 * - Mobile responsive
 *
 * @example
 * ```tsx
 * <EmailPreviewCard
 *   email={{
 *     prospect_name: "John Doe",
 *     subject: "Quick question about AI",
 *     body: "Hi John...",
 *     quality_score: 85
 *   }}
 * />
 * ```
 */
export function EmailPreviewCard({
  email,
  loading = false,
  className,
  variant = 'default',
  defaultExpanded = false,
}: EmailPreviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copied, setCopied] = useState(false);

  // Check for personalization opportunities
  const suggestions: string[] = [];
  if (email.body.split(' ').length > 150) {
    suggestions.push('Consider shortening to under 120 words');
  }
  if (!email.body.includes('{first_name}')) {
    suggestions.push('Add {first_name} personalization');
  }
  if (!email.body.includes('{company}')) {
    suggestions.push('Add {company} personalization');
  }

  const handleCopy = async (content: string, type: 'subject' | 'body' | 'full') => {
    try {
      const textToCopy = type === 'full'
        ? `Subject: ${email.subject}\n\n${email.body}`
        : content;

      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success(`${type === 'full' ? 'Email' : type.charAt(0).toUpperCase() + type.slice(1)} copied to clipboard`);

      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  // Get quality badge color and label
  const getQualityBadge = (score: number) => {
    if (score >= 80) {
      return { label: 'Excellent', color: 'bg-green-500/10 text-green-500 border-green-500/20' };
    } else if (score >= 60) {
      return { label: 'Good', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' };
    } else if (score >= 40) {
      return { label: 'Fair', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' };
    } else {
      return { label: 'Needs Work', color: 'bg-red-500/10 text-red-500 border-red-500/20' };
    }
  };

  // Highlight personalization variables in text
  const highlightPersonalization = (text: string) => {
    // Match {variable} or [variable] patterns
    const parts = text.split(/(\{[^}]+\}|\[[^\]]+\])/g);

    return parts.map((part, index) => {
      if (part.match(/^\{[^}]+\}$/) || part.match(/^\[[^\]]+\]$/)) {
        return (
          <span
            key={index}
            className="bg-primary/10 text-primary px-1 rounded font-medium"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  const isCompact = variant === 'compact';
  const qualityBadge = email.quality_score
    ? getQualityBadge(email.quality_score)
    : null;

  if (loading) {
    return (
      <Card className={cn('border-border/50', className)}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-6 w-20" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card
        className={cn(
          'border-border/50 hover:border-primary/30 transition-all',
          isExpanded && 'ring-1 ring-primary/20',
          className
        )}
      >
        <CardHeader className={cn(isCompact ? 'p-3 pb-2' : 'pb-3')}>
          <div className="flex items-start justify-between gap-3">
            {/* Header Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Mail className={cn('flex-shrink-0', isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
                <span className={cn('font-medium text-muted-foreground', isCompact ? 'text-xs' : 'text-sm')}>
                  To: {email.prospect_name}
                </span>
              </div>

              {/* Subject Line */}
              <div className="flex items-start gap-2">
                <p className={cn(
                  'font-semibold text-foreground leading-tight',
                  isCompact ? 'text-sm' : 'text-base'
                )}>
                  {highlightPersonalization(email.subject)}
                </p>
              </div>

              {/* Metadata */}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {/* Send Status */}
                {email.send_status && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      email.send_status === 'sent' && 'bg-green-500/10 text-green-500 border-green-500/20',
                      email.send_status === 'failed' && 'bg-red-500/10 text-red-500 border-red-500/20',
                      email.send_status === 'sending' && 'bg-blue-500/10 text-blue-500 border-blue-500/20',
                      email.send_status === 'skipped' && 'bg-gray-500/10 text-gray-500 border-gray-500/20',
                      email.send_status === 'pending' && 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                    )}
                  >
                    {email.send_status === 'sent' && '✓ Sent'}
                    {email.send_status === 'failed' && '✗ Failed'}
                    {email.send_status === 'sending' && '⟳ Sending...'}
                    {email.send_status === 'skipped' && '⊘ Skipped'}
                    {email.send_status === 'pending' && '○ Pending'}
                  </Badge>
                )}

                {/* Quality Score */}
                {qualityBadge && (
                  <Badge
                    variant="outline"
                    className={cn('text-xs', qualityBadge.color)}
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    {email.quality_score}/100 {qualityBadge.label}
                  </Badge>
                )}

                {/* Word Count */}
                {email.word_count && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    {email.word_count} words
                  </span>
                )}

                {/* Timestamp */}
                {email.generated_at && !isCompact && (
                  <span className="text-xs text-muted-foreground">
                    Generated {new Date(email.generated_at).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-8 w-8', copied && 'text-green-500')}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy('', 'full');
                }}
                aria-label="Copy email"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>

              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={isExpanded ? 'Collapse email' : 'Expand email'}
                >
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 transition-transform',
                      isExpanded && 'rotate-180'
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className={cn(isCompact ? 'p-3 pt-0' : 'pt-0')}>
            {/* Email Body */}
            <div className="bg-muted/30 rounded-lg p-4 border border-border/50">
              <div className={cn(
                'whitespace-pre-wrap leading-relaxed',
                isCompact ? 'text-sm' : 'text-base'
              )}>
                {highlightPersonalization(email.body)}
              </div>
            </div>

            {/* AI-Powered Suggestions */}
            {suggestions.length > 0 && isExpanded && (
              <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                      💡 AI Suggestions
                    </p>
                    <ul className="text-xs space-y-1 text-blue-600 dark:text-blue-400">
                      {suggestions.map((suggestion, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <span className="text-blue-500 mt-0.5">•</span>
                          <span>{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Send Error */}
            {email.send_error && (
              <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-red-700 dark:text-red-300">
                    <p className="font-medium mb-1">Send Error:</p>
                    <p>{email.send_error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Quality Tips */}
            {email.quality_score && email.quality_score < 60 && (
              <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-yellow-700 dark:text-yellow-300">
                    <p className="font-medium mb-1">Suggestions to improve quality:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {email.subject.length > 60 && <li>Subject line is too long (keep it under 60 characters)</li>}
                      {email.word_count && email.word_count < 50 && <li>Email body is too short (aim for 50-150 words)</li>}
                      {email.word_count && email.word_count > 200 && <li>Email body is too long (keep it under 200 words)</li>}
                      {!email.body.match(/\{|\[/) && <li>Add personalization variables like {'{first_name}'}</li>}
                      {!email.body.match(/(schedule|call|meeting|demo|chat)/i) && <li>Include a clear call-to-action</li>}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Additional Actions */}
            <div className="flex items-center gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(email.subject, 'subject')}
                className="text-xs"
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy Subject
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(email.body, 'body')}
                className="text-xs"
              >
                <Copy className="h-3 w-3 mr-1" />
                Copy Body
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

/**
 * EmailPreviewList - Display multiple email previews
 */
interface EmailPreviewListProps {
  emails: EmailData[];
  loading?: boolean;
  className?: string;
  variant?: 'default' | 'compact';
  emptyMessage?: string;
  defaultExpandFirst?: boolean;
}

export function EmailPreviewList({
  emails,
  loading = false,
  className,
  variant = 'default',
  emptyMessage = 'No emails generated yet...',
  defaultExpandFirst = false,
}: EmailPreviewListProps) {
  if (loading) {
    return (
      <div className={cn('space-y-3', className)}>
        {[...Array(2)].map((_, i) => (
          <EmailPreviewCard key={i} email={{} as EmailData} loading />
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {emails.map((email, index) => (
        <EmailPreviewCard
          key={email.prospect_id || index}
          email={email}
          variant={variant}
          defaultExpanded={defaultExpandFirst && index === 0}
        />
      ))}
    </div>
  );
}
