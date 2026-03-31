import { useEffect, useState } from "react";
import { Shield, User, ArrowLeft, CalendarDays, FileCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useAppUser } from "@/hooks/use-app-user";
import { useQuery } from "@tanstack/react-query";
import { InfoChipRow, getWeatherLucideIcon } from "@/components/InfoChipRow";
import { useWeather, getWeatherDesc, getWeatherIcon } from "@/hooks/use-weather";
import { getSlovakNameDay, getSlovakHoliday } from "@/lib/slovakNameDays";
import type { Contract } from "@shared/schema";

export default function ClientZone() {
  const { data: appUser } = useAppUser();

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const bratislavaWeather = useWeather(48.1486, 17.1077);

  const { data: contracts = [] } = useQuery<Contract[]>({
    queryKey: ["/api/contracts"],
    queryFn: async () => {
      const res = await fetch("/api/contracts?limit=500", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const activeContracts = contracts.filter((c) => !c.isDeleted);
  const soonestExpiry = activeContracts
    .map((c) => (c.expiryDate ? new Date(c.expiryDate).getTime() : null))
    .filter((t): t is number => t !== null && t >= Date.now())
    .sort((a, b) => a - b)[0];
  const daysToExpiry = soonestExpiry !== undefined
    ? Math.ceil((soonestExpiry - Date.now()) / 86400000)
    : null;

  const nameDay = getSlovakNameDay(now);
  const holiday = getSlovakHoliday(now);
  const dateStr = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
  const weatherIconKey = bratislavaWeather.data ? getWeatherIcon(bratislavaWeather.data.weatherCode) : "cloud";
  const weatherLucideIcon = getWeatherLucideIcon(weatherIconKey);
  const weatherValue = bratislavaWeather.loading
    ? "Načítavam..."
    : bratislavaWeather.error || !bratislavaWeather.data
    ? "Nedostupné"
    : `${bratislavaWeather.data.temperature}°C · ${getWeatherDesc(bratislavaWeather.data.weatherCode)}`;

  const firstName = appUser?.firstName ?? "";
  const lastName = appUser?.lastName ?? "";
  const greetingName = (firstName || lastName)
    ? `${firstName} ${lastName}`.trim()
    : appUser?.username ?? "klient";

  const clientChips = [
    {
      icon: User,
      label: "Vitajte",
      value: `Dobrý deň, pán ${greetingName}`,
      testId: "chip-client-greeting",
    },
    {
      icon: CalendarDays,
      label: holiday ? "Dátum / Sviatok" : "Dátum / Meniny",
      value: holiday
        ? `${dateStr} | ${holiday}`
        : `${dateStr} | ${nameDay || "—"}`,
      testId: "chip-client-date",
    },
    {
      icon: weatherLucideIcon,
      label: "Bratislava",
      value: weatherValue,
      testId: "chip-client-weather",
    },
    {
      icon: FileCheck,
      label: "Portfólio",
      value: daysToExpiry !== null
        ? `Zmluvy: ${activeContracts.length} | Semafor: ${daysToExpiry} dní`
        : `Zmluvy: ${activeContracts.length} | Semafor: —`,
      testId: "chip-client-portfolio",
    },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-background p-4 pt-8">
      <div className="w-full max-w-2xl space-y-4">
        {/* Client info chip row */}
        <InfoChipRow variant="client" chips={clientChips} />

        <Card className="w-full">
          <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-4">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg" data-testid="text-client-zone-title">Osobná zóna</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">ArutsoK</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-md bg-primary/5 border border-border">
              <Shield className="w-6 h-6 text-primary flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">Osobná zóna klienta</p>
                <p className="text-xs text-muted-foreground">
                  Táto sekcia je určená pre registrovaných klientov. Tu budete môcť spravovať vaše údaje, sledovať stav vašich záznamov a komunikovať s vašou spoločnosťou.
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Funkcionality klientskej zóny sú pripravované.
            </p>
            <Link href="/">
              <Button variant="outline" className="w-full" data-testid="button-back-home">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Späť na prihlásenie
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
