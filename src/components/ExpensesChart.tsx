import { Card } from "@/components/ui/card";
import { ScatterChart, Scatter, XAxis, YAxis, ResponsiveContainer, Cell } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const data = [
  { x: 0, y: 8, value: 120 },
  { x: 1, y: 12, value: 80 },
  { x: 2, y: 15, value: 150 },
  { x: 3, y: 20, value: 200 },
  { x: 4, y: 18, value: 180 },
  { x: 5, y: 25, value: 250 },
  { x: 6, y: 22, value: 220 },
  { x: 7, y: 28, value: 300 },
  { x: 8, y: 32, value: 280 },
  { x: 9, y: 30, value: 320 },
  { x: 10, y: 35, value: 350 },
  { x: 11, y: 38, value: 400 },
  { x: 12, y: 42, value: 420 },
  { x: 13, y: 45, value: 450 },
  { x: 14, y: 48, value: 380 },
];

const COLORS = ["hsl(var(--secondary))", "hsl(var(--primary))", "hsl(var(--chart-5))"];

export const ExpensesChart = () => {
  return (
    <Card className="bg-card border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">My Expenses</h3>
        <Select defaultValue="week">
          <SelectTrigger className="w-28 bg-background border-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Week</SelectItem>
            <SelectItem value="month">Month</SelectItem>
            <SelectItem value="year">Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
            <XAxis type="number" dataKey="x" hide />
            <YAxis type="number" dataKey="y" hide />
            <Scatter data={data} fill="hsl(var(--primary))">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
