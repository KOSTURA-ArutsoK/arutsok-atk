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
  flag: string;
}

export const COUNTRIES: Country[] = [
  { name: "Afganistan", code: "AF", dialCode: "+93", flag: "🇦🇫" },
  { name: "Albánsko", code: "AL", dialCode: "+355", flag: "🇦🇱" },
  { name: "Alžírsko", code: "DZ", dialCode: "+213", flag: "🇩🇿" },
  { name: "Americká Samoa", code: "AS", dialCode: "+1684", flag: "🇦🇸" },
  { name: "Andorra", code: "AD", dialCode: "+376", flag: "🇦🇩" },
  { name: "Angola", code: "AO", dialCode: "+244", flag: "🇦🇴" },
  { name: "Anguilla", code: "AI", dialCode: "+1264", flag: "🇦🇮" },
  { name: "Antigua a Barbuda", code: "AG", dialCode: "+1268", flag: "🇦🇬" },
  { name: "Argentína", code: "AR", dialCode: "+54", flag: "🇦🇷" },
  { name: "Arménsko", code: "AM", dialCode: "+374", flag: "🇦🇲" },
  { name: "Aruba", code: "AW", dialCode: "+297", flag: "🇦🇼" },
  { name: "Austrália", code: "AU", dialCode: "+61", flag: "🇦🇺" },
  { name: "Azerbajdžan", code: "AZ", dialCode: "+994", flag: "🇦🇿" },
  { name: "Bahamy", code: "BS", dialCode: "+1242", flag: "🇧🇸" },
  { name: "Bahrajn", code: "BH", dialCode: "+973", flag: "🇧🇭" },
  { name: "Bangladéš", code: "BD", dialCode: "+880", flag: "🇧🇩" },
  { name: "Barbados", code: "BB", dialCode: "+1246", flag: "🇧🇧" },
  { name: "Bielorusko", code: "BY", dialCode: "+375", flag: "🇧🇾" },
  { name: "Belgicko", code: "BE", dialCode: "+32", flag: "🇧🇪" },
  { name: "Belize", code: "BZ", dialCode: "+501", flag: "🇧🇿" },
  { name: "Benin", code: "BJ", dialCode: "+229", flag: "🇧🇯" },
  { name: "Bermuda", code: "BM", dialCode: "+1441", flag: "🇧🇲" },
  { name: "Bhután", code: "BT", dialCode: "+975", flag: "🇧🇹" },
  { name: "Bolívia", code: "BO", dialCode: "+591", flag: "🇧🇴" },
  { name: "Bosna a Hercegovina", code: "BA", dialCode: "+387", flag: "🇧🇦" },
  { name: "Botswana", code: "BW", dialCode: "+267", flag: "🇧🇼" },
  { name: "Brazília", code: "BR", dialCode: "+55", flag: "🇧🇷" },
  { name: "Britské Panenské ostrovy", code: "VG", dialCode: "+1284", flag: "🇻🇬" },
  { name: "Brunei", code: "BN", dialCode: "+673", flag: "🇧🇳" },
  { name: "Bulharsko", code: "BG", dialCode: "+359", flag: "🇧🇬" },
  { name: "Burkina Faso", code: "BF", dialCode: "+226", flag: "🇧🇫" },
  { name: "Burundi", code: "BI", dialCode: "+257", flag: "🇧🇮" },
  { name: "Kambodža", code: "KH", dialCode: "+855", flag: "🇰🇭" },
  { name: "Kamerun", code: "CM", dialCode: "+237", flag: "🇨🇲" },
  { name: "Kanada", code: "CA", dialCode: "+1", flag: "🇨🇦" },
  { name: "Kapverdy", code: "CV", dialCode: "+238", flag: "🇨🇻" },
  { name: "Kajmanské ostrovy", code: "KY", dialCode: "+1345", flag: "🇰🇾" },
  { name: "Stredoafrická republika", code: "CF", dialCode: "+236", flag: "🇨🇫" },
  { name: "Čad", code: "TD", dialCode: "+235", flag: "🇹🇩" },
  { name: "Čile", code: "CL", dialCode: "+56", flag: "🇨🇱" },
  { name: "Čína", code: "CN", dialCode: "+86", flag: "🇨🇳" },
  { name: "Kolumbia", code: "CO", dialCode: "+57", flag: "🇨🇴" },
  { name: "Komory", code: "KM", dialCode: "+269", flag: "🇰🇲" },
  { name: "Kongo (DR)", code: "CD", dialCode: "+243", flag: "🇨🇩" },
  { name: "Kongo", code: "CG", dialCode: "+242", flag: "🇨🇬" },
  { name: "Cookeho ostrovy", code: "CK", dialCode: "+682", flag: "🇨🇰" },
  { name: "Kostarika", code: "CR", dialCode: "+506", flag: "🇨🇷" },
  { name: "Chorvátsko", code: "HR", dialCode: "+385", flag: "🇭🇷" },
  { name: "Kuba", code: "CU", dialCode: "+53", flag: "🇨🇺" },
  { name: "Curaçao", code: "CW", dialCode: "+599", flag: "🇨🇼" },
  { name: "Cyprus", code: "CY", dialCode: "+357", flag: "🇨🇾" },
  { name: "Česká republika", code: "CZ", dialCode: "+420", flag: "🇨🇿" },
  { name: "Dánsko", code: "DK", dialCode: "+45", flag: "🇩🇰" },
  { name: "Džibutsko", code: "DJ", dialCode: "+253", flag: "🇩🇯" },
  { name: "Dominika", code: "DM", dialCode: "+1767", flag: "🇩🇲" },
  { name: "Dominikánska republika", code: "DO", dialCode: "+1809", flag: "🇩🇴" },
  { name: "Ekvádor", code: "EC", dialCode: "+593", flag: "🇪🇨" },
  { name: "Egypt", code: "EG", dialCode: "+20", flag: "🇪🇬" },
  { name: "Salvádor", code: "SV", dialCode: "+503", flag: "🇸🇻" },
  { name: "Rovníková Guinea", code: "GQ", dialCode: "+240", flag: "🇬🇶" },
  { name: "Eritrea", code: "ER", dialCode: "+291", flag: "🇪🇷" },
  { name: "Estónsko", code: "EE", dialCode: "+372", flag: "🇪🇪" },
  { name: "Etiopia", code: "ET", dialCode: "+251", flag: "🇪🇹" },
  { name: "Falklandské ostrovy", code: "FK", dialCode: "+500", flag: "🇫🇰" },
  { name: "Faerské ostrovy", code: "FO", dialCode: "+298", flag: "🇫🇴" },
  { name: "Fidži", code: "FJ", dialCode: "+679", flag: "🇫🇯" },
  { name: "Fínsko", code: "FI", dialCode: "+358", flag: "🇫🇮" },
  { name: "Francúzsko", code: "FR", dialCode: "+33", flag: "🇫🇷" },
  { name: "Francúzska Guyana", code: "GF", dialCode: "+594", flag: "🇬🇫" },
  { name: "Francúzska Polynézia", code: "PF", dialCode: "+689", flag: "🇵🇫" },
  { name: "Gabon", code: "GA", dialCode: "+241", flag: "🇬🇦" },
  { name: "Gambia", code: "GM", dialCode: "+220", flag: "🇬🇲" },
  { name: "Gruzínsko", code: "GE", dialCode: "+995", flag: "🇬🇪" },
  { name: "Nemecko", code: "DE", dialCode: "+49", flag: "🇩🇪" },
  { name: "Ghana", code: "GH", dialCode: "+233", flag: "🇬🇭" },
  { name: "Gibraltár", code: "GI", dialCode: "+350", flag: "🇬🇮" },
  { name: "Grécko", code: "GR", dialCode: "+30", flag: "🇬🇷" },
  { name: "Grónsko", code: "GL", dialCode: "+299", flag: "🇬🇱" },
  { name: "Grenada", code: "GD", dialCode: "+1473", flag: "🇬🇩" },
  { name: "Guadeloupe", code: "GP", dialCode: "+590", flag: "🇬🇵" },
  { name: "Guam", code: "GU", dialCode: "+1671", flag: "🇬🇺" },
  { name: "Guatemala", code: "GT", dialCode: "+502", flag: "🇬🇹" },
  { name: "Guernsey", code: "GG", dialCode: "+44", flag: "🇬🇬" },
  { name: "Guinea", code: "GN", dialCode: "+224", flag: "🇬🇳" },
  { name: "Guinea-Bissau", code: "GW", dialCode: "+245", flag: "🇬🇼" },
  { name: "Guyana", code: "GY", dialCode: "+592", flag: "🇬🇾" },
  { name: "Haiti", code: "HT", dialCode: "+509", flag: "🇭🇹" },
  { name: "Honduras", code: "HN", dialCode: "+504", flag: "🇭🇳" },
  { name: "Hongkong", code: "HK", dialCode: "+852", flag: "🇭🇰" },
  { name: "Maďarsko", code: "HU", dialCode: "+36", flag: "🇭🇺" },
  { name: "Island", code: "IS", dialCode: "+354", flag: "🇮🇸" },
  { name: "India", code: "IN", dialCode: "+91", flag: "🇮🇳" },
  { name: "Indonézia", code: "ID", dialCode: "+62", flag: "🇮🇩" },
  { name: "Irán", code: "IR", dialCode: "+98", flag: "🇮🇷" },
  { name: "Irak", code: "IQ", dialCode: "+964", flag: "🇮🇶" },
  { name: "Írsko", code: "IE", dialCode: "+353", flag: "🇮🇪" },
  { name: "Ostrov Man", code: "IM", dialCode: "+44", flag: "🇮🇲" },
  { name: "Izrael", code: "IL", dialCode: "+972", flag: "🇮🇱" },
  { name: "Taliansko", code: "IT", dialCode: "+39", flag: "🇮🇹" },
  { name: "Pobrežie Slonoviny", code: "CI", dialCode: "+225", flag: "🇨🇮" },
  { name: "Jamajka", code: "JM", dialCode: "+1876", flag: "🇯🇲" },
  { name: "Japonsko", code: "JP", dialCode: "+81", flag: "🇯🇵" },
  { name: "Jersey", code: "JE", dialCode: "+44", flag: "🇯🇪" },
  { name: "Jordánsko", code: "JO", dialCode: "+962", flag: "🇯🇴" },
  { name: "Kazachstan", code: "KZ", dialCode: "+7", flag: "🇰🇿" },
  { name: "Keňa", code: "KE", dialCode: "+254", flag: "🇰🇪" },
  { name: "Kiribati", code: "KI", dialCode: "+686", flag: "🇰🇮" },
  { name: "Kosovo", code: "XK", dialCode: "+383", flag: "🇽🇰" },
  { name: "Kuvajt", code: "KW", dialCode: "+965", flag: "🇰🇼" },
  { name: "Kirgizsko", code: "KG", dialCode: "+996", flag: "🇰🇬" },
  { name: "Laos", code: "LA", dialCode: "+856", flag: "🇱🇦" },
  { name: "Lotyšsko", code: "LV", dialCode: "+371", flag: "🇱🇻" },
  { name: "Libanon", code: "LB", dialCode: "+961", flag: "🇱🇧" },
  { name: "Lesotho", code: "LS", dialCode: "+266", flag: "🇱🇸" },
  { name: "Libéria", code: "LR", dialCode: "+231", flag: "🇱🇷" },
  { name: "Líbya", code: "LY", dialCode: "+218", flag: "🇱🇾" },
  { name: "Lichtenštajnsko", code: "LI", dialCode: "+423", flag: "🇱🇮" },
  { name: "Litva", code: "LT", dialCode: "+370", flag: "🇱🇹" },
  { name: "Luxembursko", code: "LU", dialCode: "+352", flag: "🇱🇺" },
  { name: "Macao", code: "MO", dialCode: "+853", flag: "🇲🇴" },
  { name: "Madagaskar", code: "MG", dialCode: "+261", flag: "🇲🇬" },
  { name: "Malawi", code: "MW", dialCode: "+265", flag: "🇲🇼" },
  { name: "Malajzia", code: "MY", dialCode: "+60", flag: "🇲🇾" },
  { name: "Maldivy", code: "MV", dialCode: "+960", flag: "🇲🇻" },
  { name: "Mali", code: "ML", dialCode: "+223", flag: "🇲🇱" },
  { name: "Malta", code: "MT", dialCode: "+356", flag: "🇲🇹" },
  { name: "Marshallove ostrovy", code: "MH", dialCode: "+692", flag: "🇲🇭" },
  { name: "Martinik", code: "MQ", dialCode: "+596", flag: "🇲🇶" },
  { name: "Mauritánia", code: "MR", dialCode: "+222", flag: "🇲🇷" },
  { name: "Maurícius", code: "MU", dialCode: "+230", flag: "🇲🇺" },
  { name: "Mayotte", code: "YT", dialCode: "+262", flag: "🇾🇹" },
  { name: "Mexiko", code: "MX", dialCode: "+52", flag: "🇲🇽" },
  { name: "Mikronézia", code: "FM", dialCode: "+691", flag: "🇫🇲" },
  { name: "Moldavsko", code: "MD", dialCode: "+373", flag: "🇲🇩" },
  { name: "Monako", code: "MC", dialCode: "+377", flag: "🇲🇨" },
  { name: "Mongolsko", code: "MN", dialCode: "+976", flag: "🇲🇳" },
  { name: "Čierna Hora", code: "ME", dialCode: "+382", flag: "🇲🇪" },
  { name: "Montserrat", code: "MS", dialCode: "+1664", flag: "🇲🇸" },
  { name: "Maroko", code: "MA", dialCode: "+212", flag: "🇲🇦" },
  { name: "Mozambik", code: "MZ", dialCode: "+258", flag: "🇲🇿" },
  { name: "Mjanmarsko", code: "MM", dialCode: "+95", flag: "🇲🇲" },
  { name: "Namíbia", code: "NA", dialCode: "+264", flag: "🇳🇦" },
  { name: "Nauru", code: "NR", dialCode: "+674", flag: "🇳🇷" },
  { name: "Nepál", code: "NP", dialCode: "+977", flag: "🇳🇵" },
  { name: "Holandsko", code: "NL", dialCode: "+31", flag: "🇳🇱" },
  { name: "Nová Kaledónia", code: "NC", dialCode: "+687", flag: "🇳🇨" },
  { name: "Nový Zéland", code: "NZ", dialCode: "+64", flag: "🇳🇿" },
  { name: "Nikaragua", code: "NI", dialCode: "+505", flag: "🇳🇮" },
  { name: "Niger", code: "NE", dialCode: "+227", flag: "🇳🇪" },
  { name: "Nigéria", code: "NG", dialCode: "+234", flag: "🇳🇬" },
  { name: "Niue", code: "NU", dialCode: "+683", flag: "🇳🇺" },
  { name: "Severná Kórea", code: "KP", dialCode: "+850", flag: "🇰🇵" },
  { name: "Macedónsko", code: "MK", dialCode: "+389", flag: "🇲🇰" },
  { name: "Nórsko", code: "NO", dialCode: "+47", flag: "🇳🇴" },
  { name: "Omán", code: "OM", dialCode: "+968", flag: "🇴🇲" },
  { name: "Pakistan", code: "PK", dialCode: "+92", flag: "🇵🇰" },
  { name: "Palau", code: "PW", dialCode: "+680", flag: "🇵🇼" },
  { name: "Palestína", code: "PS", dialCode: "+970", flag: "🇵🇸" },
  { name: "Panama", code: "PA", dialCode: "+507", flag: "🇵🇦" },
  { name: "Papua Nová Guinea", code: "PG", dialCode: "+675", flag: "🇵🇬" },
  { name: "Paraguaj", code: "PY", dialCode: "+595", flag: "🇵🇾" },
  { name: "Peru", code: "PE", dialCode: "+51", flag: "🇵🇪" },
  { name: "Filipíny", code: "PH", dialCode: "+63", flag: "🇵🇭" },
  { name: "Poľsko", code: "PL", dialCode: "+48", flag: "🇵🇱" },
  { name: "Portugalsko", code: "PT", dialCode: "+351", flag: "🇵🇹" },
  { name: "Portoriko", code: "PR", dialCode: "+1787", flag: "🇵🇷" },
  { name: "Katar", code: "QA", dialCode: "+974", flag: "🇶🇦" },
  { name: "Réunion", code: "RE", dialCode: "+262", flag: "🇷🇪" },
  { name: "Rumunsko", code: "RO", dialCode: "+40", flag: "🇷🇴" },
  { name: "Rusko", code: "RU", dialCode: "+7", flag: "🇷🇺" },
  { name: "Rwanda", code: "RW", dialCode: "+250", flag: "🇷🇼" },
  { name: "Svätý Bartolomej", code: "BL", dialCode: "+590", flag: "🇧🇱" },
  { name: "Svätá Helena", code: "SH", dialCode: "+290", flag: "🇸🇭" },
  { name: "Saint Kitts a Nevis", code: "KN", dialCode: "+1869", flag: "🇰🇳" },
  { name: "Svätá Lucia", code: "LC", dialCode: "+1758", flag: "🇱🇨" },
  { name: "Svätý Martin (FR)", code: "MF", dialCode: "+590", flag: "🇲🇫" },
  { name: "Saint Pierre a Miquelon", code: "PM", dialCode: "+508", flag: "🇵🇲" },
  { name: "Svätý Vincent a Grenadíny", code: "VC", dialCode: "+1784", flag: "🇻🇨" },
  { name: "Samoa", code: "WS", dialCode: "+685", flag: "🇼🇸" },
  { name: "San Maríno", code: "SM", dialCode: "+378", flag: "🇸🇲" },
  { name: "Svätý Tomáš a Princov ostrov", code: "ST", dialCode: "+239", flag: "🇸🇹" },
  { name: "Saudská Arábia", code: "SA", dialCode: "+966", flag: "🇸🇦" },
  { name: "Senegal", code: "SN", dialCode: "+221", flag: "🇸🇳" },
  { name: "Srbsko", code: "RS", dialCode: "+381", flag: "🇷🇸" },
  { name: "Seychely", code: "SC", dialCode: "+248", flag: "🇸🇨" },
  { name: "Sierra Leone", code: "SL", dialCode: "+232", flag: "🇸🇱" },
  { name: "Singapur", code: "SG", dialCode: "+65", flag: "🇸🇬" },
  { name: "Sint Maarten", code: "SX", dialCode: "+1721", flag: "🇸🇽" },
  { name: "Slovensko", code: "SK", dialCode: "+421", flag: "🇸🇰" },
  { name: "Slovinsko", code: "SI", dialCode: "+386", flag: "🇸🇮" },
  { name: "Šalamúnove ostrovy", code: "SB", dialCode: "+677", flag: "🇸🇧" },
  { name: "Somálsko", code: "SO", dialCode: "+252", flag: "🇸🇴" },
  { name: "Južná Afrika", code: "ZA", dialCode: "+27", flag: "🇿🇦" },
  { name: "Južná Kórea", code: "KR", dialCode: "+82", flag: "🇰🇷" },
  { name: "Južný Sudán", code: "SS", dialCode: "+211", flag: "🇸🇸" },
  { name: "Španielsko", code: "ES", dialCode: "+34", flag: "🇪🇸" },
  { name: "Srí Lanka", code: "LK", dialCode: "+94", flag: "🇱🇰" },
  { name: "Sudán", code: "SD", dialCode: "+249", flag: "🇸🇩" },
  { name: "Surinam", code: "SR", dialCode: "+597", flag: "🇸🇷" },
  { name: "Svazijsko", code: "SZ", dialCode: "+268", flag: "🇸🇿" },
  { name: "Švédsko", code: "SE", dialCode: "+46", flag: "🇸🇪" },
  { name: "Švajčiarsko", code: "CH", dialCode: "+41", flag: "🇨🇭" },
  { name: "Sýria", code: "SY", dialCode: "+963", flag: "🇸🇾" },
  { name: "Taiwan", code: "TW", dialCode: "+886", flag: "🇹🇼" },
  { name: "Tadžikistan", code: "TJ", dialCode: "+992", flag: "🇹🇯" },
  { name: "Tanzánia", code: "TZ", dialCode: "+255", flag: "🇹🇿" },
  { name: "Thajsko", code: "TH", dialCode: "+66", flag: "🇹🇭" },
  { name: "Timor-Leste", code: "TL", dialCode: "+670", flag: "🇹🇱" },
  { name: "Togo", code: "TG", dialCode: "+228", flag: "🇹🇬" },
  { name: "Tokelau", code: "TK", dialCode: "+690", flag: "🇹🇰" },
  { name: "Tonga", code: "TO", dialCode: "+676", flag: "🇹🇴" },
  { name: "Trinidad a Tobago", code: "TT", dialCode: "+1868", flag: "🇹🇹" },
  { name: "Tunisko", code: "TN", dialCode: "+216", flag: "🇹🇳" },
  { name: "Turecko", code: "TR", dialCode: "+90", flag: "🇹🇷" },
  { name: "Turkménsko", code: "TM", dialCode: "+993", flag: "🇹🇲" },
  { name: "Turks a Caicos", code: "TC", dialCode: "+1649", flag: "🇹🇨" },
  { name: "Tuvalu", code: "TV", dialCode: "+688", flag: "🇹🇻" },
  { name: "Uganda", code: "UG", dialCode: "+256", flag: "🇺🇬" },
  { name: "Ukrajina", code: "UA", dialCode: "+380", flag: "🇺🇦" },
  { name: "Spojené arabské emiráty", code: "AE", dialCode: "+971", flag: "🇦🇪" },
  { name: "Veľká Británia", code: "GB", dialCode: "+44", flag: "🇬🇧" },
  { name: "USA", code: "US", dialCode: "+1", flag: "🇺🇸" },
  { name: "Uruguaj", code: "UY", dialCode: "+598", flag: "🇺🇾" },
  { name: "Uzbekistan", code: "UZ", dialCode: "+998", flag: "🇺🇿" },
  { name: "Vanuatu", code: "VU", dialCode: "+678", flag: "🇻🇺" },
  { name: "Vatikán", code: "VA", dialCode: "+379", flag: "🇻🇦" },
  { name: "Venezuela", code: "VE", dialCode: "+58", flag: "🇻🇪" },
  { name: "Vietnam", code: "VN", dialCode: "+84", flag: "🇻🇳" },
  { name: "Wallis a Futuna", code: "WF", dialCode: "+681", flag: "🇼🇫" },
  { name: "Jemen", code: "YE", dialCode: "+967", flag: "🇾🇪" },
  { name: "Zambia", code: "ZM", dialCode: "+260", flag: "🇿🇲" },
  { name: "Zimbabwe", code: "ZW", dialCode: "+263", flag: "🇿🇼" },
];

