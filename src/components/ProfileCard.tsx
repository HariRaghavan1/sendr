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
    <Card className="bg-card border-border p-6 space-y-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-foreground">James Martinia Junior</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Verified Account</span>
          <CheckCircle2 className="w-4 h-4 text-primary" />
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

      <Card className="bg-background border-border p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-6 rounded bg-gradient-to-r from-secondary to-primary"></div>
            <div className="w-8 h-6 rounded-full bg-primary"></div>
          </div>
          <button className="p-1 hover:bg-muted rounded transition-colors">
            <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-1 mb-4">
          <p className="text-2xl font-bold text-foreground">$ 6421.50</p>
          <p className="text-sm text-muted-foreground">Balance</p>
        </div>

        <div className="flex gap-1 text-muted-foreground font-mono text-sm">
          <span>••••</span>
          <span>••••</span>
          <span>••••</span>
          <span className="text-foreground">3667</span>
        </div>
      </Card>

      <Card className="bg-background border-border p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Earnings</span>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-xs font-bold text-primary-foreground">P</span>
          </div>
        </div>

        <p className="text-2xl font-bold text-foreground mb-4">$894.39</p>

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
