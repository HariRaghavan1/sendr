import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Mail } from "lucide-react";

interface TemplateComponents {
  background_research?: string;
  opening_hook?: string;
  value_proposition?: string;
  personalization_strategy?: string;
  call_to_action?: string;
  tone_guidelines?: string;
}

interface TemplateData {
  id?: string;
  name: string;
  subject: string;
  body: string;
  components?: TemplateComponents;
}

interface TemplateCardProps {
  template: TemplateData;
}

export function TemplateCard({ template }: TemplateCardProps) {
  return (
    <Card className="border-2 border-accent/20 bg-gradient-to-br from-background to-accent/5">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-accent" />
            <CardTitle className="text-lg">{template.name}</CardTitle>
          </div>
          <Badge variant="secondary">Template</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Subject & Body Preview */}
        <div className="space-y-2">
          <div>
            <h4 className="font-semibold text-sm text-muted-foreground mb-1">Subject</h4>
            <p className="text-sm bg-muted/30 rounded p-2">{template.subject}</p>
          </div>
          <div>
            <h4 className="font-semibold text-sm text-muted-foreground mb-1">Body Preview</h4>
            <p className="text-sm bg-muted/30 rounded p-2 whitespace-pre-wrap line-clamp-3">
              {template.body}
            </p>
          </div>
        </div>

        {/* Template Components */}
        {template.components && Object.keys(template.components).length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Template Components
            </h4>
            <div className="space-y-2">
              {template.components.background_research && (
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-xs font-medium text-muted-foreground">Background Research:</span>
                  <p className="text-sm mt-1">{template.components.background_research}</p>
                </div>
              )}
              {template.components.opening_hook && (
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-xs font-medium text-muted-foreground">Opening Hook:</span>
                  <p className="text-sm mt-1">{template.components.opening_hook}</p>
                </div>
              )}
              {template.components.value_proposition && (
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-xs font-medium text-muted-foreground">Value Proposition:</span>
                  <p className="text-sm mt-1">{template.components.value_proposition}</p>
                </div>
              )}
              {template.components.personalization_strategy && (
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-xs font-medium text-muted-foreground">Personalization:</span>
                  <p className="text-sm mt-1">{template.components.personalization_strategy}</p>
                </div>
              )}
              {template.components.call_to_action && (
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-xs font-medium text-muted-foreground">Call to Action:</span>
                  <p className="text-sm mt-1">{template.components.call_to_action}</p>
                </div>
              )}
              {template.components.tone_guidelines && (
                <div className="bg-muted/20 rounded p-2">
                  <span className="text-xs font-medium text-muted-foreground">Tone Guidelines:</span>
                  <p className="text-sm mt-1">{template.components.tone_guidelines}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
