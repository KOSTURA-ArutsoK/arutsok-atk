import * as cheerio from "cheerio";
import * as iconv from "iconv-lite";

export interface RegistryLookupResult {
  found: boolean;
  reachable?: boolean;
  source?: "ORSR" | "ARES";
  name?: string;
  street?: string;
  streetNumber?: string;
  zip?: string;
  city?: string;
  legalForm?: string;
  dic?: string;
  directors?: string[];
  actingNote?: string;
  message?: string;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    return resp;
  } finally {
    clearTimeout(timeout);
  }
}

function decodeWindows1250(buffer: ArrayBuffer): string {
  return iconv.decode(Buffer.from(buffer), "windows-1250");
}

function cleanText(text: string): string {
  return text.replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

export async function lookupOrsrByIco(ico: string): Promise<RegistryLookupResult> {
  try {
    const searchUrl = `https://www.orsr.sk/hladaj_ico.asp?ico=${encodeURIComponent(ico)}&sid=0`;
    const searchResp = await fetchWithTimeout(searchUrl);
    if (!searchResp.ok) {
      return { found: false, message: `ORSR vrátil chybu (${searchResp.status})` };
    }

    const searchBuffer = await searchResp.arrayBuffer();
    const searchHtml = decodeWindows1250(searchBuffer);
    const $search = cheerio.load(searchHtml);

    let detailPath: string | null = null;

    $search('a').each((_, el) => {
      const href = $search(el).attr("href") || "";
      if (href.includes("vypis.asp") && href.includes("P=0")) {
        const parentTr = $search(el).closest("tr");
        const rowStyle = parentTr.attr("style") || "";
        const rowClass = parentTr.attr("class") || "";
        if (rowStyle.includes("red") || rowClass.includes("deleted") || rowClass.includes("vymazany")) {
          return;
        }
        const rowText = parentTr.text();
        if (rowText.includes("vymazaná") || rowText.includes("Vymazaná") || rowText.includes("vymazaný")) {
          return;
        }
        if (!detailPath) detailPath = href;
      }
    });

    if (!detailPath) {
      return { found: false, message: "Firma nenájdená v ORSR" };
    }

    const detailUrl = detailPath.startsWith("http")
      ? detailPath
      : `https://www.orsr.sk/${detailPath.replace(/^\//, "")}`;

    const detailResp = await fetchWithTimeout(detailUrl);
    if (!detailResp.ok) {
      return { found: false, message: `ORSR detail vrátil chybu (${detailResp.status})` };
    }

    const detailBuffer = await detailResp.arrayBuffer();
    const detailHtml = decodeWindows1250(detailBuffer);
    const $ = cheerio.load(detailHtml);

    const sections: Record<string, string[]> = {};

    $("tr").each((_, tr) => {
      const labelTd = $(tr).find("td[width='20%']").first();
      const valueTd = $(tr).find("td[width='67%']").first();
      if (!labelTd.length || !valueTd.length) return;

      const labelSpan = labelTd.find("span.tl");
      if (!labelSpan.length) return;
      const label = cleanText(labelSpan.text()).replace(/[:\s]+$/, "").trim();
      if (!label) return;

      const valueSpans = valueTd.find("span.ra, span.ro");
      const vals: string[] = [];
      valueSpans.each((_, span) => {
        const txt = cleanText($(span).text());
        if (txt && !txt.startsWith("(od:") && !txt.startsWith("(do:") && !txt.includes("icon_") && !txt.startsWith("Vznik funkcie")) {
          vals.push(txt);
        }
      });

      if (vals.length > 0) {
        if (!sections[label]) sections[label] = [];
        sections[label].push(...vals);
      }
    });

    const nameVals = sections["Obchodné meno"] || [];
    const name = nameVals[0] || null;

    let street = "";
    let streetNumber = "";
    let zip = "";
    let city = "";

    const sidloVals = sections["Sídlo"] || [];
    if (sidloVals.length >= 4) {
      street = sidloVals[0];
      streetNumber = sidloVals[1];
      city = sidloVals[2];
      zip = sidloVals[3].replace(/\s/g, "");
    } else if (sidloVals.length === 3) {
      street = sidloVals[0];
      city = sidloVals[1];
      zip = sidloVals[2].replace(/\s/g, "");
    } else if (sidloVals.length === 2) {
      city = sidloVals[0];
      zip = sidloVals[1].replace(/\s/g, "");
    } else if (sidloVals.length === 1) {
      city = sidloVals[0];
    }

    const legalFormVals = sections["Právna forma"] || [];
    const legalForm = legalFormVals[0] || "";

    if (!name) {
      return { found: false, message: "Dáta nenájdené na stránke ORSR" };
    }

    const directorNames: string[] = [];
    const statutarKeys = ["Štatutárny orgán", "Konatelia", "Konateľ"];
    for (const key of statutarKeys) {
      const vals = sections[key];
      if (!vals || vals.length === 0) continue;
      for (const v of vals) {
        const cleaned = v.replace(/,\s*$/, "").trim();
        if (!cleaned) continue;
        if (/^\d/.test(cleaned)) continue;
        if (cleaned.toLowerCase().includes("konateľ") && cleaned.length < 12) continue;
        if (cleaned.includes("Bydlisko") || cleaned.includes("bydlisko")) continue;
        const parts = cleaned.split(",").map(p => p.trim()).filter(Boolean);
        const namePart = parts[0];
        if (namePart && namePart.length >= 3 && !directorNames.includes(namePart)) {
          directorNames.push(namePart);
        }
      }
    }

    let actingNote = "";
    const actingKeys = ["Spôsob konania", "Konanie menom spoločnosti", "Spôsob konania v mene spoločnosti"];
    for (const key of actingKeys) {
      const vals = sections[key];
      if (vals && vals.length > 0) {
        actingNote = vals.join(" ").trim();
        break;
      }
    }

    return {
      found: true,
      source: "ORSR",
      name: name.trim(),
      street,
      streetNumber,
      zip,
      city,
      legalForm,
      directors: directorNames.length > 0 ? directorNames : undefined,
      actingNote: actingNote || undefined,
    };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { found: false, message: "ORSR nedostupný (timeout)" };
    }
    console.error("[ORSR LOOKUP ERROR]", err.message);
    return { found: false, message: "Chyba pri komunikácii s ORSR" };
  }
}


