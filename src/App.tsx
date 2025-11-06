import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/AppSidebar";
import { ProtectedRoute } from "./components/ProtectedRoute";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import CampaignCreate from "./pages/CampaignCreate";
import CampaignAICreate from "./pages/CampaignAICreate";
import CampaignDetail from "./pages/CampaignDetail";
import Workflows from "./pages/Workflows";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function LayoutWithSidebar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full">
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center px-4">
            <SidebarTrigger className="-ml-1" />
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/*"
            element={
              <SidebarProvider>
                <LayoutWithSidebar>
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                    <Route path="/workflows" element={<ProtectedRoute><Workflows /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                    <Route path="/campaigns/new" element={<ProtectedRoute><CampaignCreate /></ProtectedRoute>} />
                    <Route path="/campaigns/ai-create" element={<ProtectedRoute><CampaignAICreate /></ProtectedRoute>} />
                    <Route path="/campaigns/:id" element={<ProtectedRoute><CampaignDetail /></ProtectedRoute>} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </LayoutWithSidebar>
              </SidebarProvider>
            }
          />
        </Routes>
      </TooltipProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
