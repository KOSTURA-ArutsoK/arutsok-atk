import * as cheerio from "cheerio";
import * as iconv from "iconv-lite";

export interface BusinessActivity {
  text: string;
  since?: string;
}

export interface Shareholder {
  name: string;
  contribution?: string;
  address?: string;
}

export interface RegistryLookupResult {
  found: boolean;
  reachable?: boolean;
  source?: "ORSR" | "ARES" | "Finstat";
  name?: string;
  street?: string;
  streetNumber?: string;
  zip?: string;
  city?: string;
  legalForm?: string;
  dic?: string;
  icDph?: string;
  vatParagraph?: string;
  vatRegisteredAt?: string;
  foundedDate?: string;
  directors?: { name: string; role: string }[];
  actingNote?: string;
  message?: string;
  businessActivities?: BusinessActivity[];
  shareCapital?: string;
  shareholders?: Shareholder[];
  otherFacts?: string[];
}

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "sk-SK,sk;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
};

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 6000): Promise<Response> {
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

const SK_MONTHS: Record<string, number> = {
  januára: 1, januáru: 1, január: 1,
  februára: 2, februáru: 2, február: 2,
  marca: 3, marcu: 3, marec: 3,
  apríla: 4, aprílu: 4, apríl: 4,
  mája: 5, máju: 5, máj: 5,
  júna: 6, júnu: 6, jún: 6,
  júla: 7, júlu: 7, júl: 7,
  augusta: 8, augustu: 8, august: 8,
  septembra: 9, septembru: 9, september: 9,
  októbra: 10, októbru: 10, október: 10,
  novembra: 11, novembru: 11, november: 11,
  decembra: 12, decembru: 12, december: 12,
};

function parseSlovakDate(text: string): string | undefined {
  const cleaned = text.trim().toLowerCase();
  const dotMatch = cleaned.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dotMatch) {
    const [, d, m, y] = dotMatch;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const match = cleaned.match(/(\d{1,2})\.\s*(\S+)\s+(\d{4})/);
  if (!match) return undefined;
  const [, day, monthWord, year] = match;
  const month = SK_MONTHS[monthWord];
  if (!month) return undefined;
  return `${year}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export async function lookupFinstatByIco(ico: string): Promise<Partial<RegistryLookupResult>> {
  try {
    console.log(`[LOOKUP] Finstat start ICO=${ico}`);
    const url = `https://finstat.sk/${encodeURIComponent(ico)}`;
    const resp = await fetchWithTimeout(url, {
      headers: {
        ...BROWSER_HEADERS,
        "Referer": "https://finstat.sk/",
      },
    }, 6000);

    if (!resp.ok) {
      console.log(`[LOOKUP] Finstat done ICO=${ico} — HTTP ${resp.status}`);
      return {};
    }

    const html = await resp.text();
    const $ = cheerio.load(html);

    let dic: string | undefined;
    let icDph: string | undefined;
    let vatParagraph: string | undefined;
    let vatRegisteredAt: string | undefined;
    let foundedDate: string | undefined;

    $("li").each((_, el) => {
      const strong = $(el).find("strong").first().text().trim();
      const span = $(el).find("span").first();

      if (strong === "DIČ") {
        dic = span.text().trim() || undefined;
      }

      if (strong === "IČ DPH") {
        const rawText = span.text().trim();
        const icDphMatch = rawText.match(/^([A-Z]{2}\d+)/);
        if (icDphMatch) {
          icDph = icDphMatch[1];
        } else {
          const stripped = rawText.replace(/\s+/g, "");
          const fallbackMatch = stripped.match(/^([A-Z]{2}\d+)/);
          if (fallbackMatch) {
            icDph = fallbackMatch[1];
          } else if (rawText) {
            icDph = rawText.split(",")[0].trim() || undefined;
          }
        }

        const paragraphMatch = rawText.match(/podľa\s+(§[^\s,<]+)/i);
        if (paragraphMatch) {
          vatParagraph = paragraphMatch[1];
        }

        const registrationMatch = rawText.match(/registrácia\s+od\s+([\d]{1,2}\.\d{1,2}\.\d{4})/i);
        if (registrationMatch) {
          vatRegisteredAt = parseSlovakDate(registrationMatch[1]);
        } else {
          const innerSpan = span.find("span").text().trim();
          const regMatch2 = innerSpan.match(/registrácia\s+od\s+([\d]{1,2}\.[\d]{1,2}\.[\d]{4})/i);
          if (regMatch2) {
            vatRegisteredAt = parseSlovakDate(regMatch2[1]);
          }
        }
      }

      const foundedLabels = ["Deň zápisu do ORSR", "Deň vzniku v ŠÚ SR", "Dátum vzniku", "Vznik", "Dátum zápisu", "Založenie"];
      if (!foundedDate && foundedLabels.includes(strong)) {
        const dateText = span.text().trim();
        const parsed = parseSlovakDate(dateText);
        if (parsed) foundedDate = parsed;
      }
    });

    const foundedDatePattern = /^(dátum\s+vzniku|deň\s+zápisu(\s+do\s+orsr)?|deň\s+vzniku(\s+v\s+šú\s+sr)?|založenie|vznik\s+spoločnosti)\s*:?$/i;

    if (!foundedDate) {
      $("tr").each((_, el) => {
        if (foundedDate) return;
        const label = $(el).find("td, th").first().text().trim();
        if (foundedDatePattern.test(label)) {
          const val = $(el).find("td").last().text().trim();
          const parsed = parseSlovakDate(val);
          if (parsed) foundedDate = parsed;
        }
      });
    }

    if (!foundedDate) {
      $("dt").each((_, el) => {
        if (foundedDate) return;
        const label = $(el).text().trim();
        if (foundedDatePattern.test(label)) {
          const dd = $(el).next("dd").text().trim();
          const parsed = parseSlovakDate(dd);
          if (parsed) foundedDate = parsed;
        }
      });
    }

    if (!foundedDate) {
      const bodyText = $.text();
      const dateNearVznik = bodyText.match(/(?:dátum\s+vzniku|deň\s+zápisu|založenie)[^0-9]{0,30}(\d{1,2}\.\s*\d{1,2}\.\s*\d{4})/i);
      if (dateNearVznik) {
        foundedDate = parseSlovakDate(dateNearVznik[1]);
      }
    }

    let finstatName: string | undefined;
    const nameEl = $("h1, .company-name, [itemprop='name']").first().text().trim();
    if (nameEl && nameEl.length > 2) {
      finstatName = nameEl;
    }

    let finstatStreet: string | undefined;
    let finstatCity: string | undefined;
    let finstatZip: string | undefined;
    $("li").each((_, el) => {
      const strong = $(el).find("strong").first().text().trim();
      const span = $(el).find("span").first();
      if (strong === "Sídlo" || strong === "Adresa") {
        const addr = span.text().trim();
        if (addr) {
          const zipMatch = addr.match(/(\d{3}\s?\d{2})/);
          if (zipMatch) finstatZip = zipMatch[1].replace(/\s/g, "");
          const parts = addr.split(",").map(p => p.trim());
          if (parts.length >= 2) {
            finstatStreet = parts[0];
            finstatCity = parts[parts.length - 1].replace(/\d{3}\s?\d{2}\s*/, "").trim() || undefined;
          }
        }
      }
    });

    console.log(`[LOOKUP] Finstat done ICO=${ico} — dic=${dic || "N/A"}, icDph=${icDph || "N/A"}, name=${finstatName || "N/A"}, foundedDate=${foundedDate || "N/A"}`);
    return { dic, icDph, vatParagraph, vatRegisteredAt, foundedDate, name: finstatName, street: finstatStreet, city: finstatCity, zip: finstatZip };
  } catch (err: any) {
    console.error("[LOOKUP] Finstat error ICO=" + ico, err.message);
    return {};
  }
}

