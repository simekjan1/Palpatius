Test systému Palpatius: 
Obecné zásady pro testování
    • Sledovat konzoli: Otevřít vývojářské nástroje v prohlížeči (klávesa F12) a sledovat záložku "Konzole" (Console). Pokud se tam objeví nějaká červená chyba, tak ji hned napsat, případně pořídit screenshot.
    • Klávesová navigace: Co nejvíce operací zkusit provádět jen pomocí klávesnice (Tab, Shift+Tab, Enter, šipky). Kvůli testu přístupnosti.
    • Čistý start: Mezi testy jednotlivých modulů je možné v nastavení prohlížeče promazat data webu (cache a data aplikací), pro start s čistým štítem.

✅ Checklist pro Modul Masérna (001._maserna.html)
Fáze 1: Normální testování (Běžné používání)
    • Klienti:
        ◦ [ ] Přidat nového klienta (s ID i bez něj).
        ◦ [ ] Upravit existujícího klienta.
        ◦ [ ] Rozbalit a sbalit kartu klienta kliknutím na jméno.
        ◦ [ ] Ověřit, že se v detailu klienta správně zobrazují všechny podsekce (masáže, poukazy, poznámky, záznamník, věrnostní program).
        ◦ [ ] Rozbalit a sbalit každou podsekci v detailu klienta.
        ◦ [ ] Smazat klienta a ověřit, že zmizel ze seznamu.
    • Masáže:
        ◦ [ ] Přidat masáž ke klientovi pomocí našeptávače jmen.
        ◦ [ ] Ověřit, že se masáž správně přidala do historie klienta i do globální historie masáží.
        ◦ [ ] Ověřit, že se po přidání masáže odeslala transakce do Finančního správce (otevři si ho a zkontroluj).
        ◦ [ ] Upravit a smazat masáž.
    • Věrnostní program:
        ◦ [ ] Přidat klientovi bod (+1 bod).
        ◦ [ ] Odebrat klientovi bod (-1 bod).
        ◦ [ ] Přidat klientovi 9 bodů a ověřit, že se body vynulovaly a přičetl se 1 bonus.
        ◦ [ ] Nasbírat 3 bonusy a ověřit, že se přičetl 1 extra bonus.
        ◦ [ ] Zkontrolovat zobrazení stavu bodů v detailu klienta.
    • Ceník a Poukazy:
        ◦ [ ] Přidat novou položku do ceníku.
        ◦ [ ] Vytvořit nový nákup poukazu a k němu přidat individuální poukaz.
    • Filtrování a řazení:
        ◦ [ ] Vyzkoušet globální filtr (jméno, telefon, metoda...).
        ◦ [ ] Zrušit filtr a ověřit, že se zobrazí všechna data.
        ◦ [ ] Seřadit tabulku klientů podle různých sloupců (jméno, počet masáží, stav).
    • Data a nápověda:
        ◦ [ ] Exportovat všechna data do JSON souboru.
        ◦ [ ] Smazat všechna data v prohlížeči a naimportovat je zpět z JSON souboru.
        ◦ [ ] Zobrazit a zavřít okno nápovědy.
