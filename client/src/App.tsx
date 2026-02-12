import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { HelpProvider } from "@/contexts/help-context";
import { TTSProvider } from "@/contexts/tts-context";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Subjects from "@/pages/Subjects";
import Companies from "@/pages/Companies";
import Partners from "@/pages/Partners";
import Products from "@/pages/Products";
import Users from "@/pages/Users";
import PermissionGroups from "@/pages/PermissionGroups";
import History from "@/pages/History";
import Commissions from "@/pages/Commissions";
import Settings from "@/pages/Settings";
import Archive from "@/pages/Archive";
import ClientTypeRules from "@/pages/ClientTypeRules";
import RegisterPage from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ClientZone from "@/pages/ClientZone";
import Contracts from "@/pages/Contracts";
import ContractStatuses from "@/pages/ContractStatuses";
import ContractTemplates from "@/pages/ContractTemplates";
import ContractInventories from "@/pages/ContractInventories";
import ClientGroups from "@/pages/ClientGroups";
import PartnerContacts from "@/pages/PartnerContacts";
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

      <Route path="/register" component={RegisterPage} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/client-zone" component={ClientZone} />
      
      <Route path="/" component={() => <PrivateRoute component={Dashboard} />} />
      <Route path="/subjects" component={() => <PrivateRoute component={Subjects} />} />
      <Route path="/companies" component={() => <PrivateRoute component={Companies} />} />
      <Route path="/partners" component={() => <PrivateRoute component={Partners} />} />
      <Route path="/products" component={() => <PrivateRoute component={Products} />} />
      <Route path="/commissions" component={() => <PrivateRoute component={Commissions} />} />
      <Route path="/settings" component={() => <PrivateRoute component={Settings} />} />
      <Route path="/history" component={() => <PrivateRoute component={History} />} />
      <Route path="/users" component={() => <PrivateRoute component={Users} />} />
      <Route path="/permission-groups" component={() => <PrivateRoute component={PermissionGroups} />} />
      <Route path="/archive" component={() => <PrivateRoute component={Archive} />} />
      <Route path="/client-type-rules" component={() => <PrivateRoute component={ClientTypeRules} />} />
      <Route path="/contracts" component={() => <PrivateRoute component={Contracts} />} />
      <Route path="/contract-statuses" component={() => <PrivateRoute component={ContractStatuses} />} />
      <Route path="/contract-template-settings" component={() => <PrivateRoute component={ContractTemplates} />} />
      <Route path="/contract-template-management" component={() => <PrivateRoute component={ContractTemplates} />} />
      <Route path="/contract-inventories" component={() => <PrivateRoute component={ContractInventories} />} />
      <Route path="/client-groups" component={() => <PrivateRoute component={ClientGroups} />} />
      <Route path="/partner-contacts" component={() => <PrivateRoute component={PartnerContacts} />} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <HelpProvider>
          <TTSProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </TTSProvider>
        </HelpProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
