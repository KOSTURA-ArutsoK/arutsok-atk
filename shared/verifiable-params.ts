export type VerifiableParamGroup = "subjekt" | "zmluva";

export type VerifiableParam = {
  key: string;
  label: string;
  group: VerifiableParamGroup;
};

export const VERIFIABLE_PARAMS: VerifiableParam[] = [
  // === Subjekt ===
  { key: "meno",               label: "Meno",                    group: "subjekt" },
  { key: "priezvisko",         label: "Priezvisko",               group: "subjekt" },
  { key: "titul_pred",         label: "Titul pred menom",         group: "subjekt" },
  { key: "titul_za",           label: "Titul za menom",           group: "subjekt" },
  { key: "datum_narodenia",    label: "Dátum narodenia",          group: "subjekt" },
  { key: "rodne_cislo",        label: "Rodné číslo",              group: "subjekt" },
  { key: "cislo_op",           label: "Číslo OP",                 group: "subjekt" },
  { key: "telefon",            label: "Telefón",                  group: "subjekt" },
  { key: "email",              label: "E-mail",                   group: "subjekt" },
  { key: "ulica",              label: "Ulica a číslo",            group: "subjekt" },
  { key: "psc",                label: "PSČ",                      group: "subjekt" },
  { key: "mesto",              label: "Mesto",                    group: "subjekt" },
  { key: "stat",               label: "Štát",                     group: "subjekt" },
  { key: "iban",               label: "IBAN",                     group: "subjekt" },
  { key: "swift",              label: "SWIFT / BIC",              group: "subjekt" },
  { key: "gdpr_suhlas",        label: "GDPR súhlas",              group: "subjekt" },
  // === Zmluva ===
  { key: "cislo_zmluvy",       label: "Číslo zmluvy",             group: "zmluva" },
  { key: "datum_podpisu",      label: "Dátum podpisu",            group: "zmluva" },
  { key: "datum_ucinnosti",    label: "Dátum účinnosti",          group: "zmluva" },
  { key: "datum_exspiracie",   label: "Dátum exspirácie",         group: "zmluva" },
  { key: "poistna_suma",       label: "Poistná suma",             group: "zmluva" },
  { key: "poistne_lehotne",    label: "Lehotné poistné",          group: "zmluva" },
  { key: "poistne_rocne",      label: "Ročné poistné",            group: "zmluva" },
  { key: "produkt",            label: "Produkt",                  group: "zmluva" },
  { key: "partner",            label: "Partner",                  group: "zmluva" },
];
