import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type EmailTone = Database['public']['Enums']['email_tone'];
type EmailGoal = Database['public']['Enums']['email_goal'];
type CampaignStatus = Database['public']['Enums']['campaign_status'];

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

export default function CampaignCreate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in to create a campaign");
      setLoading(false);
      return;
    }

    const frequencyConfig: FrequencyConfig = {
      type: formData.frequency_type,
      time: formData.frequency_time,
      batch_size: formData.batch_size,
    };

    const { data, error} = await supabase
      .from("campaigns")
      .insert([{
        user_id: user.id,
        name: formData.name,
        target_criteria: formData.target_criteria,
        tone: formData.tone,
        goal: formData.goal,
        custom_prompt: formData.custom_prompt,
        frequency_config: frequencyConfig,
        status: "draft" as CampaignStatus,
      }])
      .select()
      .single();

    if (error) {
      toast.error("Failed to create campaign");
      console.error(error);
    } else {
      toast.success("Campaign created successfully!");
      navigate(`/campaigns/${data.id}`);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Create New Campaign</h1>
          <p className="text-muted-foreground">Configure your campaign settings and launch</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Details</CardTitle>
              <CardDescription>Give your campaign a name and define your target</CardDescription>
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
              <CardDescription>Configure how Bork writes your emails</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tone">Email Tone</Label>
                  <Select value={formData.tone} onValueChange={(value) => setFormData({ ...formData, tone: value })}>
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
                  <Select value={formData.goal} onValueChange={(value) => setFormData({ ...formData, goal: value })}>
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

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Create Campaign"}
          </Button>
        </form>
      </main>
    </div>
  );
}
