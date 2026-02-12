import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useAppUser } from "@/hooks/use-app-user";
import { useHelp } from "@/contexts/help-context";
import {
  LayoutDashboard,
  Building2,
  Users,
  Package,
  Percent,
  Settings,
  History,
  Briefcase,
  LogOut,
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
  Coins,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const topItems = [
  { href: "/", icon: LayoutDashboard, label: "Prehlad" },
  { href: "/companies", icon: Building2, label: "Spolocnosti" },
];

const financieItems = [
  { href: "/provizie", icon: ArrowDownLeft, label: "Provizie" },
  { href: "/odmeny", icon: ArrowUpRight, label: "Odmeny" },
  { href: "/commissions", icon: Percent, label: "Sadzby" },
];

const partneriProduktyItems = [
  { href: "/partners", icon: Briefcase, label: "Zoznam partnerov" },
  { href: "/products", icon: Package, label: "Katalog produktov" },
  { href: "/partner-contacts", icon: Contact, label: "Kontaktne osoby" },
];

const klientiItems = [
  { href: "/subjects", icon: Users, label: "Zoznam klientov" },
  { href: "/client-type-rules", icon: Sliders, label: "Pravidla typov klientov" },
  { href: "/client-groups", icon: UsersRound, label: "Skupiny klientov" },
];

const zmluvyItems = [
  { href: "/contracts", icon: FileText, label: "Zmluvy" },
  { href: "/contract-template-settings", icon: FileCog, label: "Nastavenia sablon" },
  { href: "/contract-template-management", icon: FileStack, label: "Sprava sablon" },
  { href: "/contract-statuses", icon: ListChecks, label: "Stavy zmluv" },
  { href: "/contract-inventories", icon: ClipboardList, label: "Zoznam supisiek" },
  { href: "/supisky", icon: ClipboardList, label: "Supisky" },
];

const nastavenieItems = [
  { href: "/archive", icon: Trash2, label: "Kos" },
  { href: "/history", icon: History, label: "Logy" },
  { href: "/users", icon: UserCog, label: "Pouzivatelia" },
  { href: "/permission-groups", icon: ShieldCheck, label: "Pravomoci skupiny" },
  { href: "/support", icon: Phone, label: "Podpora a registracia" },
  { href: "/settings", icon: Timer, label: "Doba prihlasenia" },
  { href: "/dashboard-settings", icon: Eye, label: "Nastavenie prehladov" },
];

function CollapsibleMenu({
  label,
  icon: Icon,
  items,
  location,
  defaultOpen,
  testId,
}: {
  label: string;
  icon: React.ElementType;
  items: { href: string; icon: React.ElementType; label: string }[];
  location: string;
  defaultOpen?: boolean;
  testId: string;
}) {
  const isAnyActive = items.some(item => location === item.href);
  const [open, setOpen] = useState(defaultOpen || isAnyActive);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            data-testid={testId}
            className={isAnyActive ? "text-sidebar-accent-foreground font-medium" : ""}
          >
            <Icon className="w-4 h-4" />
            <span className="flex-1">{label}</span>
            <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-90" : ""}`} />
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
  const { user, logout } = useAuth();
  const { data: appUser } = useAppUser();
  const { helpEnabled, toggleHelp } = useHelp();

  const displayName = appUser
    ? `${appUser.firstName || ""} ${appUser.lastName || ""}`.trim() || appUser.username
    : user?.firstName || "Pouzivatel";

  const initials = appUser
    ? `${(appUser.firstName || "U")[0]}${(appUser.lastName || "")[0] || ""}`.toUpperCase()
    : "U";

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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <CollapsibleMenu
                label="Financie"
                icon={Coins}
                items={financieItems}
                location={location}
                testId="nav-menu-financie"
              />
              <CollapsibleMenu
                label="Partneri a produkty"
                icon={Briefcase}
                items={partneriProduktyItems}
                location={location}
                testId="nav-menu-partneri-produkty"
              />
              <CollapsibleMenu
                label="Klienti"
                icon={Users}
                items={klientiItems}
                location={location}
                testId="nav-menu-klienti"
              />
              <CollapsibleMenu
                label="Zmluvy"
                icon={FileText}
                items={zmluvyItems}
                location={location}
                testId="nav-menu-zmluvy"
              />
              <CollapsibleMenu
                label="Nastavenia"
                icon={Settings}
                items={nastavenieItems}
                location={location}
                testId="nav-menu-nastavenia"
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
        <div className="flex items-center gap-2 px-2 py-1">
          <Avatar className="w-7 h-7">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate" data-testid="text-sidebar-username">{displayName}</p>
            <p className="text-[10px] text-sidebar-foreground/50 truncate">{appUser?.role || "pouzivatel"}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs mt-1"
          onClick={() => logout()}
          data-testid="button-logout"
        >
          <LogOut className="w-3 h-3 mr-2" />
          Odhlasit sa
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
