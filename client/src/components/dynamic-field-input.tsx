import { useState, useMemo } from "react";
import { useStates } from "@/hooks/use-hierarchy";
import { useAppUser } from "@/hooks/use-app-user";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { MultiSelectCheckboxes } from "@/components/multi-select-checkboxes";
import { PhoneInput } from "@/components/phone-input";
import { FieldHistoryIndicator } from "@/components/field-history-indicator";
import { cn } from "@/lib/utils";
import { getDocumentValidityStatus, isValidityField, isNumberFieldWithExpiredPair } from "@/lib/document-validity";
import { validateSlovakRC } from "@shared/rc-validator";
import { validateSlovakICO } from "@shared/ico-validator";
import type { StaticField } from "@/lib/staticFieldDefs";

export const TITLE_NORMALIZE_MAP: Record<string, string> = {
  "bc": "Bc.", "bc.": "Bc.",
  "ing": "Ing.", "ing.": "Ing.",
  "ing. arch.": "Ing. arch.", "ing.arch.": "Ing. arch.", "ing. arch": "Ing. arch.", "ingarch": "Ing. arch.",
  "mgr": "Mgr.", "mgr.": "Mgr.",
  "mgr. art.": "Mgr. art.", "mgr.art.": "Mgr. art.", "mgr. art": "Mgr. art.",
  "mudr": "MUDr.", "mudr.": "MUDr.",
  "mvdr": "MVDr.", "mvdr.": "MVDr.",
  "mddr": "MDDr.", "mddr.": "MDDr.",
  "phdr": "PhDr.", "phdr.": "PhDr.",
  "rndr": "RNDr.", "rndr.": "RNDr.",
  "judr": "JUDr.", "judr.": "JUDr.",
  "paeddr": "PaedDr.", "paeddr.": "PaedDr.", "paed. dr.": "PaedDr.", "paed.dr.": "PaedDr.",
  "thdr": "ThDr.", "thdr.": "ThDr.",
  "thlic": "ThLic.", "thlic.": "ThLic.",
  "dr": "Dr.", "dr.": "Dr.",
  "phmr": "PhMr.", "phmr.": "PhMr.",
  "pharmdr": "PharmDr.", "pharmdr.": "PharmDr.",
  "doc": "Doc.", "doc.": "Doc.", "docent": "Doc.",
  "prof": "Prof.", "prof.": "Prof.", "profesor": "Prof.",
  "dipl": "Dipl.", "dipl.": "Dipl.",
  "phd": "PhD.", "phd.": "PhD.",
  "csc": "CSc.", "csc.": "CSc.",
  "drsc": "DrSc.", "drsc.": "DrSc.",
  "mba": "MBA",
  "mpa": "MPA",
  "msc": "MSc.", "msc.": "MSc.",
  "bsc": "BSc.", "bsc.": "BSc.",
  "dis": "DiS.", "dis.": "DiS.",
  "dis.art": "DiS.art.", "dis.art.": "DiS.art.",
  "mph": "MPH",
  "ll.m": "LL.M.", "ll.m.": "LL.M.", "llm": "LL.M.",
  "mha": "MHA",
  "artd": "ArtD.", "artd.": "ArtD.",
};

export function normalizeTitle(raw: string): string | null {
  if (!raw || !raw.trim()) return "";
  const parts = raw.trim().split(/\s+/);
  const canonical: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (TITLE_NORMALIZE_MAP[key]) {
      canonical.push(TITLE_NORMALIZE_MAP[key]);
    } else {
      const wholeKey = raw.trim().toLowerCase();
      if (TITLE_NORMALIZE_MAP[wholeKey]) return TITLE_NORMALIZE_MAP[wholeKey];
      return null;
    }
  }
  return canonical.join(" ");
}

export function capitalizeFirst(val: string): string {
  if (!val) return val;
  return val.charAt(0).toUpperCase() + val.slice(1);
}

