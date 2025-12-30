# Audit TODO – Palpatius

Tento dokument slouží jako **transparentní seznam známých technických nedostatků**, které byly identifikovány při auditu systému Palpatius, **ale nejsou v tuto chvíli řešeny**.

Důvodem není jejich bagatelizace, ale:
- omezený časový prostor,
- nutnost plného soustředění na opravy,
- snaha zachovat současnou vysokou stabilitu systému.

Palpatius je v aktuální verzi **stabilní, funkční a bezpečně použitelný**. Níže uvedené body představují **plánované úpravy**, nikoli kritické chyby vyžadující okamžitý zásah.

---

## Principy tohoto TODO seznamu

- Tento dokument **není bugtracker**.
- Body jsou řazeny podle **reálného přínosu**, nikoli akademické priority.
- Opravy budou prováděny **postupně**, v okamžiku, kdy na ně bude dostatek času a mentální kapacity.
- Cílem je **nezhoršit stabilitu systému unáhlenými zásahy**.

---

## 🟥 PRIORITA A – Opravit jako první (stabilita a data)

### 1. Ošetření importu JSON (`try...catch`)

**Moduly:**  
- Offline poznámky  
- Zálohovací nástroje

**Popis:**  
Import dat používá `JSON.parse()` bez ošetření výjimek. Při výběru nevalidního nebo poškozeného souboru může dojít k pádu skriptu a rozbití UI stavu.

**Důvod odkladu:**  
Vyžaduje klidnou práci a důkladné otestování importních scénářů.

**Poznámka:**  
Oprava bude lokální a nemění chování aplikace.

---

### 2. Zabránění záporným hodnotám (`totalMassages`)

**Modul:**  
- Masérna

**Popis:**  
Při odečítání bodů může dojít ke stavu, kdy `totalMassages` klesne pod nulu, což vede k nekonzistenci statistik.

**Důvod odkladu:**  
Nízká frekvence výskytu, žádný okamžitý dopad na běh aplikace.

---

## 🟧 PRIORITA B – Kvalita a přístupnost (řešit postupně)

### 3. Doplnění labelů / aria-label u produkčních formulářů

**Moduly:**  
- Finanční správce Extra  
- Filtrační prvky

**Popis:**  
Některé formulářové prvky postrádají explicitní popisek pro čtečky obrazovky.

**Důvod odkladu:**  
Neovlivňuje funkčnost, pouze kvalitu přístupnosti.

---

### 4. Přístupné označení skrytých `<input type="file">`

**Moduly:**  
- Zálohovací protokol  
- Offline poznámky

**Popis:**  
Skryté file inputy nejsou vždy jednoznačně pojmenovány pro asistivní technologie.

**Důvod odkladu:**  
Vyžaduje projití více modulů najednou (a11y sweep).

---

## 🟨 PRIORITA C – Zvážit v budoucnu

### 5. Robustnější práce s uživatelskými texty (`innerHTML`)

**Moduly:**  
- Masérna  
- Finanční správce

**Popis:**  
Použití `innerHTML` bez escapování může vést k rozbití DOMu při importu nekorektních dat.

**Důvod odkladu:**  
Nejde o bezpečnostní problém v kontextu offline aplikace. Řešení by mělo smysl pouze cíleně (např. při importu).

---

## Stav dokumentu

- Tento seznam je **živý dokument**.
- Body mohou být:
  - odstraněny po opravě,
  - přeřazeny,
  - nebo doplněny o nové položky.

Jeho existence znamená:
> *Ano, o těchto věcech víme. Ano, máme plán. A ano, opravy přijdou ve správný čas.*

---

**Palpatius** – vyvíjen s rozmyslem, ne ve spěchu.