export async function lookupAresByIco(ico: string): Promise<RegistryLookupResult> {
  try {
    const resp = await fetchWithTimeout(
      `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${encodeURIComponent(ico)}`,
      { headers: { Accept: "application/json" } },
      5000
    );

    if (!resp.ok) {
      if (resp.status === 404) {
        return { found: false, message: "Firma nenájdená v registri ARES" };
      }
      return { found: false, message: `ARES vrátil chybu (${resp.status})` };
    }

    const data = await resp.json();
    const name = data.obchodniJmeno || data.nazev || null;
    const sidlo = data.sidlo || {};
    const street = sidlo.nazevUlice || sidlo.nazevObce || "";
    const streetNumber = [sidlo.cisloDomovni, sidlo.cisloOrientacni].filter(Boolean).join("/");
    const zip = sidlo.psc ? String(sidlo.psc) : "";
    const city = sidlo.nazevObce || sidlo.nazevMestskeCasti || "";
    const legalFormCode = data.pravniForma;
    const legalFormMap: Record<string, string> = {
      "101": "Fyzická osoba podnikajúca",
      "112": "Spoločnosť s ručením obmedzeným",
      "111": "Verejná obchodná spoločnosť",
      "113": "Spoločnosť komanditná",
      "121": "Akciová spoločnosť",
      "141": "Všeobecne prospešná spoločnosť",
      "205": "Družstvo",
      "301": "Štátny podnik",
      "331": "Príspevková organizácia",
      "421": "Zahraničná osoba",
      "701": "Občianske združenie",
      "711": "Politická strana",
      "721": "Cirkevná organizácia",
      "745": "Nadácia",
      "801": "Spoločenstvo vlastníkov jednotiek",
    };
    const legalForm = legalFormMap[String(legalFormCode)] || (legalFormCode ? `Kód ${legalFormCode}` : "");
    const dic = data.dic || null;

    if (!name) {
      return { found: false, message: "Firma nenájdená v registri ARES" };
    }

    const directors: string[] = [];
    try {
      const czStatOrgan = data.czleskyStatutarniOrgan || data.seznamClenuStatutarnihoOrganu || [];
      if (Array.isArray(czStatOrgan)) {
        for (const member of czStatOrgan) {
          const jmeno = member.jmeno || member.krestniJmeno || "";
          const prijmeni = member.prijmeni || "";
          const fullName = [jmeno, prijmeni].filter(Boolean).join(" ").trim();
          if (fullName && fullName.length >= 3) directors.push(fullName);
        }
      }
    } catch {}

    return {
      found: true,
      source: "ARES",
      name,
      street,
      streetNumber,
      zip,
      city,
      legalForm,
      dic: dic || undefined,
      directors: directors.length > 0 ? directors : undefined,
    };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { found: false, message: "ARES nedostupný (timeout)" };
    }
    return { found: false, message: "Chyba pri komunikácii s ARES" };
  }
}

export async function lookupByIco(
  ico: string,
  type?: "szco" | "company" | "organization" | "person" | string,
  skipAres?: boolean
): Promise<RegistryLookupResult & { valid: boolean; normalized: string }> {
  const { validateSlovakICO } = await import("@shared/ico-validator");
  const icoResult = validateSlovakICO(ico);
  if (!icoResult.valid) {
    return { valid: false, normalized: ico, found: false, message: icoResult.error };
  }
  const normalized = icoResult.normalized || ico;

  if (type === "szco") {
    return {
      valid: true,
      normalized,
      found: false,
      message: "Pre SZČO nie je automatické vyhľadávanie v registroch dostupné. Vyplňte údaje manuálne.",
    };
  }

  if (type === "organization") {
    return {
      valid: true,
      normalized,
      found: false,
      message: "Pre neziskové organizácie nie je automatické vyhľadávanie v registroch dostupné. Vyplňte údaje manuálne.",
    };
  }

  const lookups: Array<() => Promise<RegistryLookupResult>> = [];
  lookups.push(() => lookupOrsrByIco(normalized));
  if (!skipAres) lookups.push(() => lookupAresByIco(normalized));

  let allUnreachable = true;

  for (const lookup of lookups) {
    try {
      const result = await lookup();
      if (result.found) {
        return { valid: true, normalized, ...result };
      }
      if (result.reachable !== false) {
        allUnreachable = false;
      }
    } catch {
      continue;
    }
  }

  if (allUnreachable) {
    return {
      valid: true,
      normalized,
      found: false,
      message: "Štátne registre sú dočasne nedostupné. Skúste neskôr alebo vyplňte údaje manuálne.",
    };
  }

  return {
    valid: true,
    normalized,
    found: false,
    message: "Subjekt nenájdený v štátnych registroch, prosím vyplňte údaje manuálne.",
  };
}
