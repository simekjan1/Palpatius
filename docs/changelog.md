## [2.0.0] – 2025-12-11
### Novinky
- Přidán zcela nový modul **Finanční správce Extra (FS Extra)** fungující jako sandbox s vlastní IndexedDB.
- Zaveden nový sjednocený vzhled všech modulů:
  - tmavý režim Palpatius,
  - card layout,
  - sjednocené typografické styly,
  - modernizovaná tlačítka a tabulky.
- Všechny sekce v FS Extra nyní podporují *rozbalování/sbalování* (collapsible sections).

### Funkční rozšíření
- V FS Extra lze nyní:
  - definovat platební kanály (percentuální + fixní poplatky),
  - přiřazovat kanály k transakcím,
  - počítat netto hodnoty,
  - filtrovat transakce (pending/done),
  - generovat přehledy a souhrny,
  - exportovat a importovat kompletní databázi.

### Technické změny
- Nová sandbox architektura bez závislostí na globálním jádru Palpatius.
- Zjednodušený přístup k IndexedDB a oddělení datových vrstev.
- Odstranění starého kódu a refaktor DB logiky.
- Základ pro budoucí globální navigační lištu.

### Opravy
- Opraveno přiřazování kanálů, vykreslování dialogů a výpočet netto částek.
- Vyřešen problém s neviditelným / prázdným modálem.
- Vyčištění UI chyb, opravy filtrů a inicializačních sekcí.

---

# Palpatius 2.0
Modulární offline systém pro maséry.  
Běží kompletně v prohlížeči, ukládá data do IndexedDB a nevyžaduje internet.

## 🧩 Moduly
Palpatius obsahuje pět hlavních modulů:

1. **Rezervace**  
   Správa termínů a plánování masáží.

2. **Klienti**  
   Klientská databáze, historie návštěv, kontaktů a poznámek.

3. **Docházka**  
   Evidence odpracovaných dnů a hodin.

4. **Finanční správce**  
   Hlavní finanční modul zaznamenávající příjmy a výdaje.

5. **Finanční správce Extra (FS Extra)**  
   Nový sandbox modul pro detailní rozbor příjmů, poplatků a kanálů.

## 🚀 Novinky ve verzi 2.0
- Nový modul **FS Extra** s vlastním datastore.
- Nový tmavý UI styl a sjednocené rozhraní aplikace.
- Přidány collapsible sekce pro přehlednější práci.
- Export/import databáze (JSON).
- Modernizované tabulky, formuláře a tlačítka.

## 📦 Offline architektura
- Všechna data se ukládají do IndexedDB.
- Žádná komunikace se serverem.
- Aplikace funguje 100 % offline.
