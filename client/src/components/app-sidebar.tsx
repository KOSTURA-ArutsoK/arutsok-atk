import { useState, useEffect } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useAppUser } from "@/hooks/use-app-user";
import { useHelp } from "@/contexts/help-context";
import { RankBadge } from "@/components/rank-badge";
import { DataLinkaIcon } from "@/components/icons/data-linka-icon";
import { ClientGroupsIcon } from "@/components/icons/client-groups-icon";
import { StrukturaIcon } from "@/components/icons/struktura-icon";
import { useQuery } from "@tanstack/react-query";
import { isAdmin as checkIsAdmin } from "@/lib/utils";
import type { CircleConfig, SidebarLinkSection, SidebarLink } from "@shared/schema";
import {
  LayoutDashboard,
  Building2,
  Users,
  Package,
  Percent,
  Settings,
  History,
  Briefcase,
  Shield,
  Archive,
  HelpCircle,
  Sliders,
  ChevronRight,
  FileText,
  FileCog,
  FileStack,
  ListChecks,
  ClipboardList,
  Trash2,
  UserCog,
  ShieldCheck,
  Phone,
  Timer,
  Eye,
  Contact,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Network,
  TrendingUp,
  Layers,
  Info,
  Newspaper,
  FileDown,
  ExternalLink,
  Calendar,
  KeyRound,
  Globe,
  Building,
  FileSpreadsheet,
  Database,
  Zap,
  BarChart3,
  FileInput,
  ArrowRightLeft,
  ShieldPlus,
  Link2,
  Mail,
  FileBarChart,
  Target,
  User,
  Plus,
  FileSignature,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

const topItems = [
  { href: "/", icon: LayoutDashboard, label: "Prehlad" },
];

const financieItems = [
  { href: "/siet", icon: Network, label: "Sieť" },
  { href: "/ziadosti", icon: FileInput, label: "Žiadosti" },
  { href: "/prestup", icon: ArrowRightLeft, label: "Prestup" },
  { href: "/body", icon: TrendingUp, label: "Body" },
  { href: "/provizie", icon: ArrowDownLeft, label: "Provizie" },
  { href: "/odmeny", icon: ArrowUpRight, label: "Odmeny" },
  { href: "/commissions", icon: Percent, label: "Sadzby" },
];

const reportyItems = [
  { href: "/reporty-odosielanie", icon: Mail, label: "Odosielanie" },
  { href: "/reporty-nbs", icon: FileBarChart, label: "Reporty pre NBS", badge: "Špecial" },
];

const informacieItems = [
  { href: "/novinky", icon: Newspaper, label: "Novinky" },
  { href: "/dokumenty-na-stiahnutie", icon: FileDown, label: "Dokumenty na stiahnutie" },
  { href: "/externe-pristupy", icon: ExternalLink, label: "Externe pristupy" },
  { href: "/kalendar", icon: Calendar, label: "Kalendar" },
];

const partneriProduktyItems = [
  { href: "/partners", icon: Briefcase, label: "Zoznam partnerov" },
  { href: "/products", icon: Package, label: "Katalog produktov" },
  { href: "/partner-contacts", icon: Contact, label: "Kontaktne osoby" },
];

const klientiItems: { href: string; icon: React.ElementType; label: string }[] = [
  { href: "/subjects", icon: Users, label: "Zoznam klientov" },
  { href: "/client-groups", icon: ClientGroupsIcon, label: "Skupiny klientov" },
];

const zoznamZmluvChildren = [
  { href: "/contracts?view=moje", icon: User, label: "Moje zmluvy" },
  { href: "/contracts?view=portfolio", icon: Briefcase, label: "Klientske portfólio" },
];

const zmluvySubItems = [
  { href: "/contracts?view=moje", icon: Users, label: "Moje zmluvy", tooltip: "Zmluvy, kde ste poistencom alebo vlastníkom", roles: ["user", "agent", "admin", "superadmin", "prezident", "architekt"] },
  { href: "/contracts?view=portfolio", icon: Briefcase, label: "Klientske portfólio", tooltip: "Zoznam klientov a zmlúv, ktoré spravujete", roles: ["agent", "admin", "superadmin", "prezident", "architekt"] },
  { href: "/contracts?view=dokumentacia", icon: FileSignature, label: "Zmluvná dokumentácia", tooltip: "Zmluvy a dokumenty podpísané so spoločnosťou", roles: ["agent", "admin", "superadmin", "prezident", "architekt"] },
];

const spracovanieZmluvChildren = [
  { href: "/evidencia-zmluv", icon: ClipboardList, label: "Papierové zmluvy" },
  { href: "/datova-linka", icon: DataLinkaIcon, label: "Dátová linka" },
];

const nastaveniaSablonChildren = [
  { href: "/contract-template-management", icon: FileStack, label: "Sprava sablon" },
  { href: "/contract-statuses", icon: ListChecks, label: "Stavy zmluv" },
];

const protokolyChildren = [
  { href: "/contract-inventories", icon: FileStack, label: "Sprievodky" },
  { href: "/supisky", icon: ClipboardList, label: "Supisky" },
];

const importItems = [
  { href: "/hromadne-stavy", icon: FileSpreadsheet, label: "Hromadný import" },
  { href: "/import-archive", icon: Archive, label: "Archív importov" },
  { href: "/bulk-actions", icon: Zap, label: "Hromadné akcie" },
];

const allZmluvyHrefs = [
  "/contracts",
  "/digitalne-zmluvy",
  ...zmluvySubItems.map(i => i.href),
  ...spracovanieZmluvChildren.map(i => i.href),
  ...nastaveniaSablonChildren.map(i => i.href),
  ...protokolyChildren.map(i => i.href),
  ...importItems.map(i => i.href),
];

const spravaPristupovItems = [
  { href: "/users", icon: UserCog, label: "Pouzivatelia" },
  { href: "/permission-groups", icon: ShieldCheck, label: "Pravomoci skupiny" },
  { href: "/doba-prihlasenia", icon: Timer, label: "Doba prihlasenia" },
];

const specifikacieItems = [
  { href: "/settings-states", icon: Globe, label: "Staty" },
  { href: "/settings-companies", icon: Building, label: "Spolocnosti" },
  { href: "/settings-divisions", icon: Layers, label: "Divizie" },
];

const nastavenieSystemuItems = [
  { href: "/dashboard-settings", icon: Eye, label: "Nastavenie prehladov" },
  { href: "/link-settings", icon: Link2, label: "Nastavenie odkazov" },
  { href: "/nastavenie-obchodnych-prilezitosti", icon: Target, label: "Obchodne prilezitosti" },
];

const nastavenieDirectItems = [
  { href: "/support", icon: Phone, label: "Podpora a registracia" },
  { href: "/history", icon: History, label: "Logy" },
  { href: "/archive", icon: Trash2, label: "Kos" },
];

const allNastavenieHrefs = [
  ...spravaPristupovItems.map(i => i.href),
  ...specifikacieItems.map(i => i.href),
  ...nastavenieSystemuItems.map(i => i.href),
  ...nastavenieDirectItems.map(i => i.href),
];

function CollapsibleMenu({
  label,
  icon: Icon,
  items,
  location,
  searchString,
  testId,
  menuId,
  openMenuId,
  setOpenMenuId,
}: {
  label: string;
  icon: React.ElementType;
  items: { href: string; icon: React.ElementType; label: string; badge?: string }[];
  location: string;
  searchString: string;
  testId: string;
  menuId: string;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
}) {
  const matchesHref = (href: string) => {
    if (href.includes("?")) {
      const [path, queryString] = href.split("?");
      if (location !== path) return false;
      const targetParams = new URLSearchParams(queryString);
      const currentParams = new URLSearchParams(searchString);
      for (const [key, value] of targetParams.entries()) {
        if (currentParams.get(key) !== value) return false;
      }
      return true;
    }
    return location === href;
  };
  const isAnyActive = items.some(item => matchesHref(item.href));
  const isOpen = openMenuId === menuId;

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={(val) => setOpenMenuId(val ? menuId : null)}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            data-testid={testId}
            className={isAnyActive ? "text-sidebar-accent-foreground font-medium" : ""}
          >
            <Icon className="w-4 h-4" />
            <span className="flex-1">{label}</span>
            <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`} />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {items.map(item => (
              <SidebarMenuSubItem key={item.href}>
                <SidebarMenuSubButton
                  asChild
                  isActive={matchesHref(item.href)}
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                  className="py-1.5"
                >
                  <Link href={item.href}>
                    <item.icon className="w-4 h-4" />
                    <span className="text-[13px]">{item.label}</span>
                    {item.badge && (
                      <span className="ml-auto text-[10px] text-blue-400/80 font-medium">{item.badge}</span>
                    )}
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

function MojeUlohyMenuItem({ location }: { location: string }) {
  const { data: taskCount } = useQuery<{ count: number; nonCalendarCount: number; upcomingEventsCount: number; todayEventsCount: number; nbsAlert?: { show: boolean; daysLeft: number } }>({
    queryKey: ["/api/my-tasks/count"],
    refetchInterval: 30000,
  });
  const nonCalendarCount = taskCount?.nonCalendarCount || 0;
  const todayEventsCount = taskCount?.todayEventsCount || 0;
  const showBadge = nonCalendarCount > 0 || todayEventsCount > 0;
  const badgeColor = nonCalendarCount > 0 ? "bg-red-600" : "bg-blue-500";
  const badgeValue = nonCalendarCount > 0 ? nonCalendarCount : todayEventsCount;

  const nbsAlert = taskCount?.nbsAlert;
  let nbsColorClass = "";
  let nbsFontSize = "text-[10px]";
  if (nbsAlert?.show) {
    if (nbsAlert.daysLeft <= 3) { nbsColorClass = "text-red-500 animate-pulse font-black"; nbsFontSize = "text-xs"; }
    else if (nbsAlert.daysLeft <= 7) { nbsColorClass = "text-red-500 font-bold"; nbsFontSize = "text-xs"; }
    else if (nbsAlert.daysLeft <= 14) { nbsColorClass = "text-orange-400 font-bold"; }
    else { nbsColorClass = "text-blue-400 font-bold"; }
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={location === "/moje-ulohy"}
        data-testid="nav-moje-ulohy"
      >
        <Link href="/moje-ulohy">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className="w-4 h-4 shrink-0" fill="currentColor"><path d="M160-200h640v-80H160v80Zm160-240h80v-120q0-33 23.5-56.5T480-640v-80q-66 0-113 47t-47 113v120Zm160 160Zm-200-80h400v-200q0-83-58.5-141.5T480-760q-83 0-141.5 58.5T280-560v200ZM160-120q-33 0-56.5-23.5T80-200v-80q0-33 23.5-56.5T160-360h40v-200q0-117 81.5-198.5T480-840q117 0 198.5 81.5T760-560v200h40q33 0 56.5 23.5T880-280v80q0 33-23.5 56.5T800-120H160Zm320-240Z"/></svg>
          <span>Moje úlohy</span>
          <span className="flex-1 text-center">
            {nbsAlert?.show && (
              <span className={`${nbsFontSize} ${nbsColorClass}`} data-testid="badge-nbs-alert">
                NBS !
              </span>
            )}
          </span>
          {showBadge && (
            <span className={`shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full ${badgeColor} text-[10px] font-bold text-white px-1`} data-testid="badge-task-count">
              {badgeValue}
            </span>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function SidebarGroupCollapsible({ groupName, links }: { groupName: string; links: SidebarLink[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 w-full px-2 pt-2 pb-1 text-[10px] font-semibold text-sidebar-foreground/70 uppercase tracking-wider hover:text-sidebar-foreground transition-colors"
        data-testid={`nav-group-${groupName}`}
      >
        <ChevronRight className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`} />
        <span>{groupName}</span>
      </button>
      {open && links.map(link => (
        <SidebarMenuSubItem key={link.id}>
          <SidebarMenuSubButton asChild data-testid={`nav-link-${link.id}`}>
            <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sidebar-foreground">
              <span className="text-sidebar-foreground">{link.name}</span>
              <ExternalLink className="ml-auto w-3 h-3 text-sidebar-foreground/50" />
            </a>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ))}
    </div>
  );
}

