# Zásady Zabezpečení (Security Policy)

## Moje Filozofie Zabezpečení

Palpatius je navržen jako **100% offline aplikace**. Tento přístup je základem mého modelu zabezpečení.

* **Žádná data na serveru:** Aplikace neběží na žádném serveru, který by zpracovával nebo ukládal data uživatelů. Veškerá komunikace probíhá pouze mezi prohlížečem uživatele a statickými soubory hostovanými na GitHub Pages.
* **Lokální úložiště:** Všechna data (klienti, finance, poznámky) jsou ukládána **výhradně lokálně** v prohlížeči uživatele pomocí technologie IndexedDB. Já (jako vývojář) ani nikdo jiný k těmto datům nemáme žádný přístup.
* **Odpovědnost za data:** Za svá data a jejich pravidelné zálohování (pomocí vestavěné funkce "Export dat") je plně odpovědný uživatel.

Z tohoto důvodu se tradiční bezpečnostní hrozby (jako úniky dat ze serveru, SQL injection, problémy s autentizací) na projekt Palpatius nevztahují.

Potenciální zranitelnosti se týkají především bezpečnosti na straně klienta (např. Cross-Site Scripting (XSS) při importu škodlivého souboru nebo chyba v kódu vedoucí k poškození lokální databáze IndexedDB).

## Podporované Verze (Supported Versions)

Palpatius je webová aplikace hostovaná na GitHub Pages. Je podporována pouze **aktuální verze** dostupná na hlavní adrese projektu.

| Verze | Podporováno |
| :--- | :--- |
| **Aktuální (main branch)** | :white_check_mark: |
| Jakákoliv starší verze | :x: |

Uživatelé vždy automaticky používají nejnovější stabilní kód, jakmile je nasazen do hlavní větve repozitáře.

## Hlášení Zranitelnosti (Reporting a Vulnerability)

Pokud objevíte jakoukoliv zranitelnost, která by mohla vést ke ztrátě dat uživatele, poškození lokální databáze nebo k útoku typu Cross-Site Scripting (XSS), budu rád, když my dáte vědět.

**Jak nahlásit problém:**

Prosím, vytvořte nové **"Issue"** přímo zde v tomto repozitáři na GitHubu.

Do popisu problému prosím uveďte co nejvíce detailů:
1.  **Kroky k replikaci:** Přesný postup, jak chybu vyvolat.
2.  **Očekávané chování:** Co se mělo stát.
3.  **Skutečné chování:** Co se stalo (včetně případných chybových hlášek z konzole).
4.  **Prostředí:** Prohlížeč a operační systém, který používáte.

Protože se jedná o projekt v režimu údržby a data nejsou centralizovaně ukládána, neočekávám kritické bezpečnostní hrozby. Na každé hlášení se ale podívám, a pokusím se jej co nejdříve vyřešit v souladu s mými **Zlatými Pravidly Projektu** (zejména Pravidlem 0: Zachování funkcionality a Pravidlem 2: Stabilita systému).
Pravidla jsou dostupná v souboru read me.md.
