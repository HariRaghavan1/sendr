import { ArrowUp, ArrowDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";

interface MetricCardProps {
  amount: string;
  label: string;
  trend?: "up" | "down";
  progress?: number;
}

export const MetricCard = ({ amount, label, trend, progress }: MetricCardProps) => {
  return (
    <Card className="bg-card border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {trend === "up" && (
              <div className="p-1 rounded bg-primary/20">
                <ArrowUp className="w-4 h-4 text-primary" />
              </div>
            )}
            {trend === "down" && (
              <div className="p-1 rounded bg-secondary/20">
                <ArrowDown className="w-4 h-4 text-secondary" />
              </div>
            )}
            <span className="text-2xl font-bold text-foreground">{amount}</span>
          </div>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
        {!trend && (
          <TrendingUp className="w-5 h-5 text-muted-foreground" />
        )}
      </div>
      
      {progress !== undefined && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Today</span>
            <span className="text-foreground font-medium">${progress.toFixed(2)}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all"
              style={{ width: `${(progress / 1000) * 100}%` }}
            />
          </div>
        </div>
      )}
    </Card>
  );
};
