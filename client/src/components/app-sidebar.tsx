import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useAppUser } from "@/hooks/use-app-user";
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
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Prehlad" },
  { href: "/companies", icon: Building2, label: "Spolocnosti" },
  { href: "/partners", icon: Briefcase, label: "Partneri" },
  { href: "/products", icon: Package, label: "Produkty" },
  { href: "/commissions", icon: Percent, label: "Provizie" },
  { href: "/subjects", icon: Users, label: "Subjekty" },
];

const systemItems = [
  { href: "/settings", icon: Settings, label: "Nastavenia" },
  { href: "/history", icon: History, label: "Historia" },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { data: appUser } = useAppUser();

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
            <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">CRM System</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Moduly</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(item => (
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
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {systemItems.map(item => (
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
