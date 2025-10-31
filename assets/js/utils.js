// =================================================================
// PALPATIUS DATA UTILITIES (utils.js) - ROBUSTNÍ VERZE
// Tento soubor obsahuje sdílené pomocné funkce pro práci s daty.
// ZMĚNA: Funkce nyní vrací `null` v případě chyby, aby se zabránilo
// tichému selhání a šíření neplatných dat.
// =================================================================

/**
 * Formátuje datum z "DD.MM.YYYY" na "YYYY-MM-DD" pro <input type="date">.
 * @param {string} dateString Datum ve formátu "DD.MM.YYYY".
 * @returns {string|null} Datum ve formátu "YYYY-MM-DD" nebo null při chybě.
 */
function formatDateForInput(dateString) {
    if (!dateString) return ''; // Prázdný vstup není chyba, vracíme prázdný řetězec
    
    const parts = dateString.split('.');
    
    // ZMĚNA: Přísnější kontrola formátu
    if (parts.length === 3 && parts[0].length >= 1 && parts[1].length >= 1 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    
    // ZMĚNA: Logování chyby a návrat null
    console.error(`[utils.js] formatDateForInput: Neplatný formát data (očekáváno DD.MM.YYYY): ${dateString}`);
    return null;
}

/**
 * Parsování data z "YYYY-MM-DD" na "DD.MM.YYYY" pro uložení.
 * @param {string} dateString Datum ve formátu "YYYY-MM-DD".
 * @returns {string|null} Datum ve formátu "DD.MM.YYYY" nebo null při chybě.
 */
function parseDateFromInput(dateString) {
    if (!dateString) return ''; // Prázdný vstup není chyba
    
    const parts = dateString.split('-');
    
    // ZMĚNA: Přísnější kontrola formátu
    if (parts.length === 3 && parts[0].length === 4 && parts[1].length >= 1 && parts[2].length >= 1) {
        return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }

    // ZMĚNA: Logování chyby a návrat null
    console.error(`[utils.js] parseDateFromInput: Neplatný formát data (očekáváno YYYY-MM-DD): ${dateString}`);
    return null;
}

/**
 * Získá z data řetězec ve formátu "YYYY-MM".
 * @param {string} dateString Datum ve formátu "DD.MM.YYYY".
 * @returns {string|null} Řetězec ve formátu "YYYY-MM" nebo null při chybě.
 */
function getYearMonth(dateString) {
    if (!dateString) return ''; // Prázdný vstup není chyba

    const parts = dateString.split('.');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}`;
    }

    // ZMĚNA: Logování chyby a návrat null (místo tichého '')
    console.error(`[utils.js] getYearMonth: Neplatný formát data (očekáváno DD.MM.YYYY): ${dateString}`);
    return null;
}

/**
 * Získá z data řetězec s rokem "YYYY".
 * @param {string} dateString Datum ve formátu "DD.MM.YYYY".
 * @returns {string|null} Řetězec s rokem "YYYY" nebo null při chybě.
 */
function getYear(dateString) {
    if (!dateString) return ''; // Prázdný vstup není chyba

    const parts = dateString.split('.');
    if (parts.length === 3) {
        return parts[2];
    }

    // ZMĚNA: Logování chyby a návrat null (místo tichého '')
    console.error(`[utils.js] getYear: Neplatný formát data (očekáváno DD.MM.YYYY): ${dateString}`);
    return null;
}

/**
 * Vypočítá datum expirace (přidá jeden rok).
 * @param {string} issueDateStr Datum vydání ve formátu "DD.MM.YYYY".
 * @returns {string|null} Datum expirace ve formátu "DD.MM.YYYY" nebo null při chybě.
 */
function calculateExpiryDate(issueDateStr) {
    if (!issueDateStr) return ''; // Prázdný vstup není chyba

    const parts = issueDateStr.split('.');
    if (parts.length !== 3) {
        // ZMĚNA: Logování chyby a návrat null
        console.error(`[utils.js] calculateExpiryDate: Neplatný formát data (očekáváno DD.MM.YYYY): ${issueDateStr}`);
        return null;
    }

    try {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Měsíce jsou 0-indexované
        const year = parseInt(parts[2], 10);

        // ZMĚNA: Přidána kontrola, zda jsou části platná čísla
        if (isNaN(day) || isNaN(month) || isNaN(year)) {
            console.error(`[utils.js] calculateExpiryDate: Neplatný formát data (části nejsou čísla): ${issueDateStr}`);
            return null;
        }

        const date = new Date(year, month, day);

        // ZMĚNA: Vylepšená kontrola platnosti data (např. 30.02.2024)
        if (isNaN(date.getTime()) || date.getDate() !== day || date.getMonth() !== month || date.getFullYear() !== year) {
            console.error(`[utils.js] calculateExpiryDate: Neplatné datum (např. 30. února): ${issueDateStr}`);
            return null; 
        }

        date.setFullYear(date.getFullYear() + 1);

        const expDay = String(date.getDate()).padStart(2, '0');
        const expMonth = String(date.getMonth() + 1).padStart(2, '0');
        const expYear = date.getFullYear();

        return `${expDay}.${expMonth}.${expYear}`;
    } catch (error) {
        // ZMĚNA: Logování chyby a návrat null
        console.error(`[utils.js] calculateExpiryDate: Neočekávaná chyba při výpočtu data expirace pro: ${issueDateStr}`, error);
        return null;
    }
}