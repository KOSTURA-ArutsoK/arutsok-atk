import { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
import { Moon, Sun, ChevronDown, Globe, Building2, Upload, LogOut, AlertTriangle, Timer, Volume2, VolumeX, Shield, Layers, X, LayoutGrid, Lock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { isAdmin as checkIsAdmin } from "@/lib/utils";

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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const SIDEBAR_STORAGE_KEY = "arutsok-sidebar-open";

function getSidebarDefault(): boolean {
  try {
    const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (stored !== null) return stored === "true";
  } catch {}
  return true;
}

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
  const [sidebarOpen, setSidebarOpen] = useState(getSidebarDefault);
  const handleSidebarChange = useCallback((open: boolean) => {
    setSidebarOpen(open);
    try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(open)); } catch {}
  }, []);
  const [contextOverlayOpen, setContextOverlayOpen] = useState(false);
  const [contextStep, setContextStep] = useState<"state" | "company" | "division">("state");
  const [pendingStateId, setPendingStateId] = useState<number | null>(null);
  const [pendingCompanyId, setPendingCompanyId] = useState<number | null>(null);
  const [companyDivisions, setCompanyDivisions] = useState<any[]>([]);
  const contextInitRef = useRef(false);

  const isClientUser = useMemo(() => {
    const pgName = (appUser as any)?.permissionGroup?.name?.toLowerCase();
    return pgName === 'klienti';
  }, [appUser]);

  const autoCreateInFlightRef = useRef<Set<number>>(new Set());
  const autoCreateDivisionForCompany = useCallback(async (companyId: number) => {
    if (autoCreateInFlightRef.current.has(companyId)) return null;
    autoCreateInFlightRef.current.add(companyId);
    try {
      const checkRes = await fetch(`/api/companies/${companyId}/divisions`, { credentials: "include" });
      if (checkRes.ok) {
        const existing = await checkRes.json();
        if (existing.length > 0) {
          const divId = existing[0].divisionId || existing[0].division?.id;
          setActive.mutate({ activeDivisionId: divId });
          return divId;
        }
      }
      let companyName = companies?.find((c: any) => c.id === companyId)?.name;
      if (!companyName) {
        try {
          const compRes = await fetch(`/api/my-companies/${companyId}`, { credentials: "include" });
          if (compRes.ok) {
            const comp = await compRes.json();
            companyName = comp?.name;
          }
        } catch {}
      }
      if (!companyName) {
        try {
          const compRes = await fetch("/api/my-companies", { credentials: "include" });
          if (compRes.ok) {
            const allComps = await compRes.json();
            companyName = allComps.find((c: any) => c.id === companyId)?.name;
          }
        } catch {}
      }
      companyName = companyName || "Predvolená";
      const divRes = await apiRequest("POST", "/api/divisions", {
        name: companyName,
        code: companyName.substring(0, 10).toUpperCase(),
        emoji: "🏢",
        isActive: true,
      });
      const newDiv = await divRes.json();
      await apiRequest("POST", `/api/companies/${companyId}/divisions`, { divisionId: newDiv.id });
      setActive.mutate({ activeDivisionId: newDiv.id });
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId, "divisions"] });
      return newDiv.id;
    } catch {
      toast({ title: "Nepodarilo sa vytvoriť predvolenú divíziu", variant: "destructive" });
      return null;
    } finally {
      autoCreateInFlightRef.current.delete(companyId);
    }
  }, [companies, setActive, queryClient, toast]);

  const handleLogout = useCallback(() => {
    logout();
  }, [logout]);

  useEffect(() => {
    if (isClientUser && appUser?.linkedSubjectId) {
      if (window.location.pathname !== '/client-profile') {
        window.location.href = '/client-profile';
      }
    }
  }, [isClientUser, appUser]);

  useEffect(() => {
    if (appUser && !contextInitRef.current && !isClientUser) {
      contextInitRef.current = true;
      if (!appUser.activeStateId || !appUser.activeCompanyId) {
        setPendingStateId(appUser.activeStateId || null);
        setContextStep(appUser.activeStateId ? "company" : "state");
        setContextOverlayOpen(true);
      } else if (!(appUser as any).activeDivisionId && appUser.activeCompanyId) {
        (async () => {
          try {
            const res = await fetch(`/api/companies/${appUser.activeCompanyId}/divisions`, { credentials: "include" });
            if (res.ok) {
              const divs = await res.json();
              if (divs.length > 1) {
                setPendingCompanyId(appUser.activeCompanyId);
                setCompanyDivisions(divs);
                setContextStep("division");
                setContextOverlayOpen(true);
              } else if (divs.length === 1) {
                const divId = divs[0].divisionId || divs[0].division?.id;
                setActive.mutate({ activeDivisionId: divId });
              } else if (divs.length === 0) {
                await autoCreateDivisionForCompany(appUser.activeCompanyId!);
              }
            }
          } catch {}
        })();
      }
    }
  }, [appUser, isClientUser, autoCreateDivisionForCompany]);

  const handleContextSelectState = useCallback((stateId: number) => {
    setPendingStateId(stateId);
    setActive.mutate({ activeStateId: stateId, activeCompanyId: null, activeDivisionId: null }, {
      onSuccess: () => {
        setContextStep("company");
      },
      onError: () => {
        setPendingStateId(null);
      }
    });
  }, [setActive]);

  const handleContextSelectCompany = useCallback(async (companyId: number) => {
    setPendingCompanyId(companyId);
    setActive.mutate({ activeCompanyId: companyId, activeDivisionId: null }, {
      onSuccess: async () => {
        try {
          const res = await fetch(`/api/companies/${companyId}/divisions`, { credentials: "include" });
          if (res.ok) {
            const divisions = await res.json();
            if (divisions.length === 0) {
              await autoCreateDivisionForCompany(companyId);
              setContextOverlayOpen(false);
            } else if (divisions.length === 1) {
              setActive.mutate({ activeDivisionId: divisions[0].divisionId || divisions[0].division?.id });
              setContextOverlayOpen(false);
            } else {
              setCompanyDivisions(divisions);
              setContextStep("division");
            }
          } else {
            setContextOverlayOpen(false);
          }
        } catch {
          setContextOverlayOpen(false);
        }
      }
    });
  }, [setActive, autoCreateDivisionForCompany]);

  const handleContextSelectDivision = useCallback((divisionId: number | null) => {
    setActive.mutate({ activeDivisionId: divisionId }, {
      onSuccess: () => {
        setContextOverlayOpen(false);
      }
    });
  }, [setActive]);

  const handleContextBack = useCallback(() => {
    if (contextStep === "division") {
      setContextStep("company");
      setCompanyDivisions([]);
      return;
    }
    setContextStep("state");
    setPendingStateId(null);
  }, [contextStep]);

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

  const openDivisionSelector = useCallback(async () => {
    if (!appUser?.activeCompanyId) {
      openCompanySelector();
      return;
    }
    try {
      const res = await fetch(`/api/companies/${appUser.activeCompanyId}/divisions`, { credentials: "include" });
      if (res.ok) {
        const divisions = await res.json();
        if (divisions.length > 0) {
          setPendingCompanyId(appUser.activeCompanyId);
          setCompanyDivisions(divisions);
          setContextStep("division");
          setContextOverlayOpen(true);
        }
      }
    } catch {}
  }, [appUser?.activeCompanyId, openCompanySelector]);

  const defaultTimeout = (appUser as any)?.effectiveSessionTimeoutSeconds ?? 1800;

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
  const activeDivisionId = (appUser as any)?.activeDivisionId;

  const { data: activeDivisions } = useQuery<any[]>({
    queryKey: [`/api/companies/${appUser?.activeCompanyId}/divisions`],
    enabled: !!appUser?.activeCompanyId,
  });
  const activeDivision = activeDivisions?.find((d: any) => (d.divisionId || d.division?.id) === activeDivisionId);

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
    "--sidebar-width": "280px",
    "--sidebar-width-icon": "3rem",
  };

  const dismissBtnRef = useRef<HTMLButtonElement>(null);

  const handleDismissWarning = useCallback(() => {
    dismissWarning();
  }, [dismissWarning]);

  useEffect(() => {
    if (showWarning) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          handleDismissWarning();
        }
      };
      window.addEventListener("keydown", handleKeyDown, { capture: true });
      requestAnimationFrame(() => {
        dismissBtnRef.current?.focus();
      });
      return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
    }
  }, [showWarning, handleDismissWarning]);

  const warningOverlay = createPortal(
    showWarning ? (
      <div
        className="fixed inset-0 z-[99999] flex items-center justify-center"
        data-testid="idle-warning-overlay"
        onClick={handleDismissWarning}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ pointerEvents: "auto" }}
      >
        <div className="absolute inset-0 bg-background/80 backdrop-blur-md" style={{ pointerEvents: "none" }} />
        <div
          className="relative z-10 flex flex-col items-center gap-4 p-8 rounded-md border border-destructive bg-card shadow-lg max-w-md text-center"
          onClick={(e) => e.stopPropagation()}
        >
          <AlertTriangle className="w-12 h-12 text-destructive" />
          <h2 className="text-lg font-bold text-destructive" data-testid="text-idle-warning-title">Upozornenie na necinnost</h2>
          <div className="text-4xl font-bold font-mono text-destructive" data-testid="text-idle-countdown">
            {formatTime(timeLeft)}
          </div>
          <p className="text-sm text-muted-foreground">
            Budete automaticky odhlaseny z dovodu necinnosti.
          </p>
          <Button
            ref={dismissBtnRef}
            variant="default"
            onClick={handleDismissWarning}
            data-testid="button-dismiss-idle-warning"
            style={{ pointerEvents: "auto", position: "relative", zIndex: 20 }}
          >
            Zostat prihlaseny
          </Button>
        </div>
      </div>
    ) : null,
    document.body
  );

  if (isClientUser) {
    return (
      <div className="min-h-screen bg-background">
        <header className="h-14 border-b border-border px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary" />
            <span className="font-bold text-sm">ArutsoK</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Klientsk\u00e1 z\u00f3na</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground" data-testid="text-client-username">{displayName}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="btn-client-logout">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>
        <main className="p-6">{children}</main>
        {warningOverlay}
      </div>
    );
  }

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={handleSidebarChange} style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="h-14 border-b border-border bg-card flex items-center px-3 gap-2 flex-shrink-0">
            <SidebarTrigger data-testid="button-sidebar-toggle" />

            <div className="flex-1" />

            {(() => {
              const canSwitch = checkIsAdmin(appUser);
              const activeDivName = activeDivision?.division?.name || activeDivision?.name;
              const activeDivEmoji = activeDivision?.division?.emoji || activeDivision?.emoji;
              const hasDivisions = activeDivisions && activeDivisions.length > 0 && !isClientUser;

              return (
                <div
                  className="flex items-center gap-1.5 rounded-full h-10 px-2"
                  style={{
                    background: "hsl(222 20% 20%)",
                    border: "1px solid hsl(222 15% 28%)",
                    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.25)"
                  }}
                  data-testid="holding-context-bubble"
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={canSwitch ? openStateSelector : undefined}
                        className={`flex items-center justify-center gap-1.5 px-2.5 h-7 rounded-full transition-all ${canSwitch ? "hover:brightness-110 cursor-pointer" : "cursor-default"}`}
                        style={{
                          background: "hsl(222 15% 28%)",
                          border: "1px solid hsl(222 12% 36%)",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)"
                        }}
                        data-testid="button-state-switcher"
                      >
                        {activeState?.flagUrl ? (
                          <img src={activeState.flagUrl} alt={activeState.name} className="w-5 h-3.5 object-cover rounded-sm flex-shrink-0" />
                        ) : (
                          <Globe className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                        )}
                        <span className="text-[11px] font-medium hidden sm:inline whitespace-nowrap text-zinc-200">
                          {activeState?.name || "Štát"}
                        </span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{canSwitch ? "Zmeniť štát" : `${activeState?.name || "Štát"} (fixné)`}</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={canSwitch ? openCompanySelector : undefined}
                        className={`flex items-center gap-1.5 px-2.5 h-7 rounded-full transition-all ${canSwitch ? "hover:brightness-110 cursor-pointer" : "cursor-default"}`}
                        style={{
                          background: "hsl(222 15% 28%)",
                          border: "1px solid hsl(222 12% 36%)",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)"
                        }}
                        data-testid="button-company-switcher"
                      >
                        <Building2 className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                        <span className="text-[11px] font-medium truncate max-w-[140px] text-zinc-200">
                          {activeCompany?.name || "Firma"}
                        </span>
                        {!canSwitch && (
                          <Lock className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{canSwitch ? "Zmeniť spoločnosť" : `${activeCompany?.name || "Firma"} (fixné)`}</TooltipContent>
                  </Tooltip>

                  {hasDivisions && (
                    <>
                      {activeDivisions!.length <= 5 ? (
                        <div
                          className="flex items-center gap-0.5 h-7 px-1.5 rounded-full"
                          style={{
                            background: "hsl(222 15% 28%)",
                            border: "1px solid hsl(222 12% 36%)",
                            boxShadow: "0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)"
                          }}
                          data-testid="division-emoji-bar"
                        >
                          {activeDivisions!.map((cd: any) => {
                            const divId = cd.divisionId || cd.division?.id;
                            const divName = cd.division?.name || cd.name || "Divízia";
                            const divEmoji = cd.division?.emoji || cd.emoji;
                            const isActiveDivision = divId === activeDivisionId;
                            return (
                              <Tooltip key={divId}>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => handleContextSelectDivision(divId)}
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-sm transition-all ${
                                      isActiveDivision
                                        ? "ring-2 ring-zinc-400 bg-zinc-400/20"
                                        : "hover:bg-zinc-400/15"
                                    }`}
                                    data-testid={`division-emoji-${divId}`}
                                  >
                                    {divEmoji || (
                                      <span className="text-[8px] font-bold text-zinc-300">
                                        {(cd.division?.code || cd.code || divName).slice(0, 2).toUpperCase()}
                                      </span>
                                    )}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>{divName}</TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={openDivisionSelector}
                              className="flex items-center gap-1.5 px-2.5 h-7 rounded-full transition-all hover:brightness-110 cursor-pointer"
                              style={{
                                background: "hsl(222 15% 28%)",
                                border: "1px solid hsl(222 12% 36%)",
                                boxShadow: "0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)"
                              }}
                              data-testid="button-division-switcher"
                            >
                              {activeDivEmoji ? (
                                <span className="text-sm">{activeDivEmoji}</span>
                              ) : (
                                <Layers className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                              )}
                              <span className="text-[11px] font-medium truncate max-w-[120px] text-zinc-200">
                                {activeDivName || "Divízie"}
                              </span>
                              <ChevronDown className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>Zmeniť divíziu</TooltipContent>
                        </Tooltip>
                      )}
                    </>
                  )}
                </div>
              );
            })()}

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

          {(appUser as any)?.isImpersonating && (
            <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-between flex-shrink-0" data-testid="banner-impersonation">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Režim Impersonation — Nachádzate sa v kontexte: {appUser?.firstName} {appUser?.lastName}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-red-700 gap-1.5"
                onClick={async () => {
                  try {
                    await apiRequest("POST", "/api/impersonate/stop");
                    window.location.reload();
                  } catch {}
                }}
                data-testid="button-impersonate-stop"
              >
                <X className="w-4 h-4" />
                Návrat do profilu
              </Button>
            </div>
          )}


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
        companyDivisions={companyDivisions}
        currentStateId={pendingStateId}
        currentCompanyId={pendingCompanyId}
        onSelectState={handleContextSelectState}
        onSelectCompany={handleContextSelectCompany}
        onSelectDivision={handleContextSelectDivision}
        onBack={handleContextBack}
        onClose={() => setContextOverlayOpen(false)}
      />
      {warningOverlay}
    </SidebarProvider>
  );
}
