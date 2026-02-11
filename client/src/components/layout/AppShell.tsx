import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  ShieldCheck, 
  Users, 
  Building2, 
  BarChart3, 
  Settings, 
  Menu, 
  X,
  LogOut,
  Globe,
  Briefcase
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItemProps {
  href: string;
  icon: React.ElementType;
  label: string;
  active?: boolean;
}

function NavItem({ href, icon: Icon, label, active }: NavItemProps) {
  return (
    <Link href={href} className={cn(
      "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200 group",
      active 
        ? "bg-primary/10 text-primary border-l-2 border-primary" 
        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
    )}>
      <Icon className={cn("w-5 h-5", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
      <span className="font-medium text-sm tracking-wide">{label}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground flex overflow-hidden font-body">
      {/* Sidebar - Desktop */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card/50 backdrop-blur-sm z-30">
        <div className="p-6 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded bg-primary/20 flex items-center justify-center border border-primary/50 text-primary">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg tracking-tight">SECURE<span className="text-primary">CRM</span></h1>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Classified System</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            Core Modules
          </div>
          <NavItem href="/" icon={BarChart3} label="Dashboard" active={location === "/"} />
          <NavItem href="/subjects" icon={Users} label="Subjects & Integrity" active={location === "/subjects"} />
          <NavItem href="/companies" icon={Building2} label="My Firms" active={location === "/companies"} />
          <NavItem href="/partners" icon={Briefcase} label="Partners" active={location === "/partners"} />
          
          <div className="mt-6 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            System
          </div>
          <NavItem href="/hierarchy" icon={Globe} label="Geo Hierarchy" active={location === "/hierarchy"} />
          <NavItem href="/settings" icon={Settings} label="Settings" active={location === "/settings"} />
        </nav>

        <div className="p-4 border-t border-border/50 bg-black/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent border border-accent/50">
              {user?.username?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.username}</p>
              <p className="text-xs text-muted-foreground truncate">Clearance Lvl 1</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            className="w-full justify-start text-xs border-dashed border-border hover:border-destructive hover:text-destructive transition-colors"
            onClick={() => logout()}
          >
            <LogOut className="w-3 h-3 mr-2" />
            Terminate Session
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-background/95 backdrop-blur border-b border-border z-40 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-primary" />
          <span className="font-display font-bold">SECURE CRM</span>
        </div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-muted-foreground">
          {isSidebarOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden md:ml-0 mt-16 md:mt-0 relative">
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03] pointer-events-none" />
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth">
          {children}
        </div>
      </main>
    </div>
  );
}
