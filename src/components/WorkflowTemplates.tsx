import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import {
  Sparkles,
  Users,
  Handshake,
  Calendar,
  Rocket,
  MessageSquare,
  Mail,
  Target,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type EmailTone = Database['public']['Enums']['email_tone'];
type EmailGoal = Database['public']['Enums']['email_goal'];

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  goal: EmailGoal;
  tone: EmailTone;
  targetCriteria: {
    job_titles: string[];
    industry: string;
    location: string;
    company_size: string;
  };
  customPrompt: string;
  tags: string[];
}

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'sdr-cold-outreach',
    name: 'SDR Cold Outreach',
    description:
      'Target decision-makers for product demos. Perfect for sales development reps looking to book meetings with C-level executives.',
    icon: Users,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    goal: 'demo',
    tone: 'formal',
    targetCriteria: {
      job_titles: ['CEO', 'CTO', 'VP of Sales', 'Director of Marketing'],
      industry: 'Technology',
      location: 'United States',
      company_size: '50-500',
    },
    customPrompt:
      'Focus on how our solution solves their specific pain points. Keep it concise (under 150 words) and include a clear call-to-action. Mention a relevant statistic or case study if available.',
    tags: ['Sales', 'B2B', 'Cold Outreach'],
  },
  {
    id: 'partnership-inquiry',
    name: 'Partnership Inquiry',
    description:
      'Reach out to potential partners for collaboration opportunities. Great for business development and strategic partnerships.',
    icon: Handshake,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    goal: 'partnership',
    tone: 'formal',
    targetCriteria: {
      job_titles: ['VP of Partnerships', 'Head of Business Development', 'CEO', 'COO'],
      industry: '',
      location: '',
      company_size: '100+',
    },
    customPrompt:
      'Highlight mutual benefits and potential synergies. Be collaborative and professional. Mention specific ways we can work together.',
    tags: ['Partnerships', 'B2B', 'Collaboration'],
  },
  {
    id: 'event-invitation',
    name: 'Event Invitation',
    description:
      'Invite prospects to webinars, conferences, or virtual events. Perfect for driving event attendance and engagement.',
    icon: Calendar,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    goal: 'meeting',
    tone: 'casual',
    targetCriteria: {
      job_titles: ['Product Manager', 'Engineer', 'Designer', 'Data Scientist'],
      industry: 'Technology',
      location: '',
      company_size: '',
    },
    customPrompt:
      'Create excitement about the event. Mention key speakers, topics, or takeaways. Include clear registration link and date/time details.',
    tags: ['Events', 'Webinars', 'Community'],
  },
  {
    id: 'product-launch',
    name: 'Product Launch',
    description:
      'Announce new products or features to your target audience. Drive awareness and early adoption.',
    icon: Rocket,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    goal: 'other',
    tone: 'formal',
    targetCriteria: {
      job_titles: ['Product Manager', 'CTO', 'VP of Engineering'],
      industry: 'Technology',
      location: '',
      company_size: '',
    },
    customPrompt:
      'Build excitement around the new launch. Highlight key features and benefits. Include exclusive early access or beta testing opportunities.',
    tags: ['Product', 'Launch', 'Announcement'],
  },
  {
    id: 'feedback-request',
    name: 'Customer Feedback',
    description:
      'Request feedback from users to improve your product. Great for customer success and product teams.',
    icon: MessageSquare,
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
    goal: 'other',
    tone: 'casual',
    targetCriteria: {
      job_titles: [],
      industry: '',
      location: '',
      company_size: '',
    },
    customPrompt:
      'Be appreciative and genuine. Explain how their feedback will make a difference. Keep it short and offer an incentive if applicable.',
    tags: ['Feedback', 'Customer Success', 'Product'],
  },
  {
    id: 'content-promotion',
    name: 'Content Promotion',
    description:
      'Share valuable content like blog posts, whitepapers, or research reports. Drive traffic and establish thought leadership.',
    icon: Mail,
    color: 'text-cyan-500',
    bgColor: 'bg-cyan-500/10',
    goal: 'other',
    tone: 'casual',
    targetCriteria: {
      job_titles: ['Marketing Manager', 'Content Strategist', 'CMO'],
      industry: 'Marketing',
      location: '',
      company_size: '',
    },
    customPrompt:
      'Focus on the value they will get from reading. Tease key insights without giving everything away. Keep it engaging and conversational.',
    tags: ['Content', 'Marketing', 'Thought Leadership'],
  },
];

