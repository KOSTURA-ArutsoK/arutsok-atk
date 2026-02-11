import { Shield, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AuthPage() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background text-foreground font-body">
      {/* Left Panel - Visuals */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-black border-r border-border overflow-hidden">
        {/* Abstract Background Effects */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80')] opacity-10 bg-cover bg-center mix-blend-overlay" />
        {/* Tech grid overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded bg-primary flex items-center justify-center shadow-[0_0_30px_rgba(var(--primary),0.5)]">
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-display font-bold tracking-tight">SECURE<span className="text-primary">CRM</span></h1>
          </div>
          <h2 className="text-4xl font-bold leading-tight max-w-lg text-white">
            Advanced Intelligence & <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-400">Commission Systems</span>
          </h2>
        </div>

        <div className="relative z-10 space-y-6">
          <div className="glass-panel p-6 rounded-lg max-w-md border-l-4 border-primary">
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Lock className="w-4 h-4 text-primary" />
              Restricted Access
            </h3>
            <p className="text-sm text-muted-foreground">
              Authorized personnel only. All activities are monitored and logged securely. 
              Multi-factor authentication required for Level 2+ clearance.
            </p>
          </div>
          <div className="flex gap-2">
            <div className="h-1 flex-1 bg-primary/50 rounded-full" />
            <div className="h-1 w-12 bg-primary/20 rounded-full" />
            <div className="h-1 w-12 bg-primary/20 rounded-full" />
          </div>
        </div>
      </div>

      {/* Right Panel - Login */}
      <div className="flex items-center justify-center p-8 bg-card/30">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center space-y-2 lg:hidden">
            <Shield className="w-12 h-12 mx-auto text-primary" />
            <h1 className="text-2xl font-bold">SECURE CRM</h1>
          </div>

          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">System Login</h2>
            <p className="text-sm text-muted-foreground">Identify yourself to proceed</p>
          </div>

          <div className="glass-panel p-8 rounded-xl space-y-6 shadow-2xl">
            <div className="space-y-4">
              <Button 
                onClick={handleLogin}
                className="w-full h-12 text-base font-medium bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 transition-all"
              >
                Authenticate with Replit
              </Button>
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground font-mono">
                  Secure Connection
                </span>
              </div>
            </div>

            <div className="text-xs text-center text-muted-foreground font-mono">
              IP: {window.location.hostname}<br/>
              Session ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
