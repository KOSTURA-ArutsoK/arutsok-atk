import * as cheerio from "cheerio";
import * as iconv from "iconv-lite";
import { createHash } from "crypto";

export interface RegistryLookupResult {
  found: boolean;
  reachable?: boolean;
  source?: "ORSR" | "ZRSR" | "ARES";
  name?: string;
  street?: string;
  streetNumber?: string;
  zip?: string;
  city?: string;
  legalForm?: string;
  dic?: string;
  directors?: string[];
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

    return {
      found: true,
      source: "ORSR",
      name: name.trim(),
      street,
      streetNumber,
      zip,
      city,
      legalForm,
    };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { found: false, message: "ORSR nedostupný (timeout)" };
    }
    console.error("[ORSR LOOKUP ERROR]", err.message);
    return { found: false, message: "Chyba pri komunikácii s ORSR" };
  }
}

const MAX_ALTCHA_ITERATIONS = 200000;

async function solveAltchaChallenge(challengeJson: {
  algorithm: string;
  challenge: string;
  salt: string;
  signature: string;
  maxnumber: number;
}): Promise<string | null> {
  const { challenge, salt } = challengeJson;
  const cap = Math.min(challengeJson.maxnumber || 100000, MAX_ALTCHA_ITERATIONS);
  const startTime = Date.now();
  const TIMEOUT_MS = 3000;

  for (let n = 0; n <= cap; n++) {
    if (n % 10000 === 0 && Date.now() - startTime > TIMEOUT_MS) {
      return null;
    }
    const hash = createHash("sha256").update(salt + n).digest("hex");
    if (hash === challenge) {
      const payload = JSON.stringify({
        algorithm: challengeJson.algorithm,
        challenge,
        number: n,
        salt,
        signature: challengeJson.signature,
      });
      return Buffer.from(payload).toString("base64");
    }
  }
  return null;
}

