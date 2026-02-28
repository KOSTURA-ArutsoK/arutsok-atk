import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldAlert, Lock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

interface DlpStatus {
  blocked: boolean;
  challenge?: {
    a: number;
    b: number;
    question: string;
  };
}

export function DlpChallenge() {
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [locked, setLocked] = useState(false);

  const { data: dlpStatus, refetch } = useQuery<DlpStatus>({
    queryKey: ["/api/dlp/status"],
    refetchInterval: 5000,
  });

  const verifyMutation = useMutation({
    mutationFn: async (ans: number) => {
      const res = await apiRequest("POST", "/api/dlp/verify-challenge", { answer: ans });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.success) {
        setError("");
        setAnswer("");
        queryClient.invalidateQueries({ queryKey: ["/api/dlp/status"] });
        refetch();
      }
    },
    onError: async (err: any) => {
      try {
        const body = await err.json?.();
        if (body?.locked) {
          setLocked(true);
        }
        setError(body?.message || "Chyba overenia");
      } catch {
        setError("Chyba overenia");
      }
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(answer);
    if (isNaN(num)) {
      setError("Zadajte číslo");
      return;
    }
    verifyMutation.mutate(num);
  };

  if (!dlpStatus?.blocked) return null;

  return (
    <div
      className="fixed inset-0 bg-black/90 flex items-center justify-center"
      style={{ zIndex: 9999 }}
      data-testid="dlp-challenge-overlay"
    >
      <Card className="w-full max-w-md border-red-500/50 bg-card">
        <CardHeader className="text-center space-y-3">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto" />
          <CardTitle className="text-red-500 text-xl" data-testid="text-dlp-challenge-title">
            Podozrivá aktivita detegovaná
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            Systém zaznamenal neobvyklé správanie. Pre obnovenie prístupu vyriešte overenie.
          </p>
        </CardHeader>
        <CardContent>
          {locked ? (
            <div className="text-center space-y-4">
              <Lock className="w-12 h-12 text-red-500 mx-auto" />
              <p className="text-red-400 font-semibold" data-testid="text-dlp-locked">
                Príliš veľa neúspešných pokusov. Kontaktujte Architekta.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="text-center">
                <p className="text-lg font-mono font-bold text-foreground" data-testid="text-dlp-question">
                  {dlpStatus.challenge?.question || "Načítavam..."}
                </p>
              </div>
              <Input
                type="number"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Vaša odpoveď..."
                className="text-center text-lg font-mono"
                data-testid="input-dlp-answer"
                autoFocus
              />
              {error && (
                <p className="text-red-400 text-sm text-center" data-testid="text-dlp-error">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={verifyMutation.isPending}
                data-testid="button-dlp-verify"
              >
                {verifyMutation.isPending ? "Overujem..." : "Overiť"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
