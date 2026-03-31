import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useAppUser } from "@/hooks/use-app-user";
import { isAdmin as checkIsAdmin } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  TrendingUp, Code2, GitCommit, Cpu, RefreshCw,
  Loader2, Trophy, Layers, Zap, Shield, Lock, BarChart3, History,
} from "lucide-react";
import type { AtkAssetSnapshot } from "@shared/schema";

const LOC_PRICE = 25;
const WP_LOC = 1_400_000;
const WP_VALUE = WP_LOC * LOC_PRICE;
const FINTECH_LOC = 50_000;
const FINTECH_VALUE = FINTECH_LOC * LOC_PRICE;

const IP_ITEMS = [
  { label: "Decoy (návnadový) modul", value: 500_000, color: "text-amber-500", desc: "Umelá architektúra na detekciu kopírování" },
  { label: "Trezor / Holding štruktúra", value: 750_000, color: "text-blue-500", desc: "Proprietárna viacúrovňová štruktúra holdingu" },
  { label: "Zrkadlový kontext (KTO/KDE)", value: 300_000, color: "text-violet-500", desc: "Patentovateľný bezpečnostný mechanizmus kontextu" },
];

interface CommitRecord {
  sha: string;
  message: string;
  date: string;
  author: string;
}

function formatEur(n: number): string {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

function formatNum(n: number): string {
  return new Intl.NumberFormat("sk-SK").format(n);
}

function formatDate(d: string): string {
  return new Date(d).toLocaleString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDateShort(d: string): string {
  return new Date(d).toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function GrowthIndicator({ current, previous }: { current: number; previous: number | null }) {
  if (!previous) return null;
  const diff = current - previous;
  const pct = previous > 0 ? ((diff / previous) * 100).toFixed(2) : "0";
  const isPos = diff >= 0;
  return (
    <span className={`text-sm font-semibold ${isPos ? "text-emerald-500" : "text-red-500"}`}>
      {isPos ? "▲" : "▼"} {isPos ? "+" : ""}{formatEur(diff)} ({isPos ? "+" : ""}{pct}%)
    </span>
  );
}

function BenchmarkBar({ value, benchmark, label }: { value: number; benchmark: number; label: string }) {
  const pct = Math.min(100, Math.round((value / benchmark) * 100));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>ATK</span>
        <span>{label}</span>
      </div>
      <div className="relative h-3 w-full bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-amber-400 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs">
        <span className="font-semibold text-blue-600">{formatEur(value)}</span>
        <span className="text-muted-foreground">{formatEur(benchmark)}</span>
      </div>
      <p className="text-[11px] text-muted-foreground text-right">{pct}% hodnoty {label}</p>
    </div>
  );
}

export default function AssetTracker() {
  const { data: appUser, isLoading: userLoading } = useAppUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const autoSnapshotFired = useRef(false);

  const isAdmin = !userLoading && checkIsAdmin(appUser);
  const isAdminKnown = !userLoading;

  const { data: history = [], isLoading: histLoading } = useQuery<AtkAssetSnapshot[]>({
    queryKey: ["/api/admin/asset-tracker/history"],
    enabled: isAdmin,
  });

  const latest = history[0] ?? null;
  const previous = history[1] ?? null;

  const recentCommits: CommitRecord[] = Array.isArray((latest as AtkAssetSnapshot & { recentCommitsJson?: unknown })?.recentCommitsJson)
    ? ((latest as AtkAssetSnapshot & { recentCommitsJson?: CommitRecord[] }).recentCommitsJson ?? [])
    : [];

  const snapshotMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("GET", "/api/admin/asset-tracker/snapshot");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Snímka uložená", description: "Nové ocenenie aktíva bolo zaznamenané." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/asset-tracker/history"] });
    },
    onError: (err: Error) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (isAdmin && !histLoading && !autoSnapshotFired.current && !snapshotMutation.isPending) {
      autoSnapshotFired.current = true;
      snapshotMutation.mutate();
    }
  }, [isAdmin, histLoading]);

  if (isAdminKnown && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Lock className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground text-lg">Prístup len pre administrátorov.</p>
      </div>
    );
  }

  const locByExt: Record<string, number> = (latest?.locByExtension as Record<string, number>) ?? {};
  const extEntries = Object.entries(locByExt).sort((a, b) => b[1] - a[1]);
  const isRefreshing = snapshotMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" data-testid="text-asset-tracker-title">
            <svg viewBox="0 0 24 24" className="w-7 h-7 shrink-0" fill="none" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" stroke="#1d4ed8" strokeWidth={2} fill="#f59e0b" fillOpacity={0.18} />
              <path d="M8 14l2.5-3 2.5 2 3-4" stroke="#1d4ed8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="12" r="2" fill="#f59e0b" />
            </svg>
            Ocenenie systému ATK
          </h2>
          <p className="text-sm text-muted-foreground mt-1 text-justify">
            Ocenenie kódovej základne systému ArutsoK na základe LOC × 25 €/riadok + IP prémie.
          </p>
        </div>
        <Button
          onClick={() => snapshotMutation.mutate()}
          disabled={isRefreshing}
          data-testid="button-take-snapshot"
          className="shrink-0"
        >
          {isRefreshing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          {isRefreshing ? "Snímam..." : "Nová snímka"}
        </Button>
      </div>

      {(histLoading || isRefreshing) && !latest && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {!histLoading && !isRefreshing && !latest && (
        <Card className="border-2">
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>Zatiaľ žiadna snímka. Kliknite na <strong>Nová snímka</strong> na vyhodnotenie.</p>
          </CardContent>
        </Card>
      )}

      {latest && (
        <>
          {/* MAIN VALUE CARD */}
          <Card className="border-2 bg-gradient-to-br from-blue-950/10 via-background to-amber-500/5">
            <CardContent className="pt-6 pb-4">
              <div className="flex flex-col items-center gap-2 py-4">
                <span className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Aktuálna hodnota aktíva</span>
                <span
                  className="text-5xl md:text-6xl font-black tracking-tight text-blue-600 dark:text-blue-400"
                  data-testid="text-total-value"
                >
                  {formatEur(latest.totalValueEur)}
                </span>
                <GrowthIndicator current={latest.totalValueEur} previous={previous?.totalValueEur ?? null} />
                <p className="text-xs text-muted-foreground mt-1">
                  Snímka: {formatDate(String(latest.snapshotAt))}
                  {isRefreshing && <span className="ml-2 text-primary animate-pulse">• Aktualizujem...</span>}
                </p>
              </div>
              <Separator className="my-3" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Čistý kód (LOC)</p>
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-net-loc">{formatNum(latest.netLoc)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Súborov</p>
                  <p className="text-xl font-bold" data-testid="text-file-count">{formatNum(latest.fileCount)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Hodnota kódu</p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-code-value">{formatEur(latest.codeValueEur)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">IP prémie</p>
                  <p className="text-xl font-bold text-amber-500" data-testid="text-ip-premium">{formatEur(latest.ipPremiumEur)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* LOC BREAKDOWN */}
            <Card className="border-2">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                <div className="p-2 rounded-md bg-blue-500/10 text-blue-500"><Code2 className="h-4 w-4" /></div>
                <CardTitle className="text-base">Rozpad podľa prípony</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {extEntries.length === 0 && <p className="text-sm text-muted-foreground">Žiadne dáta</p>}
                {extEntries.map(([ext, loc]) => (
                  <div key={ext} className="flex items-center gap-2" data-testid={`loc-row-${ext}`}>
                    <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded w-12 text-center shrink-0">{ext}</span>
                    <div className="flex-1 bg-muted h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.min(100, Math.round((loc / (extEntries[0]?.[1] || 1)) * 100))}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold w-14 text-right">{formatNum(loc)}</span>
                    <span className="text-xs text-amber-500 w-16 text-right font-mono">{formatEur(loc * LOC_PRICE)}</span>
                  </div>
                ))}
                <Separator className="my-1" />
                <div className="flex justify-between text-xs font-bold pt-1">
                  <span>Celkom (hrubé LOC)</span>
                  <span>{formatNum(latest.totalLoc)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-blue-600">
                  <span>Čisté LOC (bez kom.)</span>
                  <span>{formatNum(latest.netLoc)}</span>
                </div>
              </CardContent>
            </Card>

            {/* COMMIT VELOCITY */}
            <Card className="border-2">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-500"><GitCommit className="h-4 w-4" /></div>
                <CardTitle className="text-base">Vývojová rýchlosť</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {latest.commitCount30d !== null ? (
                  <>
                    <div className="text-center py-3">
                      <span className="text-4xl font-black text-emerald-600 dark:text-emerald-400" data-testid="text-commit-count">
                        {latest.commitCount30d}
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">commitov za posledných 30 dní</p>
                    </div>
                    <Separator />
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Priemerný denný počet</span>
                        <span className="font-semibold" data-testid="text-avg-commits-day">
                          {latest.avgCommitsPerDay !== null ? latest.avgCommitsPerDay?.toFixed(2) : (latest.commitCount30d / 30).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Odhadovaný denný rast hodnoty</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400" data-testid="text-daily-value-growth">
                          ≈ {formatEur(Math.round((latest.netLoc / (latest.commitCount30d || 1)) * LOC_PRICE * (latest.avgCommitsPerDay ?? (latest.commitCount30d / 30))))}
                        </span>
                      </div>
                      {latest.repoName && (
                        <div className="flex justify-between gap-2">
                          <span className="text-muted-foreground shrink-0">Repozitár</span>
                          <span className="font-mono text-xs truncate max-w-[140px]" title={latest.repoName}>{latest.repoName}</span>
                        </div>
                      )}
                    </div>
                    <Separator />
                    <div className="rounded bg-muted/40 px-3 py-2">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">Vysvetlenie výpočtu</p>
                      <p className="text-[11px] text-muted-foreground text-justify">
                        Denný rast = (čisté LOC ÷ počet commitov) × cena × priem. commitov/deň.
                        Reflektuje priemerné LOC pridané za každý commit.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                    <Zap className="w-8 h-8 opacity-30" />
                    <p className="text-xs text-center">GitHub nie je prepojený — commit dáta nedostupné.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* BENCHMARK */}
            <Card className="border-2">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                <div className="p-2 rounded-md bg-amber-500/10 text-amber-500"><Trophy className="h-4 w-4" /></div>
                <CardTitle className="text-base">Benchmark</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">vs. WordPress</p>
                  <BenchmarkBar value={latest.totalValueEur} benchmark={WP_VALUE} label="WordPress" />
                  <p className="text-[11px] text-muted-foreground text-justify mt-1">
                    WordPress ~1,4M LOC ≈ {formatEur(WP_VALUE)} pri 25 €/LOC.
                  </p>
                </div>
                <Separator />
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">vs. Priemerný fintech startup</p>
                  <BenchmarkBar value={latest.codeValueEur} benchmark={FINTECH_VALUE} label="Fintech startup" />
                  <p className="text-[11px] text-muted-foreground text-justify mt-1">
                    Priemerný fintech startup ~50 000 LOC ≈ {formatEur(FINTECH_VALUE)}. ATK ho prevyšuje o {Math.max(0, Math.round(((latest.codeValueEur / FINTECH_VALUE) - 1) * 100))} %.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* IP PREMIUMS */}
          <Card className="border-2">
            <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
              <div className="p-2 rounded-md bg-violet-500/10 text-violet-500"><Shield className="h-4 w-4" /></div>
              <CardTitle className="text-base">IP prémie — inovatívne moduly</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                {IP_ITEMS.map((item) => (
                  <div key={item.label} className="border-2 rounded-lg p-4 space-y-1" data-testid={`ip-item-${item.label}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold leading-tight">{item.label}</span>
                      <Badge variant="outline" className={`text-xs shrink-0 ${item.color} border-current`}>
                        {formatEur(item.value)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground text-justify">{item.desc}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Spolu IP prémie</span>
                <span className="text-lg font-bold text-amber-500" data-testid="text-ip-total">{formatEur(latest.ipPremiumEur)}</span>
              </div>
            </CardContent>
          </Card>

          {/* COMMIT HISTORY TABLE (last 30 days) */}
          {recentCommits.length > 0 && (
            <Card className="border-2">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-500"><History className="h-4 w-4" /></div>
                <CardTitle className="text-base">
                  Commity — posledných 30 dní
                  <Badge variant="secondary" className="ml-2 text-xs">{recentCommits.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 text-xs text-muted-foreground font-semibold">SHA</th>
                        <th className="text-left py-2 px-2 text-xs text-muted-foreground font-semibold">Správa</th>
                        <th className="text-left py-2 px-2 text-xs text-muted-foreground font-semibold">Autor</th>
                        <th className="text-right py-2 px-2 text-xs text-muted-foreground font-semibold">Dátum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentCommits.map((c, idx) => (
                        <tr key={`${c.sha}-${idx}`} className="border-b last:border-0 hover:bg-muted/30 transition-colors" data-testid={`commit-row-${c.sha}`}>
                          <td className="py-2 px-2 font-mono text-xs text-muted-foreground">{c.sha}</td>
                          <td className="py-2 px-2 max-w-[260px]">
                            <span className="truncate block text-xs" title={c.message}>{c.message}</span>
                          </td>
                          <td className="py-2 px-2 text-xs">{c.author}</td>
                          <td className="py-2 px-2 text-right font-mono text-xs whitespace-nowrap">{c.date ? formatDateShort(c.date) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* SNAPSHOT HISTORY */}
          {history.length > 1 && (
            <Card className="border-2">
              <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
                <div className="p-2 rounded-md bg-cyan-500/10 text-cyan-500"><Layers className="h-4 w-4" /></div>
                <CardTitle className="text-base">História snímok</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 text-xs text-muted-foreground font-semibold">Dátum</th>
                        <th className="text-right py-2 px-2 text-xs text-muted-foreground font-semibold">Čisté LOC</th>
                        <th className="text-right py-2 px-2 text-xs text-muted-foreground font-semibold">Súborov</th>
                        <th className="text-right py-2 px-2 text-xs text-muted-foreground font-semibold">Hodnota kódu</th>
                        <th className="text-right py-2 px-2 text-xs text-muted-foreground font-semibold">Celková hodnota</th>
                        <th className="text-right py-2 px-2 text-xs text-muted-foreground font-semibold">Commity/30d</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((snap, idx) => (
                        <tr key={snap.id} className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${idx === 0 ? "bg-blue-500/5" : ""}`} data-testid={`history-row-${snap.id}`}>
                          <td className="py-2 px-2 font-mono text-xs">{formatDate(String(snap.snapshotAt))}</td>
                          <td className="py-2 px-2 text-right font-semibold">{formatNum(snap.netLoc)}</td>
                          <td className="py-2 px-2 text-right">{formatNum(snap.fileCount)}</td>
                          <td className="py-2 px-2 text-right text-emerald-600 dark:text-emerald-400">{formatEur(snap.codeValueEur)}</td>
                          <td className="py-2 px-2 text-right font-bold text-blue-600 dark:text-blue-400">{formatEur(snap.totalValueEur)}</td>
                          <td className="py-2 px-2 text-right">{snap.commitCount30d ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* INFO FOOTER */}
      <Card className="border-2 border-dashed">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Cpu className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground text-justify space-y-1">
              <p>
                <strong>Metodika:</strong> Skenujú sa súbory s príponami .ts, .tsx, .js, .jsx, .css, .html, .sql.
                Vylúčené sú adresáre: node_modules, .git, dist, .local, uploads. Za čisté LOC sa považujú
                neprázdne riadky, ktoré nie sú komentármi. Cena: <strong>{LOC_PRICE} €/LOC</strong>.
              </p>
              <p>
                <strong>IP prémie</strong> reflektujú trhovú hodnotu inovatívnych a patentovateľných
                architektonických riešení nad rámec čistého kódu.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
