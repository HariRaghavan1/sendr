import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Play,
  Rocket,
  Copy,
  Sparkles,
  ArrowRight,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import {Components} from 'react-markdown';

interface RichMessageProps {
  content: string;
  role: 'user' | 'assistant';
  suggestions?: MessageSuggestion[];
  className?: string;
}

export interface MessageSuggestion {
  id: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  action: () => void;
  variant?: 'default' | 'outline' | 'secondary';
}

/**
 * RichMessage - Enhanced message display with Markdown support and smart suggestions
 *
 * Features:
 * - Markdown formatting (headings, lists, code blocks, bold, italic)
 * - Syntax highlighting for code blocks
 * - Smart action suggestions (contextual next steps)
 * - Responsive design
 * - Copy functionality for code blocks
 *
 * @example
 * ```tsx
 * <RichMessage
 *   content="Here's your workflow:\n\n- **Target**: CTOs\n- **Goal**: Book demo"
 *   role="assistant"
 *   suggestions={[
 *     { id: '1', label: 'Test Run', icon: Play, action: () => {} },
 *     { id: '2', label: 'Deploy', icon: Rocket, action: () => {} }
 *   ]}
 * />
 * ```
 */
export function RichMessage({
  content,
  role,
  suggestions,
  className,
}: RichMessageProps) {
  // Custom components for markdown rendering
  const markdownComponents: Components = {
    h1: ({ children, ...props }) => (
      <h1 className="text-xl font-bold mb-3 mt-4 first:mt-0" {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 className="text-lg font-semibold mb-2 mt-3 first:mt-0" {...props}>
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 className="text-base font-semibold mb-2 mt-2 first:mt-0" {...props}>
        {children}
      </h3>
    ),
    p: ({ children, ...props }) => (
      <p className="mb-2 last:mb-0 leading-relaxed" {...props}>
        {children}
      </p>
    ),
    ul: ({ children, ...props }) => (
      <ul className="list-disc list-inside mb-2 space-y-1 ml-2" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol className="list-decimal list-inside mb-2 space-y-1 ml-2" {...props}>
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => (
      <li className="leading-relaxed" {...props}>
        {children}
      </li>
    ),
    code: ({ inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : undefined;

      if (!inline && language) {
        // Code block with language
        return (
          <div className="relative group my-3">
            <div className="absolute top-2 right-2 flex items-center gap-2">
              {language && (
                <Badge variant="secondary" className="text-xs">
                  {language}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => {
                  navigator.clipboard.writeText(String(children));
                }}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <pre className="bg-muted/50 border border-border rounded-lg p-4 overflow-x-auto">
              <code className={`text-sm ${className}`} {...props}>
                {children}
              </code>
            </pre>
          </div>
        );
      }

      // Inline code
      return (
        <code
          className="bg-muted/50 border border-border px-1.5 py-0.5 rounded text-sm font-mono"
          {...props}
        >
          {children}
        </code>
      );
    },
    blockquote: ({ children, ...props }) => (
      <blockquote
        className="border-l-4 border-primary/30 pl-4 italic text-muted-foreground my-3"
        {...props}
      >
        {children}
      </blockquote>
    ),
    strong: ({ children, ...props }) => (
      <strong className="font-semibold text-foreground" {...props}>
        {children}
      </strong>
    ),
    em: ({ children, ...props }) => (
      <em className="italic" {...props}>
        {children}
      </em>
    ),
    a: ({ children, href, ...props }) => (
      <a
        href={href}
        className="text-primary hover:underline"
        target="_blank"
        rel="noopener noreferrer"
        {...props}
      >
        {children}
      </a>
    ),
    hr: (props) => <hr className="my-4 border-border" {...props} />,
  };

  return (
    <div className={cn('space-y-2', className)}>
      {/* Message Content */}
      <div
        className={cn(
          'rounded-2xl px-5 py-3.5 shadow-sm',
          role === 'user'
            ? 'bg-primary text-primary-foreground'
            : 'bg-card border border-border'
        )}
      >
        <div className="text-sm">
          {role === 'assistant' ? (
            <ReactMarkdown components={markdownComponents}>{content}</ReactMarkdown>
          ) : (
            <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
          )}
        </div>
      </div>

      {/* Smart Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <Card className="border-border/50 bg-muted/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">
                Suggested Actions
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => {
                const SuggestionIcon = suggestion.icon || ArrowRight;
                return (
                  <Button
                    key={suggestion.id}
                    variant={suggestion.variant || 'outline'}
                    size="sm"
                    onClick={suggestion.action}
                    className="text-xs gap-1.5"
                  >
                    <SuggestionIcon className="h-3.5 w-3.5" />
                    {suggestion.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * getSmartSuggestions - Generate contextual suggestions based on message content
 *
 * Analyzes assistant messages to suggest relevant next actions
 */
export function getSmartSuggestions(
  content: string,
  onAction: (action: string) => void
): MessageSuggestion[] {
  const suggestions: MessageSuggestion[] = [];

  // Campaign created - suggest test run and deploy
  if (content.includes('Created campaign') || content.includes('workflow created')) {
    suggestions.push(
      {
        id: 'test-run',
        label: 'Test Run',
        icon: Play,
        action: () => onAction('test-run'),
        variant: 'default',
      },
      {
        id: 'view-details',
        label: 'View Details',
        icon: Eye,
        action: () => onAction('view-details'),
        variant: 'outline',
      }
    );
  }

  // Test completed - suggest deploy or modify
  if (content.includes('test') && (content.includes('complete') || content.includes('finished'))) {
    suggestions.push(
      {
        id: 'deploy',
        label: 'Deploy Campaign',
        icon: Rocket,
        action: () => onAction('deploy'),
        variant: 'default',
      },
      {
        id: 'modify',
        label: 'Modify Workflow',
        icon: Sparkles,
        action: () => onAction('modify'),
        variant: 'outline',
      }
    );
  }

  // Success message - suggest create another
  if (content.includes('success') || content.includes('deployed')) {
    suggestions.push({
      id: 'create-another',
      label: 'Create Another Campaign',
      icon: Sparkles,
      action: () => onAction('create-another'),
      variant: 'outline',
    });
  }

  // General workflow mentions - suggest view templates
  if (
    content.includes('campaign') &&
    (content.includes('create') || content.includes('build') || content.includes('setup'))
  ) {
    suggestions.push({
      id: 'use-template',
      label: 'Use Template',
      icon: Sparkles,
      action: () => onAction('use-template'),
      variant: 'secondary',
    });
  }

  return suggestions;
}
