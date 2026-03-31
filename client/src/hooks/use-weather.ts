import { useState, useEffect } from "react";

export interface WeatherData {
  temperature: number;
  weatherCode: number;
}

interface UseWeatherResult {
  data: WeatherData | null;
  loading: boolean;
  error: boolean;
}

export function useWeather(lat: number, lon: number): UseWeatherResult {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchWeather() {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error("fetch failed");
        const json = await res.json();
        if (!cancelled) {
          setData({
            temperature: Math.round(json.current.temperature_2m),
            weatherCode: json.current.weather_code,
          });
          setError(false);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    fetchWeather();
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [lat, lon]);

  return { data, loading, error };
}

export function getWeatherDesc(wmo: number): string {
  if (wmo === 0) return "Jasno";
  if (wmo === 1) return "Skoro jasno";
  if (wmo === 2) return "Polooblačno";
  if (wmo === 3) return "Zamračené";
  if (wmo <= 48) return "Hmla";
  if (wmo <= 57) return "Mrholenie";
  if (wmo <= 67) return "Dážď";
  if (wmo <= 77) return "Sneženie";
  if (wmo <= 82) return "Prehánky";
  if (wmo <= 86) return "Sneh. prehánky";
  return "Búrka";
}

export function getWeatherIcon(wmo: number): "sun" | "cloud" | "cloud-drizzle" | "cloud-rain" | "cloud-snow" | "zap" {
  if (wmo <= 1) return "sun";
  if (wmo <= 3) return "cloud";
  if (wmo <= 48) return "cloud";
  if (wmo <= 57) return "cloud-drizzle";
  if (wmo <= 67) return "cloud-rain";
  if (wmo <= 77) return "cloud-snow";
  if (wmo <= 82) return "cloud-rain";
  if (wmo <= 86) return "cloud-snow";
  return "zap";
}
