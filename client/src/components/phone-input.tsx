import { useState, useRef, useEffect, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown } from "lucide-react";
import { normalizePhone } from "@/lib/utils";

export interface Country {
  name: string;
  code: string;
  dialCode: string;
}

export const COUNTRIES: Country[] = [
  { name: "Afganistan", code: "AF", dialCode: "+93" },
  { name: "Albánsko", code: "AL", dialCode: "+355" },
  { name: "Alžírsko", code: "DZ", dialCode: "+213" },
  { name: "Andorra", code: "AD", dialCode: "+376" },
  { name: "Angola", code: "AO", dialCode: "+244" },
  { name: "Argentína", code: "AR", dialCode: "+54" },
  { name: "Arménsko", code: "AM", dialCode: "+374" },
  { name: "Austrália", code: "AU", dialCode: "+61" },
  { name: "Rakúsko", code: "AT", dialCode: "+43" },
  { name: "Azerbajdžan", code: "AZ", dialCode: "+994" },
  { name: "Bahrajn", code: "BH", dialCode: "+973" },
  { name: "Bangladéš", code: "BD", dialCode: "+880" },
  { name: "Bielorusko", code: "BY", dialCode: "+375" },
  { name: "Belgicko", code: "BE", dialCode: "+32" },
  { name: "Belize", code: "BZ", dialCode: "+501" },
  { name: "Benin", code: "BJ", dialCode: "+229" },
  { name: "Bhután", code: "BT", dialCode: "+975" },
  { name: "Bolívia", code: "BO", dialCode: "+591" },
  { name: "Bosna a Hercegovina", code: "BA", dialCode: "+387" },
  { name: "Botswana", code: "BW", dialCode: "+267" },
  { name: "Brazília", code: "BR", dialCode: "+55" },
  { name: "Brunei", code: "BN", dialCode: "+673" },
  { name: "Bulharsko", code: "BG", dialCode: "+359" },
  { name: "Burkina Faso", code: "BF", dialCode: "+226" },
  { name: "Burundi", code: "BI", dialCode: "+257" },
  { name: "Kambodža", code: "KH", dialCode: "+855" },
  { name: "Kamerun", code: "CM", dialCode: "+237" },
  { name: "Kanada", code: "CA", dialCode: "+1" },
  { name: "Kapverdy", code: "CV", dialCode: "+238" },
  { name: "Stredoafrická republika", code: "CF", dialCode: "+236" },
  { name: "Čad", code: "TD", dialCode: "+235" },
  { name: "Čile", code: "CL", dialCode: "+56" },
  { name: "Čína", code: "CN", dialCode: "+86" },
  { name: "Kolumbia", code: "CO", dialCode: "+57" },
  { name: "Kongo (DR)", code: "CD", dialCode: "+243" },
  { name: "Kongo", code: "CG", dialCode: "+242" },
  { name: "Kostarika", code: "CR", dialCode: "+506" },
  { name: "Chorvátsko", code: "HR", dialCode: "+385" },
  { name: "Kuba", code: "CU", dialCode: "+53" },
  { name: "Cyprus", code: "CY", dialCode: "+357" },
  { name: "Česká republika", code: "CZ", dialCode: "+420" },
  { name: "Dánsko", code: "DK", dialCode: "+45" },
  { name: "Džibutsko", code: "DJ", dialCode: "+253" },
  { name: "Dominikánska republika", code: "DO", dialCode: "+1809" },
  { name: "Ekvádor", code: "EC", dialCode: "+593" },
  { name: "Egypt", code: "EG", dialCode: "+20" },
  { name: "Salvádor", code: "SV", dialCode: "+503" },
  { name: "Eritrea", code: "ER", dialCode: "+291" },
  { name: "Estónsko", code: "EE", dialCode: "+372" },
  { name: "Etiopia", code: "ET", dialCode: "+251" },
  { name: "Fidži", code: "FJ", dialCode: "+679" },
  { name: "Fínsko", code: "FI", dialCode: "+358" },
  { name: "Francúzsko", code: "FR", dialCode: "+33" },
  { name: "Gabon", code: "GA", dialCode: "+241" },
  { name: "Gambia", code: "GM", dialCode: "+220" },
  { name: "Gruzínsko", code: "GE", dialCode: "+995" },
  { name: "Nemecko", code: "DE", dialCode: "+49" },
  { name: "Ghana", code: "GH", dialCode: "+233" },
  { name: "Grécko", code: "GR", dialCode: "+30" },
  { name: "Guatemala", code: "GT", dialCode: "+502" },
  { name: "Guinea", code: "GN", dialCode: "+224" },
  { name: "Haiti", code: "HT", dialCode: "+509" },
  { name: "Honduras", code: "HN", dialCode: "+504" },
  { name: "Hongkong", code: "HK", dialCode: "+852" },
  { name: "Maďarsko", code: "HU", dialCode: "+36" },
  { name: "Island", code: "IS", dialCode: "+354" },
  { name: "India", code: "IN", dialCode: "+91" },
  { name: "Indonézia", code: "ID", dialCode: "+62" },
  { name: "Irán", code: "IR", dialCode: "+98" },
  { name: "Irak", code: "IQ", dialCode: "+964" },
  { name: "Írsko", code: "IE", dialCode: "+353" },
  { name: "Izrael", code: "IL", dialCode: "+972" },
  { name: "Taliansko", code: "IT", dialCode: "+39" },
  { name: "Jamajka", code: "JM", dialCode: "+1876" },
  { name: "Japonsko", code: "JP", dialCode: "+81" },
  { name: "Jordánsko", code: "JO", dialCode: "+962" },
  { name: "Kazachstan", code: "KZ", dialCode: "+7" },
  { name: "Keňa", code: "KE", dialCode: "+254" },
  { name: "Kosovo", code: "XK", dialCode: "+383" },
  { name: "Kuvajt", code: "KW", dialCode: "+965" },
  { name: "Kirgizsko", code: "KG", dialCode: "+996" },
  { name: "Laos", code: "LA", dialCode: "+856" },
  { name: "Lotyšsko", code: "LV", dialCode: "+371" },
  { name: "Libanon", code: "LB", dialCode: "+961" },
  { name: "Lesotho", code: "LS", dialCode: "+266" },
  { name: "Libéria", code: "LR", dialCode: "+231" },
  { name: "Líbya", code: "LY", dialCode: "+218" },
  { name: "Lichtenštajnsko", code: "LI", dialCode: "+423" },
  { name: "Litva", code: "LT", dialCode: "+370" },
  { name: "Luxembursko", code: "LU", dialCode: "+352" },
  { name: "Madagaskar", code: "MG", dialCode: "+261" },
  { name: "Malawi", code: "MW", dialCode: "+265" },
  { name: "Malajzia", code: "MY", dialCode: "+60" },
  { name: "Mali", code: "ML", dialCode: "+223" },
  { name: "Malta", code: "MT", dialCode: "+356" },
  { name: "Mauritánia", code: "MR", dialCode: "+222" },
  { name: "Maurícius", code: "MU", dialCode: "+230" },
  { name: "Mexiko", code: "MX", dialCode: "+52" },
  { name: "Moldavsko", code: "MD", dialCode: "+373" },
  { name: "Monako", code: "MC", dialCode: "+377" },
  { name: "Mongolsko", code: "MN", dialCode: "+976" },
  { name: "Čierna Hora", code: "ME", dialCode: "+382" },
  { name: "Maroko", code: "MA", dialCode: "+212" },
  { name: "Mozambik", code: "MZ", dialCode: "+258" },
  { name: "Mjanmarsko", code: "MM", dialCode: "+95" },
  { name: "Namíbia", code: "NA", dialCode: "+264" },
  { name: "Nepál", code: "NP", dialCode: "+977" },
  { name: "Holandsko", code: "NL", dialCode: "+31" },
  { name: "Nový Zéland", code: "NZ", dialCode: "+64" },
  { name: "Nikaragua", code: "NI", dialCode: "+505" },
  { name: "Niger", code: "NE", dialCode: "+227" },
  { name: "Nigéria", code: "NG", dialCode: "+234" },
  { name: "Severná Kórea", code: "KP", dialCode: "+850" },
  { name: "Macedónsko", code: "MK", dialCode: "+389" },
  { name: "Nórsko", code: "NO", dialCode: "+47" },
  { name: "Omán", code: "OM", dialCode: "+968" },
  { name: "Pakistan", code: "PK", dialCode: "+92" },
  { name: "Palestína", code: "PS", dialCode: "+970" },
  { name: "Panama", code: "PA", dialCode: "+507" },
  { name: "Papua Nová Guinea", code: "PG", dialCode: "+675" },
  { name: "Paraguaj", code: "PY", dialCode: "+595" },
  { name: "Peru", code: "PE", dialCode: "+51" },
  { name: "Filipíny", code: "PH", dialCode: "+63" },
  { name: "Poľsko", code: "PL", dialCode: "+48" },
  { name: "Portugalsko", code: "PT", dialCode: "+351" },
  { name: "Katar", code: "QA", dialCode: "+974" },
  { name: "Rumunsko", code: "RO", dialCode: "+40" },
  { name: "Rusko", code: "RU", dialCode: "+7" },
  { name: "Rwanda", code: "RW", dialCode: "+250" },
  { name: "Saudská Arábia", code: "SA", dialCode: "+966" },
  { name: "Senegal", code: "SN", dialCode: "+221" },
  { name: "Srbsko", code: "RS", dialCode: "+381" },
  { name: "Seychely", code: "SC", dialCode: "+248" },
  { name: "Sierra Leone", code: "SL", dialCode: "+232" },
  { name: "Singapur", code: "SG", dialCode: "+65" },
  { name: "Slovensko", code: "SK", dialCode: "+421" },
  { name: "Slovinsko", code: "SI", dialCode: "+386" },
  { name: "Somálsko", code: "SO", dialCode: "+252" },
  { name: "Južná Afrika", code: "ZA", dialCode: "+27" },
  { name: "Južná Kórea", code: "KR", dialCode: "+82" },
  { name: "Južný Sudán", code: "SS", dialCode: "+211" },
  { name: "Španielsko", code: "ES", dialCode: "+34" },
  { name: "Srí Lanka", code: "LK", dialCode: "+94" },
  { name: "Sudán", code: "SD", dialCode: "+249" },
  { name: "Surinam", code: "SR", dialCode: "+597" },
  { name: "Švédsko", code: "SE", dialCode: "+46" },
  { name: "Švajčiarsko", code: "CH", dialCode: "+41" },
  { name: "Sýria", code: "SY", dialCode: "+963" },
  { name: "Taiwan", code: "TW", dialCode: "+886" },
  { name: "Tadžikistan", code: "TJ", dialCode: "+992" },
  { name: "Tanzánia", code: "TZ", dialCode: "+255" },
  { name: "Thajsko", code: "TH", dialCode: "+66" },
  { name: "Togo", code: "TG", dialCode: "+228" },
  { name: "Trinidad a Tobago", code: "TT", dialCode: "+1868" },
  { name: "Tunisko", code: "TN", dialCode: "+216" },
  { name: "Turecko", code: "TR", dialCode: "+90" },
  { name: "Turkménsko", code: "TM", dialCode: "+993" },
  { name: "Uganda", code: "UG", dialCode: "+256" },
  { name: "Ukrajina", code: "UA", dialCode: "+380" },
  { name: "Spojené arabské emiráty", code: "AE", dialCode: "+971" },
  { name: "Veľká Británia", code: "GB", dialCode: "+44" },
  { name: "USA", code: "US", dialCode: "+1" },
  { name: "Uruguaj", code: "UY", dialCode: "+598" },
  { name: "Uzbekistan", code: "UZ", dialCode: "+998" },
  { name: "Venezuela", code: "VE", dialCode: "+58" },
  { name: "Vietnam", code: "VN", dialCode: "+84" },
  { name: "Jemen", code: "YE", dialCode: "+967" },
  { name: "Zambia", code: "ZM", dialCode: "+260" },
  { name: "Zimbabwe", code: "ZW", dialCode: "+263" },
];

