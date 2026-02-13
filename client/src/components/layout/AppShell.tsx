import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useIdleTimeout } from "@/hooks/use-idle-timeout";
import { useGlobalClickLogger } from "@/hooks/use-global-click-logger";
import { useAppUser, useSetActiveContext } from "@/hooks/use-app-user";
import { useMyCompanies } from "@/hooks/use-companies";
import { useStates } from "@/hooks/use-hierarchy";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/hooks/use-auth";
import { useTTSContext } from "@/contexts/tts-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Moon, Sun, ChevronDown, Globe, Building2, Upload, LogOut, AlertTriangle, Timer, Volume2, VolumeX } from "lucide-react";
import type { PermissionGroup } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useToast } from "@/hooks/use-toast";
import { useUserProfile } from "@/hooks/use-user-profile";
import { ContextSelectorOverlay } from "@/components/context-selector-overlay";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { data: appUser } = useAppUser();
  const { data: companies } = useMyCompanies();
  const { data: allStates } = useStates();
  const { data: userProfile } = useUserProfile();
  const { theme, toggleTheme } = useTheme();
  const tts = useTTSContext();
  const setActive = useSetActiveContext();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [contextOverlayOpen, setContextOverlayOpen] = useState(false);
  const [contextStep, setContextStep] = useState<"state" | "company">("state");
  const [pendingStateId, setPendingStateId] = useState<number | null>(null);
  const contextInitRef = useRef(false);

  useEffect(() => {
    if (appUser && !contextInitRef.current) {
      contextInitRef.current = true;
      if (!appUser.activeStateId || !appUser.activeCompanyId) {
        setPendingStateId(appUser.activeStateId || null);
        setContextStep(appUser.activeStateId ? "company" : "state");
        setContextOverlayOpen(true);
      }
    }
  }, [appUser]);

  const handleContextSelectState = useCallback((stateId: number) => {
    setPendingStateId(stateId);
    setActive.mutate({ activeStateId: stateId, activeCompanyId: null }, {
      onSuccess: () => {
        setContextStep("company");
      },
      onError: () => {
        setPendingStateId(null);
      }
    });
  }, [setActive]);

  const handleContextSelectCompany = useCallback((companyId: number) => {
    setActive.mutate({ activeCompanyId: companyId }, {
      onSuccess: () => {
        setContextOverlayOpen(false);
      }
    });
  }, [setActive]);

  const handleContextBack = useCallback(() => {
    setContextStep("state");
    setPendingStateId(null);
  }, []);

  const openStateSelector = useCallback(() => {
    setPendingStateId(null);
    setContextStep("state");
    setContextOverlayOpen(true);
  }, []);

  const openCompanySelector = useCallback(() => {
    if (!appUser?.activeStateId) {
      openStateSelector();
      return;
    }
    setPendingStateId(appUser.activeStateId);
    setContextStep("company");
    setContextOverlayOpen(true);
  }, [appUser?.activeStateId, openStateSelector]);

  const { data: permGroups } = useQuery<PermissionGroup[]>({
    queryKey: ["/api/permission-groups"],
  });

  const userGroup = permGroups?.find(g => g.id === appUser?.permissionGroupId);
  const defaultTimeout = userGroup?.sessionTimeoutSeconds ?? 180;

  const { timeLeft, showWarning, dismissWarning, isRed } = useIdleTimeout(defaultTimeout);
  useGlobalClickLogger();

  useEffect(() => {
    if (displayName && displayName !== "Pouzivatel") {
      const firstName = appUser?.firstName || user?.firstName || displayName.split(" ")[0];
      tts.speak(
        `Vitaj v systeme Arutsok ${firstName}`,
        "welcome_" + (appUser?.id || "user")
      );
    }
  }, [appUser?.id]);

  const securityWarningSpokenRef = useRef(false);
  useEffect(() => {
    if (timeLeft <= 10 && timeLeft > 0 && showWarning && !securityWarningSpokenRef.current) {
      securityWarningSpokenRef.current = true;
      tts.speak("System bude o chvilu uzamknuty. Prosim, ulozte si pracu.");
    }
    if (timeLeft > 10) {
      securityWarningSpokenRef.current = false;
    }
  }, [timeLeft, showWarning]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const activeCompany = companies?.find(c => c.id === appUser?.activeCompanyId);
  const activeState = allStates?.find(s => s.id === appUser?.activeStateId);

  const displayName = appUser
    ? `${appUser.firstName || ""} ${appUser.lastName || ""}`.trim() || appUser.username
    : user?.firstName || "Pouzivatel";

  const initials = appUser
    ? `${(appUser.firstName || "U")[0]}${(appUser.lastName || "")[0] || ""}`.toUpperCase()
    : "U";

  const profilePhotoUrl = userProfile?.photoUrl || user?.profileImageUrl || undefined;

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["jpg", "jpeg", "png"].includes(ext || "")) {
      toast({ title: "Chyba", description: "Povolene su len .jpg a .png subory.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/user-profile/photo", { method: "POST", body: formData, credentials: "include" });
      if (!res.ok) throw new Error("Upload failed");
      queryClient.invalidateQueries({ queryKey: ["/api/user-profile/me"] });
      toast({ title: "Fotka nahrana" });
    } catch {
      toast({ title: "Chyba", description: "Nepodarilo sa nahrat fotku.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  const handleDismissWarning = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dismissWarning();
  }, [dismissWarning]);

  const warningOverlay = createPortal(
    showWarning && !contextOverlayOpen ? (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center" data-testid="idle-warning-overlay">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-md" />
        <div className="relative z-10 flex flex-col items-center gap-4 p-8 rounded-md border border-destructive bg-card shadow-lg max-w-md text-center">
          <AlertTriangle className="w-12 h-12 text-destructive" />
          <h2 className="text-lg font-bold text-destructive" data-testid="text-idle-warning-title">Upozornenie na necinnost</h2>
          <div className="text-4xl font-bold font-mono text-destructive" data-testid="text-idle-countdown">
            {formatTime(timeLeft)}
          </div>
          <p className="text-sm text-muted-foreground">
            Budete automaticky odhlaseny z dovodu necinnosti.
          </p>
          <Button variant="default" onClick={handleDismissWarning} data-testid="button-dismiss-idle-warning">
            Zostat prihlaseny
          </Button>
        </div>
      </div>
    ) : null,
    document.body
  );

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="h-14 border-b border-border bg-card flex items-center px-3 gap-2 flex-shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />

            <Button variant="ghost" size="sm" className="gap-1.5" onClick={openStateSelector} data-testid="button-state-switcher">
              {activeState?.flagUrl ? (
                <img src={activeState.flagUrl} alt={activeState.name} className="w-5 h-3.5 object-cover rounded-sm" />
              ) : (
                <Globe className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium hidden sm:inline">
                {activeState ? `+${activeState.code} ${activeState.name}` : "Stat"}
              </span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </Button>

            <div className="flex-1" />

            <Button variant="ghost" size="sm" className="gap-1.5" onClick={openCompanySelector} data-testid="button-company-switcher">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium truncate max-w-[200px]">
                {activeCompany?.name || "Ziadna firma"}
              </span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </Button>

            <div className="flex-1" />

            <div
              key="idle-timer"
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md font-mono text-xs font-bold transition-colors ${isRed ? 'text-destructive' : 'text-emerald-500'}`}
              data-testid="text-idle-timer"
            >
              <Timer className="w-3.5 h-3.5" />
              {formatTime(timeLeft)}
            </div>

            <Button
              size="icon"
              variant="ghost"
              onClick={tts.toggle}
              data-testid="button-tts-toggle"
            >
              {tts.enabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={toggleTheme}
              data-testid="button-theme-toggle"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>

            <input
              ref={photoInputRef}
              type="file"
              accept=".jpg,.jpeg,.png"
              className="hidden"
              onChange={handlePhotoUpload}
              data-testid="input-profile-photo"
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex items-center gap-2 rounded-md px-1 py-0.5 hover-elevate" data-testid="button-user-menu">
                  <span className="text-sm hidden sm:inline text-muted-foreground" data-testid="text-header-username">{displayName}</span>
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={profilePhotoUrl} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>{displayName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => photoInputRef.current?.click()} disabled={uploading} data-testid="button-upload-photo">
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? "Nahravam..." : "Nahrat fotku"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()} data-testid="button-logout">
                  <LogOut className="w-4 h-4 mr-2" />
                  Odhlasit sa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
      <ContextSelectorOverlay
        open={contextOverlayOpen}
        step={contextStep}
        states={allStates || []}
        companies={companies || []}
        currentStateId={pendingStateId}
        onSelectState={handleContextSelectState}
        onSelectCompany={handleContextSelectCompany}
        onBack={handleContextBack}
      />
      {warningOverlay}
    </SidebarProvider>
  );
}
