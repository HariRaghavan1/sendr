import { Card } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

const data = [
  { name: "Received", value: 85.50 },
  { name: "Remaining", value: 14.50 }
];

const COLORS = ["hsl(var(--secondary))", "hsl(var(--primary))"];

export const DonutChart = () => {
  return (
    <Card className="bg-card border-border p-6 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
      <div className="mb-6">
        <h3 className="text-base font-semibold text-foreground mb-1.5">Designers Group UK</h3>
        <p className="text-sm text-muted-foreground/70">Weekly Pay • 5 days left</p>
      </div>

      <div className="flex items-center justify-between">
        <div className="relative w-32 h-32">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={60}
                startAngle={180}
                endAngle={-180}
                dataKey="value"
              >
                {data.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center flex-col">
            <span className="text-xl font-bold text-foreground">${data[0].value}</span>
            <span className="text-xs text-muted-foreground">Received</span>
          </div>
        </div>

        <div className="flex-1 ml-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-secondary"></span>
              <span className="text-muted-foreground">Bit</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              <span className="text-muted-foreground">MC</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-chart-3"></span>
              <span className="text-muted-foreground">PP</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-chart-5"></span>
              <span className="text-muted-foreground">CO</span>
            </div>
          </div>
          <button className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors">
            <TrendingUp className="w-4 h-4 text-foreground" />
          </button>
        </div>
      </div>
    </Card>
  );
};
