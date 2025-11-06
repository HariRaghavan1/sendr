import { Card } from "@/components/ui/card";
import { CheckCircle2, MoreHorizontal } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";

const earningsData = [
  { value: 650 },
  { value: 720 },
  { value: 680 },
  { value: 780 },
  { value: 850 },
  { value: 820 },
  { value: 894 }
];

export const ProfileCard = () => {
  return (
    <Card className="bg-card border-border p-6 space-y-6 sticky top-8">
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-foreground leading-tight">James Martinia Junior</h2>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground/70">Verified Account</span>
          <CheckCircle2 className="w-4 h-4 text-primary animate-pulse" />
        </div>

        <div className="grid grid-cols-3 gap-4 pt-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Income</p>
            <p className="text-lg font-bold text-foreground">$9k</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Expences</p>
            <p className="text-lg font-bold text-foreground">$4k</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Points</p>
            <p className="text-lg font-bold text-foreground">98</p>
          </div>
        </div>
      </div>

      <Card className="bg-gradient-to-br from-background to-background/50 border-border p-5 hover:shadow-md transition-all duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-7 rounded-md bg-gradient-to-r from-secondary to-primary shadow-sm"></div>
            <div className="w-10 h-7 rounded-full bg-primary/90 shadow-sm"></div>
          </div>
          <button className="p-1.5 hover:bg-muted/60 rounded-md transition-colors">
            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-1.5 mb-5">
          <p className="text-2xl font-bold text-foreground tabular-nums tracking-tight">$ 6,421.50</p>
          <p className="text-xs text-muted-foreground/70">Balance • Updated 1m ago</p>
        </div>

        <div className="flex gap-2 text-muted-foreground/60 font-mono text-sm tracking-wider">
          <span>••••</span>
          <span>••••</span>
          <span>••••</span>
          <span className="text-foreground/90 font-semibold">3667</span>
        </div>
      </Card>

      <Card className="bg-gradient-to-br from-background to-background/50 border-border p-5 hover:shadow-md transition-all duration-300">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-xs text-muted-foreground/70 uppercase tracking-wide">Earnings</span>
            <p className="text-xs text-muted-foreground/50 mt-0.5">This week</p>
          </div>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm">
            <span className="text-sm font-bold text-primary-foreground">P</span>
          </div>
        </div>

        <p className="text-2xl font-bold text-foreground tabular-nums tracking-tight mb-4">$894.39</p>

        <div className="h-24 mb-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={earningsData}>
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2} 
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span className="text-foreground font-medium">Thu</span>
          <span>Fri</span>
          <span>Sat</span>
          <span>Sun</span>
        </div>
      </Card>
    </Card>
  );
};
