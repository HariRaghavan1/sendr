import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Play, Pause, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<any>(null);
  const [prospects, setProspects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCampaign();
    loadProspects();
  }, [id]);

  const loadCampaign = async () => {
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      toast.error("Failed to load campaign");
      navigate("/dashboard");
    } else {
      setCampaign(data);
    }
    setLoading(false);
  };

  const loadProspects = async () => {
    const { data, error } = await supabase
      .from("prospects")
      .select("*")
      .eq("campaign_id", id)
      .order("created_at", { ascending: false });

    if (!error) {
      setProspects(data || []);
    }
  };

  const toggleStatus = async () => {
    const newStatus = campaign.status === "active" ? "paused" : "active";
    const { error } = await supabase
      .from("campaigns")
      .update({ status: newStatus })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update campaign");
    } else {
      toast.success(`Campaign ${newStatus === "active" ? "activated" : "paused"}`);
      loadCampaign();
    }
  };

  const deleteCampaign = async () => {
    if (!confirm("Are you sure you want to delete this campaign? This cannot be undone.")) {
      return;
    }

    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete campaign");
    } else {
      toast.success("Campaign deleted");
      navigate("/dashboard");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!campaign) return null;

  const replyRate = campaign.total_sent > 0 
    ? ((campaign.total_replied / campaign.total_sent) * 100).toFixed(1)
    : "0.0";

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

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold">{campaign.name}</h1>
              <Badge>{campaign.status}</Badge>
            </div>
            <p className="text-muted-foreground">
              {campaign.tone} tone • {campaign.goal} goal
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={toggleStatus}>
              {campaign.status === "active" ? (
                <>
                  <Pause className="mr-2 h-4 w-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Activate
                </>
              )}
            </Button>
            <Button variant="destructive" onClick={deleteCampaign}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sent</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{campaign.total_sent}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Opened</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{campaign.total_opened}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Replied</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{campaign.total_replied}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Reply Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{replyRate}%</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Campaign Configuration</CardTitle>
            <CardDescription>Settings and target criteria</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Target Criteria</h3>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-muted-foreground">Industry</dt>
                  <dd className="font-medium">{campaign.target_criteria.industry || "Not specified"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Location</dt>
                  <dd className="font-medium">{campaign.target_criteria.location || "Not specified"}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Job Titles</dt>
                  <dd className="font-medium">{campaign.target_criteria.job_titles || "Not specified"}</dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Schedule</h3>
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-muted-foreground">Frequency</dt>
                  <dd className="font-medium capitalize">{campaign.frequency_config.type}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Time</dt>
                  <dd className="font-medium">{campaign.frequency_config.time}</dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Batch Size</dt>
                  <dd className="font-medium">{campaign.frequency_config.batch_size} emails</dd>
                </div>
              </dl>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Prospects ({prospects.length})</CardTitle>
            <CardDescription>Leads being contacted in this campaign</CardDescription>
          </CardHeader>
          <CardContent>
            {prospects.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No prospects yet. They will appear here when the campaign runs.
              </p>
            ) : (
              <div className="space-y-2">
                {prospects.map((prospect) => (
                  <div key={prospect.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{prospect.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {prospect.title} at {prospect.company}
                      </p>
                    </div>
                    <Badge variant="outline">{prospect.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
