# Palpatius

Jednoduchý, spolehlivý a 100% offline systém pro maséry, navržený s důrazem na soukromí, přístupnost a stabilitu. Veškerá data jsou ukládána lokálně v prohlížeči a nikdy neopouští váš počítač.

Pro osobní příběh o vzniku projektu navštivte soubor [`docs/AUTOR.md`](./docs/AUTOR.md).

## Klíčové vlastnosti

* **100% Offline:** Vše funguje bez nutnosti připojení k internetu.
* **Soukromí na prvním místě:** Všechna data jsou uložena bezpečně jen ve vašem prohlížeči pomocí IndexedDB.
* **Nulová instalace:** Stačí otevřít soubor `index.html` a systém okamžitě běží.
* **Modulární architektura:** Přehledná struktura kódu rozdělená do samostatných modulů.
* **Důraz na přístupnost (A11y):** Plně ovladatelné klávesnicí a optimalizované pro čtečky obrazovky.
* **Bonusová hra:** Obsahuje plně funkční hru Blackjack jako samostatnou bonusovou sekci.

## Moduly

Systém je rozdělen do několika samostatných, plně funkčních modulů:
* **Masérna:** Jádro systému pro kompletní správu klientů, jejich návštěv, historie masáží, věrnostního programu a poukazů.
* **Finanční správce:** Nástroj pro evidenci příjmů, výdajů a správu skladových zásob. Poskytuje měsíční a roční finanční přehledy.
* **Záznamník:** Univerzální poznámkový blok pro záznam poznámek, úkolů a nápadů, které lze volitelně propojit s klienty.
* **Blackjack (Bonus):** Samostatná a plně funkční hra Blackjack, integrovaná pro odreagování.

---

## Technický přehled a pravidla pro údržbu

Tato sekce je určena pro vývoj a budoucí údržbu projektu.

### Použité technologie a architektura

* **Jazyky:** HTML5, CSS3, Vanilla JavaScript (ES6+)
* **Stylování:** Tailwind CSS (lokálně uložený JIT engine pro zajištění offline funkčnosti)
* **Ukládání dat:** IndexedDB API
* **Architektura:** Projekt má modulární strukturu. Každý modul (`data/nazev-modulu/`) je soběstačná jednotka. Sdílené funkce jsou centralizovány ve složce `assets/js/` (`ui.js` pro rozhraní, `utils.js` pro data).

palpatius/
├── assets/
│   └── js/
│       ├── ui.js
│       ├── utils.js
│       └── tailwind.js
├── data/
│   └── (složky modulů)
├── docs/
│   ├── AUTOR.md
│   └── NOTICE
├── index.html
└── README.md  (TENTO SOUBOR)

### Zlatá Pravidla Projektu (Nesmí být nikdy porušena)

* **Pravidlo 0: ZACHOVÁNÍ FUNKCIONALITY.** Opravy nesmí změnit nebo zhoršit stávající uživatelské funkce.
* **Pravidlo 1: PŘÍSTUPNOST PŘEDEVŠÍM.** Vše musí zůstat plně přístupné pro klávesnici a čtečky.
* **Pravidlo 2: STABILITA SYSTÉMU.** Zásah do jednoho modulu nesmí rozbít jinou část aplikace.
* **Pravidlo 3: KVALITA KÓDU.** Kód musí být čistý, přehledný a komentovaný v češtině.
* **Pravidlo 4: LOKÁLNÍ PROVÁZANOST.** Musí být zachována funkční vazba mezi `index.html`, `script.js` a `style.css` v rámci každého modulu.

### Audit Kvality (Kontrolní seznam před dokončením úprav)

1.  **Validace Vstupů:** Nechybí ve formulářích validační atributy (`required`, `pattern`)?
2.  **Ošetření Dat:** Je veškerá práce s IndexedDB a Import/Export v bloku `try...catch`?
3.  **Přístupnost (A11y):** Funguje správně focus management a jsou ARIA atributy na svém místě?
4.  **Konzistence Názvů:** Respektují nové proměnné a funkce stávající styl pojmenování?
5.  **Lokální Provázanost:** Nerozbila změna v `script.js` něco, co je definováno v `index.html` daného modulu?