export function AppSidebar() {
  const [location] = useLocation();
  const { data: appUser } = useAppUser();
  const { helpEnabled, toggleHelp } = useHelp();
  const { data: pointsData } = useQuery<{ points: number }>({
    queryKey: ["/api/app-users/my-points"],
    staleTime: 1000 * 60 * 5,
  });
  const divisionId = appUser?.activeDivisionId;
  const { data: activeDivisionData } = useQuery<any>({
    queryKey: ["/api/divisions", divisionId],
    queryFn: async () => {
      const res = await fetch(`/api/divisions/${divisionId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!divisionId,
    staleTime: 1000 * 60 * 5,
  });
  const isDivisionEnded = activeDivisionData ? activeDivisionData.isActive === false : false;
  const { data: sidebarSections } = useQuery<SidebarLinkSection[]>({
    queryKey: ["/api/sidebar-link-sections", divisionId],
    queryFn: async () => {
      const res = await fetch(`/api/sidebar-link-sections${divisionId ? `?divisionId=${divisionId}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!divisionId,
  });
  const { data: sidebarLinksData } = useQuery<SidebarLink[]>({
    queryKey: ["/api/sidebar-links", divisionId],
    queryFn: async () => {
      const res = await fetch(`/api/sidebar-links${divisionId ? `?divisionId=${divisionId}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!divisionId,
  });
  const { data: businessOpportunities } = useQuery<{ id: number; title: string }[]>({
    queryKey: ["/api/business-opportunities", divisionId],
    queryFn: async () => {
      const res = await fetch("/api/business-opportunities", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!appUser?.activeCompanyId,
  });
  const { data: digitalContractsData } = useQuery<{ count: number }>({
    queryKey: ["/api/digital-contracts/count"],
    staleTime: 1000 * 60 * 5,
  });
  const digitalContractsCount = digitalContractsData?.count ?? 0;

  const { data: bulkImportTypes = [] } = useQuery<any[]>({
    queryKey: ["/api/bulk-status-import-types"],
    staleTime: 1000 * 60 * 5,
  });

  const allMenus = [
    { id: "nastavenia", items: [...spravaPristupovItems, ...specifikacieItems, ...nastavenieSystemuItems, ...nastavenieDirectItems] },
    { id: "sprava-pristupov", items: spravaPristupovItems },
    { id: "specifikacie", items: specifikacieItems },
    { id: "nastavenie-systemu", items: nastavenieSystemuItems },
    { id: "partneri", items: partneriProduktyItems },
    { id: "klienti", items: klientiItems },
    { id: "zmluvy", items: [...zmluvySubItems, ...spracovanieZmluvChildren, { href: "/digitalne-zmluvy", icon: Globe, label: "Digitálne zmluvy" }, ...protokolyChildren, ...importItems, ...nastaveniaSablonChildren] },
    { id: "financie", items: financieItems },
    { id: "reporty", items: reportyItems },
    { id: "informacie", items: informacieItems },
  ];
  const currentSearch = useSearch();
  const currentView = new URLSearchParams(currentSearch).get("view");
  const locationWithSearch = currentView ? `${location}?view=${currentView}` : location;

  const activeMenuId = allMenus.find(m => m.items.some(i => i.href === location || i.href === locationWithSearch))?.id || null;
  const [openMenuId, setOpenMenuId] = useState<string | null>(activeMenuId);

  const isNastavenieActive = allNastavenieHrefs.includes(location);
  const isNastavenieOpen = openMenuId === "nastavenia";
  const nastavenieInitialSub = spravaPristupovItems.some(i => i.href === location) ? "sprava-pristupov"
    : specifikacieItems.some(i => i.href === location) ? "specifikacie"
    : nastavenieSystemuItems.some(i => i.href === location) ? "nastavenie-systemu" : null;
  const [nastavenieSubId, setNastavenieSubId] = useState<string | null>(nastavenieInitialSub);

  const isZmluvyActive = allZmluvyHrefs.some(h => {
    const hPath = h.split("?")[0];
    return hPath === location || h === location;
  });
  const isZmluvyOpen = openMenuId === "zmluvy";
  const zmluvyInitialSub = (spracovanieZmluvChildren.some(i => i.href === location) || location === "/digitalne-zmluvy") ? "spracovanie"
    : (location === "/contracts") ? "zoznam"
    : protokolyChildren.some(i => i.href === location) ? "protokoly"
    : importItems.some(i => i.href === location) ? "import"
    : nastaveniaSablonChildren.some(i => i.href === location) ? "sablony"
    : location === "/contracts" ? "zoznam-zmluv" : null;
  const [zmluvySubId, setZmluvySubId] = useState<string | null>(zmluvyInitialSub);

  const userRole = appUser?.role || "user";
  const visibleZmluvySubItems = zmluvySubItems.filter(item => item.roles.includes(userRole));
  const showZmluvyCascade = visibleZmluvySubItems.length > 1;

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-sidebar-primary/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-sidebar-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight">ArutsoK</h1>
            <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">Secure Platform</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Moduly</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {topItems.map(item => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.href}
                    data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                  >
                    <Link href={item.href}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              <Collapsible
                open={isNastavenieOpen}
                onOpenChange={(val) => setOpenMenuId(val ? "nastavenia" : null)}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      data-testid="nav-menu-nastavenia"
                      className={isNastavenieActive ? "text-sidebar-accent-foreground font-medium" : ""}
                    >
                      <Settings className="w-4 h-4" />
                      <span className="flex-1">Nastavenia</span>
                      <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isNastavenieOpen ? "rotate-90" : ""}`} />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub className="mx-2 px-2">
                      <SidebarMenuSubItem>
                        <Collapsible
                          open={nastavenieSubId === "sprava-pristupov"}
                          onOpenChange={(val) => setNastavenieSubId(val ? "sprava-pristupov" : null)}
                        >
                          <CollapsibleTrigger asChild>
                            <SidebarMenuSubButton
                              data-testid="nav-submenu-sprava-pristupov"
                              className={`cursor-pointer ${spravaPristupovItems.some(i => i.href === location) ? "text-sidebar-accent-foreground font-medium" : ""}`}
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span className="flex-1">Sprava prihlasenia</span>
                              <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${nastavenieSubId === "sprava-pristupov" ? "rotate-90" : ""}`} />
                            </SidebarMenuSubButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="ml-2 border-l border-border pl-1.5 mt-1 space-y-0.5">
                              {spravaPristupovItems.map(item => (
                                <SidebarMenuSubItem key={item.href}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={location === item.href}
                                    data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                                  >
                                    <Link href={item.href}>
                                      <item.icon className="w-3.5 h-3.5 shrink-0" />
                                      <span>{item.label}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </SidebarMenuSubItem>

                      <SidebarMenuSubItem>
                        <Collapsible
                          open={nastavenieSubId === "specifikacie"}
                          onOpenChange={(val) => setNastavenieSubId(val ? "specifikacie" : null)}
                        >
                          <CollapsibleTrigger asChild>
                            <SidebarMenuSubButton
                              data-testid="nav-submenu-specifikacie"
                              className={`cursor-pointer ${specifikacieItems.some(i => i.href === location) ? "text-sidebar-accent-foreground font-medium" : ""}`}
                            >
                              <Layers className="w-3.5 h-3.5" />
                              <span>Specifikacie</span>
                              <span className="flex-1 text-center">
                                <span className="text-yellow-400 text-[10px] font-semibold">(Global)</span>
                              </span>
                              <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${nastavenieSubId === "specifikacie" ? "rotate-90" : ""}`} />
                            </SidebarMenuSubButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="ml-2 border-l border-border pl-1.5 mt-1 space-y-0.5">
                              {specifikacieItems.map(item => (
                                <SidebarMenuSubItem key={item.href}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={location === item.href}
                                    data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                                  >
                                    <Link href={item.href}>
                                      <item.icon className="w-3.5 h-3.5" />
                                      <span>{item.label}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </SidebarMenuSubItem>

                      <SidebarMenuSubItem>
                        <Collapsible
                          open={nastavenieSubId === "nastavenie-systemu"}
                          onOpenChange={(val) => setNastavenieSubId(val ? "nastavenie-systemu" : null)}
                        >
                          <CollapsibleTrigger asChild>
                            <SidebarMenuSubButton
                              data-testid="nav-submenu-nastavenie-systemu"
                              className={`cursor-pointer ${nastavenieSystemuItems.some(i => i.href === location) ? "text-sidebar-accent-foreground font-medium" : ""}`}
                            >
                              <Sliders className="w-3.5 h-3.5" />
                              <span className="flex-1">Nastavenie systemu</span>
                              <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${nastavenieSubId === "nastavenie-systemu" ? "rotate-90" : ""}`} />
                            </SidebarMenuSubButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="ml-2 border-l border-border pl-1.5 mt-1 space-y-0.5">
                              {nastavenieSystemuItems.map(item => (
                                <SidebarMenuSubItem key={item.href}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={location === item.href}
                                    data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                                  >
                                    <Link href={item.href}>
                                      <item.icon className="w-3.5 h-3.5 shrink-0" />
                                      <span>{item.label}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </SidebarMenuSubItem>

                      {nastavenieDirectItems.map(item => (
                        <SidebarMenuSubItem key={item.href}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={location === item.href}
                            data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                          >
                            <Link href={item.href}>
                              <item.icon className="w-3.5 h-3.5" />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              <CollapsibleMenu
                label="Štruktúra"
                icon={StrukturaIcon}
                items={[
                  { href: "/sektory-zmluv", icon: FileText, label: "Štruktúra sektorov (A)" },
                  { href: "/sektory-subjektov", icon: Database, label: "UI Subjektov (B)" },
                  { href: "/profil-subjektu", icon: Users, label: "Profil subjektu" },
                ]}
                location={location}
                searchString={currentSearch}
                testId="nav-sektory"
                menuId="sektory"
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <MojeUlohyMenuItem location={location} />
              {(() => {
                const allLinks = sidebarLinksData || [];
                const section = sidebarSections?.[0];
                const sectionName = section?.name || "Odkazy - linky";
                const sectionLinks = section ? allLinks.filter(l => l.sectionId === section.id) : [];
                const menuKey = "sidebar-odkazy";
                if (sectionLinks.length === 0) {
                  return (
                    <Collapsible open={openMenuId === menuKey} onOpenChange={(open) => setOpenMenuId(open ? menuKey : null)}>
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton data-testid="nav-section-odkazy" className="text-sidebar-foreground">
                            <Link2 className="w-4 h-4 text-sidebar-foreground" />
                            <span className="text-sidebar-foreground">{sectionName}</span>
                            {isDivisionEnded && (
                              <span className="ml-1 text-[9px] font-semibold text-amber-400 uppercase tracking-wider">ukončená</span>
                            )}
                            <ChevronRight className={`ml-auto h-4 w-4 transition-transform ${openMenuId === menuKey ? "rotate-90" : ""}`} />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {isDivisionEnded && (
                              <SidebarMenuSubItem>
                                <div className="px-2 py-1.5 text-[10px] text-amber-400/80 italic">
                                  Divízia ukončená – linky nie sú dostupné
                                </div>
                              </SidebarMenuSubItem>
                            )}
                            {!isDivisionEnded && (
                              <SidebarMenuSubItem>
                                <SidebarMenuSubButton asChild data-testid="nav-link-kostura">
                                  <a href="https://kostura.sk" target="_blank" rel="noopener noreferrer" className="text-sidebar-foreground">
                                    <span className="text-sidebar-foreground">kostura.sk</span>
                                    <ExternalLink className="ml-auto w-3 h-3 text-sidebar-foreground/50" />
                                  </a>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            )}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }
                const groups: Record<string, SidebarLink[]> = {};
                for (const l of sectionLinks) {
                  if (!groups[l.groupName]) groups[l.groupName] = [];
                  groups[l.groupName].push(l);
                }
                return (
                  <Collapsible open={openMenuId === menuKey} onOpenChange={(open) => setOpenMenuId(open ? menuKey : null)}>
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton data-testid="nav-section-odkazy" className="text-sidebar-foreground">
                          <Link2 className="w-4 h-4 text-sidebar-foreground" />
                          <span className="text-sidebar-foreground">{sectionName}</span>
                          <ChevronRight className={`ml-auto h-4 w-4 transition-transform ${openMenuId === menuKey ? "rotate-90" : ""}`} />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {Object.entries(groups).map(([groupName, groupLinks]) => (
                            <SidebarGroupCollapsible key={groupName} groupName={groupName} links={groupLinks} />
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })()}

              {(() => {
                const ops = businessOpportunities || [];
                const menuKey = "sidebar-obch-prilezitosti";
                const isActiveOp = location.startsWith("/obchodne-prilezitosti");
                if (ops.length === 0) {
                  return (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isActiveOp}
                        data-testid="nav-obchodne-prilezitosti"
                      >
                        <Link href="/obchodne-prilezitosti">
                          <Target className="w-4 h-4" />
                          <span>Obchodne prilezitosti</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }
                if (ops.length === 1) {
                  return (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        isActive={isActiveOp}
                        data-testid="nav-obchodne-prilezitosti"
                      >
                        <Link href={`/obchodne-prilezitosti?id=${ops[0].id}`}>
                          <Target className="w-4 h-4" />
                          <span>Obchodna prilezitost</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }
                return (
                  <Collapsible open={openMenuId === menuKey} onOpenChange={(open) => setOpenMenuId(open ? menuKey : null)}>
                    <SidebarMenuItem>
                      <CollapsibleTrigger asChild>
                        <SidebarMenuButton data-testid="nav-obchodne-prilezitosti" className={isActiveOp ? "bg-accent text-accent-foreground" : ""}>
                          <Target className="w-4 h-4" />
                          <span>Obchodne prilezitosti</span>
                          <ChevronRight className={`ml-auto h-4 w-4 transition-transform ${openMenuId === menuKey ? "rotate-90" : ""}`} />
                        </SidebarMenuButton>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SidebarMenuSub>
                          {ops.map((op) => (
                            <SidebarMenuSubItem key={op.id}>
                              <SidebarMenuSubButton
                                asChild
                                isActive={location === `/obchodne-prilezitosti?id=${op.id}`}
                                data-testid={`nav-op-${op.id}`}
                              >
                                <Link href={`/obchodne-prilezitosti?id=${op.id}`}>
                                  <span>{op.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          ))}
                        </SidebarMenuSub>
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })()}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <CollapsibleMenu
                label="Partneri a produkty"
                icon={Briefcase}
                items={partneriProduktyItems}
                location={location}
                searchString={currentSearch}
                testId="nav-menu-partneri-produkty"
                menuId="partneri"
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
              />
              <CollapsibleMenu
                label="Subjekty"
                icon={Users}
                items={klientiItems}
                location={location}
                searchString={currentSearch}
                testId="nav-menu-klienti"
                menuId="klienti"
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
              />
              <Collapsible
                open={isZmluvyOpen}
                onOpenChange={(val) => setOpenMenuId(val ? "zmluvy" : null)}
                className="group/collapsible"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      data-testid="nav-menu-zmluvy"
                      className={isZmluvyActive ? "text-sidebar-accent-foreground font-medium" : ""}
                    >
                      <FileText className="w-4 h-4" />
                      <span className="flex-1">Zmluvy</span>
                      <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isZmluvyOpen ? "rotate-90" : ""}`} />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub className="mx-2 px-2">
                      <SidebarMenuSubItem>
                        <Collapsible
                          open={zmluvySubId === "spracovanie"}
                          onOpenChange={(val) => setZmluvySubId(val ? "spracovanie" : null)}
                        >
                          <CollapsibleTrigger asChild>
                            <SidebarMenuSubButton
                              data-testid="nav-submenu-spracovanie-zmluv"
                              className={`cursor-pointer ${(spracovanieZmluvChildren.some(i => i.href === location) || location === "/digitalne-zmluvy") ? "text-sidebar-accent-foreground font-medium" : ""}`}
                            >
                              <ClipboardList className="w-3.5 h-3.5" />
                              <span className="flex-1">Spracovanie zmlúv</span>
                              <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${zmluvySubId === "spracovanie" ? "rotate-90" : ""}`} />
                            </SidebarMenuSubButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="ml-2 border-l border-border pl-1.5 mt-1 space-y-0.5">
                              <SidebarMenuSubItem key="/evidencia-zmluv">
                                <SidebarMenuSubButton asChild isActive={location === "/evidencia-zmluv"} data-testid="nav-papierové-zmluvy">
                                  <Link href="/evidencia-zmluv">
                                    <ClipboardList className="w-3.5 h-3.5" />
                                    <span>Papierové zmluvy</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                              <SidebarMenuSubItem key="/digitalne-zmluvy">
                                <SidebarMenuSubButton asChild isActive={location === "/digitalne-zmluvy"} data-testid="nav-digitalne-zmluvy" className="w-full">
                                  <Link href="/digitalne-zmluvy" className="flex items-center justify-between w-full gap-0">
                                    <span className="flex items-center gap-2 min-w-0">
                                      <Globe className="w-3.5 h-3.5 shrink-0" />
                                      <span className="truncate">Digitálne zmluvy</span>
                                    </span>
                                    <span className="shrink-0 text-[11px] font-bold text-blue-800 dark:text-blue-400 tabular-nums">{digitalContractsCount}x API</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                              <SidebarMenuSubItem key="/datova-linka">
                                <SidebarMenuSubButton asChild isActive={location === "/datova-linka"} data-testid="nav-dátová-linka">
                                  <Link href="/datova-linka">
                                    <DataLinkaIcon className="w-3.5 h-3.5" />
                                    <span>Dátová linka</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </SidebarMenuSubItem>

                      {showZmluvyCascade ? (
                        <SidebarMenuSubItem>
                          <Collapsible
                            open={zmluvySubId === "zoznam-zmluv"}
                            onOpenChange={(val) => setZmluvySubId(val ? "zoznam-zmluv" : null)}
                          >
                            <CollapsibleTrigger asChild>
                              <SidebarMenuSubButton
                                data-testid="nav-submenu-zoznam-zmluv"
                                className={`cursor-pointer ${location === "/contracts" ? "text-sidebar-accent-foreground font-medium" : ""}`}
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span className="flex-1">Zoznam zmlúv</span>
                                <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${zmluvySubId === "zoznam-zmluv" ? "rotate-90" : ""}`} />
                              </SidebarMenuSubButton>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="ml-2 border-l border-border pl-1.5 mt-1 space-y-0.5">
                                {visibleZmluvySubItems.map(item => (
                                  <SidebarMenuSubItem key={item.href}>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <SidebarMenuSubButton
                                            asChild
                                            isActive={locationWithSearch === item.href}
                                            data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                                          >
                                            <Link href={item.href}>
                                              <item.icon className="w-3.5 h-3.5" />
                                              <span>{item.label}</span>
                                            </Link>
                                          </SidebarMenuSubButton>
                                        </TooltipTrigger>
                                        <TooltipContent side="right">
                                          <p>{item.tooltip}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </SidebarMenuSubItem>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </SidebarMenuSubItem>
                      ) : (
                        visibleZmluvySubItems.map(item => (
                          <SidebarMenuSubItem key={item.href}>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={locationWithSearch === item.href}
                                    data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                                  >
                                    <Link href={item.href}>
                                      <item.icon className="w-3.5 h-3.5" />
                                      <span>{item.label}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </TooltipTrigger>
                                <TooltipContent side="right">
                                  <p>{item.tooltip}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </SidebarMenuSubItem>
                        ))
                      )}


                      <SidebarMenuSubItem>
                        <Collapsible
                          open={zmluvySubId === "protokoly"}
                          onOpenChange={(val) => setZmluvySubId(val ? "protokoly" : null)}
                        >
                          <CollapsibleTrigger asChild>
                            <SidebarMenuSubButton
                              data-testid="nav-submenu-zoznam-protokolov"
                              className={`cursor-pointer ${location === "/contract-inventories" || location === "/supisky" ? "text-sidebar-accent-foreground font-medium" : ""}`}
                            >
                              <FileStack className="w-3.5 h-3.5" />
                              <span className="flex-1">Zoznam protokolov</span>
                              <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${zmluvySubId === "protokoly" ? "rotate-90" : ""}`} />
                            </SidebarMenuSubButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="ml-2 border-l border-border pl-1.5 mt-1 space-y-0.5">
                              {protokolyChildren.map(item => (
                                <SidebarMenuSubItem key={item.href}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={location === item.href}
                                    data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                                  >
                                    <Link href={item.href}>
                                      <item.icon className="w-3.5 h-3.5" />
                                      <span>{item.label}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </SidebarMenuSubItem>

                      <SidebarMenuSubItem>
                        <Collapsible
                          open={zmluvySubId === "import"}
                          onOpenChange={(val) => setZmluvySubId(val ? "import" : null)}
                        >
                          <CollapsibleTrigger asChild>
                            <SidebarMenuSubButton
                              data-testid="nav-submenu-hromadny-import"
                              className={`cursor-pointer ${importItems.some(i => i.href === location) ? "text-sidebar-accent-foreground font-medium" : ""}`}
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                              <span className="flex-1">Hromadné stavy</span>
                              <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${zmluvySubId === "import" ? "rotate-90" : ""}`} />
                            </SidebarMenuSubButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="ml-2 border-l border-border pl-1.5 mt-1 space-y-0.5">
                              {importItems.map(item => (
                                <SidebarMenuSubItem key={item.href}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={location === item.href}
                                    data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                                  >
                                    <Link href={item.href}>
                                      <item.icon className="w-3.5 h-3.5" />
                                      <span>{item.label}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                              {bulkImportTypes.length > 0 && (
                                <>
                                  <div className="px-2 pt-2 pb-0.5">
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Typy importov</span>
                                  </div>
                                  {bulkImportTypes.map((t: any) => (
                                    <SidebarMenuSubItem key={`bst-${t.id}`}>
                                      <SidebarMenuSubButton
                                        asChild
                                        isActive={location === `/hromadne-stavy`}
                                        data-testid={`nav-bulk-type-${t.id}`}
                                      >
                                        <Link href="/hromadne-stavy">
                                          <FileSpreadsheet className="w-3.5 h-3.5 text-muted-foreground" />
                                          <span className="truncate">{t.name}</span>
                                        </Link>
                                      </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                  ))}
                                </>
                              )}
                              <SidebarMenuSubItem>
                                <SidebarMenuSubButton
                                  asChild
                                  className="text-primary hover:text-primary border border-dashed border-primary/30 hover:border-primary/60 mt-1"
                                  data-testid="nav-vytvorit-hromadny-import"
                                >
                                  <Link href="/hromadne-stavy">
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Vytvoriť hromadný import</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </SidebarMenuSubItem>

                      <SidebarMenuSubItem>
                        <Collapsible
                          open={zmluvySubId === "sablony"}
                          onOpenChange={(val) => setZmluvySubId(val ? "sablony" : null)}
                        >
                          <CollapsibleTrigger asChild>
                            <SidebarMenuSubButton
                              data-testid="nav-submenu-nastavenia-sablon"
                              className={`cursor-pointer ${nastaveniaSablonChildren.some(i => i.href === location) ? "text-sidebar-accent-foreground font-medium" : ""}`}
                            >
                              <FileCog className="w-3.5 h-3.5" />
                              <span className="flex-1">Nastavenia sablon</span>
                              <ChevronRight className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${zmluvySubId === "sablony" ? "rotate-90" : ""}`} />
                            </SidebarMenuSubButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="ml-2 border-l border-border pl-1.5 mt-1 space-y-0.5">
                              {nastaveniaSablonChildren.map(item => (
                                <SidebarMenuSubItem key={item.href}>
                                  <SidebarMenuSubButton
                                    asChild
                                    isActive={location === item.href}
                                    data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, '-')}`}
                                  >
                                    <Link href={item.href}>
                                      <item.icon className="w-3.5 h-3.5" />
                                      <span>{item.label}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
              <CollapsibleMenu
                label="Financie"
                icon={Banknote}
                items={financieItems}
                location={location}
                searchString={currentSearch}
                testId="nav-menu-financie"
                menuId="financie"
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
              />
              {checkIsAdmin(appUser) && (
                <CollapsibleMenu
                  label="Reporty"
                  icon={FileBarChart}
                  items={reportyItems}
                  location={location}
                  searchString={currentSearch}
                  testId="nav-menu-reporty"
                  menuId="reporty"
                  openMenuId={openMenuId}
                  setOpenMenuId={setOpenMenuId}
                />
              )}
              <CollapsibleMenu
                label="Informacie"
                icon={Info}
                items={informacieItems}
                location={location}
                searchString={currentSearch}
                testId="nav-menu-informacie"
                menuId="informacie"
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
              />
              {checkIsAdmin(appUser) && (
                <SidebarMenuItem>
                  <Link href="/analytika">
                    <SidebarMenuButton
                      isActive={location === "/analytika"}
                      data-testid="nav-analytika"
                    >
                      <BarChart3 className="w-4 h-4" />
                      <span>Analytika</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              )}
              {checkIsAdmin(appUser) && (
                <SidebarMenuItem>
                  <Link href="/holding-dashboard">
                    <SidebarMenuButton
                      isActive={location === "/holding-dashboard"}
                      data-testid="nav-holding-dashboard"
                    >
                      <TrendingUp className="w-4 h-4" />
                      <span>Holding Dashboard</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={toggleHelp}
                  data-testid="nav-pomoc"
                >
                  <HelpCircle className="w-4 h-4" />
                  <span className="flex-1">Pomoc</span>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${helpEnabled ? 'text-emerald-500' : 'text-destructive'}`}>
                    {helpEnabled ? "Vysvetlivky - zapnute" : "Vysvetlivky - vypnute"}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-2">
        <div className="border border-sidebar-border rounded-md p-2" data-testid="rank-display">
          <p className="text-xs font-semibold truncate mb-1.5" data-testid="text-rank-name">
            {appUser?.careerLevel?.positionName || "Nepriradená"} • {pointsData?.points?.toFixed(1) ?? "0"} bodov
          </p>
          <RankBadge
            positionName={appUser?.careerLevel?.positionName || undefined}
            frameType={appUser?.careerLevel?.frameType || "none"}
            circleConfig={appUser?.careerLevel?.circleConfig as CircleConfig[] || undefined}
            compact
          />
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
