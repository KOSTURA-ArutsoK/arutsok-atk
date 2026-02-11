import { ShieldAlert } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground font-mono">
      <ShieldAlert className="w-24 h-24 text-destructive mb-6" />
      <h1 className="text-4xl font-bold mb-2">404 - ACCESS DENIED</h1>
      <p className="text-muted-foreground mb-8">The requested resource does not exist or you lack clearance.</p>
      <Link href="/">
        <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
          Return to Dashboard
        </Button>
      </Link>
    </div>
  );
}
