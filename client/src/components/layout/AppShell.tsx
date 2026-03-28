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
import { Moon, Sun, ChevronDown, Globe, Building2, Upload, LogOut, AlertTriangle, Timer, Volume2, VolumeX, Shield, Layers, X, LayoutGrid, Lock, UserCheck, Plus, Briefcase, User, Landmark, Heart, Grid3X3, History, ShieldCheck, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { AccountLinkModal } from "@/components/account-link-modal";
import { apiRequest } from "@/lib/queryClient";
import { isAdmin as checkIsAdmin, formatDateTimeSlovak } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useToast } from "@/hooks/use-toast";
import { useUserProfile } from "@/hooks/use-user-profile";
import { ContextSelectorOverlay, type IdentityOption } from "@/components/context-selector-overlay";
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

type LoginHistoryRow = {
  id: number;
  appUserId: number;
  loginAt: string;
  logoutAt: string | null;
  ipAddress: string | null;
  contextType: string | null;
  contextLabel: string | null;
  logoutReason: string | null;
};

function formatDuration(loginAt: string, logoutAt: string | null): string {
  if (!logoutAt) return "aktívna";
  const diffMs = new Date(logoutAt).getTime() - new Date(loginAt).getTime();
  if (diffMs < 0) return "–";
  const totalSec = Math.floor(diffMs / 1000);
  if (totalSec < 60) return "< 1 min";
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h} h ${m > 0 ? `${m} min` : ""}`.trim();
  return `${m} min`;
}

function formatLogoutReason(reason: string | null): string {
  switch (reason) {
    case "switch": return "Prepnutie identity";
    case "manual": return "Odhlásenie";
    case "idle": return "Automatické (nečinnosť)";
    default: return "–";
  }
}

function subjectTypeLabelShort(type: string | null | undefined): string {
  switch (type) {
    case "person": return "FO";
    case "szco": return "SZČO";
    case "company": return "PO";
    case "organization": return "TS";
    case "state": return "VS";
    case "os": return "OS";
    case "mycompany": return "Vlastná firma";
    default: return "Neznámy";
  }
}

function isEntityType(type: string | null | undefined): boolean {
  return type !== "person" && type !== "szco" && type != null;
}

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
  const [, navigate] = useLocation();
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
  const [contextStep, setContextStep] = useState<"identity" | "state" | "company" | "division">("state");
  const [pendingStateId, setPendingStateId] = useState<number | null>(null);
  const [pendingCompanyId, setPendingCompanyId] = useState<number | null>(null);
  const [companyDivisions, setCompanyDivisions] = useState<any[]>([]);
  const [loginFlow, setLoginFlow] = useState(false);
  const [loginIdentityOptions, setLoginIdentityOptions] = useState<IdentityOption[]>([]);
  const [loginFlowPrevStep, setLoginFlowPrevStep] = useState<"identity" | "state" | null>(null);
  const contextInitRef = useRef(false);

  const finishLoginContextSetup = useCallback(() => {
    setLoginFlow(false);
    setLoginIdentityOptions([]);
    setLoginFlowPrevStep(null);
    localStorage.removeItem("atk_pending_identity_setup");
  }, []);
  const [accountLinkModalOpen, setAccountLinkModalOpen] = useState(false);
  const [loginHistoryOpen, setLoginHistoryOpen] = useState(false);

  const { data: userContexts } = useQuery<any[]>({
    queryKey: ["/api/user/contexts"],
    enabled: !!user,
    staleTime: 30000,
  });

  const { data: loginHistory, isLoading: loginHistoryLoading } = useQuery<LoginHistoryRow[]>({
    queryKey: ["/api/app-user/login-history"],
    enabled: loginHistoryOpen && !!user,
    staleTime: 0,
  });

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
    // Wait for all required data including userContexts — server data is authoritative
    if (!appUser || contextInitRef.current || isClientUser || !allStates || userContexts === undefined) return;
    contextInitRef.current = true;

    // LOGIN FLOW: After fresh login, check if identity + company selection is needed
    const loginFlag = localStorage.getItem("atk_pending_identity_setup") === "1";
    if (loginFlag) {
      if (appUser.activeCompanyId) {
        // Company already set from previous session — just clear the flag and fall through to normal init
        localStorage.removeItem("atk_pending_identity_setup");
      } else {
        // No company set — compute identity options and show identity step
        const foCtx = (userContexts as any[]).find((c) => c.contextType === "fo");
        const szcoCtxs = (userContexts as any[]).filter((c) => c.contextType === "szco");
        const officerCtxs = (userContexts as any[]).filter((c) => c.contextType === "officer_company");

        const opts: IdentityOption[] = [];
        if (foCtx) opts.push({ type: "fo", label: foCtx.label, subLabel: "Fyzická osoba", subjectId: foCtx.subjectId ?? null });
        for (const ctx of szcoCtxs) {
          opts.push({ type: "szco", label: ctx.label, subLabel: ctx.subLabel || "SZČO", subjectId: ctx.subjectId ?? null });
        }
        if (officerCtxs.length > 0) {
          const offLabel = officerCtxs.length === 1 ? officerCtxs[0].label : `${officerCtxs.length} spoločnosti`;
          opts.push({ type: "firma", label: "Vlastná firma", subLabel: offLabel, subjectId: null });
        }

        // loginFlow=true for ALL setup paths — makes overlay non-closable regardless of identity step
        setLoginFlow(true);

        if (opts.length > 1) {
          // Multiple identity options — show identity step first
          setLoginIdentityOptions(opts);
          setContextStep("identity");
          setContextOverlayOpen(true);
          return; // state/company handled after identity selection in handleContextSelectIdentity
        }

        if (opts.length === 1) {
          // Single identity option — auto-skip identity step, apply identity and run pipeline
          // Only opens overlay if user interaction is actually needed (company/division choice)
          handleContextSelectIdentity(opts[0]);
          return;
        }

        // 0 identity options (user has no registered contexts) — clear stale subject and terminate login flow
        finishLoginContextSetup();
        if ((appUser as any).activeSubjectId) {
          setActive.mutate({ activeSubjectId: null });
        }
        // Fall through to needsFullContext check below (overlay opens only if company is still needed)
      }
    }

    // Two-layer model: when subject identity is active, validate that the current company
    // is one where the subject has actual records (backend already filters /api/my-companies).
    // If the current company is invalid or unset, auto-select or show company picker.
    if ((appUser as any).activeSubjectId) {
      localStorage.removeItem("atk_context_fo");
      (async () => {
        try {
          const compsRes = await fetch("/api/my-companies", { credentials: "include" });
          if (!compsRes.ok) return;
          const validComps = await compsRes.json();
          if (validComps.length === 0) {
            // Subject has no records in any company — clear any stale active company
            if (appUser.activeCompanyId) {
              setActive.mutate({ activeCompanyId: null, activeDivisionId: null });
            }
            return;
          }
          const currentIsValid = appUser.activeCompanyId && validComps.some((c: any) => c.id === appUser.activeCompanyId);
          if (currentIsValid) {
            // Company is valid — but also check if division still needs to be selected/created
            const needsDivision = !!(appUser.activeCompanyId && !(appUser as any).activeDivisionId);
            if (needsDivision) {
              const divsRes = await fetch(`/api/companies/${appUser.activeCompanyId}/divisions`, { credentials: "include" });
              if (divsRes.ok) {
                const divs = await divsRes.json();
                if (divs.length === 1) {
                  setActive.mutate({ activeDivisionId: divs[0].divisionId || divs[0].division?.id });
                } else if (divs.length === 0) {
                  autoCreateDivisionForCompany(appUser.activeCompanyId);
                } else {
                  setPendingCompanyId(appUser.activeCompanyId);
                  setCompanyDivisions(divs);
                  setContextStep("division");
                  setContextOverlayOpen(true);
                }
              }
            }
            return;
          }
          // Current company is not valid (or null) — auto-select or show picker
          if (validComps.length === 1) {
            const comp = validComps[0];
            const divsRes = await fetch(`/api/companies/${comp.id}/divisions`, { credentials: "include" });
            if (divsRes.ok) {
              const divs = await divsRes.json();
              if (divs.length === 1) {
                setActive.mutate({ activeCompanyId: comp.id, activeDivisionId: divs[0].divisionId || divs[0].division?.id });
              } else if (divs.length === 0) {
                setActive.mutate({ activeCompanyId: comp.id }, { onSuccess: () => autoCreateDivisionForCompany(comp.id) });
              } else {
                setActive.mutate({ activeCompanyId: comp.id, activeDivisionId: null });
              }
            } else {
              setActive.mutate({ activeCompanyId: comp.id, activeDivisionId: null });
            }
          } else {
            // Multiple valid companies — the overlay filters by state, so determine
            // the correct state to open at. If all valid companies share one state,
            // open the company step directly; otherwise start from state step.
            const uniqueStateIds = [...new Set(
              validComps.map((c: any) => c.stateId).filter((id: any) => id !== null && id !== undefined)
            )] as number[];
            if (uniqueStateIds.length === 1) {
              setPendingStateId(uniqueStateIds[0]);
              setContextStep("company");
            } else {
              setPendingStateId(null);
              setContextStep("state");
            }
            setContextOverlayOpen(true);
          }
        } catch { /* silently fail */ }
      })();
      return;
    }

    // If user intentionally chose FO mode (both null but has other contexts available),
    // skip auto-init. Distinguish from a new user who has only the FO entry.
    const currentCtx = userContexts.find((c: any) => c.isCurrent);
    const hasOtherContexts = userContexts.some((c: any) => c.contextType !== "fo");
    if (currentCtx?.contextType === "fo" && hasOtherContexts) {
      localStorage.removeItem("atk_context_fo");
      return;
    }

    localStorage.removeItem("atk_context_fo");

    {
      const needsFullContext = !appUser.activeStateId || !appUser.activeCompanyId;
      const needsDivision = !!(appUser.activeStateId && appUser.activeCompanyId && !(appUser as any).activeDivisionId);

      if (needsFullContext) {
        (async () => {
          try {
            const activeStates = (allStates || []).filter((s: any) => s.isActive);
            if (activeStates.length === 1) {
              const singleStateId = activeStates[0].id;
              const compsRes = await fetch("/api/my-companies", { credentials: "include" });
              if (!compsRes.ok) { setContextStep("state"); setContextOverlayOpen(true); return; }
              const allComps = await compsRes.json();
              const stateComps = allComps.filter((c: any) => c.stateId === singleStateId);
              if (stateComps.length === 1) {
                const singleCompanyId = stateComps[0].id;
                const divsRes = await fetch(`/api/companies/${singleCompanyId}/divisions`, { credentials: "include" });
                if (!divsRes.ok) { setContextStep("state"); setContextOverlayOpen(true); return; }
                const divs = await divsRes.json();
                if (divs.length === 1) {
                  const divId = divs[0].divisionId || divs[0].division?.id;
                  setActive.mutate({ activeStateId: singleStateId, activeCompanyId: singleCompanyId, activeDivisionId: divId });
                  return;
                } else if (divs.length === 0) {
                  setActive.mutate({ activeStateId: singleStateId, activeCompanyId: singleCompanyId }, {
                    onSuccess: () => autoCreateDivisionForCompany(singleCompanyId),
                  });
                  return;
                }
              }
            }
            setPendingStateId(appUser.activeStateId || null);
            setContextStep(appUser.activeStateId ? "company" : "state");
            setContextOverlayOpen(true);
          } catch {
            setPendingStateId(appUser.activeStateId || null);
            setContextStep(appUser.activeStateId ? "company" : "state");
            setContextOverlayOpen(true);
          }
        })();
      } else if (needsDivision) {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUser, isClientUser, autoCreateDivisionForCompany, allStates, userContexts]);

  const handleContextSelectState = useCallback((stateId: number) => {
    if (stateId === appUser?.activeStateId) {
      setPendingStateId(stateId);
      setContextStep("company");
      return;
    }
    setPendingStateId(stateId);
    setActive.mutate({ activeStateId: stateId, activeCompanyId: null, activeDivisionId: null }, {
      onSuccess: () => {
        setContextStep("company");
      },
      onError: () => {
        setPendingStateId(null);
      }
    });
  }, [setActive, appUser?.activeStateId]);

  const handleContextSelectCompany = useCallback(async (companyId: number, preStateId?: number) => {
    setPendingCompanyId(companyId);
    setActive.mutate({
      activeCompanyId: companyId,
      activeDivisionId: null,
      ...(preStateId != null ? { activeStateId: preStateId } : {}),
    }, {
      onSuccess: async () => {
        try {
          const res = await fetch(`/api/companies/${companyId}/divisions`, { credentials: "include" });
          if (res.ok) {
            const divisions = await res.json();
            if (divisions.length === 0) {
              await autoCreateDivisionForCompany(companyId);
              setContextOverlayOpen(false);
              finishLoginContextSetup();
            } else if (divisions.length === 1) {
              setActive.mutate({ activeDivisionId: divisions[0].divisionId || divisions[0].division?.id });
              setContextOverlayOpen(false);
              finishLoginContextSetup();
            } else {
              setCompanyDivisions(divisions);
              setContextStep("division");
              setContextOverlayOpen(true);
            }
          } else {
            setContextOverlayOpen(false);
            finishLoginContextSetup();
          }
        } catch {
          setContextOverlayOpen(false);
          finishLoginContextSetup();
        }
      }
    });
  }, [setActive, autoCreateDivisionForCompany, finishLoginContextSetup]);

  const handleContextSelectDivision = useCallback((divisionId: number | null) => {
    setActive.mutate({ activeDivisionId: divisionId }, {
      onSuccess: () => {
        setContextOverlayOpen(false);
        finishLoginContextSetup();
      }
    });
  }, [setActive, finishLoginContextSetup]);

  const handleContextSelectIdentity = useCallback(async (ctx: IdentityOption) => {
    // subjectId is null for FO/Firma, set subjectId for SZČO (or FO with linked subject)
    const subjectIdToSet = ctx.subjectId;
    setActive.mutate({ activeSubjectId: subjectIdToSet }, {
      onSuccess: async () => {
        try {
          if (ctx.type === "szco" || ctx.type === "firma") {
            // For SZČO/Firma: fetch valid companies for this subject identity
            const compsRes = await fetch("/api/my-companies", { credentials: "include" });
            if (!compsRes.ok) { setPendingStateId(null); setContextStep("state"); return; }
            const validComps = await compsRes.json();
            if (validComps.length === 0) {
              // No companies for this identity — show state picker (mandatory, non-closable)
              setLoginFlowPrevStep(null);
              setPendingStateId(null);
              setContextStep("state");
              setContextOverlayOpen(true);
              return;
            }
            if (validComps.length === 1) {
              // Single company — auto-select; include stateId so activeStateId is persisted even when state step is skipped
              setLoginFlowPrevStep("identity");
              await handleContextSelectCompany(validComps[0].id, validComps[0].stateId ?? undefined);
            } else {
              // Multiple companies — open overlay for company/state picker
              const uniqueStateIds = [...new Set(
                validComps.map((c: any) => c.stateId).filter((id: any) => id != null)
              )] as number[];
              if (uniqueStateIds.length === 1) {
                // State auto-skipped — delegate state persistence to handleContextSelectState (sets step on success)
                setLoginFlowPrevStep("identity");
                setPendingStateId(uniqueStateIds[0]);
                handleContextSelectState(uniqueStateIds[0]);
              } else {
                // State step will be shown — Back from state → identity
                setLoginFlowPrevStep(null);
                setPendingStateId(null);
                setContextStep("state");
              }
              setContextOverlayOpen(true);
            }
          } else {
            // FO identity: run the same auto-select pipeline as initial context init
            const activeStates = (allStates || []).filter((s: any) => s.isActive);
            if (activeStates.length === 1) {
              const singleStateId = activeStates[0].id;
              const compsRes = await fetch("/api/my-companies", { credentials: "include" });
              if (compsRes.ok) {
                const allComps = await compsRes.json();
                const stateComps = allComps.filter((c: any) => c.stateId === singleStateId);
                if (stateComps.length === 1) {
                  // Single state + single company — auto-select; include stateId so activeStateId is persisted
                  setLoginFlowPrevStep("identity");
                  await handleContextSelectCompany(stateComps[0].id, singleStateId);
                  return;
                }
                if (stateComps.length > 1) {
                  // Single state + multiple companies — skip state, delegate state persistence to handleContextSelectState
                  setLoginFlowPrevStep("identity");
                  setPendingStateId(singleStateId);
                  setContextOverlayOpen(true);
                  handleContextSelectState(singleStateId);
                  return;
                }
                // 0 companies in this state — fall through to state picker
              }
            }
            // Multiple active states (or no companies in single state) — show state picker
            setLoginFlowPrevStep(null);
            setPendingStateId(null);
            setContextStep("state");
            setContextOverlayOpen(true);
          }
        } catch {
          setPendingStateId(null);
          setContextStep("state");
          setContextOverlayOpen(true);
        }
      },
      onError: () => {
        setPendingStateId(null);
        setContextStep("state");
        setContextOverlayOpen(true);
        toast({ title: "Chyba pri nastavení identity", variant: "destructive" });
      }
    });
  }, [setActive, allStates, handleContextSelectCompany, handleContextSelectState, finishLoginContextSetup, toast]);

  const handleContextBack = useCallback(() => {
    if (contextStep === "division") {
      setContextStep("company");
      setCompanyDivisions([]);
      return;
    }
    if (contextStep === "company") {
      if (loginFlow && loginFlowPrevStep === "identity") {
        // State was auto-skipped — go back to identity
        setLoginFlowPrevStep(null);
        setContextStep("identity");
        setPendingStateId(null);
      } else {
        setContextStep("state");
        setPendingStateId(null);
      }
      return;
    }
    if (contextStep === "state" && loginFlow && loginIdentityOptions.length > 1) {
      // Identity step was shown — go back to it
      setContextStep("identity");
      return;
    }
    setContextStep("state");
    setPendingStateId(null);
  }, [contextStep, loginFlow, loginFlowPrevStep, loginIdentityOptions.length]);

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

  // Two-layer model: identity (activeSubjectId) and working context (activeCompanyId) are independent.
  // Avatar and identity display are driven ONLY by activeSubjectId — company switching never changes identity.
  const hasSubjectIdentity = !!(appUser as any)?.activeSubjectId;
  const activeIdentityEntry = hasSubjectIdentity
    ? userContexts?.find((c: any) => c.subjectId === (appUser as any).activeSubjectId)
    : null;
  const isActingAsLinkedSubject = !!(activeIdentityEntry as any)?.isSubjectLink && hasSubjectIdentity;
  const isNonFoContext = hasSubjectIdentity;
  const activeIdentityLabel = activeIdentityEntry?.label ?? (isNonFoContext ? displayName : displayName);
  const activeIdentitySubLabel = activeIdentityEntry?.subLabel ?? null;
  const activeIdentityInitials = activeIdentityEntry
    ? activeIdentityEntry.label.split(/[\s,\.]+/).filter(Boolean).slice(0, 2).map((w: string) => w[0]?.toUpperCase()).join("")
    : initials;

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
              const hasDivisions = activeDivisions && activeDivisions.length > 1 && !isClientUser;

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
                        className={`flex items-center justify-center gap-1.5 px-2.5 h-7 rounded-full ${canSwitch ? "holding-chip cursor-pointer" : "cursor-default"}`}
                        style={{
                          background: "hsl(222 15% 28%)",
                          border: "1px solid hsl(222 12% 36%)",
                          ...(canSwitch ? {} : { boxShadow: "0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)" })
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
                        className={`flex items-center gap-1.5 px-2.5 h-7 rounded-full ${canSwitch ? "holding-chip cursor-pointer" : "cursor-default"}`}
                        style={{
                          background: "hsl(222 15% 28%)",
                          border: "1px solid hsl(222 12% 36%)",
                          ...(canSwitch ? {} : { boxShadow: "0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)" })
                        }}
                        data-testid="button-company-switcher"
                      >
                        {(() => {
                          const logos = activeCompany?.logos as any[] | undefined;
                          const pLogo = logos?.find((l: any) => l.isPrimary && !l.isArchived);
                          return pLogo ? (
                            <img src={pLogo.url} alt="" className="w-4 h-4 rounded-sm object-contain flex-shrink-0" />
                          ) : (
                            <Building2 className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                          );
                        })()}
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
                            const isDivisionInactive = cd.division?.isActive === false;
                            return (
                              <Tooltip key={divId}>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => handleContextSelectDivision(divId)}
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-sm holding-chip-emoji ${
                                      isActiveDivision
                                        ? "ring-2 ring-zinc-400 bg-zinc-400/20"
                                        : "hover:bg-zinc-400/15"
                                    }`}
                                    style={isDivisionInactive ? { filter: "grayscale(1)", opacity: 0.5 } : undefined}
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
                              className="flex items-center gap-1.5 px-2.5 h-7 rounded-full holding-chip cursor-pointer"
                              style={{
                                background: "hsl(222 15% 28%)",
                                border: "1px solid hsl(222 12% 36%)"
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
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={isNonFoContext ? undefined : profilePhotoUrl} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">{activeIdentityInitials}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <div className="flex items-center gap-3 px-3 py-3" data-testid="user-menu-header">
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarImage src={isNonFoContext ? undefined : profilePhotoUrl} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">{activeIdentityInitials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Prihlásený ako:</p>
                    <p className="text-sm font-semibold text-foreground truncate" data-testid="text-user-menu-name">{activeIdentityLabel}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {activeIdentitySubLabel || appUser?.email || user?.email || ""}
                    </p>
                  </div>
                </div>

                {userContexts && userContexts.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-3 py-1">Prihlásiť sa ako</DropdownMenuLabel>
                    {userContexts.map((ctx: any, idx: number) => {
                      if (ctx.isCurrent) return null;
                      const isCompany = ctx.contextType === "officer_company";
                      const isLinked = ctx.contextType === "linked_account";
                      const isGuardian = ctx.contextType === "guardian";
                      const isGuardianReturn = ctx.contextType === "guardian_return";
                      const isFo = ctx.contextType === "fo";
                      const isSubject = ["szco", "po", "ts", "vs", "os"].includes(ctx.contextType);
                      const ctxKey = isSubject ? ctx.subjectId : (ctx.companyId ?? ctx.userId);
                      const iconEl = isCompany ? (
                        <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      ) : isLinked ? (
                        <UserCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      ) : isGuardian ? (
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      ) : isGuardianReturn ? (
                        <ArrowLeft className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                      ) : isSubject ? (
                        ctx.contextType === "szco" ? <Briefcase className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" /> :
                        ctx.contextType === "po" ? <Building2 className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" /> :
                        ctx.contextType === "vs" ? <Landmark className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" /> :
                        ctx.contextType === "ts" ? <Heart className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" /> :
                        <Grid3X3 className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      );
                      const iconBg = isCompany || isLinked || isGuardian
                        ? "bg-blue-100 dark:bg-blue-900/30"
                        : isGuardianReturn
                          ? "bg-amber-100 dark:bg-amber-900/30"
                          : isSubject
                            ? "bg-violet-100 dark:bg-violet-900/30"
                            : "bg-emerald-100 dark:bg-emerald-900/30";
                      return (
                        <DropdownMenuItem
                          key={`${ctx.contextType}-${ctxKey}-${idx}`}
                          className="flex items-center gap-2 py-2 cursor-pointer mx-1 rounded"
                          onClick={async () => {
                            if (ctx.isCurrent) return;
                            try {
                              if (isLinked || isGuardian || isGuardianReturn) {
                                await apiRequest("POST", "/api/account-link/switch", { targetUserId: ctx.userId });
                                window.location.href = "/";
                              } else if (isCompany) {
                                localStorage.removeItem("atk_context_fo");
                                await apiRequest("PUT", "/api/app-user/active", { activeCompanyId: ctx.companyId, activeSubjectId: null });
                                window.location.href = "/";
                              } else if (isSubject) {
                                localStorage.removeItem("atk_context_fo");
                                if (ctx.isSubjectLink && ctx.linkId) {
                                  await apiRequest("POST", "/api/account-link/switch", { subjectLinkId: ctx.linkId });
                                } else {
                                  await apiRequest("PUT", "/api/app-user/active", { activeSubjectId: ctx.subjectId, activeCompanyId: null });
                                }
                                window.location.href = "/";
                              } else if (isFo) {
                                localStorage.setItem("atk_context_fo", "1");
                                await apiRequest("PUT", "/api/app-user/active", { activeCompanyId: null, activeSubjectId: null });
                                window.location.href = "/";
                              }
                            } catch (err: any) {
                              toast({ title: "Chyba pri prepínaní kontextu", variant: "destructive" });
                            }
                          }}
                          data-testid={`item-context-${ctx.contextType}-${ctxKey}`}
                        >
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                            {iconEl}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${ctx.isCurrent ? "text-foreground" : "text-muted-foreground"}`}>
                              {ctx.label}
                              {ctx.isCurrent && <span className="ml-1 text-xs text-emerald-600 dark:text-emerald-400">(aktívny)</span>}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">{ctx.subLabel}</p>
                          </div>
                        </DropdownMenuItem>
                      );
                    })}
                  </>
                )}

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="flex items-center gap-3 text-blue-600 dark:text-blue-400 cursor-pointer mx-1 rounded"
                  onClick={() => setAccountLinkModalOpen(true)}
                  data-testid="button-add-account-link"
                >
                  <Plus className="w-4 h-4 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm">Prepojiť nový účet</p>
                    <p className="text-xs text-muted-foreground font-normal">Pre iný e-mail / druhý login</p>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => photoInputRef.current?.click()} disabled={uploading} data-testid="button-upload-photo" className="mx-1 rounded">
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? "Nahravam..." : "Nahrať fotku"}
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setLoginHistoryOpen(true)}
                  data-testid="button-login-history"
                  className="mx-1 rounded"
                >
                  <History className="w-4 h-4 mr-2" />
                  Archív prihlásení
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); logout(); }} data-testid="button-logout" className="mx-1 rounded mb-1">
                  <LogOut className="w-4 h-4 mr-2" />
                  Odhlásiť sa
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          {isActingAsLinkedSubject && (
            <div className="bg-orange-600 text-white px-4 py-2 flex items-center justify-between flex-shrink-0" data-testid="banner-subject-context">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4" />
                <span className="text-sm font-medium">
                  Konáte v mene: {activeIdentityLabel} ({activeIdentitySubLabel ?? activeIdentityEntry?.type ?? "—"})
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-orange-700 gap-1.5"
                onClick={() => {
                  setActive.mutate({ activeSubjectId: null });
                }}
                data-testid="button-subject-context-exit"
              >
                <X className="w-4 h-4" />
                Ukončiť
              </Button>
            </div>
          )}

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
        activeStateId={appUser?.activeStateId ?? null}
        loginFlow={loginFlow}
        identityContexts={loginIdentityOptions}
        onSelectIdentity={handleContextSelectIdentity}
        onSelectState={handleContextSelectState}
        onSelectCompany={handleContextSelectCompany}
        onSelectDivision={handleContextSelectDivision}
        onBack={handleContextBack}
        onClose={loginFlow ? () => {} : () => setContextOverlayOpen(false)}
      />
      <AccountLinkModal
        open={accountLinkModalOpen}
        onClose={() => setAccountLinkModalOpen(false)}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/account-link/list"] })}
      />

      <Dialog open={loginHistoryOpen} onOpenChange={setLoginHistoryOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-5xl w-full h-[95vh] max-h-[95vh] flex flex-col p-0 gap-0 overflow-hidden" data-testid="dialog-login-history">
          <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <History className="w-4 h-4" />
              Archív prihlásení
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {loginHistoryLoading ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Načítavam...</div>
            ) : !loginHistory || loginHistory.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Žiadne záznamy</div>
            ) : (
              <table className="w-full text-sm border-collapse">
                <thead className="sticky top-0 bg-background z-10 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-12">#</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Prihlásenie</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Odhlásenie</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Trvanie</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">IP adresa</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kontext</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Dôvod ukončenia</th>
                  </tr>
                </thead>
                <tbody>
                  {loginHistory.map((row, idx) => {
                    const isActive = !row.logoutAt;
                    return (
                      <tr
                        key={row.id}
                        data-testid={`row-login-history-${row.id}`}
                        className={`border-b transition-colors ${isActive ? "bg-emerald-50 dark:bg-emerald-950/20" : "hover:bg-muted/40"}`}
                      >
                        <td className="px-4 py-3 text-muted-foreground tabular-nums">{loginHistory.length - idx}</td>
                        <td className="px-4 py-3 whitespace-nowrap tabular-nums font-mono text-xs">
                          {formatDateTimeSlovak(new Date(row.loginAt))}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap tabular-nums font-mono text-xs">
                          {row.logoutAt ? formatDateTimeSlovak(new Date(row.logoutAt)) : (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium font-sans">aktívna</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={isActive ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""}>
                            {formatDuration(row.loginAt, row.logoutAt)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {row.ipAddress || "–"}
                        </td>
                        <td className="px-4 py-3 max-w-[200px] truncate" title={row.contextLabel || undefined}>
                          {row.contextLabel || <span className="text-muted-foreground">–</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">–</span>
                          ) : (
                            <span className="text-muted-foreground">{formatLogoutReason(row.logoutReason)}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {warningOverlay}
    </SidebarProvider>
  );
}
