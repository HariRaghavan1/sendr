import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Target } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { CampaignCardSkeleton, CampaignListSkeleton } from "@/components/CampaignCardSkeleton";

type Campaign = Database['public']['Tables']['campaigns']['Row'];

export default function Dashboard() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState({
    totalCampaigns: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      // Load recent campaigns
      const { data: recentCampaigns, error: campaignsError } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      if (campaignsError) throw campaignsError;

      // Load stats efficiently with separate queries
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get total count
      const { count: totalCount, error: totalError } = await supabase
        .from("campaigns")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", user.id);

      if (totalError) throw totalError;

      const campaigns = recentCampaigns || [];
      setCampaigns(campaigns);

      setStats({
        totalCampaigns: totalCount || 0,
      });
    } catch (error) {
      console.error("Error loading dashboard:", error);
      toast.error("Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                Overview of your outreach campaigns
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-1">
            <CampaignCardSkeleton />
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Campaigns</CardTitle>
                  <CardDescription>Your latest outreach workflows</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <CampaignListSkeleton />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Overview of your outreach campaigns
            </p>
          </div>
          <Button
            onClick={() => navigate("/campaigns/ai-create")}
            size="lg"
            aria-label="Create new campaign with AI assistant"
            className="w-full sm:w-auto"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Create Campaign
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-1">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCampaigns}</div>
              <p className="text-xs text-muted-foreground mt-1">
                All campaigns
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Campaigns</CardTitle>
                <CardDescription>Your latest outreach workflows</CardDescription>
              </div>
              <Button variant="outline" onClick={() => navigate("/workflows")}>
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {campaigns.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="No campaigns yet"
                description="Create your first campaign to start reaching out to prospects with AI-powered personalization"
                actionLabel="Create Campaign"
                onAction={() => navigate("/campaigns/ai-create")}
              />
            ) : (
              <div className="space-y-3">
                {campaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    onClick={() => navigate(`/campaigns/${campaign.id}`)}
                    className="flex items-center justify-between p-4 rounded-lg border hover:border-primary/50 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Target className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate group-hover:text-primary transition-colors">
                          {campaign.name}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {campaign.tone} • {campaign.goal}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="font-bold">{campaign.total_sent || 0}</p>
                        <p className="text-muted-foreground text-xs">Sent</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold">{campaign.total_replied || 0}</p>
                        <p className="text-muted-foreground text-xs">Replied</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        campaign.status === "active"
                          ? "bg-green-500/10 text-green-500"
                          : campaign.status === "paused"
                          ? "bg-yellow-500/10 text-yellow-500"
                          : "bg-gray-500/10 text-gray-500"
                      }`}>
                        {campaign.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Get started with common tasks</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-1">
            <Button
              variant="outline"
              className="h-auto py-6 justify-start"
              onClick={() => navigate("/campaigns/ai-create")}
            >
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-primary/10 p-3">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <div className="text-left">
                  <div className="font-semibold">AI Campaign Builder</div>
                  <div className="text-sm text-muted-foreground">
                    Chat with AI to create campaigns
                  </div>
                </div>
              </div>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
