# Audit Exceptions – Palpatius

Tento dokument slouží jako **oficiální seznam vědomě neřešených nálezů**, které se mohou objevit při technickém auditu (a11y, stabilita, bezpečnost) systému **Palpatius**.

Jeho účelem je:
- vysvětlit **kontext a architekturu Palpatia**,
- odlišit **reálné chyby** od **vědomých rozhodnutí**,
- předejít opakovaným diskusím, falešným bug reportům a chybným auditním závěrům.

---

## Kontext projektu Palpatius

Palpatius je:
- **100% offline systém** (bez serveru, bez API, bez sítě),
- určený **pro jednoho uživatele** (maséra),
- běžící výhradně v lokálním prohlížeči,
- založený na HTML / CSS / JavaScript + IndexedDB.

Palpatius **není webová aplikace** v klasickém slova smyslu:
- nemá více uživatelů,
- nemá cizí vstupy z internetu,
- neřeší autentizaci, role ani síťovou bezpečnost,
- nepracuje s nedůvěryhodnými externími daty.

Z těchto důvodů **nelze na Palpatius mechanicky aplikovat běžné webové audity**, které předpokládají serverový provoz, sdílené prostředí nebo veřejný útokový vektor.

---

## 1. Použití `innerHTML` bez escapování (tzv. XSS)

**Typicky hlášeno jako:**  
XSS / HTML injection přes `innerHTML`

**Kde se vyskytuje:**  
Produkční moduly (např. Masérna, Finanční správce)

**Proč se to NEŘEŠÍ:**
- Palpatius je **offline aplikace bez cizích uživatelů**.
- Jediným zdrojem dat je **sám uživatel**.
- Neexistuje útočník, který by mohl data zneužít proti jinému uživateli.
- Neexistuje server, session, cookie ani síťový kontext.

Riziko, které zde teoreticky existuje, spočívá pouze v tom, že si uživatel **sám vloží nevhodná data**, která mohou narušit DOM. To není bezpečnostní problém, ale **otázka robustnosti dat při importu**.

**Postoj Palpatia:**  
Použití `innerHTML` je **vědomé rozhodnutí**, které zjednodušuje práci s tabulkami a dynamickým UI. Plošné escapování by vedlo ke zbytečnému znepřehlednění kódu bez reálného bezpečnostního přínosu.

**Poznámka:**  
Pokud by se v budoucnu změnil kontext (např. sdílení dat mezi uživateli), bude tato oblast znovu přehodnocena.

---

## 2. Archivní / herní zóna (legacy kód)

**Typicky hlášeno jako:**  
Chybějící a11y prvky, inline `onclick`, `<a>` bez `href`, chybějící labely

**Kde se vyskytuje:**  
`tools/Archiv/`, herní a demonstrační moduly

**Proč se to NEŘEŠÍ:**
- Tyto části **nejsou součástí produkčního systému Palpatius 2.0**.
- Slouží jako:
  - historický archiv vývoje,
  - demonstrační / sandboxová zóna,
  - technická ukázka raných fází projektu.

Nepracují s kritickými daty a nejsou součástí workflow maséra.

**Postoj Palpatia:**  
Archivní kód je **vědomě ponechán beze změn** jako dokumentace vývoje. Neodpovídá současným standardům Palpatia a **není to chyba**, ale záměr.

---

## 3. A11y nedostatky v neprodukčních částech

**Typicky hlášeno jako:**  
Button bez accessible name, chybějící label, focus management

**Kde se vyskytuje:**  
Archiv, herní moduly, interní nástroje mimo hlavní workflow

**Proč se to NEŘEŠÍ:**
- Tyto části nejsou určeny pro každodenní používání.
- Nejsou součástí hlavního uživatelského toku.
- Jejich úprava by neměla žádný praktický přínos pro cílového uživatele.

**Postoj Palpatia:**  
Přístupnost je striktně dodržována v **produkčních modulech**. V archivech a legacy kódu je stav ponechán beze změn.

---

## 4. Pevná vazba HTML ↔ JavaScript (bez kontrol existence)

**Typicky hlášeno jako:**  
Možný runtime pád při chybějícím DOM prvku

**Kde se vyskytuje:**  
Produkční moduly

**Proč se to NEŘEŠÍ:**
- HTML a JS jsou v Palpatiu **vyvíjeny a verzovány společně**.
- Neexistuje scénář, kdy by se JS spouštěl nad jiným HTML.
- Nejde o dynamicky generované šablony.

Přidávání kontrol existence by zvyšovalo složitost kódu bez reálného přínosu.

**Postoj Palpatia:**  
Jedná se o **vědomý kompromis ve prospěch čitelnosti a jednoduchosti**.

---

## 5. Použití globálních proměnných v izolovaných modulech

**Typicky hlášeno jako:**  
Riziko konfliktu globálního stavu

**Kde se vyskytuje:**  
Samostatné moduly / nástroje

**Proč se to NEŘEŠÍ:**
- Každý modul běží **na vlastní HTML stránce**.
- Neexistuje sdílený runtime mezi moduly.
- Globální proměnné jsou izolované kontextem stránky.

**Postoj Palpatia:**  
Použití globálního stavu je v tomto kontextu **bezpečné a přehledné**.

---

## Závěrečné shrnutí

Tento dokument deklaruje, že:
- uvedené body **nejsou přehlédnuté chyby**,
- jedná se o **vědomá technická rozhodnutí**,
- jsou plně v souladu s architekturou a filozofií Palpatia.

Pokud se v budoucnu změní kontext projektu (online režim, více uživatelů, sdílení dat), bude tento dokument aktualizován a jednotlivé body znovu posouzeny.

---

**Palpatius** – stabilní, offline, pod kontrolou uživatele.