interface WorkflowTemplatesProps {
  onTemplateSelect?: (templateId: string) => void;
}

/**
 * WorkflowTemplates - Pre-configured workflow templates for common use cases
 *
 * Features:
 * - 6 pre-built templates for common scenarios
 * - One-click campaign creation from template
 * - Visual template cards with icons and descriptions
 * - Tags for filtering (future enhancement)
 * - Detailed template previews
 *
 * @example
 * ```tsx
 * <WorkflowTemplates onTemplateSelect={(id) => console.log('Selected:', id)} />
 * ```
 */
export function WorkflowTemplates({ onTemplateSelect }: WorkflowTemplatesProps) {
  const [open, setOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  const handleUseTemplate = async (template: WorkflowTemplate) => {
    try {
      setCreating(true);

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        toast.error('You must be logged in to create a campaign');
        return;
      }

      // Create campaign from template
      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          name: template.name,
          user_id: userData.user.id,
          goal: template.goal,
          tone: template.tone,
          status: 'draft',
          target_criteria: template.targetCriteria,
          custom_prompt: template.customPrompt,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`Created "${template.name}" from template!`);
      setOpen(false);
      onTemplateSelect?.(data.id);
    } catch (error) {
      console.error('Error creating campaign from template:', error);
      toast.error('Failed to create campaign from template');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Use Template
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Workflow Templates
          </DialogTitle>
          <DialogDescription>
            Choose a pre-configured template to quickly create a campaign for common use cases
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[600px] pr-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            {WORKFLOW_TEMPLATES.map((template) => {
              const TemplateIcon = template.icon;
              const isSelected = selectedTemplate?.id === template.id;

              return (
                <Card
                  key={template.id}
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-md',
                    'hover:border-primary/50',
                    isSelected && 'ring-2 ring-primary border-primary'
                  )}
                  onClick={() => setSelectedTemplate(template)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={cn('p-2 rounded-lg', template.bgColor)}>
                          <TemplateIcon className={cn('h-5 w-5', template.color)} />
                        </div>
                        <div>
                          <CardTitle className="text-base">{template.name}</CardTitle>
                          <div className="flex gap-1 mt-1">
                            {template.tags.slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3">
                    <CardDescription className="text-sm leading-relaxed">
                      {template.description}
                    </CardDescription>

                    {isSelected && (
                      <div className="pt-3 border-t border-border space-y-2">
                        <div className="text-xs space-y-1">
                          <p className="text-muted-foreground">
                            <span className="font-medium">Goal:</span>{' '}
                            <span className="capitalize">{template.goal}</span>
                          </p>
                          <p className="text-muted-foreground">
                            <span className="font-medium">Tone:</span>{' '}
                            <span className="capitalize">{template.tone}</span>
                          </p>
                          {template.targetCriteria.job_titles.length > 0 && (
                            <p className="text-muted-foreground">
                              <span className="font-medium">Target:</span>{' '}
                              {template.targetCriteria.job_titles.slice(0, 2).join(', ')}
                              {template.targetCriteria.job_titles.length > 2 && '...'}
                            </p>
                          )}
                        </div>

                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUseTemplate(template);
                          }}
                          disabled={creating}
                          className="w-full"
                          size="sm"
                        >
                          {creating ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3.5 w-3.5 mr-2" />
                              Use This Template
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {!isSelected && (
                      <Button variant="ghost" size="sm" className="w-full text-xs">
                        Click to preview
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