export async function lookupZrsrByIco(ico: string): Promise<RegistryLookupResult> {
  try {
    const getResp = await fetchWithTimeout("https://www.zrsr.sk/");
    if (!getResp.ok) {
      return { found: false, message: `ZRSR vrátil chybu (${getResp.status})` };
    }

    const pageHtml = await getResp.text();
    const cookies = getResp.headers.getSetCookie?.() || [];
    const cookieStr = cookies.map((c: string) => c.split(";")[0]).join("; ");

    const tokenMatch = pageHtml.match(/name="__RequestVerificationToken".*?value="([^"]+)"/);
    const token = tokenMatch ? tokenMatch[1] : "";

    if (!token) {
      return { found: false, message: "ZRSR: chýba CSRF token" };
    }

    let altchaSolution = "";
    try {
      const challengeResp = await fetchWithTimeout("https://www.zrsr.sk/?handler=AltchaChallenge", {
        headers: { Cookie: cookieStr },
      }, 5000);
      if (challengeResp.ok) {
        const challengeJson = await challengeResp.json();
        const solution = await solveAltchaChallenge(challengeJson);
        altchaSolution = solution || "";
      }
    } catch {
      altchaSolution = "";
    }

    const body = new URLSearchParams({
      how_filtered: "ico",
      filter_ico: ico,
      __RequestVerificationToken: token,
    });

    const postHeaders: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cookie": cookieStr,
      "Referer": "https://www.zrsr.sk/",
      "Origin": "https://www.zrsr.sk",
    };
    if (altchaSolution) {
      postHeaders["Altcha"] = altchaSolution;
    }

    const postResp = await fetchWithTimeout("https://www.zrsr.sk/", {
      method: "POST",
      headers: postHeaders,
      body: body.toString(),
    }, 8000);

    if (!postResp.ok) {
      return { found: false, message: `ZRSR vrátil chybu (${postResp.status})` };
    }

    const resultHtml = await postResp.text();
    const $ = cheerio.load(resultHtml);

    const bodyText = $("body").text();
    if (
      bodyText.includes("nie ste robot") ||
      bodyText.includes("Overenie, ") ||
      bodyText.includes("not a robot") ||
      (resultHtml.includes("Overenie") && !bodyText.includes("Vyhľadávanie"))
    ) {
      return { found: false, reachable: false, message: "ZRSR: anti-bot ochrana aktívna" };
    }

    const resultTable = $("table.govuk-table");
    if (!resultTable.length) {
      if (bodyText.includes("správne vyplnený")) {
        return { found: false, reachable: false, message: "ZRSR: nepodarilo sa overiť formulár" };
      }
      if (bodyText.includes("0 výsledkov") || bodyText.includes("neboli nájdené") || !bodyText.includes("Vyhľadávanie") || resultHtml.length < 5000) {
        return { found: false, reachable: true, message: "Živnostník nenájdený v ZRSR" };
      }
      return { found: false, reachable: true, message: "Živnostník nenájdený v ZRSR" };
    }

    let name = "";
    let street = "";
    let streetNumber = "";
    let zip = "";
    let city = "";

    $("table.govuk-table tbody tr").each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length >= 2) {
        const label = cleanText($(cells[0]).text());
        const value = cleanText($(cells[1]).text());
        if (label.includes("Obchodné meno") || label.includes("obchodné meno")) {
          name = value;
        }
        if (label.includes("Miesto podnikania") || label.includes("Sídlo") || label.includes("sídlo")) {
          const addrParts = value.split(",").map(s => s.trim());
          if (addrParts.length >= 2) {
            const streetPart = addrParts[0];
            const streetMatch = streetPart.match(/^(.+?)\s+(\d+[\w/]*)$/);
            if (streetMatch) {
              street = streetMatch[1];
              streetNumber = streetMatch[2];
            } else {
              street = streetPart;
            }
            const cityPart = addrParts[addrParts.length - 1];
            const zipMatch = cityPart.match(/(\d{3}\s?\d{2})\s*(.*)/);
            if (zipMatch) {
              zip = zipMatch[1].replace(/\s/g, "");
              city = zipMatch[2] || "";
            } else {
              city = cityPart;
            }
            if (addrParts.length >= 3 && !zip) {
              const midPart = addrParts[1];
              const midZipMatch = midPart.match(/(\d{3}\s?\d{2})/);
              if (midZipMatch) {
                zip = midZipMatch[1].replace(/\s/g, "");
              }
            }
          }
        }
      }
    });

    if (!name) {
      const bodyText = $("body").text();
      const detailLinks = $("a[href*='detail']");
      if (detailLinks.length > 0) {
        const firstLink = detailLinks.first();
        name = cleanText(firstLink.text()) || "";
      }

      if (!name) {
        const resultRows = $(".govuk-summary-list__row");
        resultRows.each((_, row) => {
          const key = cleanText($(row).find(".govuk-summary-list__key").text());
          const val = cleanText($(row).find(".govuk-summary-list__value").text());
          if (key.includes("Obchodné meno") || key.includes("Meno")) {
            name = val;
          }
          if ((key.includes("Miesto") || key.includes("Sídlo")) && val) {
            const parts = val.split(",").map(s => s.trim());
            if (parts.length >= 2) {
              const sPart = parts[0];
              const sMatch = sPart.match(/^(.+?)\s+(\d+[\w/]*)$/);
              if (sMatch) { street = sMatch[1]; streetNumber = sMatch[2]; }
              else { street = sPart; }
              const cPart = parts[parts.length - 1];
              const zMatch = cPart.match(/(\d{3}\s?\d{2})\s*(.*)/);
              if (zMatch) { zip = zMatch[1].replace(/\s/g, ""); city = zMatch[2]; }
              else { city = cPart; }
            }
          }
        });
      }
    }

    if (!name) {
      return { found: false, message: "Živnostník nenájdený v ZRSR" };
    }

    return {
      found: true,
      source: "ZRSR",
      name,
      street,
      streetNumber,
      zip,
      city,
      legalForm: "Fyzická osoba - podnikateľ",
    };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { found: false, message: "ZRSR nedostupný (timeout)" };
    }
    console.error("[ZRSR LOOKUP ERROR]", err.message);
    return { found: false, message: "Chyba pri komunikácii s ZRSR" };
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

  const lookups: Array<() => Promise<RegistryLookupResult>> = [];

  if (type === "szco") {
    lookups.push(() => lookupZrsrByIco(normalized));
    lookups.push(() => lookupOrsrByIco(normalized));
    if (!skipAres) lookups.push(() => lookupAresByIco(normalized));
  } else if (type === "company" || type === "organization") {
    lookups.push(() => lookupOrsrByIco(normalized));
    lookups.push(() => lookupZrsrByIco(normalized));
    if (!skipAres) lookups.push(() => lookupAresByIco(normalized));
  } else {
    lookups.push(() => lookupOrsrByIco(normalized));
    lookups.push(() => lookupZrsrByIco(normalized));
    if (!skipAres) lookups.push(() => lookupAresByIco(normalized));
  }

  let lastErrorMessage = "";
  let anyReachable = false;
  let allUnreachable = true;
  let zrsrUnreachable = false;

  for (const lookup of lookups) {
    try {
      const result = await lookup();
      if (result.found) {
        return { valid: true, normalized, ...result };
      }
      const reachable = result.reachable !== false;
      if (reachable) {
        anyReachable = true;
        allUnreachable = false;
      }
      if (result.message === "ZRSR: anti-bot ochrana aktívna" || result.message === "ZRSR: nepodarilo sa overiť formulár") {
        zrsrUnreachable = true;
      }
      if (result.message) lastErrorMessage = result.message;
    } catch {
      continue;
    }
  }

  if (type === "szco" && zrsrUnreachable) {
    return {
      valid: true,
      normalized,
      found: false,
      registersUnavailable: true,
      message: "Živnostenský register SR (ZRSR) je dočasne nedostupný z technických dôvodov. Vyplňte údaje živnosti manuálne.",
    } as any;
  }

  if (allUnreachable) {
    return {
      valid: true,
      normalized,
      found: false,
      registersUnavailable: true,
      message: "Štátne registre sú dočasne nedostupné. Skúste neskôr alebo vyplňte údaje manuálne.",
    } as any;
  }

  return {
    valid: true,
    normalized,
    found: false,
    message: "Subjekt nenájdený v štátnych registroch, prosím vyplňte údaje manuálne.",
  };
}