Fáze 2: Neobvyklé testování (Zkouška ohněm 🔥)
    • Vstupy:
        ◦ [ ] Zkusit přidat klienta bez jména.
        ◦ [ ] Zkusit přidat klienta s ID, které už existuje.
        ◦ [ ] Do polí pro telefon a cenu zadávat text místo čísel.
        ◦ [ ] Používat speciální znaky v názvech a poznámkách (např. " & < >).
        ◦ [ ] Zadávat extrémně dlouhé texty do všech polí.
    • Akce:
        ◦ [ ] Rychle za sebou klikat na tlačítko +1 bod u klienta.
        ◦ [ ] Smazat klienta, ke kterému jsou přiřazeny záznamy ze Záznamníku.
        ◦ [ ] Importovat poškozený nebo úplně jiný JSON soubor.
        ◦ [ ] Přidat masáž a hned ji smazat.
    • Stavy:
        ◦ [ ] Rozbalit kartu klienta, seřadit tabulku a pak kartu sbalit. Chová se to správně?
        ◦ [ ] Nechat otevřený formulář pro přidání klienta a zkusit otevřít jiný.

✅ Checklist pro Finanční správce (002._financni-spravce.html)
Fáze 1: Normální testování
    • Transakce:
        ◦ [ ] Přidat příjem a výdaj.
        ◦ [ ] Upravit a smazat transakci.
        ◦ [ ] Ověřit, že se měsíční a roční přehledy automaticky aktualizují.
    • Sklad:
        ◦ [ ] Přidat novou položku do skladu.
        ◦ [ ] Pomocí tlačítka "Upravit množství" přidat (kladné číslo) i odebrat (záporné číslo) množství.
        ◦ [ ] Klíčový test: Snížit množství položky přesně na minimum a ověřit, že se řádek zvýrazní a stav se změní na "Nízký stav!".
        ◦ [ ] Snížit množství pod minimum a ověřit to samé.
    • Filtrování a řazení:
        ◦ [ ] Vyzkoušet globální filtr na transakce i sklad.
        ◦ [ ] Seřadit tabulku skladu podle sloupce "Stav".
    • Data a nápověda:
        ◦ [ ] Exportovat a importovat data.
        ◦ [ ] Zobrazit a zavřít okno nápovědy.
Fáze 2: Neobvyklé testování
    • Vstupy:
        ◦ [ ] Zkusit přidat transakci s nulovou nebo zápornou částkou.
        ◦ [ ] Vytvořit skladovou položku s nulovým minimálním množstvím.
        ◦ [ ] Do pole "Změna množství" ve skladu zadat text.
    • Akce:
        ◦ [ ] Zkusit odebrat ze skladu víc kusů, než je k dispozici.
        ◦ [ ] Importovat JSON z jiného modulu (např. z Masérny).

✅ Checklist pro Záznamník (003._pracovni_zaznamnik.html)
Fáze 1: Normální testování
    • Záznamy:
        ◦ [ ] Přidat, upravit a smazat každý typ záznamu (Poznámka, Událost, Nápad).
        ◦ [ ] Přiřadit záznam ke klientovi z Masérny.
    • To-Do Listy:
        ◦ [ ] Vytvořit nový To-Do list.
        ◦ [ ] Otevřít detail listu a přidat do něj několik úkolů s různou prioritou.
        ◦ [ ] Označit úkol jako splněný a ověřit, že se přeškrtne.
        ◦ [ ] Vrátit se na hlavní přehled.
    • Nápady (Klíčový test):
        ◦ [ ] Přidat nový nápad.
        ◦ [ ] V modálním okně, které se objeví, zvolit "Přidat jako úkol" a ověřit, že se úkol objevil v prvním To-Do listu.
        ◦ [ ] Přidat další nápad a zvolit "Přidat do ceníku v Masérně". Otevřít Masérnu a ověřit, že se v ceníku objevila nová položka.
    • Filtrování a nápověda:
        ◦ [ ] Vyzkoušet filtrování podle typu záznamu (tlačítka Všechny, Poznámky atd.).
        ◦ [ ] Zobrazit a zavřít okno nápovědy.
Fáze 2: Neobvyklé testování
    • Vstupy:
        ◦ [ ] Přidat úkol bez textu nebo s datem v minulosti.
    • Akce:
        ◦ [ ] Zkusit převést nápad na úkol, pokud neexistuje žádný To-Do list.
        ◦ [ ] Smazat To-Do list, který obsahuje úkoly.
        ◦ [ ] Vytvořit záznam, přiřadit ho ke klientovi a poté tohoto klienta v Masérně smazat. Co se stane v Záznamníku?
