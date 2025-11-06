import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Trash2, Mail, Eye, MessageSquare, TrendingUp, TestTube } from "lucide-react";
import { toast } from "sonner";
import { TestRunDialog } from "@/components/TestRunDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<any>(null);
  const [prospects, setProspects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [testDialogOpen, setTestDialogOpen] = useState(false);

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
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!campaign) return null;

  const replyRate = campaign.total_sent > 0 
    ? ((campaign.total_replied / campaign.total_sent) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold tracking-tight">{campaign.name}</h1>
              <Badge variant="outline" className={
                campaign.status === "active"
                  ? "bg-green-500/10 text-green-500 border-green-500/20"
                  : campaign.status === "paused"
                  ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                  : "bg-gray-500/10 text-gray-500 border-gray-500/20"
              }>
                {campaign.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {campaign.tone} tone • {campaign.goal} goal
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setTestDialogOpen(true)} variant="secondary">
              <TestTube className="mr-2 h-4 w-4" />
              Test Run
            </Button>
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

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{campaign.total_sent || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Opened</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{campaign.total_opened || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Replied</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{campaign.total_replied || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Reply Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{replyRate}%</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Target Criteria</CardTitle>
              <CardDescription>Who you're reaching out to</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Industry</p>
                <p className="font-medium">{campaign.target_criteria.industry || "Not specified"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="font-medium">{campaign.target_criteria.location || "Not specified"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Job Titles</p>
                <p className="font-medium">{campaign.target_criteria.job_titles || "Not specified"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Schedule Configuration</CardTitle>
              <CardDescription>When emails are sent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Frequency</p>
                <p className="font-medium capitalize">{campaign.frequency_config.type}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Send Time</p>
                <p className="font-medium">{campaign.frequency_config.time}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Batch Size</p>
                <p className="font-medium">{campaign.frequency_config.batch_size} emails per batch</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Prospects ({prospects.length})</CardTitle>
            <CardDescription>Leads being contacted in this campaign</CardDescription>
          </CardHeader>
          <CardContent>
            {prospects.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No prospects yet. They will appear here when the campaign runs.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prospects.map((prospect) => (
                    <TableRow key={prospect.id}>
                      <TableCell className="font-medium">{prospect.name}</TableCell>
                      <TableCell>{prospect.title}</TableCell>
                      <TableCell>{prospect.company}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{prospect.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <TestRunDialog 
        open={testDialogOpen}
        onOpenChange={setTestDialogOpen}
        campaignId={id!}
      />
    </div>
  );
}