const SK_COUNTRY = COUNTRIES.find(c => c.code === "SK")!;

const COUNTRY_BY_CODE = Object.fromEntries(COUNTRIES.map(c => [c.code, c]));

const NEIGHBOR_MAP: Record<string, string[]> = {
  // Stredná Európa
  "+421": ["SK", "CZ", "AT", "PL", "HU", "UA"],
  "+420": ["CZ", "SK", "AT", "DE", "PL"],
  "+43":  ["AT", "SK", "CZ", "DE", "HU", "SI", "CH", "IT", "LI"],
  "+48":  ["PL", "SK", "CZ", "DE", "UA", "BY", "LT", "RU"],
  "+36":  ["HU", "SK", "AT", "UA", "RO", "RS", "HR", "SI"],
  // Západná Európa
  "+49":  ["DE", "AT", "CH", "CZ", "PL", "NL", "BE", "FR", "LU", "DK"],
  "+33":  ["FR", "BE", "LU", "DE", "CH", "IT", "ES", "AD", "MC"],
  "+39":  ["IT", "FR", "CH", "AT", "SI", "SM", "VA"],
  "+34":  ["ES", "FR", "PT", "AD"],
  "+351": ["PT", "ES"],
  "+32":  ["BE", "FR", "DE", "LU", "NL"],
  "+31":  ["NL", "BE", "DE"],
  "+41":  ["CH", "DE", "FR", "IT", "AT", "LI"],
  "+44":  ["GB", "IE", "FR"],
  "+353": ["IE", "GB"],
  "+352": ["LU", "BE", "DE", "FR"],
  // Škandinávska Európa
  "+46":  ["SE", "NO", "FI", "DK"],
  "+47":  ["NO", "SE", "FI", "RU"],
  "+45":  ["DK", "SE", "NO", "DE"],
  "+358": ["FI", "SE", "NO", "RU", "EE"],
  "+354": ["IS"],
  // Východná Európa
  "+380": ["UA", "SK", "PL", "HU", "RO", "MD", "BY", "RU"],
  "+375": ["BY", "RU", "UA", "PL", "LT", "LV"],
  "+370": ["LT", "BY", "RU", "LV", "PL"],
  "+371": ["LV", "LT", "BY", "RU", "EE"],
  "+372": ["EE", "LV", "RU", "FI"],
  "+373": ["MD", "RO", "UA"],
  "+7":   ["RU", "UA", "BY", "FI", "EE", "LV", "LT", "PL", "NO", "KZ", "MN", "CN", "KP", "GE", "AZ"],
  // Balkán
  "+40":  ["RO", "HU", "UA", "MD", "BG", "RS"],
  "+359": ["BG", "RO", "RS", "MK", "GR", "TR"],
  "+381": ["RS", "HU", "HR", "BA", "ME", "AL", "MK", "BG", "RO"],
  "+385": ["HR", "SI", "HU", "RS", "BA", "ME"],
  "+387": ["BA", "HR", "RS", "ME"],
  "+386": ["SI", "AT", "IT", "HU", "HR"],
  "+382": ["ME", "RS", "AL", "HR", "BA"],
  "+355": ["AL", "GR", "MK", "RS", "ME"],
  "+389": ["MK", "GR", "BG", "RS", "AL"],
  "+383": ["XK", "RS", "AL", "MK", "ME"],
  "+30":  ["GR", "BG", "MK", "AL", "TR"],
  // Kaukaz
  "+90":  ["TR", "GR", "BG", "GE", "AM", "AZ", "IR", "IQ", "SY"],
  "+994": ["AZ", "RU", "GE", "AM", "TR", "IR"],
  "+374": ["AM", "TR", "GE", "AZ", "IR"],
  "+995": ["GE", "RU", "TR", "AM", "AZ"],
  // Blízky východ
  "+966": ["SA", "JO", "IQ", "KW", "AE", "QA", "YE", "OM", "BH"],
  "+962": ["JO", "SA", "IQ", "SY", "IL", "PS"],
  "+964": ["IQ", "TR", "IR", "KW", "SA", "JO", "SY"],
  "+965": ["KW", "IQ", "SA"],
  "+971": ["AE", "SA", "OM", "QA"],
  "+974": ["QA", "SA", "AE"],
  "+973": ["BH", "SA", "QA"],
  "+968": ["OM", "AE", "SA", "YE"],
  "+967": ["YE", "SA", "OM"],
  "+972": ["IL", "EG", "JO", "LB", "SY", "PS"],
  "+970": ["PS", "IL", "JO", "EG"],
  "+961": ["LB", "SY", "IL"],
  "+963": ["SY", "TR", "IQ", "JO", "IL", "LB"],
  "+98":  ["IR", "TR", "AM", "AZ", "TM", "AF", "PK", "IQ"],
  // Stredná Ázia
  "+93":  ["AF", "IR", "TM", "UZ", "TJ", "PK", "CN"],
  "+92":  ["PK", "AF", "IN", "IR", "CN"],
  "+993": ["TM", "KZ", "UZ", "AF", "IR"],
  "+998": ["UZ", "KZ", "KG", "TJ", "AF", "TM"],
  "+996": ["KG", "KZ", "TJ", "UZ", "CN"],
  "+992": ["TJ", "KG", "UZ", "AF", "CN"],
  // Južná Ázia
  "+91":  ["IN", "PK", "CN", "NP", "BT", "BD", "MM", "LK"],
  "+977": ["NP", "IN", "CN"],
  "+975": ["BT", "IN", "CN"],
  "+880": ["BD", "IN", "MM"],
  "+94":  ["LK", "IN"],
  // Juhovýchodná Ázia
  "+95":  ["MM", "IN", "BD", "CN", "LA", "TH"],
  "+66":  ["TH", "MM", "LA", "KH", "MY"],
  "+856": ["LA", "MM", "CN", "VN", "KH", "TH"],
  "+855": ["KH", "TH", "LA", "VN"],
  "+84":  ["VN", "CN", "LA", "KH"],
  "+60":  ["MY", "TH", "ID", "BN", "SG"],
  "+65":  ["SG", "MY", "ID"],
  "+673": ["BN", "MY"],
  "+62":  ["ID", "MY", "PG", "TL", "SG"],
  "+670": ["TL", "ID"],
  "+63":  ["PH", "TW", "ID", "MY"],
  // Východná Ázia
  "+86":  ["CN", "RU", "MN", "KZ", "KG", "TJ", "AF", "PK", "IN", "NP", "BT", "MM", "LA", "VN", "KP"],
  "+976": ["MN", "CN", "RU"],
  "+82":  ["KR", "KP", "CN"],
  "+850": ["KP", "CN", "RU", "KR"],
  "+81":  ["JP", "KR", "CN", "RU"],
  "+886": ["TW", "CN", "PH", "JP"],
  "+852": ["HK", "CN"],
  "+853": ["MO", "CN"],
  // Severná Amerika
  "+1":   ["US", "CA", "MX", "CU", "JM"],
  "+52":  ["MX", "US", "GT", "BZ"],
  // Stredná Amerika
  "+502": ["GT", "MX", "BZ", "HN", "SV"],
  "+501": ["BZ", "MX", "GT"],
  "+504": ["HN", "GT", "SV", "NI"],
  "+503": ["SV", "GT", "HN"],
  "+505": ["NI", "HN", "CR"],
  "+506": ["CR", "NI", "PA"],
  "+507": ["PA", "CR", "CO"],
  // Karibik
  "+53":  ["CU", "US", "JM", "HT"],
  "+509": ["HT", "DO"],
  "+1809":["DO", "HT"],
  "+1876":["JM", "CU", "HT"],
  "+1868":["TT", "VE"],
  // Južná Amerika
  "+57":  ["CO", "PA", "VE", "BR", "PE", "EC"],
  "+58":  ["VE", "CO", "BR", "GY", "TT"],
  "+592": ["GY", "VE", "BR", "SR"],
  "+597": ["SR", "GY", "BR"],
  "+594": ["GF", "BR", "SR"],
  "+593": ["EC", "CO", "PE"],
  "+51":  ["PE", "EC", "CO", "BR", "BO", "CL"],
  "+591": ["BO", "PE", "BR", "PY", "AR", "CL"],
  "+55":  ["BR", "VE", "GY", "SR", "CO", "PE", "BO", "PY", "AR", "UY"],
  "+595": ["PY", "BO", "BR", "AR"],
  "+54":  ["AR", "CL", "BO", "PY", "BR", "UY"],
  "+598": ["UY", "AR", "BR"],
  "+56":  ["CL", "PE", "BO", "AR"],
  // Severná Afrika
  "+212": ["MA", "ES", "DZ", "MR"],
  "+213": ["DZ", "MA", "TN", "LY", "NE", "ML", "MR"],
  "+216": ["TN", "DZ", "LY"],
  "+218": ["LY", "TN", "DZ", "NE", "SD", "EG", "TD"],
  "+20":  ["EG", "LY", "SD", "IL", "PS"],
  // Subsaharská Afrika – Východ
  "+249": ["SD", "EG", "LY", "TD", "CF", "SS", "ET", "ER"],
  "+211": ["SS", "SD", "ET", "KE", "UG", "CD", "CF"],
  "+251": ["ET", "SD", "SS", "KE", "SO", "DJ", "ER"],
  "+291": ["ER", "ET", "SD", "DJ"],
  "+253": ["DJ", "ET", "SO", "ER"],
  "+252": ["SO", "ET", "KE", "DJ"],
  "+254": ["KE", "SO", "ET", "SS", "UG", "TZ"],
  "+256": ["UG", "SS", "CD", "RW", "TZ", "KE"],
  "+255": ["TZ", "KE", "UG", "RW", "BI", "CD", "ZM", "MW", "MZ"],
  "+250": ["RW", "UG", "TZ", "BI", "CD"],
  "+257": ["BI", "RW", "TZ", "CD"],
  "+243": ["CD", "CF", "SD", "SS", "UG", "RW", "BI", "TZ", "ZM", "AO", "CG"],
  // Subsaharská Afrika – Západ
  "+242": ["CG", "GA", "CF", "CD", "AO"],
  "+241": ["GA", "CM", "GQ", "CG"],
  "+240": ["GQ", "CM", "GA"],
  "+237": ["CM", "NG", "CF", "CG", "GA", "GQ"],
  "+234": ["NG", "BJ", "NE", "CM", "TD"],
  "+235": ["TD", "LY", "SD", "CF", "NG", "NE", "CM"],
  "+236": ["CF", "SD", "SS", "CD", "CG", "CM", "NG"],
  "+227": ["NE", "DZ", "LY", "TD", "NG", "BJ", "BF", "ML"],
  "+223": ["ML", "DZ", "NE", "BF", "CI", "GN", "SN", "MR"],
  "+222": ["MR", "MA", "SN", "ML", "DZ"],
  "+221": ["SN", "MR", "ML", "GN", "GW", "GM"],
  "+220": ["GM", "SN"],
  "+245": ["GW", "SN", "GN"],
  "+224": ["GN", "SN", "ML", "CI", "LR", "SL"],
  "+232": ["SL", "GN", "LR"],
  "+231": ["LR", "GN", "SL", "CI"],
  "+225": ["CI", "LR", "GN", "ML", "BF", "GH"],
  "+226": ["BF", "ML", "NE", "BJ", "TG", "GH", "CI"],
  "+233": ["GH", "CI", "BF", "TG"],
  "+228": ["TG", "GH", "BF", "BJ"],
  "+229": ["BJ", "TG", "BF", "NG"],
  // Subsaharská Afrika – Juh
  "+244": ["AO", "CD", "ZM", "NA", "CG"],
  "+260": ["ZM", "CD", "TZ", "MW", "MZ", "ZW", "BW", "NA", "AO"],
  "+263": ["ZW", "ZM", "MZ", "BW", "ZA"],
  "+258": ["MZ", "TZ", "MW", "ZM", "ZW", "ZA", "SZ"],
  "+265": ["MW", "TZ", "ZM", "MZ"],
  "+264": ["NA", "AO", "ZM", "BW", "ZA"],
  "+267": ["BW", "NA", "ZM", "ZW", "ZA"],
  "+27":  ["ZA", "NA", "BW", "ZW", "MZ", "SZ", "LS"],
  "+266": ["LS", "ZA"],
  "+268": ["SZ", "ZA", "MZ"],
  "+261": ["MG", "MZ"],
  // Oceánia
  "+61":  ["AU", "PG", "ID", "NZ"],
  "+64":  ["NZ", "AU"],
  "+675": ["PG", "AU", "ID"],
  "+679": ["FJ", "VU", "SB"],
};

