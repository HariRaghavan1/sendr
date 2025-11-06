import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";

const data = [
  { date: "18 JAN", value: 420, color: "hsl(var(--secondary))" },
  { date: "17 JAN", value: 780, tooltip: "136.5", color: "hsl(var(--secondary))" },
  { date: "16 JAN", value: 680, color: "hsl(var(--secondary))" },
  { date: "15 JAN", value: 240, color: "hsl(var(--primary))" },
  { date: "14 JAN", value: 850, color: "hsl(var(--primary))" },
  { date: "13 JAN", value: 720, color: "hsl(var(--secondary))" },
  { date: "12 JAN", value: 0, color: "transparent" }
];

export const AccountOverview = () => {
  return (
    <Card className="bg-card border-border p-6 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-semibold text-foreground mb-1">Account Overview</h3>
          <p className="text-xs text-muted-foreground/60">Jan 12 - Jan 18, 2024</p>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 60, bottom: 5 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
            <Bar dataKey="value" radius={[0, 8, 8, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
