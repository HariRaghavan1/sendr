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
    <Card className="bg-card border-border p-6 hover:border-primary/30 transition-all duration-300 group">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            {trend === "up" && (
              <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <ArrowUp className="w-4 h-4 text-primary" />
              </div>
            )}
            {trend === "down" && (
              <div className="p-1.5 rounded-lg bg-secondary/10 group-hover:bg-secondary/20 transition-colors">
                <ArrowDown className="w-4 h-4 text-secondary" />
              </div>
            )}
            <span className="text-2xl font-semibold text-foreground tracking-tight">{amount}</span>
          </div>
          <p className="text-sm text-muted-foreground/80">{label}</p>
        </div>
        {!trend && (
          <TrendingUp className="w-5 h-5 text-muted-foreground/60" />
        )}
      </div>
      
      {progress !== undefined && (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground/70">Today</span>
            <span className="text-foreground font-medium tabular-nums">${progress.toFixed(2)}</span>
          </div>
          <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary via-primary/90 to-secondary rounded-full transition-all duration-500"
              style={{ width: `${(progress / 1000) * 100}%` }}
            />
          </div>
        </div>
      )}
    </Card>
  );
};
