import { useAppUser } from "@/hooks/use-app-user";
import { useMyCompanies } from "@/hooks/use-companies";
import { useStates } from "@/hooks/use-hierarchy";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/hooks/use-auth";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { data: appUser } = useAppUser();
  const { data: companies } = useMyCompanies();
  const { data: allStates } = useStates();
  const { theme, toggleTheme } = useTheme();

  const activeCompany = companies?.find(c => c.id === appUser?.activeCompanyId);
  const activeState = allStates?.find(s => s.id === appUser?.activeStateId);

  const displayName = appUser
    ? `${appUser.firstName || ""} ${appUser.lastName || ""}`.trim() || appUser.username
    : user?.firstName || "Pouzivatel";

  const initials = appUser
    ? `${(appUser.firstName || "U")[0]}${(appUser.lastName || "")[0] || ""}`.toUpperCase()
    : "U";

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4 flex-shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />

            <div className="flex items-center gap-3 flex-1">
              {activeState?.flagUrl ? (
                <img
                  src={activeState.flagUrl}
                  alt={activeState.name}
                  className="w-6 h-4 rounded-sm object-cover border border-border"
                  data-testid="img-state-flag"
                />
              ) : (
                <div className="w-6 h-4 rounded-sm bg-muted border border-border flex items-center justify-center text-[8px] text-muted-foreground" data-testid="img-state-flag">
                  SK
                </div>
              )}
              <Separator orientation="vertical" className="h-6" />
              <span className="text-sm font-medium truncate" data-testid="text-active-company">
                {activeCompany?.name || "Ziadna firma"}
              </span>
            </div>

            <Button
              size="icon"
              variant="ghost"
              onClick={toggleTheme}
              data-testid="button-theme-toggle"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            <div className="flex items-center gap-2">
              <span className="text-sm hidden sm:inline text-muted-foreground" data-testid="text-header-username">{displayName}</span>
              <Avatar className="w-8 h-8">
                <AvatarImage src={user?.profileImageUrl || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
              </Avatar>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