function getNeighborCodes(dialCode: string): string[] {
  const normalized = dialCode.startsWith('+') ? dialCode : `+${dialCode}`;
  return NEIGHBOR_MAP[normalized] ?? [];
}

function flagUrl(code: string): string {
  return `https://flagcdn.com/w20/${code.toLowerCase()}.png`;
}

function CountryFlag({ code, name }: { code: string; name: string }) {
  return (
    <img
      src={flagUrl(code)}
      alt={name}
      width={20}
      height={14}
      style={{ display: "inline-block", objectFit: "cover", borderRadius: 1, flexShrink: 0 }}
      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
    />
  );
}

function detectCountryFromDialCode(dialCode: string): Country {
  const normalized = dialCode.startsWith('+') ? dialCode : `+${dialCode}`;
  const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  return sorted.find(c => c.dialCode === normalized) ?? SK_COUNTRY;
}

function detectCountry(phone: string): Country {
  const normalized = normalizePhone(phone);
  if (normalized.startsWith('+')) {
    const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
    for (const c of sorted) {
      if (normalized.startsWith(c.dialCode)) return c;
    }
  }
  return SK_COUNTRY;
}

function extractLocalDigits(phone: string, dialCode: string): string {
  const normalized = normalizePhone(phone);
  if (normalized.startsWith(dialCode)) {
    return normalized.slice(dialCode.length).replace(/\D/g, '');
  }
  if (normalized.startsWith('+')) {
    return normalized.slice(dialCode.length).replace(/\D/g, '');
  }
  return normalized.replace(/\D/g, '');
}

