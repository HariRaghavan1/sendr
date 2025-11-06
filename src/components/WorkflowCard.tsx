import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Edit, Play, Rocket, Target, Mail, Search, Clock, FileText, ChevronDown } from "lucide-react";
import { useState } from "react";

interface WorkflowStep {
  action: "find_prospects" | "generate_email" | "send_email";
  description: string;
}

interface WorkflowData {
  id?: string;
  name: string;
  description?: string;
  goal: "meeting" | "demo" | "call" | "information";
  target_criteria: {
    job_titles?: string[];
    industry?: string;
    location?: string;
    company_size?: string;
  };
  tone: "professional" | "casual";
  instructions?: string;
  schedule?: {
    frequency: "daily" | "weekly" | "monthly";
    time: string;
    batch_size: number;
  };
  steps: WorkflowStep[];
}

interface WorkflowCardProps {
  workflow: WorkflowData;
  onEdit?: () => void;
  onTestRun?: () => void;
  onDeploy?: () => void;
}

const getStepIcon = (action: WorkflowStep["action"]) => {
  switch (action) {
    case "find_prospects":
      return <Search className="h-4 w-4" />;
    case "generate_email":
      return <Edit className="h-4 w-4" />;
    case "send_email":
      return <Mail className="h-4 w-4" />;
  }
};

const getGoalBadge = (goal: WorkflowData["goal"]) => {
  const variants = {
    meeting: "default",
    demo: "secondary",
    call: "outline",
    information: "outline",
  } as const;
  
  return (
    <Badge variant={variants[goal]} className="capitalize">
      {goal}
    </Badge>
  );
};

export function WorkflowCard({ workflow, onEdit, onTestRun, onDeploy }: WorkflowCardProps) {
  const [instructionsExpanded, setInstructionsExpanded] = useState(false);
  
  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-background to-muted/20">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle className="text-xl">{workflow.name}</CardTitle>
          </div>
          {getGoalBadge(workflow.goal)}
        </div>
        {workflow.description && (
          <p className="text-sm text-muted-foreground mt-2">{workflow.description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Schedule Section */}
        {workflow.schedule && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Schedule
            </h4>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="secondary" className="capitalize">
                {workflow.schedule.frequency}
              </Badge>
              <span className="text-sm text-muted-foreground">
                at {workflow.schedule.time}
              </span>
              <span className="text-sm text-muted-foreground">
                • {workflow.schedule.batch_size} prospects per run
              </span>
            </div>
          </div>
        )}
        {/* Target Audience */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-muted-foreground">Target Audience</h4>
          <div className="space-y-1">
            {workflow.target_criteria.job_titles && workflow.target_criteria.job_titles.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm">•</span>
                <span className="text-sm">{workflow.target_criteria.job_titles.join(", ")}</span>
              </div>
            )}
            {workflow.target_criteria.industry && (
              <div className="flex items-center gap-2">
                <span className="text-sm">•</span>
                <span className="text-sm">{workflow.target_criteria.industry}</span>
              </div>
            )}
            {workflow.target_criteria.location && (
              <div className="flex items-center gap-2">
                <span className="text-sm">•</span>
                <span className="text-sm">{workflow.target_criteria.location}</span>
              </div>
            )}
            {workflow.target_criteria.company_size && (
              <div className="flex items-center gap-2">
                <span className="text-sm">•</span>
                <span className="text-sm">{workflow.target_criteria.company_size} employees</span>
              </div>
            )}
          </div>
        </div>

        {/* Campaign Steps */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-muted-foreground">Campaign Steps</h4>
          <div className="space-y-2">
            {workflow.steps.map((step, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary flex-shrink-0">
                  {getStepIcon(step.action)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium capitalize">
                    {index + 1}. {step.action.replace(/_/g, " ")}
                  </p>
                  {step.description && (
                    <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions/Mega-prompt Section */}
        {workflow.instructions && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Campaign Instructions
            </h4>
            <Collapsible open={instructionsExpanded} onOpenChange={setInstructionsExpanded}>
              <div className="bg-muted/30 rounded-lg p-3">
                <CollapsibleContent className="space-y-2">
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {workflow.instructions}
                  </p>
                </CollapsibleContent>
                {!instructionsExpanded && (
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {workflow.instructions}
                  </p>
                )}
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full mt-2 h-8">
                    <ChevronDown className={`h-4 w-4 mr-2 transition-transform ${instructionsExpanded ? 'rotate-180' : ''}`} />
                    {instructionsExpanded ? 'Show less' : 'Show more'}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </Collapsible>
          </div>
        )}

        {/* Email Template Status */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Email Generation
          </h4>
          <div className="bg-muted/30 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">AI will generate emails</span> unless you upload your own template.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Click "Edit Template" below to use a custom email template instead.
            </p>
          </div>
        </div>

        {/* Details */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Tone: <span className="font-medium capitalize text-foreground">{workflow.tone}</span></span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-4 border-t">
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <FileText className="h-4 w-4 mr-2" />
              Edit Template
            </Button>
          )}
          {onTestRun && (
            <Button variant="secondary" size="sm" onClick={onTestRun}>
              <Play className="h-4 w-4 mr-2" />
              Test Run
            </Button>
          )}
          {onDeploy && (
            <Button variant="default" size="sm" onClick={onDeploy}>
              <Rocket className="h-4 w-4 mr-2" />
              Deploy
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
