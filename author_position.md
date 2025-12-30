# Postoj autora k systému Palpatius

Tento dokument vyjadřuje **oficiální a osobní postoj autora** k projektu Palpatius. Slouží jako kontext pro uživatele, vývojáře i přispěvatele a vysvětluje, **v jakém stavu se projekt nachází, kam směřuje – a kam už ne**.

---

## Stav projektu

Palpatius je v tuto chvíli **kompletně hotový systém**.

- Obsahuje veškerou funkcionalitu, kterou autor potřeboval pro každodenní masérskou praxi.
- Autor si je vědom existence několika drobných nedostatků, ty však **nijak neohrožují stabilitu ani funkčnost systému**.
- Palpatius je **spolehlivě použitelný**, ověřený dlouhodobým reálným provozem.

Autor Palpatius **aktivně používá jako součást svého každodenního workflow**. Systém mu denně pomáhá v práci a plní svůj účel.

---

## Struktura projektu

Palpatius je rozdělen do tří hlavních částí:

### 1. `assets/`
Základní stavební kameny systému.

- společné styly,
- sdílená JavaScript logika,
- funkce používané napříč všemi moduly.

Tato část zajišťuje **jednotnost, stabilitu a konzistenci** celého systému.

---

### 2. `data/`
Produkční moduly Palpatia.

- stabilní,
- hotové,
- plně funkční.

Moduly v této složce tvoří **jádro systému** a jsou navrženy tak, aby spolu logicky fungovaly jako jeden celek.

---

### 3. `tools/`
Utility a pomocné nástroje.

- nejsou systémově propojené s hlavními moduly,
- nepředávají si mezi sebou data,
- nejsou určeny pro každodenní používání.

Slouží jako **občasní pomocníci**, které se mohou hodit v konkrétních situacích (exporty, experimenty, archivní nástroje).

---

## Další vývoj

### Co už se dít nebude

- Nebudou přidávány nové moduly.
  - Pět modulů je **vědomě zvolené a dostatečné množství**.
- Nebudou přidávány nové utility.
  - Stávající sada nástrojů plně pokrývá potřeby autora.
- Nebude probíhat funkční rozšiřování systému.

Vývojová fáze Palpatia je **ukončena**.

---

### Testování a audity

- Proběhlo přibližně **50 praktických testů**.
- Bylo provedeno **7 technických auditů** (stabilita, a11y, struktura).
- Nalezené nedostatky jsou zdokumentovány v souboru `AUDIT_TODO.md`.

Testovací fáze je rovněž **ukončena**.

---

## Aktuální fáze: finální ladění

Palpatius vstupuje do **poslední ladicí fáze**.

- budou řešeny pouze známé a dokumentované problémy,
- cílem je zachovat stabilitu a čitelnost kódu,
- žádné unáhlené zásahy.

Po dokončení této fáze bude Palpatius považován za **oficiálně dokončený projekt**.

---

## Výzva komunitě

Po technickém dokončení přichází **vaše chvíle**.

Autor už nedokáže nahlížet na Palpatius „čerstvýma očima“:
- strávil s ním mnoho měsíců vývoje,
- ladění,
- oprav,
- testování.

Proto vítá:
- zkoušení systému,
- snahu jej rozbít nečekanými způsoby,
- reálné používání v praxi.

Pokud:
- narazíte na chybu,
- máte relevantní nápad,
- nabídnete konstruktivní kritiku,

**dejte vědět**.

---

## Osobní poznámka autora

Palpatius vznikl původně **výhradně pro osobní potřebu autora**.

Postupem času se ukázalo, že:
- by mohl pomoci i dalším masérům,
- má smysl jej sdílet,
- stojí za to ho zveřejnit.

Proto je Palpatius:
- otevřený,
- dostupný na GitHubu,
- doplněný informačním webem.

A nyní zcela otevřeně:

> Palpatius jsem si vytvořil. Pomáhá mi. Jsem za něj vděčný.
> Pokud pomůže i vám, bude to skvělé.
> Pokud ne, je to v pořádku.
>
> I tak Palpatius plní svůj účel.

---

**Palpatius**  
Vytvořen z praxe. Ověřen životem. Sdílen dobrovolně.

