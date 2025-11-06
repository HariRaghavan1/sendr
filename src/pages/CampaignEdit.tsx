import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

type EmailTone = Database['public']['Enums']['email_tone'];
type EmailGoal = Database['public']['Enums']['email_goal'];

interface TargetCriteria {
  industry: string;
  location: string;
  job_titles: string;
}

interface FrequencyConfig {
  type: string;
  time: string;
  batch_size: number;
}

export default function CampaignEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    target_criteria: {
      industry: "",
      location: "",
      job_titles: "",
    } as TargetCriteria,
    tone: "casual" as EmailTone,
    goal: "meeting" as EmailGoal,
    custom_prompt: "",
    frequency_type: "daily",
    frequency_time: "09:00",
    batch_size: 25,
  });

  useEffect(() => {
    if (id) {
      loadCampaign(id);
    }
  }, [id]);

  const loadCampaign = async (campaignId: string) => {
    try {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("id", campaignId)
        .single();

      if (error) throw error;

      if (data) {
        const criteria = (data.target_criteria as any) || {
          industry: "",
          location: "",
          job_titles: "",
        };
        const freqConfig = (data.frequency_config as any) || {
          type: "daily",
          time: "09:00",
          batch_size: 25,
        };

        setFormData({
          name: data.name,
          target_criteria: criteria,
          tone: data.tone,
          goal: data.goal,
          custom_prompt: data.custom_prompt || "",
          frequency_type: freqConfig.type,
          frequency_time: freqConfig.time,
          batch_size: freqConfig.batch_size,
        });
      }
    } catch (error) {
      console.error("Error loading campaign:", error);
      toast.error("Failed to load campaign");
      navigate("/workflows");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in to edit a campaign");
      setSaving(false);
      return;
    }

    const frequencyConfig: FrequencyConfig = {
      type: formData.frequency_type,
      time: formData.frequency_time,
      batch_size: formData.batch_size,
    };

    const { error } = await supabase
      .from("campaigns")
      .update({
        name: formData.name,
        target_criteria: formData.target_criteria as any,
        tone: formData.tone,
        goal: formData.goal,
        custom_prompt: formData.custom_prompt,
        frequency_config: frequencyConfig as any,
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      toast.error("Failed to update campaign");
      console.error(error);
    } else {
      toast.success("Campaign updated successfully!");
      navigate(`/campaigns/${id}`);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate(`/campaigns/${id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Campaign
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Edit Campaign</h1>
          <p className="text-muted-foreground">Update your campaign settings</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Details</CardTitle>
              <CardDescription>Update your campaign name and target</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Campaign Name</Label>
                <Input
                  id="name"
                  placeholder="Q1 2025 Outreach"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="industry">Target Industry</Label>
                <Input
                  id="industry"
                  placeholder="SaaS, Fintech, Healthcare..."
                  value={formData.target_criteria.industry}
                  onChange={(e) => setFormData({
                    ...formData,
                    target_criteria: { ...formData.target_criteria, industry: e.target.value }
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="California, New York, Remote..."
                  value={formData.target_criteria.location}
                  onChange={(e) => setFormData({
                    ...formData,
                    target_criteria: { ...formData.target_criteria, location: e.target.value }
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="job_titles">Job Titles</Label>
                <Input
                  id="job_titles"
                  placeholder="CEO, Founder, VP of Sales..."
                  value={formData.target_criteria.job_titles}
                  onChange={(e) => setFormData({
                    ...formData,
                    target_criteria: { ...formData.target_criteria, job_titles: e.target.value }
                  })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email Settings</CardTitle>
              <CardDescription>Configure how Sendr writes your emails</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tone">Email Tone</Label>
                  <Select value={formData.tone} onValueChange={(value) => setFormData({ ...formData, tone: value as EmailTone })}>
                    <SelectTrigger id="tone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="formal">Formal</SelectItem>
                      <SelectItem value="casual">Casual</SelectItem>
                      <SelectItem value="witty">Witty</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="goal">Email Goal</Label>
                  <Select value={formData.goal} onValueChange={(value) => setFormData({ ...formData, goal: value as EmailGoal })}>
                    <SelectTrigger id="goal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="demo">Book Demo</SelectItem>
                      <SelectItem value="meeting">Schedule Meeting</SelectItem>
                      <SelectItem value="partnership">Explore Partnership</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="custom_prompt">Custom Instructions (Optional)</Label>
                <Textarea
                  id="custom_prompt"
                  placeholder="Add any specific instructions for email generation..."
                  value={formData.custom_prompt}
                  onChange={(e) => setFormData({ ...formData, custom_prompt: e.target.value })}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Schedule & Frequency</CardTitle>
              <CardDescription>When and how often to send emails</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="frequency_type">Frequency</Label>
                  <Select value={formData.frequency_type} onValueChange={(value) => setFormData({ ...formData, frequency_type: value })}>
                    <SelectTrigger id="frequency_type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Every Hour</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="frequency_time">Time</Label>
                  <Input
                    id="frequency_time"
                    type="time"
                    value={formData.frequency_time}
                    onChange={(e) => setFormData({ ...formData, frequency_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="batch_size">Batch Size (emails per run)</Label>
                <Input
                  id="batch_size"
                  type="number"
                  min="1"
                  max="100"
                  value={formData.batch_size}
                  onChange={(e) => setFormData({ ...formData, batch_size: parseInt(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">
                  How many emails to send each time the campaign runs (max 100)
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" size="lg" className="flex-1" disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => navigate(`/campaigns/${id}`)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
