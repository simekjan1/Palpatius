# Volitelná vylepšení – interní checklist

Tento dokument **není plán**, **není roadmapa** a **není seznam povinností**.

Slouží pouze jako:
- souhrn **možných vylepšení**, která se objevila při nezávislé analýze projektu,
- inspirace pro budoucí úpravy,
- připomínka nápadů, ke kterým se lze kdykoliv vrátit.

Nic z tohoto seznamu:
- se **nemusí** implementovat,
- nemá prioritu,
- nemá termín,
- nemá závaznost.

Checklist lze:
- použít,
- odložit,
- ignorovat,
- nebo klidně celý smazat.

Projekt Palpatius je funkční a stabilní i bez těchto bodů.

---

## 1. Architektura a navigace (volitelně)

☐ Zvážit jemné sjednocení navigace mezi moduly  
☐ Zvážit vizuální konzistenci přechodů mezi moduly  
☐ Zvážit drobné zlepšení orientace při přepínání kontextu

Poznámka:  
Modularita a samostatnost modulů je **záměrná**.  
Jakékoliv úpravy musí zachovat:
- stabilitu,
- přístupnost,
- izolaci chyb.

---

## 2. Uživatelský prožitek (UX) – pouze pokud dává smysl

☐ Zvážit drobné zjemnění interakcí bez zásahu do logiky  
☐ Zvážit drobné úpravy textů pro větší srozumitelnost  
☐ Zvážit zlepšení čitelnosti stávajících prvků

Poznámka:  
Plynulost je druhotná.  
Přednost má:
- předvídatelnost,
- klid,
- konzistentní chování.

---

## 3. Přístupnost (dlouhodobě sledovat)

☐ Průběžně kontrolovat ovládání klávesnicí  
☐ Průběžně testovat se čtečkami obrazovky  
☐ Zvážit drobná zlepšení ARIA popisků tam, kde to dává smysl

Poznámka:  
Přístupnost není jednorázový úkol, ale **dlouhodobý postoj**.

---

## 4. Zálohování a práce s daty (bez změny principů)

☐ Zvážit lepší popis existujících zálohovacích mechanismů  
☐ Zvážit jemné zpřehlednění informací o stavu záloh  
☐ Zvážit drobná vysvětlení bez centralizace funkcí

Poznámka:  
Vícevrstvé zálohování je **záměrné**.  
Cílem není zjednodušovat, ale **chránit data**.

---

## 5. Dokumentace a kontext (volitelné)

☐ Zvážit drobné zpřesnění technické dokumentace  
☐ Zvážit doplnění vysvětlení některých rozhodnutí  
☐ Zvážit odkazování na filozofii projektu tam, kde to dává smysl

Poznámka:  
Příběh projektu patří do dokumentace, ne do samotného nástroje.

---

## 6. Dlouhodobá údržba

☐ Průběžně sledovat konzistenci kódu  
☐ Průběžně odstraňovat drobné technické nepřesnosti  
☐ Udržovat stabilní chování napříč verzemi

Poznámka:  
Cílem není růst.  
Cílem je **spolehlivost v čase**.

---

## Závěrem

Tento checklist je pouze **pomocný nástroj pro autora**.

Nevytváří tlak.
Nevytváří závazky.
Nevytváří očekávání.

Slouží jen jako:
> „Tady jsou možnosti, kdybys někdy chtěl.“

A to je celé.
