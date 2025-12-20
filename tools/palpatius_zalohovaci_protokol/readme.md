# Backup Protocols Tools

Offline nástroj pro dlouhodobě udržitelnou evidenci záloh.

Cílem projektu **backup_protocols_tools** je nabídnout jednoduchou, přehlednou a plně offline aplikaci pro správu přehledu zálohovacích médií a jejich stavů – bez cloudu, bez účtů, bez závislosti na externích službách.

Aplikace je navržena tak, aby byla:

* dlouhodobě čitelná (i za mnoho let),
* maximálně přístupná (a11y, screenreadery),
* technicky jednoduchá a robustní,
* plně funkční offline.

---

## Hlavní vlastnosti

* 🗂 Evidence zálohovacích zařízení (SSD, HDD, PC, NAS, …)
* 📝 Evidence stavů záloh v čase (historie)
* 🔄 Editace a mazání stavů
* 💾 Lokální ukládání dat pomocí **IndexedDB**
* 📤 Export kompletních dat do **JSON**
* 📥 Import dat ze zálohy (obnova při ztrátě IndexedDB)
* 🧾 Export přehledného **Markdown** souboru
* ♿ Přístupné rozhraní (ARIA, bez tabulek, čitelné pro čtečky)
* 🌐 100 % offline provoz

---

## Použití aplikace

Aplikace je tvořena třemi soubory:

* `index.html`
* `style.css`
* `app.js`

### Spuštění

1. Stáhni nebo naklonuj repozitář.
2. Otevři soubor `index.html` v moderním webovém prohlížeči.
3. Není potřeba server ani internetové připojení.

---

## Způsoby zálohy (zařízení)

Každý způsob zálohy představuje jedno zařízení nebo úložiště (např. SSD, externí disk, NAS, PC).

U každého zařízení lze evidovat:

* kategorii (SSD, HDD, PC, …),
* název,
* typ (externí / interní / virtuální),
* umístění,
* kapacitu,
* účel,
* poznámku.

Zařízení lze **deaktivovat** bez ztráty historických dat.

---

## Stavy záloh

Ke každému zařízení lze přidávat stavové záznamy.

Stav obsahuje:

* aktuální stav zálohy (OK / ČÁSTEČNĚ / NEAKTUÁLNÍ / NEZNÁMÝ),
* datum a čas poslední aktualizace,
* rozdíl vůči PC,
* změnu od minula,
* popis změny,
* poznámku.

Každý stav lze:

* upravit,
* nebo trvale smazat.

Historie stavů je zachována a přehledně zobrazena.

---

## Ukládání dat (IndexedDB)

Veškerá data jsou ukládána:

* **lokálně v prohlížeči uživatele** pomocí IndexedDB,
* bez odesílání kamkoliv na internet,
* bez cookies a bez trackingu.

⚠️ Poznámka:
Vymazání dat prohlížeče může způsobit ztrátu uložených dat.

Proto aplikace obsahuje export a import.

---

## Export a import

### Export do JSON

* obsahuje kompletní strukturu dat (zařízení + stavy),
* slouží jako **plnohodnotná záloha** aplikace,
* vhodné pro archivaci nebo přenos mezi zařízeními.

### Import z JSON

* obnoví kompletní data aplikace,
* přepíše aktuální uložená data,
* slouží jako ochrana proti ztrátě IndexedDB.

---

## Export do Markdown

Aplikace umí vytvořit přehledný Markdown soubor:

* vhodný pro dlouhodobou archivaci,
* čitelný v textových editorech,
* přístupný pro čtečky obrazovky,
* snadno upravitelný ručně.

⚠️ Ruční úpravy Markdownu **neovlivňují data v aplikaci**.

---

## Přístupnost (a11y)

Projekt klade důraz na přístupnost:

* správná struktura nadpisů,
* ARIA role a `aria-live` hlášky,
* žádné závislosti na barvě nebo ikonách,
* formuláře bez tabulek,
* plná použitelnost s klávesnicí a čtečkami obrazovky.

---

## Offline filozofie

Tento projekt:

* **nepoužívá cloud**,
* **neodesílá data**,
* **nevyžaduje účet**,
* **nevyžaduje připojení k internetu**.

Uživatel má plnou kontrolu nad svými daty.

---

## Dlouhodobá udržitelnost

Aplikace je záměrně postavena:

* bez frameworků,
* bez build nástrojů,
* bez externích závislostí.

Používá pouze:

* HTML
* CSS
* JavaScript (ES6)

Cílem je, aby aplikace fungovala a byla pochopitelná i za mnoho let.

---

## Autor

Jan Šimek

---

## Licence

Tento projekt je distribuován pod licencí **Apache License 2.0**.

Licence umožňuje:

* volné používání,
* úpravy,
* šíření,
* použití v komerčních i nekomerčních projektech,

za podmínky zachování licenčního oznámení.

Plné znění licence viz soubor `LICENSE` nebo oficiální text licence Apache 2.0.

---

*backup_protocols_tools – jednoduchá, přístupná a dlouhodobě udržitelná evidence záloh.*