function formatMask(digits: string): string {
  const d = digits.slice(0, 9);
  if (d.length === 0) return '';
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

interface PhoneInputProps {
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  "data-testid"?: string;
  disabled?: boolean;
  className?: string;
  initialDialCode?: string;
  error?: boolean;
}

export function PhoneInput({
  value,
  onChange,
  onBlur,
  placeholder,
  "data-testid": testId,
  disabled,
  className,
  initialDialCode,
  error,
}: PhoneInputProps) {
  const getInitialCountry = (): Country => {
    if (value) return detectCountry(value);
    if (initialDialCode) return detectCountryFromDialCode(initialDialCode);
    return SK_COUNTRY;
  };

  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState<Country>(getInitialCountry);
  const [localMasked, setLocalMasked] = useState<string>(() => {
    const c = getInitialCountry();
    return formatMask(extractLocalDigits(value, c.dialCode));
  });
  const [search, setSearch] = useState("");
  const [touched, setTouched] = useState(false);
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      if (value) {
        const c = detectCountry(value);
        setCountry(c);
        setLocalMasked(formatMask(extractLocalDigits(value, c.dialCode)));
      } else if (initialDialCode) {
        const c = detectCountryFromDialCode(initialDialCode);
        setCountry(c);
        setLocalMasked('');
      } else {
        setLocalMasked('');
      }
      setTouched(false);
    }
  }, [value, initialDialCode]);

  useEffect(() => {
    if (!value && initialDialCode) {
      const c = detectCountryFromDialCode(initialDialCode);
      setCountry(prev => prev.dialCode === c.dialCode ? prev : c);
    }
  }, [initialDialCode, value]);

  const buildFull = useCallback((c: Country, digits: string): string => {
    if (!digits) return '';
    return `${c.dialCode}${digits}`;
  }, []);

  const rawDigits = localMasked.replace(/\D/g, '');
  const isInvalid = touched && rawDigits.length > 0 && rawDigits.length !== 9;
  const showError = isInvalid || error;

  const neighborCodes = initialDialCode ? getNeighborCodes(initialDialCode) : [];
  const neighborCountries = neighborCodes
    .map(code => COUNTRY_BY_CODE[code])
    .filter(Boolean);
  const otherCountries = search.trim()
    ? []
    : COUNTRIES.filter(c => !neighborCodes.includes(c.code));

  const filteredNeighbors = search.trim()
    ? neighborCountries.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dialCode.includes(search) ||
        c.code.toLowerCase().includes(search.toLowerCase())
      )
    : neighborCountries;

  const filteredOthers = search.trim()
    ? COUNTRIES.filter(c =>
        !neighborCodes.includes(c.code) &&
        (c.name.toLowerCase().includes(search.toLowerCase()) ||
         c.dialCode.includes(search) ||
         c.code.toLowerCase().includes(search.toLowerCase()))
      )
    : otherCountries;

  const handleCountrySelect = (c: Country) => {
    setCountry(c);
    setOpen(false);
    setSearch("");
    onChange(buildFull(c, rawDigits));
  };

  const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = raw.replace(/\D/g, '').slice(0, 9);
    const masked = formatMask(digits);
    setLocalMasked(masked);
    onChange(buildFull(country, digits));
  };

  const handleBlur = () => {
    setTouched(true);
    onBlur?.();
  };

  const renderCountryItem = (c: Country) => (
    <CommandItem
      key={c.code}
      value={c.code}
      onSelect={() => handleCountrySelect(c)}
      className="flex items-center gap-2 cursor-pointer"
      data-testid={`phone-country-${c.code}`}
    >
      <CountryFlag code={c.code} name={c.name} />
      <span className="flex-1 text-sm">{c.name}</span>
      <span className="text-xs text-muted-foreground font-mono">{c.dialCode}</span>
    </CommandItem>
  );

  return (
    <div className={`flex gap-0 ${className ?? ''}`}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={`rounded-r-none border-r-0 px-2 h-9 shrink-0 gap-1.5 font-mono text-xs ${showError ? 'border-red-500 ring-1 ring-red-500' : ''}`}
            data-testid={testId ? `${testId}-country` : "phone-country-trigger"}
          >
            <CountryFlag code={country.code} name={country.name} />
            <span className="text-muted-foreground">{country.dialCode}</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-72" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Hľadať krajinu..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList className="max-h-72">
              <CommandEmpty>Žiadna krajina nenájdená</CommandEmpty>
              {filteredNeighbors.length > 0 && (
                <CommandGroup heading="Blízke krajiny">
                  {filteredNeighbors.map(renderCountryItem)}
                </CommandGroup>
              )}
              {filteredOthers.length > 0 && (
                <CommandGroup heading={search.trim() ? "Výsledky" : "Všetky krajiny"}>
                  {filteredOthers.map(renderCountryItem)}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        value={localMasked}
        onChange={handleLocalChange}
        onBlur={handleBlur}
        placeholder={placeholder ?? "9XX XXX XXX"}
        disabled={disabled}
        className={`rounded-l-none font-mono h-9 ${showError ? 'border-red-500 ring-1 ring-red-500 focus-visible:ring-red-500' : ''}`}
        data-testid={testId ?? "phone-input"}
      />
    </div>
  );
}
