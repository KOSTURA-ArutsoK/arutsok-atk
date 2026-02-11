import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Subjects from "@/pages/Subjects";
import Companies from "@/pages/Companies";
import { AppShell } from "@/components/layout/AppShell";

function PrivateRoute({ component: Component, ...rest }: any) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <AppShell>
      <Component />
    </AppShell>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/api/login" component={() => {
        window.location.href = "/api/login";
        return null;
      }} />
      
      <Route path="/" component={() => <PrivateRoute component={Dashboard} />} />
      <Route path="/subjects" component={() => <PrivateRoute component={Subjects} />} />
      <Route path="/companies" component={() => <PrivateRoute component={Companies} />} />
      
      {/* Placeholder for routes not yet implemented but in nav */}
      <Route path="/partners" component={() => <PrivateRoute component={() => <div>Partners Module - Coming Soon</div>} />} />
      <Route path="/hierarchy" component={() => <PrivateRoute component={() => <div>Hierarchy Module - Coming Soon</div>} />} />
      <Route path="/settings" component={() => <PrivateRoute component={() => <div>System Settings - Coming Soon</div>} />} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
