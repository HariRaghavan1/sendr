import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./components/AppSidebar";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ErrorBoundary } from "./components/ErrorBoundary";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import CampaignCreate from "./pages/CampaignCreate";
import CampaignEdit from "./pages/CampaignEdit";
import ConversationView from "./pages/ConversationView";
import CampaignDetail from "./pages/CampaignDetail";
import Workflows from "./pages/Workflows";
import NotFound from "./pages/NotFound";
import { toast } from "sonner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
    },
    mutations: {
      retry: 1,
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'An error occurred');
      },
    },
  },
});

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

// Wrapper component for protected routes with sidebar layout
function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <LayoutWithSidebar>
        <ProtectedRoute>{children}</ProtectedRoute>
      </LayoutWithSidebar>
    </SidebarProvider>
  );
}

// Wrapper component for public routes with sidebar layout
function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <LayoutWithSidebar>
        {children}
      </LayoutWithSidebar>
    </SidebarProvider>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<PublicLayout><Navigate to="/dashboard" replace /></PublicLayout>} />
            <Route path="/dashboard" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
            <Route path="/workflows" element={<ProtectedLayout><Workflows /></ProtectedLayout>} />
            <Route path="/settings" element={<ProtectedLayout><Settings /></ProtectedLayout>} />
            <Route path="/campaigns/new" element={<ProtectedLayout><CampaignCreate /></ProtectedLayout>} />
            <Route path="/campaigns/:id/edit" element={<ProtectedLayout><CampaignEdit /></ProtectedLayout>} />
            <Route path="/campaigns/ai-create" element={<ProtectedLayout><ConversationView /></ProtectedLayout>} />
            <Route path="/campaigns/ai-create/:conversationId" element={<ProtectedLayout><ConversationView /></ProtectedLayout>} />
            <Route path="/campaigns/:id" element={<ProtectedLayout><CampaignDetail /></ProtectedLayout>} />
            <Route path="*" element={<PublicLayout><NotFound /></PublicLayout>} />
          </Routes>
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
