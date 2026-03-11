function stripDiacritics(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

const RAW_NAMES = [
  "adam","adrián","adriana","agáta","agnes","agnesa","alan","albín","alena","ales","aleš",
  "alexander","alexandra","alexej","alfonz","alfréd","alica","alina","alojz","alžbeta",
  "amália","ambróz","amélia","anastázia","andrea","andrej","aneta","angela","angelika",
  "anna","anton","antonín","antónia","arabela","aranka","arianna","arnošt","artur","augustín",
  "aurel","aurélia","barbora","bartolomej","beáta","bedrich","belinda","benedikt","benjamin",
  "berenika","bernát","bianka","blahoslav","blanka","blažej","blažena","bohumil","bohumír",
  "bohuslav","bohuš","boleslav","bonifác","boris","bořivoj","božena","božidara","branislav",
  "branislava","brigita","bronislav","bruno","cecília","ctibor","cyril","čestmír",
  "dagmar","dalibor","damián","dana","daniel","daniela","danka","darina","dárius","dáša",
  "david","dean","denisa","denis","dezider","diana","dobromila","dobroslav","dominik",
  "dominika","donald","dorota","drahomír","drahomíra","drahoslav","dušan","dušana",
  "edit","edita","eduard","ela","elena","eleonóra","eliška","elvíra","emanuel","emília",
  "emil","emma","erik","erika","ernest","ervín","estera","etela","eugen","eugénia","eva",
  "evelína","evžen",
  "fabián","fedor","felix","ferdinand","filoména","filip","flóra","florián","františek",
  "františka","frederik","fridrich",
  "gabriel","gabriela","gašpar","gertrúda","gizela","gregor","gustáv",
  "hana","hannelore","hedviga","helena","henrich","henrieta","herbert","herman","hilda",
  "hugo","hubert",
  "ida","ignác","igor","ilona","imrich","inéz","ingrid","irena","irina","ivan","ivana",
  "iveta","ivo","ivona",
  "jacek","jakub","ján","jana","janka","jarolím","jaromír","jaroslav","jaroslava",
  "jasna","jela","jerguš","jiří","jiřina","joachim","joana","jozef","jozefína",
  "judita","julián","juliana","juliána","julius","juraj","justína",
  "kamil","kamila","karel","karína","karol","karolína","karina","katarína","kazimír",
  "kevin","klára","klaudia","klaudius","klément","koloman","konštantín","kornélia",
  "kornel","kristián","kristína","krištof","kvetoslava","kvetoslav",
  "ladislav","laura","laura","lea","lenka","leo","leon","leonardo","leontína","leopold",
  "lesia","libuša","lída","lídia","liliana","linda","lívia","lorenz","lucia","lucián",
  "luciana","lucie","ľubica","ľubomír","ľubomíra","ľuboš","ľudmila","ľudovít","lukáš",
  "lumír",
  "macej","magdaléna","mahuliena","maja","malvína","mária","marián","marianna","marika",
  "marina","márius","mário","maroš","marta","martin","martina","matej","matilda","matuš",
  "maximilián","medard","melinda","metod","michal","michaela","mikuláš","milan","milana",
  "milena","milica","miloš","miloslav","miloslava","milota","mira","miriam","mirko",
  "miroslav","miroslava","mojmír","monika","mária",
  "naďa","nataša","natália","natálie","nela","nikola","nikolas","nikoleta","nina","nora",
  "norbert",
  "oldrich","oleg","olga","oliver","ondrej","oskar","otakar","otília","otto",
  "pankrác","patrícia","patrik","paul","pavla","pavlína","pavol","peter","petra",
  "petronela","pius",
  "radek","radim","radislav","radka","radko","radmila","radomír","radoslav","radovan",
  "radúz","rafael","raja","rastislav","rebeka","regina","renáta","rené","richard",
  "rita","robert","roberta","robin","roland","roman","romana","romeo","rostislav",
  "rovena","rozália","rudolf","rút","ružena",
  "sabína","samuel","sandra","sára","šarlota","šebestián","servác","silvia","silvester",
  "simeon","simona","simon","šimon","slavomír","slavomíra","soňa","sofia","stanislav",
  "stanislava","stela","štefan","štefánia","svetlana","svätopluk",
  "tamara","taťána","tatiana","teodor","terézia","tibor","timea","timotej","tobiáš",
  "tomáš","toňa",
  "urban",
  "václav","valentín","valentína","valéria","valér","vanda","vanesa","vasil","vavrinec",
  "vendula","veronika","viera","vieroslava","viktor","viktória","viliam","vilma",
  "vincent","viola","virgínia","vít","vítězslav","vladan","vladimír","vladimíra",
  "vladislav","vlasta","vlastimil","vojtech","vratislav",
  "xénia",
  "zdenka","zdenko","žaneta","želmíra","zita","zlatica","zlata","zoja","zoltán","zora",
  "zuzana","žofia"
];

const SK_CZ_FIRST_NAMES = new Set(RAW_NAMES.map(stripDiacritics));

const TITLES_BEFORE = [
  "prof.", "doc.",
  "ing. arch.", "mgr. art.",
  "mudr.", "mddr.", "mvdr.",
  "phdr.", "rndr.", "pharmdr.", "judr.", "thdr.", "paeddr.",
  "ing.", "mgr.", "bc.",
];

const TITLES_AFTER = [
  "ph.d.", "phd.", "artd.", "art.d.",
  "csc.", "drsc.", "dr.sc.",
  "ll.m.", "llm",
  "mba", "msc.", "dba", "rsc.",
];

export function isFirstName(token: string): boolean {
  return SK_CZ_FIRST_NAMES.has(stripDiacritics(token));
}

export interface ParsedTitles {
  titleBefore: string;
  titleAfter: string;
  cleanName: string;
}

export function parseTitles(text: string): ParsedTitles {
  if (!text || !text.trim()) {
    return { titleBefore: "", titleAfter: "", cleanName: "" };
  }

  let working = text.trim();
  const foundBefore: string[] = [];
  const foundAfter: string[] = [];

  const sortedBefore = [...TITLES_BEFORE].sort((a, b) => b.length - a.length);
  const sortedAfter = [...TITLES_AFTER].sort((a, b) => b.length - a.length);

  let changed = true;
  while (changed) {
    changed = false;
    const lower = working.toLowerCase();

    for (const title of sortedBefore) {
      const idx = lower.indexOf(title);
      if (idx !== -1) {
        const originalTitle = working.substring(idx, idx + title.length);
        foundBefore.push(originalTitle);
        working = (working.substring(0, idx) + " " + working.substring(idx + title.length)).trim();
        changed = true;
        break;
      }
    }
  }

  changed = true;
  while (changed) {
    changed = false;
    const lower = working.toLowerCase();

    for (const title of sortedAfter) {
      const idx = lower.indexOf(title);
      if (idx !== -1) {
        const originalTitle = working.substring(idx, idx + title.length);
        foundAfter.push(originalTitle);
        working = (working.substring(0, idx) + " " + working.substring(idx + title.length)).trim();
        changed = true;
        break;
      }
    }
  }

  working = working.replace(/,/g, " ").replace(/\s+/g, " ").trim();

  return {
    titleBefore: foundBefore.join(" "),
    titleAfter: foundAfter.join(" "),
    cleanName: working,
  };
}

export interface AmbiguousNameResult {
  ambiguous: boolean;
  firstName: string;
  lastName: string;
}

export function detectAmbiguousName(firstName: string | null, lastName: string | null): AmbiguousNameResult {
  const fn = (firstName || "").trim();
  const ln = (lastName || "").trim();

  if (!fn || !ln) {
    return { ambiguous: false, firstName: fn, lastName: ln };
  }

  const fnIsFirst = isFirstName(fn);
  const lnIsFirst = isFirstName(ln);

  return {
    ambiguous: fnIsFirst && lnIsFirst,
    firstName: fn,
    lastName: ln,
  };
}