export async function lookupOrsrByIco(ico: string): Promise<RegistryLookupResult> {
  try {
    console.log(`[LOOKUP] ORSR start ICO=${ico}`);
    const searchUrl = `https://www.orsr.sk/hladaj_ico.asp?ico=${encodeURIComponent(ico)}&sid=0`;
    const searchResp = await fetchWithTimeout(searchUrl, { headers: BROWSER_HEADERS });
    if (!searchResp.ok) {
      console.log(`[LOOKUP] ORSR done ICO=${ico} — HTTP error ${searchResp.status}`);
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
      console.log(`[LOOKUP] ORSR done ICO=${ico} — not found`);
      return { found: false, message: "Firma nenájdená v ORSR" };
    }

    const detailUrl = detailPath.startsWith("http")
      ? detailPath
      : `https://www.orsr.sk/${detailPath.replace(/^\//, "")}`;

    const detailResp = await fetchWithTimeout(detailUrl, { headers: BROWSER_HEADERS });
    if (!detailResp.ok) {
      console.log(`[LOOKUP] ORSR done ICO=${ico} — detail HTTP error ${detailResp.status}`);
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

    const directorEntries: { name: string; role: string }[] = [];
    const roleMapping: Record<string, string> = {
      "Štatutárny orgán": "Štatutár",
      "Konatelia": "Konateľ",
      "Konateľ": "Konateľ",
      "Prokurista": "Prokurista",
      "Prokúra": "Prokurista",
    };
    const statutarKeys = Object.keys(roleMapping);
    for (const key of statutarKeys) {
      const vals = sections[key];
      if (!vals || vals.length === 0) continue;
      const role = roleMapping[key] || "Štatutár";
      for (const v of vals) {
        const cleaned = v.replace(/,\s*$/, "").trim();
        if (!cleaned) continue;
        if (/^\d/.test(cleaned)) continue;
        if (cleaned.toLowerCase().includes("konateľ") && cleaned.length < 12) continue;
        if (cleaned.includes("Bydlisko") || cleaned.includes("bydlisko")) continue;
        const parts = cleaned.split(",").map(p => p.trim()).filter(Boolean);
        const namePart = parts[0];
        if (namePart && namePart.length >= 3 && !directorEntries.some(d => d.name === namePart)) {
          directorEntries.push({ name: namePart, role });
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

    const businessActivities: BusinessActivity[] = [];
    $("tr").each((_, tr) => {
      const labelTd = $(tr).find("td[width='20%']").first();
      const valueTd = $(tr).find("td[width='67%']").first();
      if (!labelTd.length || !valueTd.length) return;
      const labelSpan = labelTd.find("span.tl");
      if (!labelSpan.length) return;
      const label = cleanText(labelSpan.text()).replace(/[:\s]+$/, "").trim();
      if (label !== "Predmet činnosti" && label !== "Predmety podnikania" && label !== "Predmet podnikania") return;
      const allSpans = valueTd.find("span.ra, span.ro");
      let currentText = "";
      allSpans.each((_, span) => {
        const txt = cleanText($(span).text());
        if (!txt) return;
        const dateMatch = txt.match(/^\(od:\s*(\d{2}\.\d{2}\.\d{4})\)/);
        if (dateMatch) {
          if (currentText) {
            businessActivities.push({ text: currentText, since: dateMatch[1] });
            currentText = "";
          }
        } else if (!txt.startsWith("(do:") && !txt.includes("icon_")) {
          if (currentText) {
            businessActivities.push({ text: currentText });
          }
          currentText = txt;
        }
      });
      if (currentText) {
        businessActivities.push({ text: currentText });
      }
    });

    let shareCapital = "";
    const capitalKeys = ["Základné imanie", "Základné imania"];
    for (const key of capitalKeys) {
      const vals = sections[key];
      if (vals && vals.length > 0) {
        shareCapital = vals.join(", ").trim();
        break;
      }
    }

    const shareholders: Shareholder[] = [];
    const shareholderKeys = ["Spoločníci", "Spoločník", "Akcionári", "Akcionár"];
    for (const key of shareholderKeys) {
      if (!sections[key] || sections[key].length === 0) continue;
      const vals = sections[key];
      let currentName = "";
      let currentContrib = "";
      let currentAddr = "";
      for (const v of vals) {
        const cleaned = v.replace(/,\s*$/, "").trim();
        if (!cleaned) continue;
        if (/^\d/.test(cleaned) && cleaned.includes("EUR")) {
          currentContrib = cleaned;
        } else if (/^\d{3}\s?\d{2}/.test(cleaned) || cleaned.includes("PSČ")) {
          currentAddr = currentAddr ? `${currentAddr}, ${cleaned}` : cleaned;
        } else if (cleaned.length >= 3 && !/^\d/.test(cleaned)) {
          if (currentName) {
            shareholders.push({
              name: currentName,
              contribution: currentContrib || undefined,
              address: currentAddr || undefined,
            });
          }
          currentName = cleaned;
          currentContrib = "";
          currentAddr = "";
        }
      }
      if (currentName) {
        shareholders.push({
          name: currentName,
          contribution: currentContrib || undefined,
          address: currentAddr || undefined,
        });
      }
    }

    const otherFacts: string[] = [];
    const otherKeys = ["Ďalšie právne skutočnosti", "Ostatné právne skutočnosti", "Iné skutočnosti"];
    for (const key of otherKeys) {
      const vals = sections[key];
      if (vals && vals.length > 0) {
        otherFacts.push(...vals);
      }
    }

    let foundedDate: string | undefined;
    const foundedKeys = ["Dátum vzniku", "Dátum zápisu", "Vznik"];
    for (const key of foundedKeys) {
      const vals = sections[key];
      if (vals && vals.length > 0) {
        foundedDate = parseSlovakDate(vals[0]) || undefined;
        if (foundedDate) break;
      }
    }

    console.log(`[LOOKUP] ORSR done ICO=${ico} — found: ${name.trim()}`);
    return {
      found: true,
      source: "ORSR",
      name: name.trim(),
      street,
      streetNumber,
      zip,
      city,
      legalForm,
      foundedDate,
      directors: directorEntries.length > 0 ? directorEntries : undefined,
      actingNote: actingNote || undefined,
      businessActivities: businessActivities.length > 0 ? businessActivities : undefined,
      shareCapital: shareCapital || undefined,
      shareholders: shareholders.length > 0 ? shareholders : undefined,
      otherFacts: otherFacts.length > 0 ? otherFacts : undefined,
    };
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.log(`[LOOKUP] ORSR timeout ICO=${ico}`);
      return { found: false, message: "ORSR nedostupný (timeout)" };
    }
    console.error("[LOOKUP] ORSR error ICO=" + ico, err.message);
    return { found: false, message: "Chyba pri komunikácii s ORSR" };
  }
}


export async function lookupAresByIco(ico: string): Promise<RegistryLookupResult> {
  try {
    console.log(`[LOOKUP] ARES start ICO=${ico}`);
    const resp = await fetchWithTimeout(
      `https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${encodeURIComponent(ico)}`,
      { headers: { Accept: "application/json" } },
      6000
    );

    if (!resp.ok) {
      if (resp.status === 404) {
        console.log(`[LOOKUP] ARES done ICO=${ico} — not found (404)`);
        return { found: false, message: "Firma nenájdená v registri ARES" };
      }
      console.log(`[LOOKUP] ARES done ICO=${ico} — HTTP error ${resp.status}`);
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

    const directors: { name: string; role: string }[] = [];
    const statOrgArray = data.statutarniOrgan || data.seznamStatutarnichOrganu || [];
    if (Array.isArray(statOrgArray)) {
      for (const organ of statOrgArray) {
        const clenove = organ.clenove || organ.seznamClenu || [];
        if (Array.isArray(clenove)) {
          for (const clen of clenove) {
            const osoba = clen.fospiOsoba || clen.ospiOsoba || clen;
            const jmeno = osoba.jmeno || osoba.krestniJmeno || "";
            const prijmeni = osoba.prijmeni || "";
            const fullName = [jmeno, prijmeni].filter(Boolean).join(" ").trim();
            if (fullName && fullName.length >= 3 && !directors.some(d => d.name === fullName)) {
              directors.push({ name: fullName, role: "Štatutár" });
            }
          }
        }
      }
    }

    console.log(`[LOOKUP] ARES done ICO=${ico} — found: ${name}`);
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
      console.log(`[LOOKUP] ARES timeout ICO=${ico}`);
      return { found: false, message: "ARES nedostupný (timeout)" };
    }
    console.error("[LOOKUP] ARES error ICO=" + ico, err.message);
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

  console.log(`[LOOKUP] Starting parallel lookup for ICO: ${normalized}`);
  const startTime = Date.now();

  const registryPromises: Promise<RegistryLookupResult>[] = [
    lookupOrsrByIco(normalized),
  ];
  if (!skipAres) {
    registryPromises.push(lookupAresByIco(normalized));
  }
  const finstatPromise = lookupFinstatByIco(normalized).catch(() => ({} as Partial<RegistryLookupResult>));

  const [registryResults, finstatData] = await Promise.all([
    Promise.allSettled(registryPromises),
    finstatPromise,
  ]);

  const elapsed = Date.now() - startTime;

  let primaryResult: RegistryLookupResult | null = null;
  let allUnreachable = true;

  for (const settled of registryResults) {
    if (settled.status === "fulfilled") {
      const result = settled.value;
      if (result.found && !primaryResult) {
        primaryResult = result;
      }
      if (result.reachable !== false) {
        allUnreachable = false;
      }
    }
  }

  if (primaryResult) {
    const merged: RegistryLookupResult & { valid: boolean; normalized: string } = {
      valid: true,
      normalized,
      ...primaryResult,
      dic: primaryResult.dic || finstatData.dic,
      icDph: finstatData.icDph,
      vatParagraph: finstatData.vatParagraph,
      vatRegisteredAt: finstatData.vatRegisteredAt,
      foundedDate: primaryResult.foundedDate || finstatData.foundedDate,
    };
    console.log(`[LOOKUP] Final result ICO=${normalized} — source=${primaryResult.source}, name=${primaryResult.name}, elapsed=${elapsed}ms`);
    return merged;
  }

  if (finstatData.name || finstatData.dic || finstatData.icDph) {
    console.log(`[LOOKUP] Final result ICO=${normalized} — Finstat fallback, name=${finstatData.name || "N/A"}, elapsed=${elapsed}ms`);
    return {
      valid: true,
      normalized,
      found: true,
      source: "Finstat",
      name: finstatData.name,
      street: finstatData.street,
      city: finstatData.city,
      zip: finstatData.zip,
      dic: finstatData.dic,
      icDph: finstatData.icDph,
      vatParagraph: finstatData.vatParagraph,
      vatRegisteredAt: finstatData.vatRegisteredAt,
      foundedDate: finstatData.foundedDate,
    };
  }

  console.log(`[LOOKUP] Final result ICO=${normalized} — not found in any registry, elapsed=${elapsed}ms`);

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