function detectCountry(phone: string): Country {
  const normalized = normalizePhone(phone);
  if (normalized.startsWith('+')) {
    const sorted = [...COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
    for (const c of sorted) {
      if (normalized.startsWith(c.dialCode)) return c;
    }
  }
  return COUNTRIES.find(c => c.code === "SK")!;
}

function extractLocal(phone: string, dialCode: string): string {
  const normalized = normalizePhone(phone);
  if (normalized.startsWith(dialCode)) {
    return normalized.slice(dialCode.length).replace(/^\s+/, '');
  }
  return normalized.startsWith('+') ? normalized.slice(dialCode.length) : normalized;
}

interface PhoneInputProps {
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  "data-testid"?: string;
  disabled?: boolean;
  className?: string;
}

export function PhoneInput({ value, onChange, onBlur, placeholder, "data-testid": testId, disabled, className }: PhoneInputProps) {
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState<Country>(() => detectCountry(value));
  const [localNumber, setLocalNumber] = useState(() => extractLocal(value, detectCountry(value).dialCode));
  const [search, setSearch] = useState("");
  const prevValueRef = useRef(value);

  useEffect(() => {
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      const c = detectCountry(value);
      setCountry(c);
      setLocalNumber(extractLocal(value, c.dialCode));
    }
  }, [value]);

  const buildFull = useCallback((c: Country, local: string): string => {
    const digits = local.replace(/\D/g, '');
    if (!digits) return '';
    return `${c.dialCode}${digits}`;
  }, []);

  const handleCountrySelect = (c: Country) => {
    setCountry(c);
    setOpen(false);
    setSearch("");
    onChange(buildFull(c, localNumber));
  };

  const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalNumber(raw);
    onChange(buildFull(country, raw));
  };

  const handleBlur = () => {
    const full = buildFull(country, localNumber);
    const normalized = normalizePhone(full);
    if (normalized && normalized !== full) {
      const newCountry = detectCountry(normalized);
      const newLocal = extractLocal(normalized, newCountry.dialCode);
      setCountry(newCountry);
      setLocalNumber(newLocal);
      onChange(normalized);
    }
    onBlur?.();
  };

  const filtered = search.trim()
    ? COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dialCode.includes(search) ||
        c.code.toLowerCase().includes(search.toLowerCase())
      )
    : COUNTRIES;

  return (
    <div className={`flex gap-0 ${className ?? ''}`}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="rounded-r-none border-r-0 px-2 font-mono text-sm h-9 shrink-0 gap-1"
            data-testid={testId ? `${testId}-country` : "phone-country-trigger"}
          >
            <span className="text-base leading-none">{country.flag}</span>
            <span className="text-xs text-muted-foreground">{country.dialCode}</span>
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
            <CommandList className="max-h-64">
              <CommandEmpty>Žiadna krajina nenájdená</CommandEmpty>
              <CommandGroup>
                {filtered.map(c => (
                  <CommandItem
                    key={c.code}
                    value={c.code}
                    onSelect={() => handleCountrySelect(c)}
                    className="flex items-center gap-2 cursor-pointer"
                    data-testid={`phone-country-${c.code}`}
                  >
                    <span className="text-base">{c.flag}</span>
                    <span className="flex-1 text-sm">{c.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">{c.dialCode}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        value={localNumber}
        onChange={handleLocalChange}
        onBlur={handleBlur}
        placeholder={placeholder ?? "9XX XXX XXX"}
        disabled={disabled}
        className="rounded-l-none font-mono h-9"
        data-testid={testId ?? "phone-input"}
      />
    </div>
  );
}
