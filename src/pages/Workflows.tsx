import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Play, Pause, Trash2, MoreHorizontal, Sparkles, LayoutGrid, Columns3 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkflowKanban } from "@/components/WorkflowKanban";
import type { Campaign } from "@/components/WorkflowKanban";
import { WorkflowEditDialog } from "@/components/WorkflowEditDialog";
import { WorkflowTemplates } from "@/components/WorkflowTemplates";

export default function Workflows() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filteredCampaigns, setFilteredCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<'grid' | 'kanban'>('kanban');
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    filterCampaigns();
  }, [searchQuery, statusFilter, campaigns]);

  const loadCampaigns = async () => {
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load campaigns");
    } else {
      setCampaigns(data || []);
    }
    setLoading(false);
  };

  const filterCampaigns = () => {
    let filtered = campaigns;

    if (searchQuery) {
      filtered = filtered.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((c) => c.status === statusFilter);
    }

    setFilteredCampaigns(filtered);
  };

  const toggleStatus = async (campaignId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";
    const { error } = await supabase
      .from("campaigns")
      .update({ status: newStatus })
      .eq("id", campaignId);

    if (error) {
      toast.error("Failed to update campaign");
    } else {
      toast.success(`Campaign ${newStatus === "active" ? "activated" : "paused"}`);
      loadCampaigns();
    }
  };

  const deleteCampaign = async (campaignId: string, campaignName: string) => {
    if (!confirm(`Delete "${campaignName}"? This cannot be undone.`)) return;

    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", campaignId);

    if (error) {
      toast.error("Failed to delete campaign");
    } else {
      toast.success("Campaign deleted");
      loadCampaigns();
    }
  };

  // Kanban-specific handlers
  const handleStatusChange = async (campaignId: string, newStatus: Campaign['status']) => {
    const { error } = await supabase
      .from("campaigns")
      .update({ status: newStatus })
      .eq("id", campaignId);

    if (error) {
      toast.error("Failed to update campaign");
    } else {
      toast.success(`Campaign moved to ${newStatus}`);
      loadCampaigns();
    }
  };

  const handleEdit = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    setEditDialogOpen(true);
  };

  const handleEditSave = () => {
    loadCampaigns();
  };

  const handleDuplicate = async (campaign: Campaign) => {
    const { data, error } = await supabase
      .from("campaigns")
      .insert({
        name: `${campaign.name} (Copy)`,
        goal: campaign.goal,
        tone: campaign.tone,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to duplicate campaign");
    } else {
      toast.success("Campaign duplicated");
      loadCampaigns();
    }
  };

  const handleDelete = (campaign: Campaign) => {
    deleteCampaign(campaign.id, campaign.name);
  };

  const handleTestRun = (campaign: Campaign) => {
    navigate(`/campaigns/${campaign.id}`);
  };

  const handleTemplateSelect = (campaignId: string) => {
    loadCampaigns();
    navigate(`/campaigns/${campaignId}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-500/10 text-green-500 border-green-500/20";
      case "paused": return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      case "completed": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "draft": return "bg-gray-500/10 text-gray-500 border-gray-500/20";
      default: return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8 overflow-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">All Workflows</h1>
            <p className="text-muted-foreground mt-1">
              Manage and monitor your campaign workflows
            </p>
          </div>
          <div className="flex gap-2">
            <WorkflowTemplates onTemplateSelect={handleTemplateSelect} />
            <Button variant="outline" onClick={() => navigate("/campaigns/ai-create")}>
              <Sparkles className="mr-2 h-4 w-4" />
              AI Create
            </Button>
            <Button onClick={() => navigate("/campaigns/new")}>
              <Plus className="mr-2 h-4 w-4" />
              New Campaign
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {viewMode === 'grid' && (
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* View Mode Toggle */}
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'grid' | 'kanban')}>
            <TabsList>
              <TabsTrigger value="kanban" className="gap-2">
                <Columns3 className="h-4 w-4" />
                Kanban
              </TabsTrigger>
              <TabsTrigger value="grid" className="gap-2">
                <LayoutGrid className="h-4 w-4" />
                Grid
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Kanban View */}
        {viewMode === 'kanban' ? (
          campaigns.length === 0 ? (
            <Card>
              <CardContent>
                <EmptyState
                  icon={Sparkles}
                  title="No campaigns yet"
                  description="Create your first campaign to start reaching out to prospects"
                  actionLabel="Create Campaign"
                  onAction={() => navigate("/campaigns/ai-create")}
                />
              </CardContent>
            </Card>
          ) : (
            <WorkflowKanban
              campaigns={searchQuery ? filteredCampaigns : campaigns}
              onStatusChange={handleStatusChange}
              onEdit={handleEdit}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
              onTestRun={handleTestRun}
              loading={loading}
            />
          )
        ) : (
          /* Grid View */
          filteredCampaigns.length === 0 ? (
            <Card>
              <CardContent>
                <EmptyState
                  icon={Sparkles}
                  title={campaigns.length === 0 ? "No campaigns yet" : "No campaigns found"}
                  description={
                    campaigns.length === 0
                      ? "Create your first campaign to start reaching out to prospects"
                      : "Try adjusting your search or filters"
                  }
                  actionLabel={campaigns.length === 0 ? "Create Campaign" : undefined}
                  onAction={campaigns.length === 0 ? () => navigate("/campaigns/ai-create") : undefined}
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredCampaigns.map((campaign) => (
                <Card
                  key={campaign.id}
                  className="hover:shadow-lg transition-all cursor-pointer group hover:border-primary/50"
                  onClick={() => navigate(`/campaigns/${campaign.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg line-clamp-1">
                          {campaign.name}
                        </CardTitle>
                        <CardDescription className="mt-1.5">
                          {campaign.tone} • {campaign.goal}
                        </CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStatus(campaign.id, campaign.status);
                            }}
                          >
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
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteCampaign(campaign.id, campaign.name);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <Badge className={getStatusColor(campaign.status)} variant="outline">
                      {campaign.status}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold">{campaign.total_sent || 0}</p>
                        <p className="text-xs text-muted-foreground">Sent</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{campaign.total_opened || 0}</p>
                        <p className="text-xs text-muted-foreground">Opened</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{campaign.total_replied || 0}</p>
                        <p className="text-xs text-muted-foreground">Replied</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )
        )}
      </div>

      {/* Edit Dialog */}
      <WorkflowEditDialog
        campaign={editingCampaign}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSave={handleEditSave}
      />
    </div>
  );
}
