import { useState, useRef, useCallback, useEffect, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatDateTimeSlovak } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useTableSort } from "@/hooks/use-table-sort";
import { useSmartFilter } from "@/hooks/use-smart-filter";
import type { SmartColumnDef } from "@/hooks/use-smart-filter";
import { SmartFilterBar } from "@/components/smart-filter-bar";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { ColumnManager } from "@/components/column-manager";
import { Plus, Pencil, Trash2, Clock, Upload, Image, Globe, ChevronDown, ChevronRight, Download, Search, CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";
import { AddStateButton } from "@/components/AddStateButton";

interface WC { name: string; iso: string; dial: string; currency: string; continent: string; }
const WORLD_COUNTRIES: WC[] = [
  // Europa
  { name: "Albánsko", iso: "al", dial: "355", currency: "ALL", continent: "Europa" },
  { name: "Andorra", iso: "ad", dial: "376", currency: "EUR", continent: "Europa" },
  { name: "Rakúsko", iso: "at", dial: "43", currency: "EUR", continent: "Europa" },
  { name: "Bielorusko", iso: "by", dial: "375", currency: "BYN", continent: "Europa" },
  { name: "Belgicko", iso: "be", dial: "32", currency: "EUR", continent: "Europa" },
  { name: "Bosna a Hercegovina", iso: "ba", dial: "387", currency: "BAM", continent: "Europa" },
  { name: "Bulharsko", iso: "bg", dial: "359", currency: "BGN", continent: "Europa" },
  { name: "Chorvátsko", iso: "hr", dial: "385", currency: "EUR", continent: "Europa" },
  { name: "Cyprus", iso: "cy", dial: "357", currency: "EUR", continent: "Europa" },
  { name: "Česká republika", iso: "cz", dial: "420", currency: "CZK", continent: "Europa" },
  { name: "Dánsko", iso: "dk", dial: "45", currency: "DKK", continent: "Europa" },
  { name: "Estónsko", iso: "ee", dial: "372", currency: "EUR", continent: "Europa" },
  { name: "Fínsko", iso: "fi", dial: "358", currency: "EUR", continent: "Europa" },
  { name: "Francúzsko", iso: "fr", dial: "33", currency: "EUR", continent: "Europa" },
  { name: "Nemecko", iso: "de", dial: "49", currency: "EUR", continent: "Europa" },
  { name: "Grécko", iso: "gr", dial: "30", currency: "EUR", continent: "Europa" },
  { name: "Maďarsko", iso: "hu", dial: "36", currency: "HUF", continent: "Europa" },
  { name: "Island", iso: "is", dial: "354", currency: "ISK", continent: "Europa" },
  { name: "Írsko", iso: "ie", dial: "353", currency: "EUR", continent: "Europa" },
  { name: "Taliansko", iso: "it", dial: "39", currency: "EUR", continent: "Europa" },
  { name: "Kosovo", iso: "xk", dial: "383", currency: "EUR", continent: "Europa" },
  { name: "Lotyšsko", iso: "lv", dial: "371", currency: "EUR", continent: "Europa" },
  { name: "Lichtenštajnsko", iso: "li", dial: "423", currency: "CHF", continent: "Europa" },
  { name: "Litva", iso: "lt", dial: "370", currency: "EUR", continent: "Europa" },
  { name: "Luxembursko", iso: "lu", dial: "352", currency: "EUR", continent: "Europa" },
  { name: "Malta", iso: "mt", dial: "356", currency: "EUR", continent: "Europa" },
  { name: "Moldavsko", iso: "md", dial: "373", currency: "MDL", continent: "Europa" },
  { name: "Monako", iso: "mc", dial: "377", currency: "EUR", continent: "Europa" },
  { name: "Čierna Hora", iso: "me", dial: "382", currency: "EUR", continent: "Europa" },
  { name: "Holandsko", iso: "nl", dial: "31", currency: "EUR", continent: "Europa" },
  { name: "Severné Macedónsko", iso: "mk", dial: "389", currency: "MKD", continent: "Europa" },
  { name: "Nórsko", iso: "no", dial: "47", currency: "NOK", continent: "Europa" },
  { name: "Poľsko", iso: "pl", dial: "48", currency: "PLN", continent: "Europa" },
  { name: "Portugalsko", iso: "pt", dial: "351", currency: "EUR", continent: "Europa" },
  { name: "Rumunsko", iso: "ro", dial: "40", currency: "RON", continent: "Europa" },
  { name: "Rusko", iso: "ru", dial: "7", currency: "RUB", continent: "Europa" },
  { name: "San Maríno", iso: "sm", dial: "378", currency: "EUR", continent: "Europa" },
  { name: "Srbsko", iso: "rs", dial: "381", currency: "RSD", continent: "Europa" },
  { name: "Slovensko", iso: "sk", dial: "421", currency: "EUR", continent: "Europa" },
  { name: "Slovinsko", iso: "si", dial: "386", currency: "EUR", continent: "Europa" },
  { name: "Španielsko", iso: "es", dial: "34", currency: "EUR", continent: "Europa" },
  { name: "Švédsko", iso: "se", dial: "46", currency: "SEK", continent: "Europa" },
  { name: "Švajčiarsko", iso: "ch", dial: "41", currency: "CHF", continent: "Europa" },
  { name: "Ukrajina", iso: "ua", dial: "380", currency: "UAH", continent: "Europa" },
  { name: "Spojené kráľovstvo", iso: "gb", dial: "44", currency: "GBP", continent: "Europa" },
  { name: "Vatikán", iso: "va", dial: "379", currency: "EUR", continent: "Europa" },
  // Severná Amerika
  { name: "Antigua a Barbuda", iso: "ag", dial: "1268", currency: "XCD", continent: "Severná Amerika" },
  { name: "Bahamy", iso: "bs", dial: "1242", currency: "BSD", continent: "Severná Amerika" },
  { name: "Barbados", iso: "bb", dial: "1246", currency: "BBD", continent: "Severná Amerika" },
  { name: "Belize", iso: "bz", dial: "501", currency: "BZD", continent: "Severná Amerika" },
  { name: "Kanada", iso: "ca", dial: "1", currency: "CAD", continent: "Severná Amerika" },
  { name: "Kostarika", iso: "cr", dial: "506", currency: "CRC", continent: "Severná Amerika" },
  { name: "Kuba", iso: "cu", dial: "53", currency: "CUP", continent: "Severná Amerika" },
  { name: "Dominika", iso: "dm", dial: "1767", currency: "XCD", continent: "Severná Amerika" },
  { name: "Dominikánska republika", iso: "do", dial: "1809", currency: "DOP", continent: "Severná Amerika" },
  { name: "Salvádor", iso: "sv", dial: "503", currency: "USD", continent: "Severná Amerika" },
  { name: "Grenada", iso: "gd", dial: "1473", currency: "XCD", continent: "Severná Amerika" },
  { name: "Guatemala", iso: "gt", dial: "502", currency: "GTQ", continent: "Severná Amerika" },
  { name: "Haiti", iso: "ht", dial: "509", currency: "HTG", continent: "Severná Amerika" },
  { name: "Honduras", iso: "hn", dial: "504", currency: "HNL", continent: "Severná Amerika" },
  { name: "Jamajka", iso: "jm", dial: "1876", currency: "JMD", continent: "Severná Amerika" },
  { name: "Mexiko", iso: "mx", dial: "52", currency: "MXN", continent: "Severná Amerika" },
  { name: "Nikaragua", iso: "ni", dial: "505", currency: "NIO", continent: "Severná Amerika" },
  { name: "Panama", iso: "pa", dial: "507", currency: "PAB", continent: "Severná Amerika" },
  { name: "Svätý Krištof a Nevis", iso: "kn", dial: "1869", currency: "XCD", continent: "Severná Amerika" },
  { name: "Svätá Lucia", iso: "lc", dial: "1758", currency: "XCD", continent: "Severná Amerika" },
  { name: "Svätý Vincent a Grenadíny", iso: "vc", dial: "1784", currency: "XCD", continent: "Severná Amerika" },
  { name: "Trinidad a Tobago", iso: "tt", dial: "1868", currency: "TTD", continent: "Severná Amerika" },
  { name: "USA", iso: "us", dial: "1", currency: "USD", continent: "Severná Amerika" },
  // Južná Amerika
  { name: "Argentína", iso: "ar", dial: "54", currency: "ARS", continent: "Južná Amerika" },
  { name: "Bolívia", iso: "bo", dial: "591", currency: "BOB", continent: "Južná Amerika" },
  { name: "Brazília", iso: "br", dial: "55", currency: "BRL", continent: "Južná Amerika" },
  { name: "Čile", iso: "cl", dial: "56", currency: "CLP", continent: "Južná Amerika" },
  { name: "Kolumbia", iso: "co", dial: "57", currency: "COP", continent: "Južná Amerika" },
  { name: "Ekvádor", iso: "ec", dial: "593", currency: "USD", continent: "Južná Amerika" },
  { name: "Guyana", iso: "gy", dial: "592", currency: "GYD", continent: "Južná Amerika" },
  { name: "Paraguaj", iso: "py", dial: "595", currency: "PYG", continent: "Južná Amerika" },
  { name: "Peru", iso: "pe", dial: "51", currency: "PEN", continent: "Južná Amerika" },
  { name: "Surinam", iso: "sr", dial: "597", currency: "SRD", continent: "Južná Amerika" },
  { name: "Uruguaj", iso: "uy", dial: "598", currency: "UYU", continent: "Južná Amerika" },
  { name: "Venezuela", iso: "ve", dial: "58", currency: "VES", continent: "Južná Amerika" },
  // Ázia
  { name: "Afganistan", iso: "af", dial: "93", currency: "AFN", continent: "Ázia" },
  { name: "Arménsko", iso: "am", dial: "374", currency: "AMD", continent: "Ázia" },
  { name: "Azerbajdžan", iso: "az", dial: "994", currency: "AZN", continent: "Ázia" },
  { name: "Bahrajn", iso: "bh", dial: "973", currency: "BHD", continent: "Ázia" },
  { name: "Bangladéš", iso: "bd", dial: "880", currency: "BDT", continent: "Ázia" },
  { name: "Bhután", iso: "bt", dial: "975", currency: "BTN", continent: "Ázia" },
  { name: "Brunej", iso: "bn", dial: "673", currency: "BND", continent: "Ázia" },
  { name: "Kambodža", iso: "kh", dial: "855", currency: "KHR", continent: "Ázia" },
  { name: "Čína", iso: "cn", dial: "86", currency: "CNY", continent: "Ázia" },
  { name: "Gruzínsko", iso: "ge", dial: "995", currency: "GEL", continent: "Ázia" },
  { name: "Hongkong", iso: "hk", dial: "852", currency: "HKD", continent: "Ázia" },
  { name: "India", iso: "in", dial: "91", currency: "INR", continent: "Ázia" },
  { name: "Indonézia", iso: "id", dial: "62", currency: "IDR", continent: "Ázia" },
  { name: "Irán", iso: "ir", dial: "98", currency: "IRR", continent: "Ázia" },
  { name: "Irak", iso: "iq", dial: "964", currency: "IQD", continent: "Ázia" },
  { name: "Izrael", iso: "il", dial: "972", currency: "ILS", continent: "Ázia" },
  { name: "Japonsko", iso: "jp", dial: "81", currency: "JPY", continent: "Ázia" },
  { name: "Jordánsko", iso: "jo", dial: "962", currency: "JOD", continent: "Ázia" },
  { name: "Kazachstan", iso: "kz", dial: "7", currency: "KZT", continent: "Ázia" },
  { name: "Kuvajt", iso: "kw", dial: "965", currency: "KWD", continent: "Ázia" },
  { name: "Kirgizsko", iso: "kg", dial: "996", currency: "KGS", continent: "Ázia" },
  { name: "Laos", iso: "la", dial: "856", currency: "LAK", continent: "Ázia" },
  { name: "Libanon", iso: "lb", dial: "961", currency: "LBP", continent: "Ázia" },
  { name: "Malajzia", iso: "my", dial: "60", currency: "MYR", continent: "Ázia" },
  { name: "Maldivy", iso: "mv", dial: "960", currency: "MVR", continent: "Ázia" },
  { name: "Mongolsko", iso: "mn", dial: "976", currency: "MNT", continent: "Ázia" },
  { name: "Mjanmarsko", iso: "mm", dial: "95", currency: "MMK", continent: "Ázia" },
  { name: "Nepál", iso: "np", dial: "977", currency: "NPR", continent: "Ázia" },
  { name: "Severná Kórea", iso: "kp", dial: "850", currency: "KPW", continent: "Ázia" },
  { name: "Omán", iso: "om", dial: "968", currency: "OMR", continent: "Ázia" },
  { name: "Pakistan", iso: "pk", dial: "92", currency: "PKR", continent: "Ázia" },
  { name: "Palestína", iso: "ps", dial: "970", currency: "ILS", continent: "Ázia" },
  { name: "Filipíny", iso: "ph", dial: "63", currency: "PHP", continent: "Ázia" },
  { name: "Katar", iso: "qa", dial: "974", currency: "QAR", continent: "Ázia" },
  { name: "Saudská Arábia", iso: "sa", dial: "966", currency: "SAR", continent: "Ázia" },
  { name: "Singapur", iso: "sg", dial: "65", currency: "SGD", continent: "Ázia" },
  { name: "Južná Kórea", iso: "kr", dial: "82", currency: "KRW", continent: "Ázia" },
  { name: "Srí Lanka", iso: "lk", dial: "94", currency: "LKR", continent: "Ázia" },
  { name: "Sýria", iso: "sy", dial: "963", currency: "SYP", continent: "Ázia" },
  { name: "Taiwan", iso: "tw", dial: "886", currency: "TWD", continent: "Ázia" },
  { name: "Tadžikistan", iso: "tj", dial: "992", currency: "TJS", continent: "Ázia" },
  { name: "Thajsko", iso: "th", dial: "66", currency: "THB", continent: "Ázia" },
  { name: "Východný Timor", iso: "tl", dial: "670", currency: "USD", continent: "Ázia" },
  { name: "Turecko", iso: "tr", dial: "90", currency: "TRY", continent: "Ázia" },
  { name: "Turkménsko", iso: "tm", dial: "993", currency: "TMT", continent: "Ázia" },
  { name: "Spojené arabské emiráty", iso: "ae", dial: "971", currency: "AED", continent: "Ázia" },
  { name: "Uzbekistan", iso: "uz", dial: "998", currency: "UZS", continent: "Ázia" },
  { name: "Vietnam", iso: "vn", dial: "84", currency: "VND", continent: "Ázia" },
  { name: "Jemen", iso: "ye", dial: "967", currency: "YER", continent: "Ázia" },
  // Afrika
  { name: "Alžírsko", iso: "dz", dial: "213", currency: "DZD", continent: "Afrika" },
  { name: "Angola", iso: "ao", dial: "244", currency: "AOA", continent: "Afrika" },
  { name: "Benin", iso: "bj", dial: "229", currency: "XOF", continent: "Afrika" },
  { name: "Botswana", iso: "bw", dial: "267", currency: "BWP", continent: "Afrika" },
  { name: "Burkina Faso", iso: "bf", dial: "226", currency: "XOF", continent: "Afrika" },
  { name: "Burundi", iso: "bi", dial: "257", currency: "BIF", continent: "Afrika" },
  { name: "Kamerun", iso: "cm", dial: "237", currency: "XAF", continent: "Afrika" },
  { name: "Kapverdy", iso: "cv", dial: "238", currency: "CVE", continent: "Afrika" },
  { name: "Stredoafrická republika", iso: "cf", dial: "236", currency: "XAF", continent: "Afrika" },
  { name: "Čad", iso: "td", dial: "235", currency: "XAF", continent: "Afrika" },
  { name: "Komory", iso: "km", dial: "269", currency: "KMF", continent: "Afrika" },
  { name: "Kongo", iso: "cg", dial: "242", currency: "XAF", continent: "Afrika" },
  { name: "Kongo (DR)", iso: "cd", dial: "243", currency: "CDF", continent: "Afrika" },
  { name: "Džibutsko", iso: "dj", dial: "253", currency: "DJF", continent: "Afrika" },
  { name: "Egypt", iso: "eg", dial: "20", currency: "EGP", continent: "Afrika" },
  { name: "Rovníková Guinea", iso: "gq", dial: "240", currency: "XAF", continent: "Afrika" },
  { name: "Eritrea", iso: "er", dial: "291", currency: "ERN", continent: "Afrika" },
  { name: "Eswatini", iso: "sz", dial: "268", currency: "SZL", continent: "Afrika" },
  { name: "Etiopia", iso: "et", dial: "251", currency: "ETB", continent: "Afrika" },
  { name: "Gabon", iso: "ga", dial: "241", currency: "XAF", continent: "Afrika" },
  { name: "Gambia", iso: "gm", dial: "220", currency: "GMD", continent: "Afrika" },
  { name: "Ghana", iso: "gh", dial: "233", currency: "GHS", continent: "Afrika" },
  { name: "Guinea", iso: "gn", dial: "224", currency: "GNF", continent: "Afrika" },
  { name: "Guinea-Bissau", iso: "gw", dial: "245", currency: "XOF", continent: "Afrika" },
  { name: "Pobrežie Slonoviny", iso: "ci", dial: "225", currency: "XOF", continent: "Afrika" },
  { name: "Keňa", iso: "ke", dial: "254", currency: "KES", continent: "Afrika" },
  { name: "Lesotho", iso: "ls", dial: "266", currency: "LSL", continent: "Afrika" },
  { name: "Libéria", iso: "lr", dial: "231", currency: "LRD", continent: "Afrika" },
  { name: "Líbya", iso: "ly", dial: "218", currency: "LYD", continent: "Afrika" },
  { name: "Madagaskar", iso: "mg", dial: "261", currency: "MGA", continent: "Afrika" },
  { name: "Malawi", iso: "mw", dial: "265", currency: "MWK", continent: "Afrika" },
  { name: "Mali", iso: "ml", dial: "223", currency: "XOF", continent: "Afrika" },
  { name: "Mauritánia", iso: "mr", dial: "222", currency: "MRU", continent: "Afrika" },
  { name: "Maurícius", iso: "mu", dial: "230", currency: "MUR", continent: "Afrika" },
  { name: "Maroko", iso: "ma", dial: "212", currency: "MAD", continent: "Afrika" },
  { name: "Mozambik", iso: "mz", dial: "258", currency: "MZN", continent: "Afrika" },
  { name: "Namíbia", iso: "na", dial: "264", currency: "NAD", continent: "Afrika" },
  { name: "Niger", iso: "ne", dial: "227", currency: "XOF", continent: "Afrika" },
  { name: "Nigéria", iso: "ng", dial: "234", currency: "NGN", continent: "Afrika" },
  { name: "Rwanda", iso: "rw", dial: "250", currency: "RWF", continent: "Afrika" },
  { name: "Svätý Tomáš a Princov ostrov", iso: "st", dial: "239", currency: "STN", continent: "Afrika" },
  { name: "Senegal", iso: "sn", dial: "221", currency: "XOF", continent: "Afrika" },
  { name: "Seychely", iso: "sc", dial: "248", currency: "SCR", continent: "Afrika" },
  { name: "Sierra Leone", iso: "sl", dial: "232", currency: "SLL", continent: "Afrika" },
  { name: "Somálsko", iso: "so", dial: "252", currency: "SOS", continent: "Afrika" },
  { name: "Južná Afrika", iso: "za", dial: "27", currency: "ZAR", continent: "Afrika" },
  { name: "Južný Sudán", iso: "ss", dial: "211", currency: "SSP", continent: "Afrika" },
  { name: "Sudán", iso: "sd", dial: "249", currency: "SDG", continent: "Afrika" },
  { name: "Tanzánia", iso: "tz", dial: "255", currency: "TZS", continent: "Afrika" },
  { name: "Togo", iso: "tg", dial: "228", currency: "XOF", continent: "Afrika" },
  { name: "Tunisko", iso: "tn", dial: "216", currency: "TND", continent: "Afrika" },
  { name: "Uganda", iso: "ug", dial: "256", currency: "UGX", continent: "Afrika" },
  { name: "Zambia", iso: "zm", dial: "260", currency: "ZMW", continent: "Afrika" },
  { name: "Zimbabwe", iso: "zw", dial: "263", currency: "ZWL", continent: "Afrika" },
  // Oceánia
  { name: "Austrália", iso: "au", dial: "61", currency: "AUD", continent: "Oceánia" },
  { name: "Fidži", iso: "fj", dial: "679", currency: "FJD", continent: "Oceánia" },
  { name: "Kiribati", iso: "ki", dial: "686", currency: "AUD", continent: "Oceánia" },
  { name: "Marshallove ostrovy", iso: "mh", dial: "692", currency: "USD", continent: "Oceánia" },
  { name: "Mikronézia", iso: "fm", dial: "691", currency: "USD", continent: "Oceánia" },
  { name: "Nauru", iso: "nr", dial: "674", currency: "AUD", continent: "Oceánia" },
  { name: "Nový Zéland", iso: "nz", dial: "64", currency: "NZD", continent: "Oceánia" },
  { name: "Palau", iso: "pw", dial: "680", currency: "USD", continent: "Oceánia" },
  { name: "Papua Nová Guinea", iso: "pg", dial: "675", currency: "PGK", continent: "Oceánia" },
  { name: "Samoa", iso: "ws", dial: "685", currency: "WST", continent: "Oceánia" },
  { name: "Šalamúnove ostrovy", iso: "sb", dial: "677", currency: "SBD", continent: "Oceánia" },
  { name: "Tonga", iso: "to", dial: "676", currency: "TOP", continent: "Oceánia" },
  { name: "Tuvalu", iso: "tv", dial: "688", currency: "AUD", continent: "Oceánia" },
  { name: "Vanuatu", iso: "vu", dial: "678", currency: "VUV", continent: "Oceánia" },
];
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { State, StateFlagHistory } from "@shared/schema";

const STATE_COLUMNS: ColumnDef[] = [
  { key: "id", label: "ID" },
  { key: "name", label: "Nazov" },
  { key: "code", label: "Skratka" },
  { key: "currency", label: "Mena" },
  { key: "continentId", label: "Kontinent" },
  { key: "flagUrl", label: "Vlajka" },
];

const STATE_FILTER_COLUMNS: SmartColumnDef[] = [
  { key: "id", label: "ID", type: "number" },
  { key: "name", label: "Nazov", type: "text" },
  { key: "code", label: "Skratka", type: "text" },
  { key: "continentId", label: "Kontinent", type: "number" },
];

function FlagImage({
  src,
  alt,
  code,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  code?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-muted border border-border ${className || "w-6 h-6"}`}
        title={alt}
        data-testid={`flag-fallback-${code || "unknown"}`}
      >
        <span className="text-[10px] font-bold text-muted-foreground uppercase">{code || "?"}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className || "h-6 object-contain"}
      onError={() => setFailed(true)}
    />
  );
}

function CountryPickerDialog({
  open,
  onOpenChange,
  continents,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  continents: { id: number; name: string; code: string }[];
  onSelect: (c: WC, continentId: number) => void;
}) {
  const [pickerContinent, setPickerContinent] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) { setPickerContinent("all"); setSearch(""); }
  }, [open]);

  const filtered = WORLD_COUNTRIES.filter(c => {
    const matchContinent = pickerContinent === "all" || c.continent === pickerContinent;
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase());
    return matchContinent && matchSearch;
  }).sort((a, b) => a.name.localeCompare(b.name, "sk"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <div className="flex flex-col gap-3 h-full">
          {/* Header — custom, non-sticky, no clipping */}
          <div className="shrink-0 flex items-center gap-2 pt-2 pb-3 border-b border-border/60 -mx-6 px-6">
            <Globe className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-base font-semibold">Vybrať krajinu</span>
          </div>
          {/* Filters */}
          <div className="flex gap-2 shrink-0">
            <Select value={pickerContinent} onValueChange={setPickerContinent}>
              <SelectTrigger className="w-48 shrink-0" data-testid="select-picker-continent">
                <SelectValue placeholder="Všetky kontinenty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všetky kontinenty</SelectItem>
                {continents.map(c => (
                  <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Hľadať krajinu…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                data-testid="input-picker-search"
              />
              {search && (
                <button type="button" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearch("")}>
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          {/* Country list — fills remaining dialog height */}
          <div className="flex-1 min-h-0 border border-border rounded-md overflow-y-auto">
            {filtered.length === 0 && pickerContinent === "Antarktída" ? (
              <div className="h-full flex flex-col p-5 gap-5 overflow-y-auto">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">🧊</span>
                  <div>
                    <p className="text-base font-semibold text-foreground">Antarktída</p>
                    <p className="text-xs text-muted-foreground">Neutrálne medzinárodné územie — žiadne suverénne štáty</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {[
                    { label: "Rozloha", value: "14 000 000 km²", icon: "🗺️" },
                    { label: "Stála populácia", value: "0 obyvateľov", icon: "👤" },
                    { label: "Leto (výskumníci)", value: "≈ 5 000 osôb", icon: "☀️" },
                    { label: "Zima (výskumníci)", value: "≈ 1 000 osôb", icon: "❄️" },
                    { label: "Vedecké stanice", value: "≈ 70 staníc", icon: "🔬" },
                    { label: "Krajiny so stanicami", value: "30 krajín", icon: "🌍" },
                    { label: "Najvyšší bod", value: "Vinson Massif 4 892 m", icon: "⛰️" },
                    { label: "Najnižšia teplota", value: "−89,2 °C (1983)", icon: "🌡️" },
                    { label: "Antarktická zmluva", value: "1. dec. 1959", icon: "📜" },
                  ].map(({ label, value, icon }) => (
                    <div key={label} className="flex flex-col gap-0.5 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><span>{icon}</span>{label}</span>
                      <span className="text-sm font-semibold text-foreground">{value}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground text-sm">Prečo tu nie sú žiadne štáty?</p>
                  <p>Antarktída je jedinou obývanou oblasťou sveta bez suverénnej vlády. Spravuje ju <strong className="text-foreground">Antarktická zmluva</strong> podpísaná 1. decembra 1959 v Meste Washington (vstúpila do platnosti 23. júna 1961), ku ktorej pristúpilo celkovo <strong className="text-foreground">54 štátov</strong>.</p>
                  <p>Zmluva na dobu neurčitú zakazuje:</p>
                  <ul className="list-none space-y-1 pl-2">
                    {["Vojenské aktivity, zbrane a jadrové skúšky", "Ťažbu nerastných surovín a neobnoviteľných zdrojov", "Zakladanie stálych civilných osídlení so štatútom štátu", "Územné nároky nových krajín (platné nároky 7 krajín sú zmrazené)"].map(item => (
                      <li key={item} className="flex items-start gap-2"><span className="text-amber-400 mt-0.5 shrink-0">▸</span><span>{item}</span></li>
                    ))}
                  </ul>
                  <p>Sedem krajín (Argentína, Austrália, Čile, Francúzsko, Nórsko, Nový Zéland, Veľká Británia) má historické územné nároky, ktoré zmluva <em>zmrazila</em> — ani ich neruší, ani neuznáva.</p>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Žiadna krajina nenájdená</div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map(c => {
                  const cid = continents.find(cont => cont.name === c.continent)?.id ?? 1;
                  return (
                    <button
                      key={`${c.iso}-${c.dial}`}
                      type="button"
                      className="flex items-center gap-3 w-full px-3 py-2 hover:bg-muted/50 transition-colors text-left"
                      data-testid={`picker-country-${c.iso}`}
                      onClick={() => { onSelect(c, cid); onOpenChange(false); }}
                    >
                      <img
                        src={`https://flagcdn.com/w20/${c.iso}.png`}
                        alt={c.name}
                        className="w-6 h-4 object-cover rounded-sm shrink-0 border border-border/40"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                      <span className="flex-1 text-sm font-medium">{c.name}</span>
                      <span className="text-xs text-muted-foreground font-mono shrink-0">+{c.dial}</span>
                      <span className="text-xs text-muted-foreground shrink-0 w-10 text-right">{c.currency}</span>
                      <span className="text-xs text-muted-foreground shrink-0 w-28 text-right hidden sm:block">{c.continent}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="text-xs text-muted-foreground text-right shrink-0">{filtered.length} krajín</div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StateFormDialog({
  open,
  onOpenChange,
  editingState,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingState: State | null;
}) {
  const { toast } = useToast();
  const timerRef = useRef<number>(0);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [continentId, setContinentId] = useState("1");
  const [flagUrl, setFlagUrl] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: continents } = useQuery<{ id: number; name: string; code: string }[]>({
    queryKey: ["/api/hierarchy/continents"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/hierarchy/states", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hierarchy/states"] });
      toast({ title: "Úspech", description: "Štát vytvorený" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vytvoriť štát", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/states/${editingState?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hierarchy/states"] });
      toast({ title: "Úspech", description: "Štát aktualizovaný" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa aktualizovať štát", variant: "destructive" }),
  });

  useEffect(() => {
    if (open) {
      timerRef.current = performance.now();
      if (editingState) {
        setName(editingState.name);
        setCode(editingState.code);
        setCurrency((editingState as any).currency || "EUR");
        setContinentId(editingState.continentId.toString());
        setFlagUrl(editingState.flagUrl ?? null);
      } else {
        setName(""); setCode(""); setCurrency("EUR"); setContinentId("1"); setFlagUrl(null);
      }
    }
  }, [open, editingState]);

  function handleCountrySelect(c: WC, cid: number) {
    setName(c.name);
    setCode(c.dial);
    setCurrency(c.currency);
    setContinentId(cid.toString());
    setFlagUrl(`https://flagcdn.com/w40/${c.iso}.png`);
  }

  function handleSubmit() {
    if (!name || !code) {
      toast({ title: "Chyba", description: "Názov a kód sú povinné", variant: "destructive" });
      return;
    }
    const processingTimeSec = Math.round((performance.now() - timerRef.current) / 1000);
    const payload = { name, code, currency, continentId: parseInt(continentId), flagUrl, processingTimeSec };

    if (editingState) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <CountryPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        continents={continents ?? []}
        onSelect={handleCountrySelect}
      />
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle data-testid="text-state-dialog-title">
              {editingState ? "Upraviť štát" : "Pridať štát"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Kontinent — prvý parameter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Kontinent</label>
              <Select value={continentId} onValueChange={setContinentId}>
                <SelectTrigger data-testid="select-state-continent">
                  <SelectValue placeholder="Vyberte kontinent" />
                </SelectTrigger>
                <SelectContent>
                  {continents?.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Názov so search buttonom */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Názov štátu</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  {flagUrl && (
                    <img
                      src={flagUrl}
                      alt={name}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-6 h-4 object-cover rounded-sm border border-border/40"
                    />
                  )}
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="napr. Slovensko"
                    data-testid="input-state-name"
                    className={flagUrl ? "pl-11" : ""}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  title="Vyhľadať krajinu"
                  data-testid="button-open-country-picker"
                  onClick={() => setPickerOpen(true)}
                >
                  <Globe className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Kliknite na <Globe className="w-3 h-3 inline" /> pre výber zo zoznamu všetkých krajín sveta</p>
            </div>

            {/* Kód (telefónna predvoľba) */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Telefónna predvoľba (kód)</label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="napr. 421"
                data-testid="input-state-code"
              />
            </div>

            {/* Mena */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Mena</label>
              <Input
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                placeholder="napr. EUR"
                maxLength={3}
                data-testid="input-state-currency"
              />
            </div>

            {/* Vlajka preview */}
            {flagUrl && (
              <div className="flex items-center gap-3 p-2 rounded-md border border-border bg-muted/20">
                <img src={flagUrl} alt={name} className="w-10 h-7 object-cover rounded border border-border/50" />
                <div className="text-sm">
                  <p className="font-medium">{name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{flagUrl}</p>
                </div>
                <Button type="button" variant="ghost" size="icon" className="ml-auto h-7 w-7" onClick={() => setFlagUrl(null)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-state">
                Zrušiť
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isPending}
                data-testid="button-save-processing"
              >
                {isPending ? "Ukladá sa…" : "Uložiť"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

type WikiFlag = { title: string; thumbUrl: string; descriptionUrl: string };

async function searchWikipediaFlag(countryName: string): Promise<WikiFlag | null> {
  // 1. Primárne: sk.wikipedia.org — hľadáme článok "Vlajka [krajina]"
  try {
    const skSearchUrl = `https://sk.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent("Vlajka " + countryName)}&srnamespace=0&srlimit=6&format=json&origin=*`;
    const skSearchRes = await fetch(skSearchUrl);
    const skSearchData = await skSearchRes.json();
    const skResults: Array<{ title: string }> = skSearchData?.query?.search || [];
    const skBest = skResults.find(r => /vlajka/i.test(r.title)) || skResults[0];

    if (skBest) {
      const skImgUrl = `https://sk.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(skBest.title)}&prop=pageimages&pithumbsize=640&pilicense=any&format=json&origin=*`;
      const skImgRes = await fetch(skImgUrl);
      const skImgData = await skImgRes.json();
      const skPages = skImgData?.query?.pages || {};
      const skPage = Object.values(skPages)[0] as any;
      const thumbUrl: string | undefined = skPage?.thumbnail?.source;
      if (thumbUrl) {
        return {
          title: skBest.title,
          thumbUrl,
          descriptionUrl: `https://sk.wikipedia.org/wiki/${encodeURIComponent(skBest.title)}`,
        };
      }
    }
  } catch {}

  // 2. Záloha: Wikimedia Commons — "Flag of [krajina]"
  try {
    const query = `Flag of ${countryName}`;
    const searchUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=6&srlimit=8&format=json&origin=*`;
    const searchRes = await fetch(searchUrl);
    const searchData = await searchRes.json();
    const results: Array<{ title: string }> = searchData?.query?.search || [];
    const flagResult = results.find(r => /flag/i.test(r.title) && !/historical|naval|state|civil|war|variant|coat|arm/i.test(r.title)) || results[0];
    if (!flagResult) return null;

    const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(flagResult.title)}&prop=imageinfo&iiprop=url|descriptionurl&iiurlwidth=640&format=json&origin=*`;
    const infoRes = await fetch(infoUrl);
    const infoData = await infoRes.json();
    const pages = infoData?.query?.pages || {};
    const page = Object.values(pages)[0] as any;
    const info = page?.imageinfo?.[0];
    if (!info?.thumburl) return null;
    return { title: flagResult.title, thumbUrl: info.thumburl, descriptionUrl: info.descriptionurl || "" };
  } catch {}

  return null;
}

function FlagUploadDialog({
  open,
  onOpenChange,
  state,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: State | null;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [wikiSearching, setWikiSearching] = useState(false);
  const [wikiFlag, setWikiFlag] = useState<WikiFlag | null>(null);
  const [wikiError, setWikiError] = useState<string | null>(null);
  const [wikiDownloading, setWikiDownloading] = useState(false);

  useEffect(() => {
    if (!open) {
      setWikiFlag(null);
      setWikiError(null);
      setWikiSearching(false);
      setWikiDownloading(false);
    } else if (open && state && !state.flagUrl) {
      setWikiSearching(true);
      setWikiFlag(null);
      setWikiError(null);
      searchWikipediaFlag(state.name).then(result => {
        if (result) {
          setWikiFlag(result);
        } else {
          setWikiError("Vlajka nenájdená na Wikimedia Commons");
        }
      }).catch(() => {
        setWikiError("Chyba pri vyhľadávaní na Wikimedia");
      }).finally(() => {
        setWikiSearching(false);
      });
    }
  }, [open, state]);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploading(true);
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/states/${state?.id}/flag`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hierarchy/states"] });
      toast({ title: "Uspech", description: "Vlajka nahrana" });
      setUploading(false);
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa nahrat vlajku", variant: "destructive" });
      setUploading(false);
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
  }

  async function handleWikiSearch() {
    if (!state) return;
    setWikiSearching(true);
    setWikiFlag(null);
    setWikiError(null);
    try {
      const result = await searchWikipediaFlag(state.name);
      if (result) {
        setWikiFlag(result);
      } else {
        setWikiError("Vlajka nenájdená na Wikimedia Commons");
      }
    } catch {
      setWikiError("Chyba pri vyhľadávaní na Wikimedia");
    } finally {
      setWikiSearching(false);
    }
  }

  async function handleWikiDownload() {
    if (!state || !wikiFlag) return;
    setWikiDownloading(true);
    try {
      const imgRes = await fetch(wikiFlag.thumbUrl);
      if (!imgRes.ok) throw new Error("Nepodarilo sa stiahnuť obrázok z Wikimedia");
      const blob = await imgRes.blob();
      const mimeToExt: Record<string, string> = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
        "image/gif": "gif",
        "image/bmp": "bmp",
      };
      const actualMime = blob.type || "image/png";
      const ext = mimeToExt[actualMime] || "png";
      const file = new File([blob], `wiki-flag.${ext}`, { type: actualMime });
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch(`/api/states/${state.id}/flag`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!uploadRes.ok) {
        const body = await uploadRes.json().catch(() => ({}));
        throw new Error(body?.message || "Upload zlyhal");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/hierarchy/states"] });
      toast({ title: "Úspech", description: "Vlajka stiahnutá z Wikipedie" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Chyba", description: err?.message || "Nepodarilo sa stiahnuť vlajku", variant: "destructive" });
    } finally {
      setWikiDownloading(false);
    }
  }

  if (!state) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle data-testid="text-flag-upload-title">Vlajka — {state.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Aktuálna vlajka</label>
            <div className="flex items-center justify-center p-4 border rounded-md bg-muted/20">
              <FlagImage src={state.flagUrl} alt={state.name} code={state.code} className="max-h-24 object-contain" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Stiahnuť z internetu</label>
            <p className="text-xs text-muted-foreground -mt-1">Primárne sk.wikipedia.org, záloha Wikimedia Commons</p>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleWikiSearch}
              disabled={wikiSearching || wikiDownloading}
              data-testid="button-wiki-search-flag"
            >
              {wikiSearching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              {wikiSearching ? "Hľadám na sk.wikipedia.org..." : `Nájsť vlajku pre „${state.name}"`}
            </Button>

            {wikiError && (
              <div className="flex items-center gap-2 text-sm text-destructive p-2 rounded bg-destructive/10">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {wikiError}
              </div>
            )}

            {wikiFlag && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  <span className="truncate">
                    Nájdené: <span className="font-medium text-foreground">{wikiFlag.title.replace("File:", "")}</span>
                  </span>
                </div>
                {wikiFlag.descriptionUrl && (
                  <a href={wikiFlag.descriptionUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline truncate block">
                    {wikiFlag.descriptionUrl.replace("https://", "").split("/wiki/")[0]}
                  </a>
                )}
                <div className="flex items-center justify-center p-3 border rounded-md bg-muted/20">
                  <img src={wikiFlag.thumbUrl} alt="Wikipedia vlajka" className="max-h-28 object-contain" />
                </div>
                <Button
                  type="button"
                  className="w-full"
                  onClick={handleWikiDownload}
                  disabled={wikiDownloading}
                  data-testid="button-wiki-download-flag"
                >
                  {wikiDownloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                  {wikiDownloading ? "Sťahujem..." : "Uložiť túto vlajku"}
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2 border-t pt-3">
            <label className="text-sm font-semibold">Alebo nahrať vlastný súbor</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              data-testid="input-flag-file"
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || wikiDownloading}
              data-testid="button-select-flag-file"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? "Nahrávam..." : "Vybrať súbor"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FlagHistoryDialog({
  open,
  onOpenChange,
  state,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: State | null;
}) {
  const { data: history, isLoading } = useQuery<StateFlagHistory[]>({
    queryKey: ["/api/states", state?.id, "flag-history"],
    queryFn: async () => {
      if (!state) return [];
      const res = await fetch(`/api/states/${state.id}/flag-history`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: open && !!state,
  });

  if (!state) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle data-testid="text-flag-history-title">Historia vlajok statu - {state.name}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Nacitavam...</div>
        ) : !history || history.length === 0 ? (
          <div className="text-sm text-muted-foreground">Ziadna historia vlajok</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vlajka</TableHead>
                <TableHead>Nahradena</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <FlagImage src={entry.flagUrl} alt="Stara vlajka" code={state?.code} className="max-h-12 object-contain" />
                  </TableCell>
                  <TableCell>
                    {formatDateTimeSlovak(entry.replacedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function SettingsStates() {
  const { toast } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingState, setEditingState] = useState<State | null>(null);
  const [flagUploadState, setFlagUploadState] = useState<State | null>(null);
  const [flagHistoryState, setFlagHistoryState] = useState<State | null>(null);
  const [deleteState, setDeleteState] = useState<State | null>(null);
  const [expandedContinents, setExpandedContinents] = useState<Set<number>>(new Set());

  const { data: allStates, isLoading } = useQuery<State[]>({
    queryKey: ["/api/hierarchy/states"],
  });

  const { data: continents } = useQuery<{ id: number; name: string; code: string }[]>({
    queryKey: ["/api/hierarchy/continents"],
  });

  const tableFilter = useSmartFilter(allStates || [], STATE_FILTER_COLUMNS, "settings-states-filter");
  const columnVisibility = useColumnVisibility("settings-states", STATE_COLUMNS);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/states/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hierarchy/states"] });
      toast({ title: "Uspech", description: "Stat vymazany" });
      setDeleteState(null);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vymazat stat", variant: "destructive" }),
  });

  function toggleContinent(id: number) {
    setExpandedContinents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const filteredStates = tableFilter.filteredData;
  const isFiltered = filteredStates.length !== (allStates?.length ?? 0);

  const ANTARCTICA_CONTINENT_ID = 7;

  const continentGroups = (continents || []).map(continent => ({
    continent,
    states: [...(filteredStates.filter(s => s.continentId === continent.id))].sort((a, b) => a.name.localeCompare(b.name, "sk")),
  })).filter(g => g.states.length > 0 || g.continent.id === ANTARCTICA_CONTINENT_ID);

  const ungrouped = filteredStates.filter(s => !continents?.find(c => c.id === s.continentId));

  const colSpan = [
    columnVisibility.isVisible("id"),
    columnVisibility.isVisible("name"),
    columnVisibility.isVisible("code"),
    columnVisibility.isVisible("currency"),
    columnVisibility.isVisible("continentId"),
    columnVisibility.isVisible("flagUrl"),
  ].filter(Boolean).length + 1;

  function renderStateRow(state: State) {
    return (
      <TableRow key={state.id} data-testid={`row-state-${state.id}`} onRowClick={() => { setEditingState(state); setFormOpen(true); }} className="border-l-[3px] border-l-border/40 bg-background hover:bg-muted/30">
        {columnVisibility.isVisible("id") && <TableCell><Badge variant="outline">{state.id}</Badge></TableCell>}
        {columnVisibility.isVisible("name") && <TableCell className="font-medium pl-7" data-testid={`text-state-name-${state.id}`}>{state.name}</TableCell>}
        {columnVisibility.isVisible("code") && <TableCell data-testid={`text-state-code-${state.id}`}>{state.code}</TableCell>}
        {columnVisibility.isVisible("currency") && <TableCell data-testid={`text-state-currency-${state.id}`}><Badge variant="outline">{(state as any).currency || "EUR"}</Badge></TableCell>}
        {columnVisibility.isVisible("continentId") && <TableCell className="text-muted-foreground text-xs">{continents?.find(c => c.id === state.continentId)?.name || state.continentId}</TableCell>}
        {columnVisibility.isVisible("flagUrl") && <TableCell><FlagImage src={state.flagUrl} alt={state.name} code={state.code} className="h-6 object-contain" /></TableCell>}
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            <Button size="icon" variant="ghost" onClick={() => setFlagUploadState(state)} data-testid={`button-upload-flag-${state.id}`} title="Nahrat vlajku"><Image className="w-4 h-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => setFlagHistoryState(state)} data-testid={`button-flag-history-${state.id}`} title="Historia vlajok statu"><Clock className="w-4 h-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => { setEditingState(state); setFormOpen(true); }} data-testid={`button-edit-state-${state.id}`}><Pencil className="w-4 h-4" /></Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" onClick={() => setDeleteState(state)} data-testid={`button-delete-state-${state.id}`}><Trash2 className="w-4 h-4" /></Button>
              </TooltipTrigger>
              <TooltipContent>Zmazať prázdny záznam</TooltipContent>
            </Tooltip>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Staty</h1>
          <p className="text-sm text-muted-foreground mt-1">Sprava statov a vlajok</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SmartFilterBar filter={tableFilter} />
          <ColumnManager columnVisibility={columnVisibility} />
        </div>
      </div>

      <AddStateButton onClick={() => { setEditingState(null); setFormOpen(true); }} />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Nacitavam...</div>
          ) : !allStates || allStates.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Ziadne staty</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columnVisibility.isVisible("id") && <TableHead>ID</TableHead>}
                  {columnVisibility.isVisible("name") && <TableHead>Nazov</TableHead>}
                  {columnVisibility.isVisible("code") && <TableHead>Skratka</TableHead>}
                  {columnVisibility.isVisible("currency") && <TableHead>Mena</TableHead>}
                  {columnVisibility.isVisible("continentId") && <TableHead>Kontinent</TableHead>}
                  {columnVisibility.isVisible("flagUrl") && <TableHead>Vlajka</TableHead>}
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isFiltered ? (
                  filteredStates.sort((a, b) => a.name.localeCompare(b.name, "sk")).map(renderStateRow)
                ) : (
                  <>
                    {continentGroups.map(({ continent, states }) => (
                      <Fragment key={`continent-group-${continent.id}`}>
                        <TableRow
                          key={`continent-${continent.id}`}
                          className="bg-muted border-t border-border hover:bg-muted/80 cursor-pointer select-none"
                          data-testid={`row-continent-${continent.id}`}
                          onClick={() => toggleContinent(continent.id)}
                        >
                          <TableCell colSpan={colSpan} className="py-2.5 px-4">
                            <div className="flex items-center gap-2">
                              {expandedContinents.has(continent.id)
                                ? <ChevronDown className="w-4 h-4" />
                                : <ChevronRight className="w-4 h-4" />}
                              <Globe className="w-4 h-4 text-muted-foreground" />
                              <span className="font-semibold text-xs uppercase tracking-wider">{continent.name}</span>
                              <Badge variant="secondary" className="text-[10px] ml-1 h-4 px-1.5">{states.length}</Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedContinents.has(continent.id) && states.length === 0 && continent.id === ANTARCTICA_CONTINENT_ID && (
                          <TableRow>
                            <TableCell colSpan={colSpan} className="py-5 px-7">
                              <div className="flex flex-col gap-4 bg-muted/30 rounded-md border border-border/50 p-5">
                                <div className="flex items-center gap-3">
                                  <span className="text-3xl">🧊</span>
                                  <div>
                                    <p className="font-semibold text-foreground">Antarktída</p>
                                    <p className="text-xs text-muted-foreground">Neutrálne medzinárodné územie — žiadne suverénne štáty</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                                  {[
                                    { label: "Rozloha", value: "14 000 000 km²", icon: "🗺️" },
                                    { label: "Stála populácia", value: "0 obyvateľov", icon: "👤" },
                                    { label: "Leto (výskumníci)", value: "≈ 5 000 osôb", icon: "☀️" },
                                    { label: "Zima (výskumníci)", value: "≈ 1 000 osôb", icon: "❄️" },
                                    { label: "Vedecké stanice", value: "≈ 70 staníc", icon: "🔬" },
                                    { label: "Krajiny so stanicami", value: "30 krajín", icon: "🌍" },
                                    { label: "Najvyšší bod", value: "Vinson Massif 4 892 m", icon: "⛰️" },
                                    { label: "Najnižšia teplota", value: "−89,2 °C (1983)", icon: "🌡️" },
                                    { label: "Antarktická zmluva", value: "1. dec. 1959", icon: "📜" },
                                  ].map(({ label, value, icon }) => (
                                    <div key={label} className="flex flex-col gap-0.5 rounded-md border border-border/50 bg-background px-3 py-2">
                                      <span className="text-xs text-muted-foreground flex items-center gap-1"><span>{icon}</span>{label}</span>
                                      <span className="text-sm font-semibold text-foreground">{value}</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="space-y-2 text-sm text-muted-foreground">
                                  <p className="font-medium text-foreground">Prečo tu nie sú žiadne štáty?</p>
                                  <p>Antarktída je jedinou obývanou oblasťou sveta bez suverénnej vlády. Spravuje ju <strong className="text-foreground">Antarktická zmluva</strong> podpísaná 1. decembra 1959 (platnosť od 23. júna 1961), ku ktorej pristúpilo <strong className="text-foreground">54 štátov</strong>. Zmluva zakazuje vojenské aktivity, ťažbu nerastných surovín a zakladanie štátov. Sedem krajín (Argentína, Austrália, Čile, Francúzsko, Nórsko, Nový Zéland, Veľká Británia) má historické územné nároky, ktoré zmluva zmrazila.</p>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                        {expandedContinents.has(continent.id) && states.map(renderStateRow)}
                        {expandedContinents.has(continent.id) && <TableRow className="h-0 border-b border-border/60"><TableCell colSpan={colSpan} className="p-0" /></TableRow>}
                      </Fragment>
                    ))}
                    {ungrouped.length > 0 && (
                      <Fragment key="continent-group-none">
                        <TableRow
                          className="bg-muted border-t border-border hover:bg-muted/80 cursor-pointer select-none"
                          onClick={() => toggleContinent(-1)}
                        >
                          <TableCell colSpan={colSpan} className="py-2.5 px-4">
                            <div className="flex items-center gap-2">
                              {expandedContinents.has(-1)
                                ? <ChevronDown className="w-4 h-4" />
                                : <ChevronRight className="w-4 h-4" />}
                              <Globe className="w-4 h-4 text-muted-foreground" />
                              <span className="font-semibold text-xs uppercase tracking-wider">Nezaradené</span>
                              <Badge variant="secondary" className="text-[10px] ml-1 h-4 px-1.5">{ungrouped.length}</Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                        {expandedContinents.has(-1) && ungrouped.sort((a, b) => a.name.localeCompare(b.name, "sk")).map(renderStateRow)}
                        {expandedContinents.has(-1) && <TableRow className="h-0 border-b border-border/60"><TableCell colSpan={colSpan} className="p-0" /></TableRow>}
                      </Fragment>
                    )}
                  </>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <StateFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editingState={editingState}
      />

      <FlagUploadDialog
        open={!!flagUploadState}
        onOpenChange={(open) => { if (!open) setFlagUploadState(null); }}
        state={flagUploadState}
      />

      <FlagHistoryDialog
        open={!!flagHistoryState}
        onOpenChange={(open) => { if (!open) setFlagHistoryState(null); }}
        state={flagHistoryState}
      />

      <AlertDialog open={!!deleteState} onOpenChange={(open) => { if (!open) setDeleteState(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vymazat stat</AlertDialogTitle>
            <AlertDialogDescription>
              Naozaj chcete vymazat stat "{deleteState?.name}"? Tato akcia sa neda vratit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Zrusit</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteState && deleteMutation.mutate(deleteState.id)}
              data-testid="button-confirm-delete"
            >
              Vymazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