export function DynamicFieldInput({ field, dynamicValues, setDynamicValues, hasError, disabled, subjectId }: {
  field: StaticField;
  dynamicValues: Record<string, string>;
  setDynamicValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  hasError?: boolean;
  disabled?: boolean;
  subjectId?: number;
}) {
  const { data: allStates } = useStates();
  const { data: appUser } = useAppUser();
  const [nameWarning, setNameWarning] = useState<string | null>(null);
  const [titleWarning, setTitleWarning] = useState<string | null>(null);
  const [rcFieldError, setRcFieldError] = useState<string | null>(null);
  const [icoFieldError, setIcoFieldError] = useState<string | null>(null);

  const isNameField = field.fieldKey === "meno" || field.fieldKey === "priezvisko";
  const isTitleField = field.fieldKey === "titul_pred" || field.fieldKey === "titul_za";
  const isRcField = field.fieldKey === "rodne_cislo" || field.fieldKey === "zi_rodne_cislo";
  const isIcoField = field.fieldKey === "ico" || field.fieldKey === "zi_ico";

  const numberFieldValidity = useMemo(() => {
    return isNumberFieldWithExpiredPair(field.fieldKey, dynamicValues);
  }, [field.fieldKey, dynamicValues]);
  const isExpiredNumber = numberFieldValidity?.status === "expired";
  const errorBorder = hasError || rcFieldError || icoFieldError ? "border-red-500 ring-1 ring-red-500" : isExpiredNumber ? "border-red-500/60 bg-red-500/10 ring-1 ring-red-500/30" : titleWarning ? "border-amber-500 ring-1 ring-amber-500/60" : "";
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <Label className={`text-xs truncate block ${hasError ? "text-red-500" : isExpiredNumber ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
          {field.shortLabel ? (
            <>
              <span className="hidden lg:inline">{field.label || field.fieldKey}</span>
              <span className="inline lg:hidden">{field.shortLabel}</span>
            </>
          ) : (
            <span>{field.label || field.fieldKey}</span>
          )}
          {field.isRequired ? " *" : ""}
          {isExpiredNumber && <span className="ml-1 text-red-500 text-[9px]">(neplatný doklad)</span>}
        </Label>
        {subjectId && (
          <FieldHistoryIndicator subjectId={subjectId} fieldKey={field.fieldKey} fieldLabel={field.label || field.fieldKey} />
        )}
      </div>
      {field.fieldType === "long_text" ? (
        <Textarea
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
          rows={2}
          className={errorBorder}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      ) : field.fieldType === "combobox" || field.fieldType === "jedna_moznost" ? (
        <Select
          value={dynamicValues[field.fieldKey] || ""}
          onValueChange={val => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: val }))}
          disabled={disabled}
        >
          <SelectTrigger className={cn(errorBorder, disabled && "bg-muted/50 cursor-default opacity-100")} data-testid={`select-dynamic-${field.fieldKey}`}>
            <SelectValue placeholder="" />
          </SelectTrigger>
          <SelectContent>
            {(field.options || []).map((opt: string) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.fieldType === "viac_moznosti" ? (
        <MultiSelectCheckboxes
          paramId={field.fieldKey}
          options={field.options || []}
          value={dynamicValues[field.fieldKey] || ""}
          onChange={(val) => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: val }))}
        />
      ) : field.fieldType === "switch" ? (
        <div className="flex items-center gap-2 pt-1">
          <Switch
            checked={dynamicValues[field.fieldKey] === "true"}
            onCheckedChange={checked => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: String(checked) }))}
            data-testid={`switch-dynamic-${field.fieldKey}`}
          />
          <span className="text-xs text-muted-foreground">{dynamicValues[field.fieldKey] === "true" ? "Ano" : "Nie"}</span>
        </div>
      ) : field.fieldType === "checkbox" ? (
        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            checked={dynamicValues[field.fieldKey] === "true"}
            onCheckedChange={checked => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: String(!!checked) }))}
            data-testid={`checkbox-dynamic-${field.fieldKey}`}
          />
          <span className="text-xs text-muted-foreground">{dynamicValues[field.fieldKey] === "true" ? "Ano" : "Nie"}</span>
        </div>
      ) : field.fieldType === "date" ? (
        (() => {
          const dateVal = dynamicValues[field.fieldKey] || "";
          const isValidity = isValidityField(field.fieldKey);
          const validity = isValidity && dateVal ? getDocumentValidityStatus(dateVal) : null;
          const validityClass = validity ? `${validity.borderClass} ${validity.bgClass}` : "";
          const validityLabel = validity?.label || "";
          return (
            <div className="relative">
              <Input
                type="date"
                value={dateVal}
                onChange={e => { if (disabled) return; setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value })); }}
                readOnly={disabled}
                tabIndex={disabled ? -1 : undefined}
                className={cn(errorBorder || validityClass, disabled && "bg-muted/50 cursor-default", validityLabel && "pr-[5.5rem]")}
                data-testid={`input-dynamic-${field.fieldKey}`}
              />
              {validity && validity.status !== "unknown" && (
                <span className={cn(
                  "absolute right-8 top-1/2 -translate-y-1/2 text-[10px] font-semibold pointer-events-none select-none flex items-center gap-1",
                  validity.textClass
                )} data-testid={`validity-status-${field.fieldKey}`}>
                  <span className={cn("w-2 h-2 rounded-full shrink-0", validity.dotClass)} />
                  {validityLabel}
                </span>
              )}
            </div>
          );
        })()
      ) : field.fieldType === "number" && field.fieldKey === "vek" ? (
        <div
          className="h-9 w-full flex items-center px-3 rounded-md bg-muted/50 border border-border text-sm font-medium text-foreground cursor-default select-none whitespace-nowrap"
          data-testid={`input-dynamic-${field.fieldKey}`}
        >
          {dynamicValues[field.fieldKey] ? `${dynamicValues[field.fieldKey]} rokov` : ""}
        </div>
      ) : field.fieldType === "number" ? (
        <Input
          type="number"
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
          className={errorBorder}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      ) : field.fieldType === "email" ? (
        <Input
          type="email"
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
          className={errorBorder}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      ) : field.fieldType === "phone" ? (
        <PhoneInput
          value={dynamicValues[field.fieldKey] || ""}
          onChange={val => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: val }))}
          initialDialCode={allStates?.find(s => s.id === appUser?.activeStateId)?.code}
          error={!!errorBorder}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      ) : field.fieldType === "iban" ? (
        <Input
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value.toUpperCase() }))}
          placeholder="SK00 0000 0000 0000 0000 0000"
          className={`font-mono ${errorBorder}`}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      ) : isTitleField ? (
        <Input
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => {
            setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }));
            if (!e.target.value.trim()) setTitleWarning(null);
          }}
          onBlur={() => {
            const raw = dynamicValues[field.fieldKey] || "";
            if (!raw.trim()) { setTitleWarning(null); return; }
            const result = normalizeTitle(raw);
            if (result === null) {
              setTitleWarning(`"${raw}" — titul sa nenachádza v zozname povolených titulov`);
            } else if (result !== raw) {
              setDynamicValues(prev => ({ ...prev, [field.fieldKey]: result }));
              setTitleWarning(null);
            } else {
              setTitleWarning(null);
            }
          }}
          className={errorBorder}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      ) : isNameField ? (
        <Input
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => {
            const raw = e.target.value;
            if (raw.length > 0 && raw.charAt(0) !== raw.charAt(0).toUpperCase()) {
              const corrected = capitalizeFirst(raw);
              setDynamicValues(prev => ({ ...prev, [field.fieldKey]: corrected }));
              const fieldLabel = field.fieldKey === "meno" ? "Meno" : "Priezvisko";
              setNameWarning(`${fieldLabel} opravene: "${raw}" → "${corrected}"`);
            } else {
              setDynamicValues(prev => ({ ...prev, [field.fieldKey]: raw }));
              setNameWarning(null);
            }
          }}
          onBlur={() => {
            const val = dynamicValues[field.fieldKey] || "";
            if (val.length > 0 && val.charAt(0) !== val.charAt(0).toUpperCase()) {
              const corrected = capitalizeFirst(val);
              setDynamicValues(prev => ({ ...prev, [field.fieldKey]: corrected }));
              const fieldLabel = field.fieldKey === "meno" ? "Meno" : "Priezvisko";
              setNameWarning(`${fieldLabel} opravene: "${val}" → "${corrected}"`);
            }
          }}
          className={cn(errorBorder, nameWarning && "border-amber-500")}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      ) : isRcField ? (
        <Input
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => {
            setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }));
            if (rcFieldError) {
              const result = validateSlovakRC(e.target.value);
              if (result.valid) setRcFieldError(null);
            }
          }}
          onBlur={() => {
            const val = (dynamicValues[field.fieldKey] || "").trim();
            if (!val || val.replace(/[\s\/-]/g, "").length < 6) { setRcFieldError(null); return; }
            const result = validateSlovakRC(val);
            if (!result.valid) {
              setRcFieldError(result.error || "Neplatné rodné číslo");
            } else {
              setRcFieldError(null);
            }
          }}
          className={`font-mono ${errorBorder}`}
          placeholder="XXXXXX/XXXX"
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      ) : isIcoField ? (
        <Input
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => {
            setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }));
            if (icoFieldError) {
              const r = validateSlovakICO(e.target.value);
              if (r.valid) setIcoFieldError(null);
            }
          }}
          onBlur={() => {
            const val = (dynamicValues[field.fieldKey] || "").trim();
            if (!val) { setIcoFieldError(null); return; }
            const result = validateSlovakICO(val);
            if (!result.valid) {
              setIcoFieldError(result.error || "Neplatné IČO");
            } else {
              setIcoFieldError(null);
              if (result.normalized && result.normalized !== val) {
                setDynamicValues(prev => ({ ...prev, [field.fieldKey]: result.normalized! }));
              }
            }
          }}
          className={`font-mono ${errorBorder}`}
          placeholder="12345678"
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      ) : (
        <Input
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
          className={errorBorder}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      )}
      {nameWarning && isNameField && (
        <p className="text-[10px] text-amber-500 leading-tight">{nameWarning}</p>
      )}
      {titleWarning && isTitleField && (
        <p className="text-[10px] text-amber-500 leading-tight">{titleWarning}</p>
      )}
      {rcFieldError && isRcField && (
        <p className="text-[10px] text-red-500 leading-tight" data-testid={`text-rc-error-${field.fieldKey}`}>{rcFieldError}</p>
      )}
      {icoFieldError && isIcoField && (
        <p className="text-[10px] text-red-500 leading-tight" data-testid={`text-ico-error-${field.fieldKey}`}>{icoFieldError}</p>
      )}
    </div>
  );
}
