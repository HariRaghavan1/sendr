import { Header } from "@/components/Header";
import { MetricCard } from "@/components/MetricCard";
import { DonutChart } from "@/components/DonutChart";
import { ExpensesChart } from "@/components/ExpensesChart";
import { AccountOverview } from "@/components/AccountOverview";
import { AnalyticsChart } from "@/components/AnalyticsChart";
import { ProfileCard } from "@/components/ProfileCard";
import { ChevronDown } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-5 tracking-tight">Main Dashboard</h1>
            <div className="flex items-center gap-8 border-b border-border/50">
              <button className="pb-3 text-foreground font-medium border-b-2 border-primary text-sm transition-all">
                Overview
              </button>
              <button className="pb-3 text-muted-foreground/70 hover:text-foreground hover:border-b-2 hover:border-muted transition-all text-sm">
                Account
              </button>
              <button className="pb-3 text-muted-foreground/70 hover:text-foreground hover:border-b-2 hover:border-muted transition-all text-sm">
                Services
              </button>
              <button className="pb-3 text-muted-foreground/70 hover:text-foreground hover:border-b-2 hover:border-muted transition-all text-sm">
                Payments
              </button>
            </div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-card border border-border/60 hover:bg-muted hover:border-border transition-all duration-200 text-sm">
            <span className="text-foreground font-medium">Manage</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-6">
          <div className="col-span-3 space-y-6">
            <div className="grid grid-cols-3 gap-6">
              <MetricCard amount="$1872.75" label="Outgoing" trend="up" />
              <MetricCard amount="$890.50" label="Incoming" trend="down" />
              <MetricCard amount="$780.50" label="Today" progress={780.50} />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <DonutChart />
              <ExpensesChart />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <AccountOverview />
              <AnalyticsChart />
            </div>
          </div>

          <div className="col-span-1">
            <ProfileCard />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
