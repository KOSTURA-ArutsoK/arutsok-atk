export const PRIORITY_COUNTRIES = [
  "Slovenská republika",
  "Česká republika",
  "Rakúsko",
  "Maďarsko",
  "Poľsko",
  "Ukrajina",
  "Nemecko",
];

export const ALL_COUNTRIES = [
  "Afganistan", "Albánsko", "Alžírsko", "Andorra", "Angola", "Antigua a Barbuda",
  "Argentína", "Arménsko", "Austrália", "Azerbajdžan", "Bahamy", "Bahrajn",
  "Bangladéš", "Barbados", "Belgicko", "Belize", "Benin", "Bhutan", "Bielorusko",
  "Bolívia", "Bosna a Hercegovina", "Botswana", "Brazília", "Brunei", "Bulharsko",
  "Burkina Faso", "Burundi", "Cyprus", "Čad", "Čierna Hora", "Čile", "Čína",
  "Česká republika", "Dánsko", "Dominika", "Dominikánska republika", "Džibutsko",
  "Egypt", "Ekvádor", "Eritrea", "Estónsko", "Eswatini (Svazijsko)", "Etiópia",
  "Fidži", "Filipíny", "Fínsko", "Francúzsko", "Gabon", "Gambia", "Ghana",
  "Grenada", "Grécko", "Gruzínsko", "Guatemala", "Guinea", "Guinea-Bissau",
  "Guyana", "Haiti", "Holandsko", "Honduras", "Chorvátsko", "India", "Indonézia",
  "Irak", "Irán", "Írsko", "Island", "Izrael", "Jamajka", "Japonsko", "Jemen",
  "Jordánsko", "Južná Afrika", "Južný Sudán", "Kambodža", "Kamerun", "Kanada",
  "Kapverdy", "Katar", "Kazachstan", "Keňa", "Kirgizsko", "Kiribati", "Kolumbia",
  "Komory", "Kongo (Dem. rep.)", "Kongo (Rep.)", "Kórejská ľudovodemokratická republika",
  "Kórejská republika", "Kostarika", "Kuba", "Kuvajt", "Laos", "Lesotho",
  "Libanon", "Libéria", "Líbya", "Lichtenštajnsko", "Litva", "Lotyšsko",
  "Luxembursko", "Madagaskar", "Maďarsko", "Malawi", "Malajzia", "Maldivy",
  "Mali", "Malta", "Maroko", "Marshallove ostrovy", "Maurícius", "Mauritánia",
  "Mexiko", "Mikronézia", "Mjanmarsko", "Moldavsko", "Monako", "Mongolsko",
  "Mozambik", "Namíbia", "Nauru", "Nemecko", "Nepál", "Niger", "Nigéria",
  "Nikaragua", "Niue", "Nórsko", "Nový Zéland", "Omán", "Pakistan", "Palau",
  "Panama", "Papua-Nová Guinea", "Paraguaj", "Peru", "Pobrežie Slonoviny",
  "Poľsko", "Portugalsko", "Rakúsko", "Rumunsko", "Rusko", "Rwanda",
  "Salvador", "Samoa", "San Maríno", "Saudská Arábia", "Senegal",
  "Severné Macedónsko", "Seychely", "Sierra Leone", "Singapur",
  "Slovenská republika", "Slovinsko", "Somálsko", "Spojené arabské emiráty",
  "Spojené kráľovstvo", "Spojené štáty americké", "Srbsko", "Srí Lanka",
  "Stredoafrická republika", "Sudán", "Surinam", "Svätá Lucia",
  "Svätý Krištof a Nevis", "Svätý Tomáš a Princov ostrov",
  "Svätý Vincent a Grenadíny", "Sýria", "Šalamúnove ostrovy",
  "Španielsko", "Švajčiarsko", "Švédsko", "Tadžikistan", "Taiwan",
  "Taliansko", "Tanzánia", "Thajsko", "Togo", "Tonga", "Trinidad a Tobago",
  "Tunisko", "Turecko", "Turkménsko", "Tuvalu", "Uganda", "Ukrajina",
  "Uruguaj", "Uzbekistan", "Vanuatu", "Vatikán", "Venezuela", "Vietnam",
  "Východný Timor", "Zambia", "Zimbabwe",
];

export const STATE_TO_COUNTRY: Record<string, string> = {
  "Slovensko": "Slovenská republika",
  "Česko": "Česká republika",
  "Rakúsko": "Rakúsko",
  "Maďarsko": "Maďarsko",
  "Poľsko": "Poľsko",
  "Ukrajina": "Ukrajina",
  "Nemecko": "Nemecko",
};

export function getCountryOptions(activeStateName?: string | null) {
  const prioritySet = new Set(PRIORITY_COUNTRIES);
  const rest = ALL_COUNTRIES.filter(c => !prioritySet.has(c));
  return { priority: PRIORITY_COUNTRIES, rest };
}

export function getDefaultCountryForState(stateName?: string | null): string {
  if (!stateName) return "Slovenská republika";
  for (const [key, value] of Object.entries(STATE_TO_COUNTRY)) {
    if (stateName.toLowerCase().includes(key.toLowerCase())) return value;
  }
  return "Slovenská republika";
}
