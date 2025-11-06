import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Badge } from './ui/badge';
import { Loader2, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import type { Campaign } from './WorkflowKanban';

type EmailTone = Database['public']['Enums']['email_tone'];
type EmailGoal = Database['public']['Enums']['email_goal'];

interface WorkflowEditDialogProps {
  campaign: Campaign | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

interface FormData {
  name: string;
  goal: EmailGoal;
  tone: EmailTone;
  target_criteria: {
    industry: string;
    location: string;
    job_titles: string;
    company_size: string;
  };
  custom_prompt: string;
}

/**
 * WorkflowEditDialog - Inline editing dialog for campaign workflows
 *
 * Features:
 * - Quick edit without navigation
 * - Essential fields (name, goal, tone, targeting)
 * - Real-time validation
 * - Loading states
 * - Auto-save on field change (optional)
 *
 * @example
 * ```tsx
 * <WorkflowEditDialog
 *   campaign={selectedCampaign}
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   onSave={handleSave}
 * />
 * ```
 */
export function WorkflowEditDialog({
  campaign,
  open,
  onOpenChange,
  onSave,
}: WorkflowEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    goal: 'meeting',
    tone: 'professional',
    target_criteria: {
      industry: '',
      location: '',
      job_titles: '',
      company_size: '',
    },
    custom_prompt: '',
  });

  // Load campaign data when dialog opens
  useEffect(() => {
    if (campaign && open) {
      loadCampaignData(campaign.id);
    }
  }, [campaign, open]);

  const loadCampaignData = async (campaignId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (error) throw error;

      if (data) {
        const criteria = (data.target_criteria as any) || {
          industry: '',
          location: '',
          job_titles: '',
          company_size: '',
        };

        setFormData({
          name: data.name,
          goal: data.goal as EmailGoal,
          tone: data.tone as EmailTone,
          target_criteria: {
            industry: criteria.industry || '',
            location: criteria.location || '',
            job_titles: Array.isArray(criteria.job_titles)
              ? criteria.job_titles.join(', ')
              : criteria.job_titles || '',
            company_size: criteria.company_size || '',
          },
          custom_prompt: data.custom_prompt || '',
        });
      }
    } catch (error) {
      console.error('Error loading campaign:', error);
      toast.error('Failed to load campaign details');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!campaign) return;

    try {
      setLoading(true);

      // Parse job titles back to array
      const jobTitlesArray = formData.target_criteria.job_titles
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const updateData = {
        name: formData.name,
        goal: formData.goal,
        tone: formData.tone,
        target_criteria: {
          industry: formData.target_criteria.industry,
          location: formData.target_criteria.location,
          job_titles: jobTitlesArray,
          company_size: formData.target_criteria.company_size,
        },
        custom_prompt: formData.custom_prompt,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('campaigns')
        .update(updateData)
        .eq('id', campaign.id);

      if (error) throw error;

      toast.success('Campaign updated successfully');
      onOpenChange(false);
      onSave?.();
    } catch (error) {
      console.error('Error updating campaign:', error);
      toast.error('Failed to update campaign');
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: string, value: any) => {
    if (field.startsWith('target_criteria.')) {
      const criteriaField = field.split('.')[1];
      setFormData((prev) => ({
        ...prev,
        target_criteria: {
          ...prev.target_criteria,
          [criteriaField]: value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Workflow</DialogTitle>
          <DialogDescription>
            Make changes to your campaign workflow. Changes will be saved immediately.
          </DialogDescription>
        </DialogHeader>

        {loading && !formData.name ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Campaign Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateFormData('name', e.target.value)}
                placeholder="e.g., Q1 2025 Outbound Campaign"
              />
            </div>

            {/* Goal and Tone */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="goal">Goal *</Label>
                <Select
                  value={formData.goal}
                  onValueChange={(value) => updateFormData('goal', value as EmailGoal)}
                >
                  <SelectTrigger id="goal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meeting">Schedule Meeting</SelectItem>
                    <SelectItem value="demo">Request Demo</SelectItem>
                    <SelectItem value="call">Schedule Call</SelectItem>
                    <SelectItem value="information">Share Information</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tone">Tone *</Label>
                <Select
                  value={formData.tone}
                  onValueChange={(value) => updateFormData('tone', value as EmailTone)}
                >
                  <SelectTrigger id="tone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Target Criteria */}
            <div className="space-y-4 pt-2 border-t border-border">
              <h3 className="text-sm font-semibold text-foreground">Target Audience</h3>

              <div className="space-y-2">
                <Label htmlFor="job_titles">Job Titles</Label>
                <Input
                  id="job_titles"
                  value={formData.target_criteria.job_titles}
                  onChange={(e) =>
                    updateFormData('target_criteria.job_titles', e.target.value)
                  }
                  placeholder="e.g., CTO, VP of Engineering, Head of Product"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated list of job titles
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Input
                    id="industry"
                    value={formData.target_criteria.industry}
                    onChange={(e) =>
                      updateFormData('target_criteria.industry', e.target.value)
                    }
                    placeholder="e.g., Technology, SaaS"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    id="location"
                    value={formData.target_criteria.location}
                    onChange={(e) =>
                      updateFormData('target_criteria.location', e.target.value)
                    }
                    placeholder="e.g., United States, Remote"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company_size">Company Size</Label>
                <Input
                  id="company_size"
                  value={formData.target_criteria.company_size}
                  onChange={(e) =>
                    updateFormData('target_criteria.company_size', e.target.value)
                  }
                  placeholder="e.g., 50-200, 500+"
                />
              </div>
            </div>

            {/* Custom Prompt */}
            <div className="space-y-2 pt-2 border-t border-border">
              <Label htmlFor="custom_prompt">Custom Instructions (Optional)</Label>
              <Textarea
                id="custom_prompt"
                value={formData.custom_prompt}
                onChange={(e) => updateFormData('custom_prompt', e.target.value)}
                placeholder="Add any specific instructions for email generation..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                These instructions will guide the AI in generating personalized emails
              </p>
            </div>

            {/* Current Status */}
            {campaign && (
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Badge
                  variant={
                    campaign.status === 'active'
                      ? 'default'
                      : campaign.status === 'draft'
                      ? 'secondary'
                      : 'outline'
                  }
                  className="capitalize"
                >
                  {campaign.status}
                </Badge>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading || !formData.name}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
