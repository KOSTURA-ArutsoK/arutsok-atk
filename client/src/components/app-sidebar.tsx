import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAppUser } from "@/hooks/use-app-user";
import { useHelp } from "@/contexts/help-context";
import { RankBadge } from "@/components/rank-badge";
import { useQuery } from "@tanstack/react-query";
import type { CircleConfig } from "@shared/schema";
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
  UsersRound,
  Contact,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
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
  LayoutGrid,
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

const topItems = [
  { href: "/", icon: LayoutDashboard, label: "Prehlad" },
];

const financieItems = [
  { href: "/body", icon: TrendingUp, label: "Body" },
  { href: "/provizie", icon: ArrowDownLeft, label: "Provizie" },
  { href: "/odmeny", icon: ArrowUpRight, label: "Odmeny" },
  { href: "/commissions", icon: Percent, label: "Sadzby" },
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

const klientiItems = [
  { href: "/subjects", icon: Users, label: "Zoznam klientov" },
  { href: "/client-groups", icon: UsersRound, label: "Skupiny klientov" },
];

const zmluvyFlatItems = [
  { href: "/evidencia-zmluv", icon: ClipboardList, label: "Spracovanie zmlúv" },
  { href: "/contracts", icon: FileText, label: "Zoznam zmlúv" },
];

const nastaveniaSablonChildren = [
  { href: "/contract-template-management", icon: FileStack, label: "Sprava sablon" },
  { href: "/contract-statuses", icon: ListChecks, label: "Stavy zmluv" },
  { href: "/contract-field-settings", icon: Sliders, label: "Nastavenie evidencie" },
];

const protokolyChildren = [
  { href: "/contract-inventories", icon: FileStack, label: "Sprievodky" },
  { href: "/supisky", icon: ClipboardList, label: "Supisky" },
];

const importItems = [
  { href: "/bulk-import", icon: FileSpreadsheet, label: "Hromadný import" },
  { href: "/import-archive", icon: Archive, label: "Archív importov" },
];

const allZmluvyHrefs = [
  ...zmluvyFlatItems.map(i => i.href),
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
];

const nastavenieDirectItems = [
  { href: "/history", icon: History, label: "Logy" },
  { href: "/support", icon: Phone, label: "Podpora a registracia" },
  { href: "/dashboard-settings", icon: Eye, label: "Nastavenie prehladov" },
  { href: "/archive", icon: Trash2, label: "Kos" },
];

const allNastavenieHrefs = [
  ...spravaPristupovItems.map(i => i.href),
  ...specifikacieItems.map(i => i.href),
  ...nastavenieDirectItems.map(i => i.href),
];

function CollapsibleMenu({
  label,
  icon: Icon,
  items,
  location,
  testId,
  menuId,
  openMenuId,
  setOpenMenuId,
}: {
  label: string;
  icon: React.ElementType;
  items: { href: string; icon: React.ElementType; label: string }[];
  location: string;
  testId: string;
  menuId: string;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
}) {
  const isAnyActive = items.some(item => location === item.href);
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

  const allMenus = [
    { id: "nastavenia", items: [...spravaPristupovItems, ...specifikacieItems, ...nastavenieDirectItems] },
    { id: "sprava-pristupov", items: spravaPristupovItems },
    { id: "specifikacie", items: specifikacieItems },
    { id: "partneri", items: partneriProduktyItems },
    { id: "klienti", items: klientiItems },
    { id: "zmluvy", items: [...zmluvyFlatItems, ...nastaveniaSablonChildren, ...protokolyChildren, ...importItems] },
    { id: "financie", items: financieItems },
    { id: "informacie", items: informacieItems },
  ];
  const activeMenuId = allMenus.find(m => m.items.some(i => i.href === location))?.id || null;
  const [openMenuId, setOpenMenuId] = useState<string | null>(activeMenuId);

  const isNastavenieActive = allNastavenieHrefs.includes(location);
  const isNastavenieOpen = openMenuId === "nastavenia";
  const nastavenieInitialSub = spravaPristupovItems.some(i => i.href === location) ? "sprava-pristupov"
    : specifikacieItems.some(i => i.href === location) ? "specifikacie" : null;
  const [nastavenieSubId, setNastavenieSubId] = useState<string | null>(nastavenieInitialSub);

  const isZmluvyActive = allZmluvyHrefs.includes(location);
  const isZmluvyOpen = openMenuId === "zmluvy";
  const zmluvyInitialSub = nastaveniaSablonChildren.some(i => i.href === location) ? "sablony"
    : protokolyChildren.some(i => i.href === location) ? "protokoly"
    : importItems.some(i => i.href === location) ? "import" : null;
  const [zmluvySubId, setZmluvySubId] = useState<string | null>(zmluvyInitialSub);

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
                              <span className="flex-1">Specifikacie</span>
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
                label="Sektory"
                icon={LayoutGrid}
                items={[
                  { href: "/sektory-subjektov", icon: Database, label: "Sektory Subjektov" },
                  { href: "/sektory-zmluv", icon: FileText, label: "Sektory Zmlúv" },
                ]}
                location={location}
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
              <CollapsibleMenu
                label="Partneri a produkty"
                icon={Briefcase}
                items={partneriProduktyItems}
                location={location}
                testId="nav-menu-partneri-produkty"
                menuId="partneri"
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
              />
              <CollapsibleMenu
                label="Klienti"
                icon={Users}
                items={klientiItems}
                location={location}
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
                      {zmluvyFlatItems.map(item => (
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

                      <SidebarMenuSubItem>
                        <Collapsible
                          open={zmluvySubId === "protokoly"}
                          onOpenChange={(val) => setZmluvySubId(val ? "protokoly" : null)}
                        >
                          <CollapsibleTrigger asChild>
                            <SidebarMenuSubButton
                              data-testid="nav-submenu-zoznam-protokolov"
                              className={`cursor-pointer ${protokolyChildren.some(i => i.href === location) ? "text-sidebar-accent-foreground font-medium" : ""}`}
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
                testId="nav-menu-financie"
                menuId="financie"
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
              />
              <CollapsibleMenu
                label="Informacie"
                icon={Info}
                items={informacieItems}
                location={location}
                testId="nav-menu-informacie"
                menuId="informacie"
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
              />
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

      <SidebarFooter className="p-3">
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
