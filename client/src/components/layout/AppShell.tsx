import { useAppUser, useSetActiveContext } from "@/hooks/use-app-user";
import { useMyCompanies } from "@/hooks/use-companies";
import { useStates } from "@/hooks/use-hierarchy";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/hooks/use-auth";
import { Moon, Sun, ChevronDown, Globe, Building2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { data: appUser } = useAppUser();
  const { data: companies } = useMyCompanies();
  const { data: allStates } = useStates();
  const { theme, toggleTheme } = useTheme();
  const setActive = useSetActiveContext();

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
          <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-2 flex-shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 ml-2" data-testid="button-state-switcher">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {activeState ? `+${activeState.code} ${activeState.name}` : "Vyberte stat"}
                  </span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Aktivny stat</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {allStates?.map(s => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => setActive.mutate({ activeStateId: s.id })}
                    data-testid={`menu-state-${s.id}`}
                  >
                    <span className="flex-1">+{s.code} {s.name}</span>
                    {appUser?.activeStateId === s.id && <Check className="w-4 h-4 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex-1" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2" data-testid="button-company-switcher">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium truncate max-w-[200px]">
                    {activeCompany?.name || "Ziadna firma"}
                  </span>
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Aktivna spolocnost</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {companies?.filter(c => !c.isDeleted).map(c => (
                  <DropdownMenuItem
                    key={c.id}
                    onClick={() => setActive.mutate({ activeCompanyId: c.id })}
                    data-testid={`menu-company-${c.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.specialization} | {c.code}</p>
                    </div>
                    {appUser?.activeCompanyId === c.id && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                  </DropdownMenuItem>
                ))}
                {(!companies || companies.filter(c => !c.isDeleted).length === 0) && (
                  <DropdownMenuItem disabled>Ziadne spolocnosti</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <Separator orientation="vertical" className="h-6 mx-1" />

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
