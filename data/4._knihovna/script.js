// Hlavní datová struktura pro články
let articles = [];
// Fixní kategorie podle tvého zadání
const FIXED_CATEGORIES = ['Články', 'Dokumenty', 'Texty', 'Ostatní'];

// --- Začátek kódu pro práci s IndexDB ---
const DB_NAME = 'PalpatiusKnihovnaDB'; // Unikátní název DB pro tento modul
const DB_VERSION = 1;
let db;

/**
 * Otevře IndexedDB databázi. Pokud neexistuje, vytvoří ji a vytvoří object store.
 * @returns {Promise<IDBDatabase>} Vrátí Promise s databázovým objektem.
 */
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('knihovnaData')) {
                db.createObjectStore('knihovnaData', { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('IndexedDB databáze Palpatius-Knihovna byla úspěšně otevřena.');
            resolve(db);
        };

        request.onerror = (event) => {
            console.error("IndexedDB chyba:", event.target.error);
            showCustomModal('Nepodařilo se otevřít databázi. Data nebudou automaticky ukládána.', 'Chyba databáze');
            reject(event.target.error);
        };
    });
}

/**
 * Načte data z databáze a nahradí jimi aktuální globální proměnnou 'articles'.
 * @returns {Promise<void>}
 */
async function loadDataFromDB() {
    if (!db) {
        await openDatabase();
    }
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['knihovnaData'], 'readonly');
        const store = transaction.objectStore('knihovnaData');
        const request = store.get('currentData'); // Používáme fixní klíč

        request.onsuccess = (event) => {
            if (request.result) {
                articles = request.result.data; // Načteme pole článků
                console.log('Data knihovny byla úspěšně načtena z lokálního úložiště.');
            }
            resolve();
        };

        request.onerror = (event) => {
            console.error("Chyba při čtení z databáze:", event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * Uloží aktuální globální data (pole 'articles') do IndexedDB.
 */
function saveDataToDB() {
    if (!db) {
        console.error("Databáze není otevřena.");
        return;
    }
    const transaction = db.transaction(['knihovnaData'], 'readwrite');
    const store = transaction.objectStore('knihovnaData');
    const dataToSave = {
        id: 'currentData', // Vždy ukládáme pod stejným klíčem
        data: articles // Ukládáme celé pole článků
    };
    const request = store.put(dataToSave);

    request.onsuccess = () => {
        console.log('Data knihovny byla automaticky uložena.');
    };

    request.onerror = (event) => {
        console.error('Chyba při ukládání dat knihovny do IndexedDB:', event.target.error);
        showCustomModal('Kritická chyba! Data se nepodařilo automaticky uložit. Doporučujeme okamžitě exportovat data ručně a obnovit stránku.', 'Chyba ukládání');
    };
}


/**
 * Automatické ukládání dat po každé změně.
 */
function autoSave() {
    saveDataToDB();
}

// --- Konec kódu pro práci s IndexDB ---

let currentFilterCategory = 'all'; // Pro filtrování podle kategorií
let sortStates = {}; // Pro řazení tabulky
let activeFormId = null; // Pro přepínání formuláře
let currentEditingId = null; // ID článku, který se právě upravuje

/**
 * Otevře/zavře formulář
 * @param {string} formId ID formuláře
 */
function toggleForm(formId) {
    const targetForm = document.getElementById(formId);
    if (activeFormId === formId) {
        targetForm.classList.add('hidden');
        document.querySelector(`button[aria-controls="${formId}"]`).setAttribute('aria-expanded', 'false');
        activeFormId = null;
    } else {
        document.querySelectorAll('.form-section').forEach(form => {
            if (form.id !== formId) {
                form.classList.add('hidden');
                document.querySelector(`button[aria-controls="${form.id}"]`)?.setAttribute('aria-expanded', 'false');
            }
        });
        targetForm.classList.remove('hidden');
        document.querySelector(`button[aria-controls="${formId}"]`).setAttribute('aria-expanded', 'true');
        activeFormId = formId;
        targetForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        // Pokud je to formulář článku, fokusujeme první input
        if (formId === 'articleFormSection') {
             targetForm.querySelector('input, textarea, select')?.focus();
        }
    }
}

/**
 * Zobrazí formulář pro přidání nebo editaci článku.
 * @param {number | null} id ID článku pro editaci, nebo null pro nový.
 */
function showArticleForm(id) {
    currentEditingId = id;
    const form = document.getElementById('articleFormSection');
    const titleEl = document.getElementById('articleTitle');
    const categoryEl = document.getElementById('articleCategory');
    const contentEl = document.getElementById('articleContent');
    const formTitle = document.getElementById('formTitle');
    const submitButton = document.getElementById('formSubmitButton');

    if (id === null) {
        // Režim "Přidat nový"
        formTitle.textContent = 'Přidat nový text';
        submitButton.textContent = 'Uložit text';
        titleEl.value = '';
        categoryEl.value = 'Články'; // Výchozí kategorie
        contentEl.value = '';
    } else {
        // Režim "Upravit"
        const article = articles.find(a => a.id === id);
        if (article) {
            formTitle.textContent = 'Upravit text';
            submitButton.textContent = 'Uložit změny';
            titleEl.value = article.title;
            categoryEl.value = article.category;
            contentEl.value = article.content;
        } else {
            // Pojistka, kdyby článek nebyl nalezen
            showCustomModal('Chyba: Článek pro úpravu nebyl nalezen.', 'Chyba');
            return;
        }
    }
    
    // Otevřeme formulář, pokud ještě není otevřený
    if (activeFormId !== 'articleFormSection') {
        toggleForm('articleFormSection');
    }
    titleEl.focus();
}

/**
 * Zpracuje odeslání formuláře (přidání nebo editace).
 */
function handleSubmitArticle() {
    const title = document.getElementById('articleTitle').value.trim();
    const category = document.getElementById('articleCategory').value;
    const content = document.getElementById('articleContent').value.trim();

    if (!title || !content) {
        showCustomModal('Prosím, vyplňte název i obsah textu.', 'Chyba');
        return;
    }

    if (currentEditingId === null) {
        // Přidání nového článku
        const newArticle = {
            id: Date.now(),
            title: title,
            category: category,
            content: content
        };
        articles.push(newArticle);
    } else {
        // Úprava existujícího
        const article = articles.find(a => a.id === currentEditingId);
        if (article) {
            article.title = title;
            article.category = category;
            article.content = content;
        }
    }
    
    currentEditingId = null; // Resetujeme ID
    autoSave();
    updateTable();
    toggleForm('articleFormSection'); // Zavřeme formulář
}

/**
 * Zobrazí modál s obsahem článku.
 * @param {number} id ID článku
 */
function viewArticle(id) {
    const article = articles.find(a => a.id === id);
    if (article) {
        // Použijeme <pre> tag pro zachování formátování (nové řádky) a omezenou výšku
        const contentHtml = `<div style="max-height: 50vh; overflow-y: auto; background: #111; padding: 10px; border-radius: 5px;"><pre style="white-space: pre-wrap; word-wrap: break-word; color: #fff;">${article.content}</pre></div>`;
        showCustomModal(contentHtml, `Obsah: ${article.title}`, null, false);
    }
}

/**
 * Potvrdí a smaže položku.
 * @param {number} id ID článku
 */
function confirmAndDeleteItem(id) {
    showCustomModal('Opravdu chcete odstranit tento text?', 'Potvrdit smazání', () => {
        doDeleteItem(id);
    }, true);
}

/**
 * Provede smazání položky.
 * @param {number} id ID článku
 */
function doDeleteItem(id) {
    articles = articles.filter(item => item.id !== id);
    closeModal('customMessageModal');
    updateTable();
    autoSave();
}

/**
 * Řadí tabulku.
 * @param {string} tableId ID tabulky
 * @param {string} sortKey Klíč, podle kterého se řadí
 */
function sortTable(tableId, sortKey) {
    const table = document.getElementById(tableId);
    const headers = table.querySelectorAll('th[data-sort]');
    headers.forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'));
    
    const currentHeader = table.querySelector(`th[data-sort="${sortKey}"]`);
    
    if (!sortStates[tableId] || sortStates[tableId].key !== sortKey) {
        sortStates[tableId] = { key: sortKey, direction: 'asc' };
    } else {
        sortStates[tableId].direction = sortStates[tableId].direction === 'asc' ? 'desc' : 'asc';
    }
    
    currentHeader.classList.add(`sorted-${sortStates[tableId].direction}`);
    updateTable();
}

/**
 * Aktualizuje a překreslí hlavní tabulku.
 */
function updateTable() {
    const tbody = document.querySelector('#mainDataTable tbody');
    tbody.innerHTML = '';
    
    const filterInput = document.getElementById('globalFilterInput').value.toLowerCase();
    
    // Filtrování
    let filteredItems = articles.filter(item => {
        // 1. Filtrování podle kategorie
        if (currentFilterCategory !== 'all' && item.category !== currentFilterCategory) {
            return false;
        }
        
        // 2. Filtrování fulltextovým vyhledáváním
        const searchable = (item.title || '') + ' ' + (item.content || '') + ' ' + (item.category || '');
        return searchable.toLowerCase().includes(filterInput);
    });
    
    // Řazení
    const sortKey = sortStates['mainDataTable'] ? sortStates['mainDataTable'].key : 'title';
    const sortDirection = sortStates['mainDataTable'] ? sortStates['mainDataTable'].direction : 'asc';
    
    const finalSortedItems = filteredItems.sort((a, b) => {
        let valA = (a[sortKey] || '').toLowerCase();
        let valB = (b[sortKey] || '').toLowerCase();
        
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    // Vykreslení řádků
    finalSortedItems.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><button class="text-left text-yellow-300 hover:text-yellow-500" onclick="viewArticle(${item.id})">${item.title}</button></td>
            <td>${item.category}</td>
            <td>
                <button class="btn-secondary" onclick="showArticleForm(${item.id})">Upravit</button>
                <button class="btn-danger" onclick="confirmAndDeleteItem(${item.id})">Smazat</button>
                <button class="btn-export" onclick="exportItemToTxt(${item.id})">Export TXT</button>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // Aktualizace tlačítek kategorií
    updateCategoryButtons();
}

/**
 * Aktualizuje tlačítka pro filtrování kategorií (podle fixního seznamu).
 */
function updateCategoryButtons() {
    const container = document.getElementById('categoryFilterButtons');
    container.innerHTML = `<button class="btn-toggle-filter ${currentFilterCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}" onclick="filterByCategory('all')">Všechny kategorie</button>`;
    
    FIXED_CATEGORIES.forEach(category => {
        const btn = document.createElement('button');
        btn.textContent = category;
        btn.className = `btn-toggle-filter ${currentFilterCategory === category ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'}`;
        btn.onclick = () => filterByCategory(category);
        container.appendChild(btn);
    });
}

/**
 * Nastaví filtr kategorie a překreslí tabulku.
 * @param {string} category Název kategorie
 */
function filterByCategory(category) {
    currentFilterCategory = category;
    updateTable(); // Překreslí tabulku a ta si sama v `updateCategoryButtons` nastaví aktivní tlačítka
}

/**
 * Vyčistí full-text filtr a filtr kategorií.
 */
function clearFilter() {
    document.getElementById('globalFilterInput').value = '';
    filterByCategory('all'); // Zavoláme filterByCategory, aby se správně resetovala i tlačítka
}

/**
 * Exportuje jeden článek jako .txt soubor.
 * @param {number} id ID článku
 */
function exportItemToTxt(id) {
    const item = articles.find(a => a.id === id);
    if (!item) return;
    
    let content = `--- Knihovna textů ---\n\n`;
    content += `Název: ${item.title}\n`;
    content += `Kategorie: ${item.category}\n`;
    content += `--------------------\n\n${item.content}\n`;
    
    const filename = item.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(content);
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", `${filename}.txt`);
    dl.click();
}

/**
 * Exportuje všechna data (pole 'articles') jako JSON.
 */
function exportAllData() {
    try {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(articles, null, 2));
        const dl = document.createElement('a');
        dl.setAttribute("href", dataStr);
        dl.setAttribute("download", "knihovna_textu.json");
        dl.click();
        showCustomModal("Všechna data knihovny byla úspěšně exportována jako JSON.", "Export dokončen");
    } catch (error) {
        console.error("Chyba při exportu JSON dat:", error);
        showCustomModal("Nastala chyba při exportu dat. Zkuste to prosím znovu.", 'Chyba exportu');
    }
}

/**
 * Importuje data z JSON souboru.
 * @param {Event} event Událost z inputu
 */
function importAllData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
        try {
            const importedData = JSON.parse(e.target.result);
            
            // Ověření, že importovaná data jsou pole
            if (Array.isArray(importedData)) {
                
                // Validace a přiřazení ID
                const validatedData = importedData.map((item, index) => ({
                    id: Number(item.id) || (Date.now() + index), // Zajistíme unikátní ID
                    title: String(item.title || 'Bez názvu'),
                    category: String(item.category || 'Ostatní'), // Použijeme "Ostatní" jako výchozí
                    content: String(item.content || '')
                }));

                articles = validatedData;
                await saveDataToDB();
                updateTable();
                showCustomModal('Data byla úspěšně importována do knihovny textů!', "Import dokončen");
            } else {
                showCustomModal('Chyba: Importovaný soubor nemá očekávaný formát (očekáváno pole článků).', 'Chyba importu');
            }
        } catch (e) {
            console.error("Chyba při čtení JSON souboru:", e);
            showCustomModal('Chyba při čtení JSON souboru: ' + e.message, 'Chyba importu');
        }
    };
    reader.readAsText(file);
    event.target.value = null;
}

// --- Nápověda ---
function openHelpModal() {
    lastFocusedElement = document.activeElement;
    const modal = document.getElementById('helpModal');
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
    modal.focus();
}

function closeHelpModal() {
    closeModal('helpModal');
}

// --- Inicializace ---

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await openDatabase();
        await loadDataFromDB();
    } catch (e) {
        console.error("Nepodařilo se načíst data z databáze.", e);
    }
    
    // Nastavení řazení tabulky
    document.querySelectorAll('th[data-sort]').forEach(header => {
        header.addEventListener('click', () => {
            const tableId = header.closest('table').id;
            const sortKey = header.getAttribute('data-sort');
            sortTable(tableId, sortKey);
        });
    });

    // Nastavení modálního okna (OK/Cancel)
    document.getElementById('modalOkButton').addEventListener('click', () => {
        if(pendingConfirmCallback) {
            pendingConfirmCallback();
        }
        closeModal('customMessageModal');
    });

    const cancelButton = document.getElementById('modalCancelButton');
    if (cancelButton) {
        cancelButton.addEventListener('click', () => closeModal('customMessageModal'));
    }

    document.getElementById('customMessageModal').addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal('customMessageModal');
    });
    
    // První vykreslení tabulky a tlačítek
    updateTable();
    filterByCategory('all'); // Zajistí zobrazení "Všechny kategorie" jako aktivní
});