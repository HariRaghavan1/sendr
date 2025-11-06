import { Card } from "@/components/ui/card";
import {
  ResponsiveContainer,
  Line,
  LineChart
} from "recharts";
import { MoreVertical } from "lucide-react";

const data = [
  { date: "23 March", value: 200 },
  { date: "21 August", value: 540, highlighted: true },
  { date: "25 March", value: 350 }
];

export const AnalyticsChart = () => {
  return (
    <Card className="bg-card border-border p-6 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-semibold text-foreground mb-1">Analytics</h3>
          <p className="text-xs text-muted-foreground/60">Peak day: Aug 21</p>
        </div>
        <button className="p-1 hover:bg-muted rounded transition-colors">
          <MoreVertical className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      <div className="h-64 flex items-end justify-center gap-12">
        {data.map((item, index) => (
          <div key={index} className="flex flex-col items-center gap-2">
            <div className="relative">
              {item.highlighted ? (
                <div className="w-24 h-48 bg-primary rounded-2xl flex items-start justify-center pt-4 relative">
                  <div className="absolute -top-8 left-0 right-0">
                    <div className="h-16">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={[
                          { value: 400 },
                          { value: 480 },
                          { value: 420 },
                          { value: 520 },
                          { value: 540 }
                        ]}>
                          <Line type="monotone" dataKey="value" stroke="hsl(var(--foreground))" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <span className="text-foreground font-semibold text-sm">${item.value}</span>
                </div>
              ) : (
                <div 
                  className="w-16 bg-gradient-to-t from-primary to-transparent rounded-t-xl"
                  style={{ height: `${item.value / 3}px` }}
                />
              )}
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{item.date}</span>
          </div>
        ))}
      </div>
    </Card>
  );
};
