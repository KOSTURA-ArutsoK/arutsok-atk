import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface HelpContextType {
  helpEnabled: boolean;
  toggleHelp: () => void;
}

const HelpContext = createContext<HelpContextType>({
  helpEnabled: false,
  toggleHelp: () => {},
});

export function useHelp() {
  return useContext(HelpContext);
}

const FIELD_TOOLTIPS: Record<string, string> = {
  "nazov": "Zadajte nazov entity. Toto pole je povinne.",
  "meno": "Krstne meno osoby alebo kontaktu.",
  "priezvisko": "Priezvisko osoby alebo kontaktu.",
  "email": "Emailova adresa pre komunikaciu.",
  "telefon": "Telefonne cislo vo formate +421...",
  "tel": "Telefonne cislo vo formate +421...",
  "phone": "Telefonne cislo vo formate +421...",
  "adresa": "Uplna postova adresa.",
  "ulica": "Nazov ulice a popisne cislo.",
  "mesto": "Nazov mesta alebo obce.",
  "psc": "Postove smerovacie cislo (5 cifier).",
  "ico": "Identifikacne cislo organizacie (8 cifier).",
  "dic": "Danove identifikacne cislo.",
  "ic_dph": "Identifikacne cislo pre DPH.",
  "rodne_cislo": "Rodne cislo vo formate XXXXXX/XXXX.",
  "cislo_op": "Cislo obcianskeho preukazu.",
  "poznamka": "Volitelna poznamka alebo komentar.",
  "poznamky": "Volitelne poznamky alebo komentare.",
  "datum": "Datum vo formate DD.MM.RRRR.",
  "od": "Datum zaciatku platnosti.",
  "do": "Datum konca platnosti.",
  "suma": "Financna suma v EUR.",
  "percento": "Percentualna hodnota (0-100).",
  "provisia": "Vyska provizie v EUR alebo percentach.",
  "stav": "Aktualny stav zaznamu.",
  "rola": "Rola pouzivatela v systeme.",
  "heslo": "Bezpecnostne heslo. Pouzite silne heslo.",
  "password": "Bezpecnostne heslo. Pouzite silne heslo.",
  "kod": "Jedinecny kod entity.",
  "specializacia": "Oblast specializacie alebo zamerania.",
  "popis": "Podrobny popis entity.",
  "kategoria": "Kategoria pre klasifikaciu.",
  "typ": "Typ zaznamu alebo entity.",
  "support-phone": "Telefonne cislo podpory zobrazene klientom pri neuspesnej registracii.",
  "search": "Vyhladavanie v zozname zaznamov.",
  "filter": "Filtrovanie zaznamov podla kriterii.",
};

function getTooltipForElement(el: HTMLElement): string | null {
  const id = el.id?.toLowerCase() || "";
  const name = (el as HTMLInputElement).name?.toLowerCase() || "";
  const placeholder = (el as HTMLInputElement).placeholder?.toLowerCase() || "";
  const ariaLabel = el.getAttribute("aria-label")?.toLowerCase() || "";

  const label = el.closest("div")?.querySelector("label");
  const labelText = label?.textContent?.toLowerCase().trim() || "";

  const candidates = [id, name, labelText, placeholder, ariaLabel];

  for (const candidate of candidates) {
    if (!candidate) continue;
    for (const [key, tip] of Object.entries(FIELD_TOOLTIPS)) {
      if (candidate.includes(key)) {
        return tip;
      }
    }
  }

  if (el.tagName === "INPUT") {
    const type = (el as HTMLInputElement).type;
    if (type === "text") return "Textove pole. Zadajte pozadovanu hodnotu.";
    if (type === "number") return "Numericke pole. Zadajte cislo.";
    if (type === "email") return "Pole pre emailovu adresu.";
    if (type === "tel") return "Pole pre telefonne cislo.";
    if (type === "date") return "Pole pre datum.";
    if (type === "password") return "Pole pre heslo.";
    if (type === "checkbox") return "Zaskrtavacie pole. Kliknite pre zmenu stavu.";
    return "Vstupne pole. Vyplnte pozadovanu hodnotu.";
  }
  if (el.tagName === "TEXTAREA") return "Textova oblast. Mozete zadat viacriadkovy text.";
  if (el.tagName === "SELECT") return "Vyberove pole. Zvolte jednu z moznosti.";

  if (el.tagName === "LABEL") {
    const forId = (el as HTMLLabelElement).htmlFor;
    if (forId) {
      const input = document.getElementById(forId);
      if (input) return getTooltipForElement(input);
    }
    return `Popisok pola: "${el.textContent?.trim()}"`;
  }

  return null;
}

interface TooltipState {
  x: number;
  y: number;
  text: string;
}

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [helpEnabled, setHelpEnabled] = useState(() => {
    try {
      return localStorage.getItem("arutsok_help") === "true";
    } catch {
      return false;
    }
  });
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const toggleHelp = useCallback(() => {
    setHelpEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem("arutsok_help", String(next)); } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    if (!helpEnabled) {
      setTooltip(null);
      return;
    }

    function handleContextMenu(e: MouseEvent) {
      const target = e.target as HTMLElement;

      const isInteractive = target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.tagName === "LABEL" ||
        target.closest("label") !== null;

      if (!isInteractive) return;

      const el = target.tagName === "LABEL" ? target : (target.closest("label") || target);
      const tip = getTooltipForElement(el as HTMLElement);
      if (!tip) return;

      e.preventDefault();
      setTooltip({ x: e.clientX, y: e.clientY, text: tip });
    }

    function handleClick() {
      setTooltip(null);
    }

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("click", handleClick);
    document.addEventListener("scroll", handleClick, true);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("click", handleClick);
      document.removeEventListener("scroll", handleClick, true);
    };
  }, [helpEnabled]);

  const tooltipPortal = createPortal(
    tooltip ? (
      <div
        className="fixed z-[10000] max-w-xs p-3 rounded-md border border-border bg-card shadow-lg text-sm"
        style={{ left: tooltip.x + 8, top: tooltip.y + 8 }}
        data-testid="help-tooltip"
      >
        <p className="text-foreground">{tooltip.text}</p>
        <p className="text-[10px] text-muted-foreground mt-1 italic">Pravym kliknutim na pole zobrazite napovedu</p>
      </div>
    ) : null,
    document.body
  );

  return (
    <HelpContext.Provider value={{ helpEnabled, toggleHelp }}>
      {children}
      {tooltipPortal}
    </HelpContext.Provider>
  );
}
