// =================================================================
// PALPATIUS MASÉRNA LOGIC (script.js)
// Tento soubor obsahuje veškerou logiku pro modul Masérna.
// =================================================================

// Globální datová struktura pro celou aplikaci Masérna
let masernaData = {
    clients: [],
    priceListItems: [],
    globalMassageHistory: [],
    voucherPurchases: []
};
let zaznamnikDataForClient = {}; // Dočasné úložiště pro záznamy ze záznamníku

// --- Začátek kódu pro práci s IndexDB (nově přidané) ---
const DB_NAME = 'palpatiusMasernaDB';
const DB_VERSION = 1;
let db;

const FINANCIAL_DB_NAME = 'palpatiusFinancialDB';
const FINANCIAL_DB_VERSION = 2;

const ZAZNAMNIK_DB_NAME = 'PalpatiusZaznamnikDB';
const ZAZNAMNIK_DB_VERSION = 1;

/**
 * Otevře IndexedDB databázi. Pokud neexistuje, vytvoří ji a object store.
 * @returns {Promise<IDBDatabase>} Promise s databázovým objektem.
 */
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('masernaData')) {
                db.createObjectStore('masernaData', { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
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
 * Načte data z databáze.
 * @returns {Promise<void>}
 */
async function loadDataFromDB() {
    if (!db) {
        await openDatabase();
    }
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['masernaData'], 'readonly');
        const store = transaction.objectStore('masernaData');
        const request = store.get('currentData');

        request.onsuccess = (event) => {
            if (request.result) {
                masernaData = request.result.data;
// === NORMALIZACE POLOŽEK CENÍKU (kvůli Záznamníku) ===
if (!Array.isArray(masernaData.priceListItems)) {
    masernaData.priceListItems = [];
}

masernaData.priceListItems.forEach(item => {
    if (!item.year) item.year = '';
    if (!item.type) item.type = '';
    if (!item.length) item.length = '';
    if (typeof item.price !== 'number') item.price = 0;
    if (typeof item.count !== 'number') item.count = 0;
    if (typeof item.total !== 'number') item.total = 0;
});

                // *** NOVÉ: Zajistíme, že všichni klienti mají data pro věrnostní program ***
                masernaData.clients.forEach(client => {
                    if (typeof client.points === 'undefined') client.points = 0;
                    if (typeof client.bonus === 'undefined') client.bonus = 0;
                    if (typeof client.extra === 'undefined') client.extra = 0;
                    if (typeof client.totalMassages === 'undefined') client.totalMassages = client.massages.length; // Odhad
                });
                showCustomModal(
'Data byla úspěšně načtena z lokálního úložiště.', 
'Načtení dat');
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
 * Uloží data do databáze.
 */
function saveDataToDB() {
    if (!db) {
        console.error("Databáze není otevřena.");
        return;
    }
    const transaction = db.transaction(['masernaData'], 'readwrite');
    const store = transaction.objectStore('masernaData');
    const dataToSave = {
        id: 'currentData',
        data: masernaData
    };
    const request = store.put(dataToSave); // Uložíme si request do proměnné

    request.onsuccess = () => {
        // Úspěch můžeme logovat, ale není třeba nic zobrazovat uživateli
        // console.log('Data úspěšně uložena do IndexedDB.');
    };

    request.onerror = (event) => {
        console.error('Chyba při ukládání dat do IndexedDB:', event.target.error);
        showCustomModal('Chyba! Data se nepodařilo automaticky uložit. Zkuste prosím exportovat data ručně a obnovit stránku.', 'Kritická chyba ukládání');
    };
}

/**
 * Automatické ukládání dat po každé změně.
 */
function autoSave() {
    saveDataToDB();
    console.log('Data byla automaticky uložena.');
}

// ------------------------------------------------------------
// NOVÁ FUNKCE – posílá vstupní data do Finančního správce
// ------------------------------------------------------------
function sendFinanceEntry(entry) {

    // Základní validace dat (proti prázdným hodnotám)
    if (!entry || typeof entry !== 'object') return;
    if (!entry.amount || !entry.date || !entry.method) return;

    const request = indexedDB.open(FINANCIAL_DB_NAME, FINANCIAL_DB_VERSION);

    request.onsuccess = (event) => {
        const db = event.target.result;

        // Později vytvoříme nový object store "rawTransactions"
        const tx = db.transaction(['financialData'], 'readwrite');
        const store = tx.objectStore('financialData');

        const getReq = store.get('currentData');

        getReq.onsuccess = () => {
            const financialData = getReq.result ? getReq.result.data : { transactions: [], rawTransactions: [] };

            // Uložení nové struktury (pro budoucí workflow)
            financialData.rawTransactions = financialData.rawTransactions || [];
            financialData.rawTransactions.push(entry);

            // ZÁROVEŇ zachováme starý záznam,
            // aby Finanční správce nepřišel o data
            financialData.transactions.push({
                id: Date.now().toString(),
                date: entry.date,
                type: 'income',
                amount: entry.amount,
                description: 'Automatický záznam – nový formát'
            });

            // Uložit zpět
            store.put({
                id: 'currentData',
                data: financialData
            });
        };
    };
}

/**
 * Odešle finanční transakci do databáze Finančního správce.
 * @param {string} date Datum transakce (formát DD.MM.RRRR).
 * @param {number} amount Částka transakce.
 * @param {string} description Popis transakce.
 */
function sendFinancialTransaction(date, amount, description) {
    const request = indexedDB.open(FINANCIAL_DB_NAME, FINANCIAL_DB_VERSION);

    request.onsuccess = (event) => {
        const financialDb = event.target.result;
        const transaction = financialDb.transaction(['financialData'], 'readwrite');
        const store = transaction.objectStore('financialData');

        const newTransaction = {
            id: Date.now().toString(),
            date: date,
            type: 'income',
            amount: amount,
            description: description
        };

        const getRequest = store.get('currentData');
        getRequest.onsuccess = () => {
            const financialData = getRequest.result ? getRequest.result.data : { transactions: [], annualMassages: {}, stockItems: [] };
            financialData.transactions.push(newTransaction);
            
            const dataToSave = {
                id: 'currentData',
                data: financialData
            };
            store.put(dataToSave);
            console.log('Finanční transakce odeslána do Finančního správce.');
        };
        getRequest.onerror = (event) => {
            console.error('Chyba při čtení dat z finanční databáze:', event.target.error);
        };
    };
    request.onerror = (event) => {
        console.error("Chyba při otevírání finanční databáze:", event.target.error);
    };
}

/**
 * NOVÁ FUNKCE: Načte záznamy ze Záznamníku pro daného klienta.
 * @param {string} clientId ID klienta.
 * @returns {Promise<Array>} Promise s polem záznamů.
 */
function loadZaznamnikRecordsForClient(clientId) {
    return new Promise((resolve) => {
        const zaznamnikRequest = indexedDB.open(ZAZNAMNIK_DB_NAME, ZAZNAMNIK_DB_VERSION);

        zaznamnikRequest.onsuccess = (event) => {
            const zaznamnikDb = event.target.result;

            // Bezpečnost: když store neexistuje, nerozbijeme Masérnu
            if (!zaznamnikDb.objectStoreNames.contains('zaznamnikData')) {
                resolve([]);
                return;
            }

            const transaction = zaznamnikDb.transaction(['zaznamnikData'], 'readonly');
            const store = transaction.objectStore('zaznamnikData');
            const getRequest = store.get('currentData');

            getRequest.onsuccess = () => {
                const zaznamnikData = getRequest.result
                    ? getRequest.result.data
                    : { notes: [], todos: [], events: [], ideas: [] };

                const allRecords = [];

                // Poznámky / události / nápady
                allRecords.push(...(zaznamnikData.notes || []));
                allRecords.push(...(zaznamnikData.events || []));
                allRecords.push(...(zaznamnikData.ideas || []));

                // Úkoly v todo seznamech
                (zaznamnikData.todos || []).forEach(todoList => {
                    allRecords.push(...(todoList.tasks || []));
                });

                const clientRecords = allRecords.filter(r => r && r.clientId === clientId);
                resolve(clientRecords);
            };

            getRequest.onerror = () => resolve([]);
        };

        zaznamnikRequest.onerror = () => resolve([]);
    });
}

// --- Konec kódu pro práci s IndexDB ---

/**
* Otevře modální okno s nápovědou.
*/
function openHelpModal() {
    lastFocusedElement = document.activeElement;
    const modal = document.getElementById('helpModal');
    modal.classList.remove('hidden');
    modal.style.display = 'flex'; // Použijeme flex pro centrování
    modal.focus();
}

/**
* Zavře modální okno s nápovědou.
*/
function closeHelpModal() {
    const modal = document.getElementById('helpModal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
    if (lastFocusedElement) {
        lastFocusedElement.focus();
    }
}

// --- NOVÉ FUNKCE pro správu stavu klientů ---
/**
 * Automaticky aktualizuje stav aktivity klienta na základě data poslední masáže.
 */
function updateClientStatus() {
    masernaData.clients.forEach(client => {
        if (client.massages && client.massages.length > 0) {
            const lastMassageDate = client.massages.sort((a, b) => new Date(parseDateFromInput(b.date)) - new Date(parseDateFromInput(a.date)))[0].date;
            const lastMassageTimestamp = new Date(parseDateFromInput(lastMassageDate)).getTime();
            const now = new Date().getTime();
            const diffMonths = (now - lastMassageTimestamp) / (1000 * 60 * 60 * 24 * 30.44); // Průměrný měsíc

            if (diffMonths >= 6) {
                client.status = 'inactive';
            } else if (diffMonths < 1) {
                client.status = 'very_active';
            } else {
                client.status = 'active';
            }
        } else {
            client.status = 'inactive';
        }
    });
}

/**
 * Otevře modální okno pro ruční změnu stavu klienta.
 * @param {string} clientId ID klienta.
 */
function editClientStatus(clientId) {
    const client = masernaData.clients.find(c => c.id === clientId);
    if (!client) return;
    
    lastFocusedElement = document.activeElement;
    const modal = document.getElementById('editClientStatusModal');
    document.getElementById('editClientStatusModalTitle').textContent = `Změnit stav klienta: ${client.name}`;
    document.getElementById('editClientStatusSelect').value = client.status;
    
    document.getElementById('submitEditClientStatus').onclick = () => submitEditClientStatus(clientId);
    modal.style.display = 'flex';
    modal.focus();
}

/**
 * Uloží ručně nastavený stav klienta.
 * @param {string} clientId ID klienta.
 */
function submitEditClientStatus(clientId) {
    const client = masernaData.clients.find(c => c.id === clientId);
    if (!client) return;
    client.status = document.getElementById('editClientStatusSelect').value;
    closeModal('editClientStatusModal');
    updateAllTables();
    autoSave();
}

// --- Funkce pro přepínání viditelnosti formulářů ---
let activeFormId = null;
function toggleForm(formId) {
    const targetForm = document.getElementById(formId);
    if (activeFormId === formId) {
        targetForm.classList.add('hidden');
        document.querySelector(`button[aria-controls="${formId}"]`)?.setAttribute('aria-expanded', 'false');
        activeFormId = null;
    } else {
        document.querySelectorAll('.form-section').forEach(form => {
            form.classList.add('hidden');
            document.querySelector(`button[aria-controls="${form.id}"]`)?.setAttribute('aria-expanded', 'false');
        });
        targetForm.classList.remove('hidden');
        document.querySelector(`button[aria-controls="${formId}"]`)?.setAttribute('aria-expanded', 'true');
        activeFormId = formId;
        targetForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Reset autocomplete po otevření formuláře
        resetAutocomplete('massageClientName');
        resetAutocomplete('purchasingClientName');
        resetAutocomplete('clientNoteClientName');
        targetForm.querySelector('input, textarea, select, button')?.focus();
    }
}

// --- Funkce pro rozbalování/sbalování sekcí s tabulkami ---
function toggleTableSection(containerId, buttonId) {
    const container = document.getElementById(containerId);
    const button = document.getElementById(buttonId);
    const isExpanded = container.classList.contains('hidden');

    if (isExpanded) {
        container.classList.remove('hidden');
        button.textContent = 'Sbalit';
        button.setAttribute('aria-expanded', 'true');
    } else {
        container.classList.add('hidden');
        button.textContent = 'Zobrazit';
        button.setAttribute('aria-expanded', 'false');
    }
}

// --- Autocomplete logika ---
function setupAutocomplete(inputId, listId) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);

    let activeItemIndex = -1;

    input.addEventListener('input', () => {
        const filter = input.value.toLowerCase();
        list.innerHTML = '';
        activeItemIndex = -1;

        if (filter.length === 0) {
            list.classList.add('hidden');
            return;
        }

        const filteredClients = masernaData.clients.filter(client => 
            client.name.toLowerCase().includes(filter) ||
            (client.phone && client.phone.toLowerCase().includes(filter)) ||
            (client.id && client.id.toLowerCase().includes(filter))
        ).slice(0, 10);

        if (filteredClients.length > 0) {
            filteredClients.forEach((client, index) => {
                const item = document.createElement('li');
                item.classList.add('autocomplete-item');
                item.setAttribute('role', 'option');
                item.setAttribute('tabindex', '-1');
                item.dataset.clientId = client.id;
                item.innerHTML = `<strong>${client.name}</strong> <br><span>ID: ${client.id} | Tel: ${client.phone || '---'}</span>`;
                item.addEventListener('click', () => {
                    input.value = client.name;
                    list.classList.add('hidden');
                    input.focus();
                });
                list.appendChild(item);
            });
            list.classList.remove('hidden');
        } else {
            list.classList.add('hidden');
        }
    });

    input.addEventListener('keydown', (e) => {
        const items = list.querySelectorAll('.autocomplete-item');
        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeItemIndex = (activeItemIndex + 1) % items.length;
            items[activeItemIndex].focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeItemIndex = (activeItemIndex - 1 + items.length) % items.length;
            items[activeItemIndex].focus();
        } else if (e.key === 'Enter' || e.key === ' ') {
            if (activeItemIndex > -1) {
                e.preventDefault();
                items[activeItemIndex].click();
            }
        } else if (e.key === 'Escape') {
            list.classList.add('hidden');
            input.focus();
        }
    });

    list.addEventListener('keydown', (e) => {
        const items = list.querySelectorAll('.autocomplete-item');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeItemIndex = (activeItemIndex + 1) % items.length;
            items[activeItemIndex].focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeItemIndex = (activeItemIndex - 1 + items.length) % items.length;
            items[activeItemIndex].focus();
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            items[activeItemIndex].click();
        } else if (e.key === 'Escape') {
            list.classList.add('hidden');
            input.focus();
        }
    });
    
    input.addEventListener('focusout', (e) => {
        if (!list.contains(e.relatedTarget)) {
            setTimeout(() => { // Dáme malou prodlevu pro případ kliknutí
                list.classList.add('hidden');
            }, 200);
        }
    });
    list.addEventListener('focusout', (e) => {
        if (!input.contains(e.relatedTarget)) {
            setTimeout(() => { // Dáme malou prodlevu pro případ kliknutí
                list.classList.add('hidden');
            }, 200);
        }
    });
}

function resetAutocomplete(inputId) {
    document.getElementById(inputId).value = '';
    document.getElementById(inputId + '-list').innerHTML = '';
    document.getElementById(inputId + '-list').classList.add('hidden');
}

// --- Klienti: Přidání, úpravy, mazání ---
function addClient() {
    let id = document.getElementById('clientId').value.trim();
    const name = document.getElementById('clientName').value.trim();
    const phone = document.getElementById('clientPhone').value.trim();
    const diag = document.getElementById('clientDiag').value.trim();

    if (!name) { showCustomModal('Prosím, vyplňte jméno klienta.', 'Chyba zadání'); return; }
    
    if (!id) {
        const uniqueId = masernaData.clients.length > 0 ? Math.max(...masernaData.clients.map(c => parseInt(c.id.replace('Palpatius', '')) || 0)) + 1 : 1;
        id = `Palpatius${String(uniqueId).padStart(3, '0')}`;
    }

    if (masernaData.clients.some(c => c.id === id)) { showCustomModal('Klient s tímto ID již existuje. Zadejte unikátní ID nebo nechte pole prázdné pro automatické vygenerování.', 'Chyba ID'); return; }

    const newClient = { 
        id, name, phone, diag, 
        massages: [], total: 0, count: 0, methods: [], clientNotes: [], 
        expanded: false, 
        subTables: { massages: false, vouchers: false, notes: false, zaznamnik: false, loyalty: false }, 
        status: 'inactive',
        points: 0,
        bonus: 0,
        extra: 0,
        totalMassages: 0
    };
    masernaData.clients.push(newClient);
    
    document.getElementById('clientId').value = ''; document.getElementById('clientName').value = '';
    document.getElementById('clientPhone').value = ''; document.getElementById('clientDiag').value = '';
    updateAllTables();
    toggleForm('clientFormSection');
    autoSave();
}

function editClient(id) {
    const client = masernaData.clients.find(c => c.id === id);
    if (!client) return;
    showCustomModal(`
        <label for="editClientId">ID klienta:</label>
        <input type="text" id="editClientId" value="${client.id}" disabled /><br>
        <label for="editClientName">Příjmení a jméno:</label>
        <input type="text" id="editClientName" value="${client.name}" /><br>
        <label for="editClientPhone">Telefon:</label>
        <input type="tel" id="editClientPhone" value="${client.phone}" /><br>
        <label for="editClientDiag">Diagnóza:</label>
        <input type="text" id="editClientDiag" value="${client.diag}" /><br>
    `, `Upravit klienta: ${client.name}`, () => {
        submitEditClient(id);
    }, true);
}

function submitEditClient(id) {
    const client = masernaData.clients.find(c => c.id === id);
    if (!client) return;
    client.name = document.getElementById('editClientName').value.trim();
    client.phone = document.getElementById('editClientPhone').value.trim();
    client.diag = document.getElementById('editClientDiag').value.trim();
    updateAllTables();
    autoSave();
}

function deleteClient(id) {
    confirmAndDeleteItem('client', id, 'Opravdu chcete odstranit klienta a veškeré jeho záznamy (masáže, poznámky, poukazy)?');
}

// --- Klienti: Přidání masáže (propíše se i do Historie masáží) ---
function addMassage() {
    const clientName = document.getElementById('massageClientName').value.trim();
    const date = document.getElementById('massageDate').value;
    const time = document.getElementById('massageTime').value.trim();
    const method = document.getElementById('massageMethod').value.trim();
const payment = document.getElementById('massagePayment').value;
    const price = parseFloat(document.getElementById('massagePrice').value);

    if (!clientName || !date || !time || !method || !payment || isNaN(price) || price < 0) {
        showCustomModal('Vyplňte prosím všechna pole masáže.', 'Chyba zadání'); return;
    }
    const client = masernaData.clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());
    if (!client) { showCustomModal('Klient s tímto jménem nebyl nalezen. Zvolte ho prosím ze seznamu.', 'Klient nenalezen'); return; }

    const newMassage = { id: Date.now().toString(), date: parseDateFromInput(date), time, method, payment, price };
    client.massages.push(newMassage);
    client.count++;
    client.total += price;
    if (!client.methods.includes(method)) client.methods.push(method);

    masernaData.globalMassageHistory.push({
        id: newMassage.id,
        date: newMassage.date,
        time: newMassage.time,
        clientId: client.id,
        clientName: client.name,
        method: newMassage.method,
        payment: newMassage.payment,
        amount: newMassage.price
    });

    sendFinancialTransaction(newMassage.date, newMassage.price, 'Platba za masáž');
    // NOVÝ ZÁPIS
    sendFinanceEntry({
        amount: newMassage.price,
        method: newMassage.payment,    // H/T/O/Q/V
        date: newMassage.date,
        serviceCode: newMassage.method,  // můžeš změnit dle svého systému označení
        clientId: client.id
    });

    document.getElementById('massageClientName').value = ''; document.getElementById('massageDate').value = '';
    document.getElementById('massageTime').value = ''; document.getElementById('massageMethod').value = '';
    document.getElementById('massagePayment').value = ''; document.getElementById('massagePrice').value = '';
    updateAllTables();
    toggleForm('massageFormSection');
    showCustomModal('Masáž byla úspěšně přidána ke klientovi a do historie.', 'Masáž přidána');
    autoSave();
}

function editClientMassage(clientId, massageId) {
    const client = masernaData.clients.find(c => c.id === clientId);
    if (!client) return;
    const massage = client.massages.find(m => m.id === massageId);
    if (!massage) return;

    const dateForInput = formatDateForInput(massage.date);

    lastFocusedElement = document.activeElement;
    const modal = document.getElementById('editClientMassageModal');
    document.getElementById('editClientMassageModalTitle').textContent = `Upravit masáž pro ${client.name}`;
    document.getElementById('editClientMassageDate').value = dateForInput;
    document.getElementById('editClientMassageTime').value = massage.time;
    document.getElementById('editClientMassageMethod').value = massage.method;
    document.getElementById('editClientMassagePayment').value = massage.payment;
    document.getElementById('editClientMassagePrice').value = massage.price;

    document.getElementById('submitEditClientMassage').onclick = () => submitEditClientMassage(clientId, massageId);
    modal.style.display = 'flex';
    modal.focus();
}

function submitEditClientMassage(clientId, massageId) {
    const client = masernaData.clients.find(c => c.id === clientId);
    if (!client) return;
    const massage = client.massages.find(m => m.id === massageId);
    if (!massage) return;

    const oldPrice = massage.price;

    massage.date = parseDateFromInput(document.getElementById('editClientMassageDate').value);
    massage.time = document.getElementById('editClientMassageTime').value;
    massage.method = document.getElementById('editClientMassageMethod').value;
    massage.payment = document.getElementById('editClientMassagePayment').value;
    const newPrice = parseFloat(document.getElementById('editClientMassagePrice').value);
    if (!isNaN(newPrice)) {
        massage.price = newPrice;
    } else {
        showCustomModal('Prosím, zadejte platné číslo pro cenu.', 'Chyba zadání'); return;
    }

    client.total += (massage.price - oldPrice);

    const globalRecord = masernaData.globalMassageHistory.find(r => r.id === massageId);
    if (globalRecord) {
        globalRecord.date = massage.date;
        globalRecord.time = massage.time;
        globalRecord.method = massage.method;
        globalRecord.payment = massage.payment;
        globalRecord.amount = massage.price;
    }

    closeModal('editClientMassageModal');
    updateAllTables();
    showCustomModal('Masáž byla úspěšně upravena.', 'Masáž upravena');
    autoSave();
}

function deleteClientMassage(clientId, massageId) {
    confirmAndDeleteItem('clientMassage', {clientId, massageId}, 'Opravdu chcete smazat tuto masáž od klienta?');
}

// --- Ceník masáží: Přidání, úpravy, mazání ---
function addPriceListItem() {
    const year = document.getElementById('itemYear').value;
    const type = document.getElementById('itemType').value.trim();
    const name = document.getElementById('priceListName').value.trim();
    const length = document.getElementById('itemLength').value.trim();
    const price = parseFloat(document.getElementById('itemPrice').value);

    if (!year || !type || !name || !length || isNaN(price) || price < 0) {
        showCustomModal('Prosím, vyplňte všechna pole položky ceníku.', 'Chyba zadání'); return;
    }

    masernaData.priceListItems.push({ id: Date.now().toString(), year: year, type: type, name: name, length: length, price: price, count: 0, total: 0 });
    document.getElementById('itemYear').value = ''; document.getElementById('itemType').value = '';
    document.getElementById('priceListName').value = ''; document.getElementById('itemLength').value = ''; document.getElementById('itemPrice').value = '';
    updateAllTables();
    toggleForm('priceListFormSection');
    autoSave();
}

function editPriceListItem(id) {
    const item = masernaData.priceListItems.find(i => i.id === id);
    if (!item) return;
    showCustomModal(`
        <label for="editItemYear">Rok:</label>
        <input type="number" id="editItemYear" value="${item.year}" /><br>
        <label for="editItemType">Typ:</label>
        <input type="text" id="editItemType" value="${item.type}" /><br>
        <label for="editItemName">Název masáže:</label>
        <input type="text" id="editItemName" value="${item.name}" /><br>
        <label for="editItemLength">Délka:</label>
        <input type="text" id="editItemLength" value="${item.length}" /><br>
        <label for="editItemPrice">Cena (Kč):</label>
        <input type="number" id="editItemPrice" value="${item.price}" /><br>
    `, `Upravit položku ceníku: ${item.name}`, () => {
        submitEditPriceListItem(id);
    }, true);
}

function submitEditPriceListItem(id) {
    const item = masernaData.priceListItems.find(i => i.id === id);
    if (!item) return;
    item.year = document.getElementById('editItemYear').value;
    item.type = document.getElementById('editItemType').value;
    item.name = document.getElementById('editItemName').value;
    item.length = document.getElementById('editItemLength').value;
    const newPrice = parseFloat(document.getElementById('editItemPrice').value);
    if (!isNaN(newPrice)) {
        item.price = newPrice;
        item.total = item.count * newPrice;
    } else {
        showCustomModal('Prosím, zadejte platné číslo pro cenu.', 'Chyba zadání'); return;
    }
    updateAllTables();
    autoSave();
}

function deletePriceListItem(id) {
    confirmAndDeleteItem('priceListItem', id);
}

function addCountToPriceListItem(id) {
    const item = masernaData.priceListItems.find(i => i.id === id);
    if (!item) return;

    lastFocusedElement = document.activeElement;
    const modal = document.getElementById('addCountToPriceListItemModal');
    
    document.getElementById('addCountModalTitle').textContent = `Zadat počet pro: ${item.name}`;
    document.getElementById('addCountModalItemName').textContent = `Aktuální počet: ${item.count}`;
    document.getElementById('editItemCount').value = item.count;
    
    document.getElementById('submitCountToPriceListItemBtn').onclick = () => submitCountToPriceListItem(id);
    modal.style.display = 'flex';
    modal.focus();
}

function submitCountToPriceListItem(id) {
    const item = masernaData.priceListItems.find(i => i.id === id);
    if (!item) return;

    const newCount = parseInt(document.getElementById('editItemCount').value);
    if (!isNaN(newCount) && newCount >= 0) {
        item.count = newCount;
        item.total = item.count * item.price;
    } else {
        showCustomModal('Prosím, zadejte platné kladné číslo pro počet.', 'Chyba zadání');
        return;
    }
    closeModal('addCountToPriceListItemModal');
    updateAllTables();
    autoSave();
}


// --- Historie masáží (globální): Úpravy, mazání ---
function editGlobalMassageRecord(id) {
    const record = masernaData.globalMassageHistory.find(r => r.id === id);
    if (!record) return;
    const dateForInput = formatDateForInput(record.date);
    showCustomModal(`
        <label for="editRecordDate">Datum:</label>
        <input type="date" id="editRecordDate" value="${dateForInput}" /><br>
        <label for="editRecordTime">Čas:</label>
        <input type="text" id="editRecordTime" value="${record.time}" /><br>
        <label for="editRecordId">ID Klienta:</label>
        <input type="text" id="editRecordId" value="${record.clientId}" disabled /><br>
        <label for="editRecordClient">Jméno Klienta:</label>
        <input type="text" id="editRecordClient" value="${record.clientName}" disabled /><br>
        <label for="editRecordMethod">Metoda:</label>
        <input type="text" id="editRecordMethod" value="${record.method}" /><br>
        <label for="editRecordPayment">Platba (H/K/V):</label>
        <input type="text" id="editRecordPayment" value="${record.payment}" /><br>
        <label for="editRecordAmount">Částka (Kč):</label>
        <input type="number" id="editRecordAmount" value="${record.amount}" /><br>
    `, `Upravit záznam masáže: ${record.clientName}`, () => {
        submitEditGlobalMassageRecord(id);
    }, true);
}

function submitEditGlobalMassageRecord(id) {
    const record = masernaData.globalMassageHistory.find(r => r.id === id);
    if (!record) return;
    const oldAmount = record.amount;

    record.date = parseDateFromInput(document.getElementById('editRecordDate').value);
    record.time = document.getElementById('editRecordTime').value;
    record.method = document.getElementById('editRecordMethod').value;
    record.payment = document.getElementById('editRecordPayment').value;
    const newAmount = parseFloat(document.getElementById('editRecordAmount').value);
    if (!isNaN(newAmount)) {
        record.amount = newAmount;
    } else {
        showCustomModal('Prosím, zadejte platné číslo pro částku.', 'Chyba zadání'); return;
    }

    const client = masernaData.clients.find(c => c.id === record.clientId);
    if (client) {
        client.total += (record.amount - oldAmount);
        const clientMassage = client.massages.find(m => m.id === id);
        if (clientMassage) {
            clientMassage.date = record.date;
            clientMassage.time = record.time;
            clientMassage.method = record.method;
            clientMassage.payment = record.payment;
            clientMassage.price = record.amount;
        }
    }
    updateAllTables();
    showCustomModal('Záznam masáže byl úspěšně upraven.', 'Záznam upraven');
    autoSave();
}

function deleteGlobalMassageRecord(id) {
    confirmAndDeleteItem('globalMassageRecord', id, 'Opravdu chcete smazat tento záznam masáže z historie a od klienta?');
}

// --- Správa dárkových poukazů: Přidání, úpravy, mazání ---
function addVoucherPurchase() {
    let purchaseId = document.getElementById('purchaseId').value.trim();
    const purchasingClientName = document.getElementById('purchasingClientName').value.trim();
const overallPaymentType = document.getElementById('overallPaymentType').value;
    if (!purchasingClientName) { showCustomModal('Prosím, vyplňte jméno klienta.', 'Chyba zadání'); return; }
    const client = masernaData.clients.find(c => c.name.toLowerCase() === purchasingClientName.toLowerCase());
    if (!client) { showCustomModal('Klient s tímto jménem nebyl nalezen. Zvolte ho prosím ze seznamu.', 'Klient nenalezen'); return; }

    if (!purchaseId) {
        const uniqueId = masernaData.voucherPurchases.length > 0 ? Math.max(...masernaData.voucherPurchases.map(p => parseInt(p.purchaseId.replace('PUK', '')) || 0)) + 1 : 1;
        purchaseId = `PUK${String(uniqueId).padStart(3, '0')}`;
    }

    if (masernaData.voucherPurchases.some(p => p.purchaseId === purchaseId)) { showCustomModal('Nákup s tímto ID již existuje. Zadejte unikátní ID nebo nechte pole prázdné pro automatické vygenerování.', 'Chyba ID'); return; }

    masernaData.voucherPurchases.push({
        purchaseId,
        purchasingClientName,
        totalVouchersBought: 0,
        totalAmountPaid: 0,
        overallPaymentType,
        individualVouchers: []
    });
    document.getElementById('purchaseId').value = ''; document.getElementById('purchasingClientName').value = '';
    document.getElementById('overallPaymentType').value = '';
    updateAllTables();
    toggleForm('voucherPurchaseFormSection');
    autoSave();
}

function showAddIndividualVoucherModal(purchaseId) {
    lastFocusedElement = document.activeElement;
    const modal = document.getElementById('addIndividualVoucherModal');
    document.getElementById('submitAddIndividualVoucher').onclick = () => addIndividualVoucher(purchaseId);
    
    document.getElementById('newVoucherType').value = '';
    document.getElementById('newVoucherIssueDate').value = '';
    document.getElementById('newVoucherValue').value = '';

    modal.style.display = 'flex';
    modal.focus();
}

function addIndividualVoucher(purchaseId) {
    const voucherType = document.getElementById('newVoucherType').value.trim();
    const issueDate = parseDateFromInput(document.getElementById('newVoucherIssueDate').value);
    const voucherValue = parseFloat(document.getElementById('newVoucherValue').value);

    if (!voucherType || !issueDate || isNaN(voucherValue) || voucherValue < 0) {
        showCustomModal('Vyplňte prosím všechna pole pro nový poukaz.', 'Chyba zadání'); return;
    }

    const purchase = masernaData.voucherPurchases.find(p => p.purchaseId === purchaseId);
    if (!purchase) { showCustomModal('Nákup poukazů nebyl nalezen.', 'Chyba'); return; }

    const newVoucher = {
        voucherId: `${purchaseId}_${purchase.individualVouchers.length + 1}`,
        voucherType, issueDate,
        redeemedBy: '', redemptionDates: '',
        voucherValue
    };

    purchase.individualVouchers.push(newVoucher);
    purchase.totalVouchersBought++;
    purchase.totalAmountPaid += voucherValue;

    sendFinancialTransaction(newVoucher.issueDate, newVoucher.voucherValue, 'Nákup poukazu');
    // NOVÝ ZÁPIS
    sendFinanceEntry({
        amount: newVoucher.voucherValue,
        method: purchase.overallPaymentType, // H/T/O/Q
        date: newVoucher.issueDate,
        serviceCode: voucherType,
        clientId: purchase.purchasingClientName
    });

    closeModal('addIndividualVoucherModal');
    updateAllTables();
    showCustomModal('Poukaz byl úspěšně přidán k nákupu.', 'Poukaz přidán');
    autoSave();
}

function editVoucherPurchase(id) {
    const p = masernaData.voucherPurchases.find(purchase => purchase.purchaseId === id);
    if (!p) return;
    showCustomModal(`
        <label for="editPurchaseId">ID nákupu:</label>
        <input type="text" id="editPurchaseId" value="${p.purchaseId}" disabled /><br>
        <label for="editPurchasingClientName">Jméno kupujícího klienta:</label>
        <input type="text" id="editPurchasingClientName" value="${p.purchasingClientName}" /><br>
        <label for="editOverallPaymentType">Typ platby (H/K/V):</label>
        <input type="text" id="editOverallPaymentType" value="${p.overallPaymentType}" /><br>
        <p class="text-sm text-gray-400"><i>Počet poukazů a celková hodnota se aktualizují úpravou jednotlivých poukazů.</i></p>
    `, `Upravit nákup poukazů: ${p.purchaseId}`, () => {
        submitEditVoucherPurchase(id);
    }, true);
}

function submitEditVoucherPurchase(id) {
    const p = masernaData.voucherPurchases.find(purchase => purchase.purchaseId === id);
    if (!p) return;
    p.purchasingClientName = document.getElementById('editPurchasingClientName').value.trim();
    p.overallPaymentType = document.getElementById('editOverallPaymentType').value.trim();
    updateAllTables();
    autoSave();
}

function deleteVoucherPurchase(id) {
    confirmAndDeleteItem('voucherPurchase', id, 'Opravdu chcete smazat tento nákup poukazů a všechny jeho individuální poukazy?');
}

function editIndividualVoucher(purchaseId, voucherId) {
    const purchase = masernaData.voucherPurchases.find(p => p.purchaseId === purchaseId);
    if (!purchase) return;
    const voucher = purchase.individualVouchers.find(v => v.voucherId === voucherId);
    if (!voucher) return;

    const issueDateForInput = formatDateForInput(voucher.issueDate);
    
    lastFocusedElement = document.activeElement;
    const modal = document.getElementById('editIndividualVoucherModal');
    document.getElementById('editIndividualVoucherModalTitle').textContent = `Upravit poukaz: ${voucher.voucherId}`;
    document.getElementById('editVoucherType').value = voucher.voucherType;
    document.getElementById('editVoucherIssueDate').value = issueDateForInput;
    document.getElementById('editRedeemedBy').value = voucher.redeemedBy;
    document.getElementById('editRedemptionDates').value = voucher.redemptionDates;
    document.getElementById('editVoucherValue').value = voucher.voucherValue;

    document.getElementById('submitEditIndividualVoucher').onclick = () => submitEditIndividualVoucher(purchaseId, voucherId);
    modal.style.display = 'flex';
    modal.focus();
}

function submitEditIndividualVoucher(purchaseId, voucherId) {
    const purchase = masernaData.voucherPurchases.find(p => p.purchaseId === purchaseId);
    if (!purchase) return;
    const voucher = purchase.individualVouchers.find(v => v.voucherId === voucherId);
    if (!voucher) return;

    const oldVoucherValue = voucher.voucherValue;

    voucher.voucherType = document.getElementById('editVoucherType').value.trim();
    voucher.issueDate = parseDateFromInput(document.getElementById('editVoucherIssueDate').value);
    voucher.redeemedBy = document.getElementById('editRedeemedBy').value.trim();
    voucher.redemptionDates = document.getElementById('editRedemptionDates').value.trim();
    const newVoucherValue = parseFloat(document.getElementById('editVoucherValue').value);
    if (!isNaN(newVoucherValue) && newVoucherValue >= 0) {
        voucher.voucherValue = newVoucherValue;
    } else {
        showCustomModal('Zadejte prosím platnou hodnotu poukazu.', 'Chyba zadání'); return;
    }

    purchase.totalAmountPaid += (voucher.voucherValue - oldVoucherValue);
    closeModal('editIndividualVoucherModal');
    updateAllTables();
    showCustomModal('Poukaz byl úspěšně upraven.', 'Poukaz upraven');
    autoSave();
}

// --- Klienti: Poznámky ke klientovi ---
function addClientNote() {
    const clientName = document.getElementById('clientNoteClientName').value.trim();
    const noteText = document.getElementById('clientNoteText').value.trim();

    if (!clientName || !noteText) { showCustomModal('Prosím, vyplňte jméno klienta a text poznámky.', 'Chyba zadání'); return; }
    const client = masernaData.clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());
    if (!client) { showCustomModal('Klient s tímto jménem nebyl nalezen. Zvolte ho prosím ze seznamu.', 'Klient nenalezen'); return; }

    client.clientNotes.push({ id: Date.now().toString(), text: noteText });
    document.getElementById('clientNoteClientName').value = '';
    document.getElementById('clientNoteText').value = '';
    updateAllTables();
    toggleForm('clientNoteFormSection');
    showCustomModal('Poznámka byla úspěšně přidána ke klientovi.', 'Poznámka přidána');
    autoSave();
}

function editClientNote(clientId, noteId) {
    const client = masernaData.clients.find(c => c.id === clientId);
    if (!client) return;
    const note = client.clientNotes.find(n => n.id === noteId);
    if (!note) return;

    lastFocusedElement = document.activeElement;
    const modal = document.getElementById('editClientNoteModal');
    document.getElementById('editClientNoteModalTitle').textContent = `Upravit poznámku pro ${client.name}`;
    document.getElementById('editClientNoteText').value = note.text;

    document.getElementById('submitEditClientNote').onclick = () => submitEditClientNote(clientId, noteId);
    modal.style.display = 'flex';
    modal.focus();
}

function submitEditClientNote(clientId, noteId) {
    const client = masernaData.clients.find(c => c.id === clientId);
    if (!client) return;
    const note = client.clientNotes.find(n => n.id === noteId);
    if (!note) return;

    note.text = document.getElementById('editClientNoteText').value.trim();
    closeModal('editClientNoteModal');
    updateAllTables();
    showCustomModal('Poznámka byla úspěšně upravena.', 'Poznámka upravena');
    autoSave();
}

function deleteClientNote(clientId, noteId) {
    confirmAndDeleteItem('clientNote', { clientId, noteId }, 'Opravdu chcete smazat tuto poznámku?');
}

// --- NOVÉ: Funkce pro Věrnostní program ---
/**
 * Přidá klientovi jeden věrnostní bod.
 * @param {string} clientId ID klienta.
 */
function addLoyaltyPoint(clientId) {
    const client = masernaData.clients.find(c => c.id === clientId);
    if (!client) return;

    client.points++;
    client.totalMassages++;

    let bonusMessage = `Klientovi ${client.name} byl přičten 1 bod. Nyní má ${client.points} bodů.`;

    if (client.points >= 9) {
        client.points = 0;
        client.bonus++;
        bonusMessage += `<br><strong class="bonus">Gratulujeme! Klient získal bonus!</strong>`;
        
        if (client.bonus > 0 && client.bonus % 3 === 0) {
            client.extra++;
            bonusMessage += `<br><strong class="bonus">Skvělé! Klient navíc získal extra bonus!</strong>`;
        }
    }
    showCustomModal(bonusMessage, 'Věrnostní bod přičten');
    updateAllTables();
    autoSave();
}

/**
 * Odebere klientovi jeden věrnostní bod.
 * @param {string} clientId ID klienta.
 */
function removeLoyaltyPoint(clientId) {
    const client = masernaData.clients.find(c => c.id === clientId);
    if (!client) return;

    if (client.points > 0) {
        client.points--;
        client.totalMassages--; // Předpokládáme, že se odebere i masáž
        showCustomModal(`Klientovi ${client.name} byl odebrán 1 bod. Nyní má ${client.points} bodů.`, 'Věrnostní bod odebrán');
    } else {
        showCustomModal(`Klient ${client.name} má 0 bodů, nelze odebrat.`, 'Chyba');
    }
    updateAllTables();
    autoSave();
}


// --- Globální funkce pro aktualizaci tabulek ---
let sortStates = {};
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

    updateAllTables();
}

function updateAllTables() {
    updateClientStatus();
    displayClients();
    displayPriceList();
    displayGlobalMassageHistory();
    displayVoucherPurchases();
}

function getZaznamnikRecordTypeLabel(type) {
    switch(type) {
        case 'note': return 'Poznámka';
        case 'idea': return 'Nápad';
        case 'event': return 'Událost';
        case 'todo_task': return 'Úkol';
        default: return 'Ostatní';
    }
}

function getZaznamnikRecordTypeIcon(type) {
     switch(type) {
        case 'note': return '📝';
        case 'idea': return '💡';
        case 'event': return '🗓️';
        case 'todo_task': return '✅';
        default: return '---';
    }
}

function getZaznamnikRecordTypeClass(type) {
    switch(type) {
        case 'note': return 'item-type-note';
        case 'idea': return 'item-type-idea';
        case 'event': return 'item-type-event';
        case 'todo_task': return 'item-type-todo_task';
        default: return '';
    }
}

function getZaznamnikRecordContent(record) {
    switch(record.type) {
        case 'note': return record.title + ': ' + record.text.substring(0, 50) + '...';
        case 'idea': return record.title + ': ' + record.description.substring(0, 50) + '...';
        case 'event': return record.title + ' ' + record.date + ' ' + record.time;
        case 'todo_task': return record.text.substring(0, 50) + '...';
        default: return '---';
    }
}

// Funkce pro zobrazení klientů
function displayClients() {
    const tbody = document.querySelector('#clientTable tbody');
    const oldScroll = { top: tbody.scrollTop, left: tbody.scrollLeft };
    const activeIds = masernaData.clients.filter(c => c.expanded).map(c => c.id);
    
    tbody.innerHTML = '';
    const filterInput = document.getElementById('globalFilterInput').value.toLowerCase();
    let filteredClients = masernaData.clients.filter(c =>
        c.id.toLowerCase().includes(filterInput) ||
        c.name.toLowerCase().includes(filterInput) ||
        c.phone.toLowerCase().includes(filterInput) ||
        c.diag.toLowerCase().includes(filterInput)
    );

    const sortKey = sortStates['clientTable'] ? sortStates['clientTable'].key : 'name';
    const sortDirection = sortStates['clientTable'] ? sortStates['clientTable'].direction : 'asc';

    filteredClients.sort((a, b) => {
        let valA, valB;
        if (sortKey === 'count' || sortKey === 'total') {
            valA = a[sortKey];
            valB = b[sortKey];
        } else if (sortKey === 'status') {
            const statusOrder = {'very_active': 3, 'active': 2, 'inactive': 1};
            valA = statusOrder[a.status];
            valB = statusOrder[b.status];
        } else {
            valA = a[sortKey].toLowerCase();
            valB = b[sortKey].toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    filteredClients.forEach(client => {
        const row = document.createElement('tr');
        if (client.expanded) {
            row.classList.add('active-client-row');
        }
        const nameColorClass = `status-${client.status}-text`;
        const statusBadgeClass = `status-${client.status}-badge`;
        row.innerHTML = `
            <td>${client.id}</td>
            <td><button onclick="toggleClientDetails('${client.id}')" aria-expanded="${client.expanded}" aria-controls="client-details-${client.id}" class="${nameColorClass}">${client.name}</button></td>
            <td>${client.phone}</td>
            <td>${client.diag}</td>
            <td><button class="client-status-badge ${statusBadgeClass}" onclick="editClientStatus('${client.id}')">${client.status === 'very_active' ? 'Velmi aktivní' : (client.status === 'inactive' ? 'Neaktivní' : 'Aktivní')}</button></td>
            <td>${client.count}</td>
            <td>${client.total.toLocaleString('cs-CZ')} Kč</td>
            <td>${client.methods.join(', ')}</td>
            <td>
                <button class="btn-loyalty-add" onclick="addLoyaltyPoint('${client.id}')">+1 bod</button>
                <button class="btn-loyalty-remove" onclick="removeLoyaltyPoint('${client.id}')">-1 bod</button>
                <button class="btn-secondary" onclick="editClient('${client.id}')">Upravit</button>
                <button class="btn-danger" onclick="deleteClient('${client.id}')">Smazat</button>
                <button class="btn-export" onclick="exportItemToTxt('client', '${client.id}')">Export TXT</button>
            </td>
        `;
        tbody.appendChild(row);

        const detailRow = document.createElement('tr');
        detailRow.id = `client-details-${client.id}`;
        detailRow.className = client.expanded ? '' : 'hidden';
        detailRow.setAttribute('role', 'region');
        detailRow.setAttribute('aria-labelledby', `clients-heading client-name-${client.id}`);
        
        let clientMassagesHtml = '';
        const sortedMassages = client.massages.sort((a, b) => new Date(formatDateForInput(b.date)) - new Date(formatDateForInput(a.date)));
        if (sortedMassages.length > 0) {
            clientMassagesHtml = sortedMassages.map(m => `
                <tr>
                    <td>${m.date}</td><td>${m.time}</td><td>${m.method}</td><td>${m.payment}</td><td>${m.price} Kč</td>
                    <td>
                        <button class="btn-secondary" onclick="editClientMassage('${client.id}', '${m.id}')">Upravit</button>
                        <button class="btn-danger" onclick="deleteClientMassage('${client.id}', '${m.id}')">Smazat</button>
                    </td>
                </tr>
            `).join('');
        } else {
            clientMassagesHtml = `<tr><td colspan="6">Žádné masáže pro tohoto klienta.</td></tr>`;
        }

        let clientVouchersHtml = '';
        const vouchersForThisClient = getVouchersForClient(client.name);
        const sortedVouchers = vouchersForThisClient.sort((a, b) => new Date(formatDateForInput(b.issueDate)) - new Date(formatDateForInput(a.issueDate)));
        if (sortedVouchers.length > 0) {
            clientVouchersHtml = sortedVouchers.map(v => `
                <tr>
                    <td>${v.voucherId || 'N/A'}</td><td>${v.voucherType}</td><td>${v.voucherValue} Kč</td><td>${v.issueDate}</td><td>${calculateExpiryDate(v.issueDate)}</td><td>${v.redeemedBy || '---'}</td>
                    <td>
                        <button class="btn-secondary" onclick="editIndividualVoucher('${v.purchaseId}', '${v.voucherId}')">Upravit</button>
                        <button class="btn-danger" onclick="deleteIndividualVoucher('${v.purchaseId}', '${v.voucherId}')">Smazat</button>
                    </td>
                </tr>
            `).join('');
        } else {
            clientVouchersHtml = `<tr><td colspan="7">Žádné poukazy zakoupené tímto klientem.</td></tr>`;
        }

        let clientNotesHtml = '';
        const sortedNotes = client.clientNotes.sort((a,b) => b.id - a.id);
        if (sortedNotes.length > 0) {
            clientNotesHtml = sortedNotes.map(note => `
                <tr>
                    <td>${note.text}</td>
                    <td>
                        <button class="btn-secondary" onclick="editClientNote('${client.id}', '${note.id}')">Upravit</button>
                        <button class="btn-danger" onclick="deleteClientNote('${client.id}', '${note.id}')">Smazat</button>
                    </td>
                </tr>
            `).join('');
        } else {
            clientNotesHtml = `<tr><td colspan="2">Žádné poznámky pro tohoto klienta.</td></tr>`;
        }

        let zaznamnikRecordsHtml = '';
        if (zaznamnikDataForClient[client.id] && zaznamnikDataForClient[client.id].length > 0) {
            zaznamnikRecordsHtml = zaznamnikDataForClient[client.id].map(rec => `
                <tr>
                    <td><span class="${getZaznamnikRecordTypeClass(rec.type)}">${getZaznamnikRecordTypeIcon(rec.type)} ${getZaznamnikRecordTypeLabel(rec.type)}</span></td>
                    <td>${getZaznamnikRecordContent(rec)}</td>
                </tr>
            `).join('');
        } else {
            zaznamnikRecordsHtml = `<tr><td colspan="2">Žádné záznamy ze záznamníku pro tohoto klienta.</td></tr>`;
        }
        
        // *** NOVÉ: HTML pro sekci Věrnostní program ***
        const clientLoyaltyHtml = `
            <div class="loyalty-section">
                <p><strong>Aktuální body:</strong> ${client.points} / 9</p>
                <p><strong>Získané bonusy (masáže zdarma):</strong> <span class="bonus">${client.bonus}</span></p>
                <p><strong>Získané extra bonusy (poukazy):</strong> <span class="bonus">${client.extra}</span></p>
                <p><strong>Celkem absolvovaných masáží:</strong> ${client.totalMassages}</p>
            </div>
        `;


        detailRow.innerHTML = `<td colspan="9">
            <div class="client-detail-section">
                <h3>Absolvované masáže (${client.massages.length}) <button onclick="toggleClientSubTable('${client.id}', 'massages')">Zobrazit/Sbalit</button></h3>
                <div id="client-${client.id}-massages" class="table-responsive ${client.subTables && client.subTables.massages ? '' : 'hidden'}">
                    <table>
                        <thead>
                            <tr>
                                <th data-sort="date">Datum</th><th data-sort="time">Čas</th><th data-sort="method">Metoda</th><th data-sort="payment">Platba</th><th data-sort="price">Cena</th><th>Akce</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${clientMassagesHtml}
                        </tbody>
                    </table>
                </div>

                <h3>Dárkové poukazy (${vouchersForThisClient.length}) <button onclick="toggleClientSubTable('${client.id}', 'vouchers')">Zobrazit/Sbalit</button></h3>
                <div id="client-${client.id}-vouchers" class="table-responsive ${client.subTables && client.subTables.vouchers ? '' : 'hidden'}">
                    <table>
                        <thead>
                            <tr>
                                <th data-sort="voucherId">ID Poukazu</th><th data-sort="voucherType">Typ</th><th data-sort="voucherValue">Hodnota</th><th data-sort="issueDate">Vystaveno</th><th>Platí do</th><th data-sort="redeemedBy">Využil/a</th><th>Akce</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${clientVouchersHtml}
                        </tbody>
                    </table>
                </div>

                <h3>Poznámky (${client.clientNotes.length}) <button onclick="toggleClientSubTable('${client.id}', 'notes')">Zobrazit/Sbalit</button></h3>
                <div id="client-${client.id}-notes" class="table-responsive ${client.subTables && client.subTables.notes ? '' : 'hidden'}">
                    <table>
                        <thead>
                            <tr>
                                <th>Text poznámky</th><th>Akce</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${clientNotesHtml}
                        </tbody>
                    </table>
                </div>
                
                <h3>Záznamy ze Záznamníku (${zaznamnikDataForClient[client.id] ? zaznamnikDataForClient[client.id].length : 0}) <button onclick="toggleClientSubTable('${client.id}', 'zaznamnik')">Zobrazit/Sbalit</button></h3>
                <div id="client-${client.id}-zaznamnik" class="table-responsive ${client.subTables && client.subTables.zaznamnik ? '' : 'hidden'}">
                    <table>
                        <thead>
                            <tr>
                                <th>Typ</th>
                                <th>Obsah</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${zaznamnikRecordsHtml}
                        </tbody>
                    </table>
                </div>

                <h3>Věrnostní program <button onclick="toggleClientSubTable('${client.id}', 'loyalty')">Zobrazit/Sbalit</button></h3>
                <div id="client-${client.id}-loyalty" class="table-responsive ${client.subTables && client.subTables.loyalty ? '' : 'hidden'}">
                   ${clientLoyaltyHtml}
                </div>
            </div>
        </td>`;
        tbody.appendChild(detailRow);
    });
    tbody.scrollTop = oldScroll.top;
    tbody.scrollLeft = oldScroll.left;
}

async function toggleClientDetails(clientId) {
    const client = masernaData.clients.find(c => c.id === clientId);
    if (!client) return;
    
    client.expanded = !client.expanded;
    
    const mainRow = document.querySelector(`button[onclick="toggleClientDetails('${clientId}')"]`).closest('tr');
    const detailRow = mainRow.nextElementSibling;
    
    if (detailRow && detailRow.id === `client-details-${clientId}`) {
        detailRow.classList.toggle('hidden', !client.expanded);
        mainRow.classList.toggle('active-client-row', client.expanded);
        mainRow.querySelector('button[aria-expanded]').setAttribute('aria-expanded', client.expanded);
        
        if (client.expanded) {
            if (!zaznamnikDataForClient[client.id]) {
                zaznamnikDataForClient[client.id] = await loadZaznamnikRecordsForClient(clientId);
                // Rerender jen pro tento jeden řádek
                displayClients();
            }
        }
    }
}

function toggleClientSubTable(clientId, subTableType) {
    const client = masernaData.clients.find(c => c.id === clientId);
    if (!client) return;

    if (!client.subTables) {
        client.subTables = { massages: false, vouchers: false, notes: false, zaznamnik: false, loyalty: false };
    }
    client.subTables[subTableType] = !client.subTables[subTableType];

    const subTableContainer = document.getElementById(`client-${clientId}-${subTableType}`);
    const button = subTableContainer.previousElementSibling.querySelector('button');
    if (subTableContainer && button) {
        subTableContainer.classList.toggle('hidden', !client.subTables[subTableType]);
    }
}

function getVouchersForClient(clientName) {
    const clientVouchers = [];

    masernaData.voucherPurchases.forEach(purchase => {
        if (purchase.purchasingClientName &&
            purchase.purchasingClientName.toLowerCase() === clientName.toLowerCase()) {

            const vouchers = (purchase.individualVouchers || []).map(v => ({
                ...v,
                purchaseId: purchase.purchaseId
            }));

            clientVouchers.push(...vouchers);
        }
    });

    return clientVouchers;
}

function displayPriceList() {
    const tbody = document.querySelector('#priceListTable tbody');
    tbody.innerHTML = '';
    const filterInput = document.getElementById('globalFilterInput').value.toLowerCase();

    let filteredItems = masernaData.priceListItems.filter(item =>
        item.year.toString().includes(filterInput) ||
        item.type.toLowerCase().includes(filterInput) ||
        item.name.toLowerCase().includes(filterInput) ||
        item.length.toLowerCase().includes(filterInput) ||
        item.price.toString().includes(filterInput)
    );

    const sortKey = sortStates['priceListTable'] ? sortStates['priceListTable'].key : 'year';
    const sortDirection = sortStates['priceListTable'] ? sortStates['priceListTable'].direction : 'asc';
    
    filteredItems.sort((a, b) => {
        let valA, valB;
        if (sortKey === 'year' || sortKey === 'price' || sortKey === 'count' || sortKey === 'total') {
            valA = a[sortKey];
            valB = b[sortKey];
        } else {
            valA = a[sortKey].toLowerCase();
            valB = b[sortKey].toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    filteredItems.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.year}</td>
            <td>${item.type}</td>
            <td>${item.name}</td>
            <td>${item.length}</td>
            <td>${item.price} Kč</td>
            <td>${item.count}</td>
            <td>${item.total} Kč</td>
            <td>
                <button class="btn-primary" onclick="addCountToPriceListItem('${item.id}')">Přidat data</button>
                <button class="btn-secondary" onclick="editPriceListItem('${item.id}')">Upravit</button>
                <button class="btn-danger" onclick="deletePriceListItem('${item.id}')">Smazat</button>
                <button class="btn-export" onclick="exportItemToTxt('priceListItem', '${item.id}')">Export TXT</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function displayGlobalMassageHistory() {
    const tbody = document.querySelector('#globalMassageHistoryTable tbody');
    tbody.innerHTML = '';
    const filterInput = document.getElementById('globalFilterInput').value.toLowerCase();

    let filteredRecords = masernaData.globalMassageHistory.filter(record =>
        record.date.includes(filterInput) ||
        record.clientName.toLowerCase().includes(filterInput) ||
        record.method.toLowerCase().includes(filterInput) ||
        record.amount.toString().includes(filterInput)
    );

    const sortKey = sortStates['globalMassageHistoryTable'] ? sortStates['globalMassageHistoryTable'].key : 'date';
    const sortDirection = sortStates['globalMassageHistoryTable'] ? sortStates['globalMassageHistoryTable'].direction : 'desc';

    filteredRecords.sort((a, b) => {
        let valA, valB;
        if (sortKey === 'date') {
            valA = new Date(formatDateForInput(a.date));
            valB = new Date(formatDateForInput(b.date));
        } else if (sortKey === 'amount') {
            valA = a.amount;
            valB = b.amount;
        } else {
            valA = a[sortKey].toLowerCase();
            valB = b[sortKey].toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    filteredRecords.forEach(record => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${record.date}</td>
            <td>${record.time}</td>
            <td>${record.clientId}</td>
            <td>${record.clientName}</td>
            <td>${record.method}</td>
            <td>${record.payment}</td>
            <td>${record.amount} Kč</td>
            <td>
                <button class="btn-secondary" onclick="editGlobalMassageRecord('${record.id}')">Upravit</button>
                <button class="btn-danger" onclick="deleteGlobalMassageRecord('${record.id}')">Smazat</button>
                <button class="btn-export" onclick="exportItemToTxt('globalMassageRecord', '${record.id}')">Export TXT</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function displayVoucherPurchases() {
    const tbody = document.querySelector('#voucherTable tbody');
    tbody.innerHTML = '';
    const filterInput = document.getElementById('globalFilterInput').value.toLowerCase();

    let filteredPurchases = masernaData.voucherPurchases.filter(p =>
        p.purchaseId.toLowerCase().includes(filterInput) ||
        p.purchasingClientName.toLowerCase().includes(filterInput) ||
        p.overallPaymentType.toLowerCase().includes(filterInput) ||
        p.totalAmountPaid.toString().includes(filterInput)
    );

    const sortKey = sortStates['voucherTable'] ? sortStates['voucherTable'].key : 'purchaseId';
    const sortDirection = sortStates['voucherTable'] ? sortStates['voucherTable'].direction : 'asc';
    
    filteredPurchases.sort((a, b) => {
        let valA, valB;
        if (sortKey === 'totalVouchersBought' || sortKey === 'totalAmountPaid') {
            valA = a[sortKey];
            valB = b[sortKey];
        } else {
            valA = a[sortKey].toLowerCase();
            valB = b[sortKey].toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    filteredPurchases.forEach(purchase => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${purchase.purchaseId}</td>
            <td><button onclick="toggleVoucherPurchaseDetails('${purchase.purchaseId}')" aria-expanded="${purchase.expanded}" aria-controls="voucher-purchase-details-${purchase.purchaseId}">${purchase.purchasingClientName}</button></td>
            <td>${purchase.totalVouchersBought}</td>
            <td>${purchase.totalAmountPaid.toLocaleString('cs-CZ')} Kč</td>
            <td>${purchase.overallPaymentType}</td>
            <td>
                <button class="btn-primary" onclick="showAddIndividualVoucherModal('${purchase.purchaseId}')">Přidat poukaz</button>
                <button class="btn-secondary" onclick="editVoucherPurchase('${purchase.purchaseId}')">Upravit</button>
                <button class="btn-danger" onclick="deleteVoucherPurchase('${purchase.purchaseId}')">Smazat</button>
                <button class="btn-export" onclick="exportItemToTxt('voucherPurchase', '${purchase.purchaseId}')">Export TXT</button>
            </td>
        `;
        tbody.appendChild(row);

        const detailRow = document.createElement('tr');
        detailRow.id = `voucher-purchase-details-${purchase.purchaseId}`;
        detailRow.className = purchase.expanded ? '' : 'hidden';
        detailRow.setAttribute('role', 'region');
        detailRow.setAttribute('aria-labelledby', `vouchers-heading client-name-${purchase.purchaseId}`);
        
        let vouchersHtml = '';
        if (purchase.individualVouchers.length > 0) {
            vouchersHtml = purchase.individualVouchers.map(v => `
                <div class="detail-entry flex items-center justify-between flex-wrap p-2 border-b border-gray-700 last:border-b-0">
                    <span class="flex-grow">
                        <strong>ID:</strong> ${v.voucherId || 'N/A'} |
                        <strong>Typ:</strong> ${v.voucherType} |
                        <strong>Hodnota:</strong> ${v.voucherValue} Kč |
                        <strong>Vystaveno:</strong> ${v.issueDate} |
                        <strong>Platí do:</strong> ${calculateExpiryDate(v.issueDate)} |
                        <strong>Využil:</strong> ${v.redeemedBy || 'N/A'} |
                        <strong>Použito:</strong> ${v.redemptionDates || 'N/A'}
                    </span>
                    <div class="flex-shrink-0 ml-4">
                        <button class="btn-secondary" onclick="editIndividualVoucher('${purchase.purchaseId}', '${v.voucherId}')">Upravit</button>
                        <button class="btn-danger" onclick="deleteIndividualVoucher('${purchase.purchaseId}', '${v.voucherId}')">Smazat</button>
                    </div>
                </div>
            `).join('');
        } else {
            vouchersHtml = `<div class="detail-entry p-2"><span>Žádné individuální poukazy v tomto nákupu.</span></div>`;
        }

        detailRow.innerHTML = `<td colspan="6"><div class="client-detail-section">${vouchersHtml}</div></td>`;
        tbody.appendChild(detailRow);
    });
}

function toggleVoucherPurchaseDetails(purchaseId) {
    const purchase = masernaData.voucherPurchases.find(p => p.purchaseId === purchaseId);
    if (!purchase) return;
    purchase.expanded = !purchase.expanded;
    const detailRow = document.getElementById(`voucher-purchase-details-${purchase.purchaseId}`);
    if (detailRow) {
        detailRow.classList.toggle('hidden', !purchase.expanded);
        const mainRow = detailRow.previousElementSibling;
        mainRow.classList.toggle('active-client-row', purchase.expanded);
        mainRow.querySelector('button[aria-expanded]').setAttribute('aria-expanded', purchase.expanded);
    }
}


// --- Globální funkce pro správu dat a tabulky ---
function confirmAndDeleteItem(type, id, message = 'Opravdu chcete odstranit tento záznam?') {
    showCustomModal(message, 'Potvrdit smazání', () => {
        if (type === 'client') {
            const clientToDelete = masernaData.clients.find(c => c.id === id);
            if (clientToDelete) {
                masernaData.globalMassageHistory = masernaData.globalMassageHistory.filter(m => m.clientId !== id);
                masernaData.voucherPurchases = masernaData.voucherPurchases.filter(p => p.purchasingClientName.toLowerCase() !== clientToDelete.name.toLowerCase());
                masernaData.voucherPurchases.forEach(p => {
                    p.individualVouchers = p.individualVouchers.filter(v => v.redeemedBy.toLowerCase() !== clientToDelete.name.toLowerCase());
                });
            }
            masernaData.clients = masernaData.clients.filter(c => c.id !== id);
        } else if (type === 'clientMassage') {
            const clientId = id.clientId;
            const massageId = id.massageId;
            const client = masernaData.clients.find(c => c.id === clientId);
            if (client) {
                const massage = client.massages.find(m => m.id === massageId);
                if (massage) {
                    client.total -= massage.price;
                    client.count--;
                    client.massages = client.massages.filter(m => m.id !== massageId);
                }
            }
            masernaData.globalMassageHistory = masernaData.globalMassageHistory.filter(m => m.id !== massageId);
        } else if (type === 'priceListItem') {
            masernaData.priceListItems = masernaData.priceListItems.filter(item => item.id !== id);
        } else if (type === 'globalMassageRecord') {
            const recordToDelete = masernaData.globalMassageHistory.find(r => r.id === id);
            if (recordToDelete) {
                const client = masernaData.clients.find(c => c.id === recordToDelete.clientId);
                if (client) {
                    const clientMassage = client.massages.find(m => m.id === id);
                    if (clientMassage) {
                        client.total -= clientMassage.price;
                        client.count--;
                        client.massages = client.massages.filter(m => m.id !== id);
                    }
                }
            }
            masernaData.globalMassageHistory = masernaData.globalMassageHistory.filter(record => record.id !== id);
        } else if (type === 'voucherPurchase') {
            masernaData.voucherPurchases = masernaData.voucherPurchases.filter(p => p.purchaseId !== id);
        } else if (type === 'individualVoucher') {
            const purchaseId = id.purchaseId;
            const voucherId = id.voucherId;
            const purchase = masernaData.voucherPurchases.find(p => p.purchaseId === purchaseId);
            if (purchase) {
                const voucher = purchase.individualVouchers.find(v => v.voucherId === voucherId);
                if (voucher) {
                    purchase.totalVouchersBought--;
                    purchase.totalAmountPaid -= voucher.voucherValue;
                    purchase.individualVouchers = purchase.individualVouchers.filter(v => v.voucherId !== voucherId);
                }
            }
        } else if (type === 'clientNote') {
            const clientId = id.clientId;
            const noteId = id.noteId;
            const client = masernaData.clients.find(c => c.id === clientId);
            if (client) {
                client.clientNotes = client.clientNotes.filter(n => n.id !== noteId);
            }
        }
        updateAllTables();
        autoSave();
    }, true);
}

// Exportuje data položky do TXT
function exportItemToTxt(type, id) {
    let item;
    let content = '';
    let filename = 'zaznam';

    switch (type) {
        case 'client':
            item = masernaData.clients.find(c => c.id === id);
            if (!item) return;
            content = `--- Detaily klienta ---\n`;
            content += `ID: ${item.id}\nJméno: ${item.name}\nTelefon: ${item.phone}\nDiagnóza: ${item.diag}\nStav: ${item.status}\n\n`;
            content += `--- Absolvované masáže ---\n`;
            if (item.massages.length > 0) {
                item.massages.forEach(m => {
                    content += `Datum: ${m.date}, Čas: ${m.time}, Metoda: ${m.method}, Platba: ${m.payment}, Cena: ${m.price} Kč\n`;
                });
            } else {
                content += `Žádné masáže.\n`;
            }
            content += `\n--- Věrnostní program ---\n`;
            content += `Body: ${item.points}\nBonusy: ${item.bonus}\nExtra bonusy: ${item.extra}\nCelkem masáží: ${item.totalMassages}\n`;
            content += `\n--- Poznámky ---\n`;
            if (item.clientNotes.length > 0) {
                item.clientNotes.forEach(n => {
                    content += `- ${n.text}\n`;
                });
            } else {
                content += `Žádné poznámky.\n`;
            }
            content += `\n--- Záznamy ze záznamníku ---\n`;
            if (zaznamnikDataForClient[item.id] && zaznamnikDataForClient[item.id].length > 0) {
                 zaznamnikDataForClient[item.id].forEach(rec => {
                    content += `[${getZaznamnikRecordTypeLabel(rec.type)}] - ${getZaznamnikRecordContent(rec)}\n`;
                });
            } else {
                content += `Žádné záznamy ze záznamníku.\n`;
            }
            
            filename = `klient_${item.name}`;
            break;
        case 'globalMassageRecord':
            item = masernaData.globalMassageHistory.find(r => r.id === id);
            if (!item) return;
            content = `--- Záznam masáže ---\n`;
            content += `Datum: ${item.date}\nČas: ${item.time}\nKlient: ${item.clientName} (ID: ${item.clientId})\nMetoda: ${item.method}\nPlatba: ${item.payment}\nČástka: ${item.amount} Kč\n`;
            filename = `masaz_${item.clientName}_${item.date.replace(/\./g, '-')}`;
            break;
        case 'voucherPurchase':
            item = masernaData.voucherPurchases.find(p => p.purchaseId === id);
            if (!item) return;
            content = `--- Nákup poukazů ---\n`;
            content += `ID Nákupu: ${item.purchaseId}\nKlient (Kupující): ${item.purchasingClientName}\nPočet poukazů: ${item.totalVouchersBought}\nCelková hodnota: ${item.totalAmountPaid} Kč\nTyp platby: ${item.overallPaymentType}\n\n`;
            content += `--- Jednotlivé poukazy ---\n`;
            if (item.individualVouchers.length > 0) {
                item.individualVouchers.forEach(v => {
                    content += `ID: ${v.voucherId}, Typ: ${v.voucherType}, Hodnota: ${v.voucherValue} Kč, Vystaveno: ${v.issueDate}, Platí do: ${calculateExpiryDate(v.issueDate)}, Využil/a: ${v.redeemedBy || '---'}, Použito: ${v.redemptionDates || '---'}\n`;
                });
            } else {
                content += `Žádné poukazy v tomto nákupu.\n`;
            }
            filename = `poukazy_${item.purchasingClientName}_${item.purchaseId}`;
            break;
        case 'priceListItem':
            item = masernaData.priceListItems.find(i => i.id === id);
            if (!item) return;
            content = `--- Položka ceníku ---\n`;
            content += `Rok: ${item.year}\nTyp: ${item.type}\nMasáž: ${item.name}\nDélka: ${item.length}\nCena: ${item.price} Kč\nPočet prodaných: ${item.count}\nCelkem: ${item.total} Kč\n`;
            filename = `cenik_polozka_${item.name}`;
            break;
        default:
            showCustomModal('Nelze exportovat tento typ záznamu do TXT.', 'Chyba exportu');
            return;
    }

    filename = filename.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(content);
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", `${filename}.txt`);
    document.body.appendChild(dl);
    dl.click();
    document.body.removeChild(dl);
    URL.revokeObjectURL(dataStr);
}

// --- Globální export/import všech dat Masérny ---
function exportAllMasernaData() {
    try {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(masernaData, null, 2));
        const dl = document.createElement('a');
        dl.setAttribute("href", dataStr);
        dl.setAttribute("download", "maserna_data.json");
        document.body.appendChild(dl);
        dl.click();
        document.body.removeChild(dl);
        URL.revokeObjectURL(dataStr);
        showCustomModal("Všechna data Masérny byla úspěšně exportována jako JSON.");
        
        document.getElementById('backupReminder').classList.add('hidden');
    } catch (error) {
        console.error("Chyba při exportu JSON dat Masérny:", error);
        showCustomModal("Nastala chyba při exportu dat Masérny. Zkuste to prosím znovu.", 'Chyba exportu');
    }
}

function importAllMasernaData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
        try {
            const importedData = JSON.parse(e.target.result);
            if (importedData && typeof importedData === 'object' &&
                'clients' in importedData && Array.isArray(importedData.clients) &&
                'priceListItems' in importedData && Array.isArray(importedData.priceListItems) &&
                'globalMassageHistory' in importedData && Array.isArray(importedData.globalMassageHistory) &&
                'voucherPurchases' in importedData && Array.isArray(importedData.voucherPurchases)) {

importedData.clients.forEach(c => {
    c.id = c.id ? String(c.id) : Date.now().toString();

    // === ZAJIŠTĚNÍ STRUKTURY POZNÁMEK ===
    if (!Array.isArray(c.clientNotes)) {
        c.clientNotes = [];
    }

    c.clientNotes.forEach(n => {
        n.id = n.id ? String(n.id) : Date.now().toString();
    });

    // === MASÁŽE ===
    if (!Array.isArray(c.massages)) {
        c.massages = [];
    }

    c.massages.forEach(m => {
        m.id = m.id ? String(m.id) : Date.now().toString();
    });

    // === UI STAVY ===
    if (typeof c.expanded !== 'boolean') c.expanded = false;
    if (typeof c.subTables !== 'object' || c.subTables === null) {
        c.subTables = { massages: false, vouchers: false, notes: false, zaznamnik: false, loyalty: false };
    }

    // === STAV KLIENTA ===
    if (typeof c.status !== 'string') c.status = 'inactive';

    // === VĚRNOSTNÍ PROGRAM ===
    if (typeof c.points === 'undefined') c.points = 0;
    if (typeof c.bonus === 'undefined') c.bonus = 0;
    if (typeof c.extra === 'undefined') c.extra = 0;
    if (typeof c.totalMassages === 'undefined') c.totalMassages = c.massages.length;
});

                importedData.priceListItems.forEach(item => item.id = item.id ? String(item.id) : Date.now().toString());
                importedData.globalMassageHistory.forEach(item => item.id = item.id ? String(item.id) : Date.now().toString());
                importedData.voucherPurchases.forEach(purchase => {
                    purchase.purchaseId = purchase.purchaseId ? String(purchase.purchaseId) : Date.now().toString();
                    purchase.individualVouchers.forEach(v => v.voucherId = v.voucherId ? String(v.voucherId) : Date.now().toString());
                    if (typeof purchase.expanded !== 'boolean') purchase.expanded = false;
                });

                masernaData = importedData;
                await saveDataToDB();
                updateAllTables();
                showCustomModal('Data Masérny byla úspěšně importována!');
            } else {
                showCustomModal('Chyba: Importovaný soubor nemá očekávaný formát pro aplikaci Masérna.', 'Chyba importu');
            }
        } catch (e) {
            console.error("Chyba při čtení JSON souboru:", e);
            showCustomModal('Chyba při čtení JSON souboru: ' + e.message, 'Chyba importu');
        }
    };
    reader.readAsText(file);
}

function clearFilter() {
    document.getElementById('globalFilterInput').value = '';
    masernaData.clients.forEach(c => c.expanded = false);
    masernaData.voucherPurchases.forEach(p => p.expanded = false);
    updateAllTables();
}

function initEventListeners() {
    // --- Globální tlačítka ---
    document.getElementById('exportAllBtn').addEventListener('click', exportAllMasernaData);
    document.getElementById('importAllInput').addEventListener('change', importAllMasernaData);
    document.getElementById('helpBtn').addEventListener('click', openHelpModal);
    document.getElementById('clearFilterBtn').addEventListener('click', clearFilter);
    document.getElementById('globalFilterInput').addEventListener('input', updateAllTables);

    // --- Tlačítka pro přepínání formulářů ---
    document.getElementById('toggleClientFormBtn').addEventListener('click', () => toggleForm('clientFormSection'));
    document.getElementById('toggleMassageFormBtn').addEventListener('click', () => toggleForm('massageFormSection'));
    document.getElementById('toggleVoucherFormBtn').addEventListener('click', () => toggleForm('voucherPurchaseFormSection'));
    document.getElementById('togglePriceListFormBtn').addEventListener('click', () => toggleForm('priceListFormSection'));
    document.getElementById('toggleNoteFormBtn').addEventListener('click', () => toggleForm('clientNoteFormSection'));

    // --- Tlačítka pro odeslání formulářů ---
    document.getElementById('addClientBtn').addEventListener('click', (event) => {
        event.preventDefault();
        addClient();
    });
    document.getElementById('addMassageBtn').addEventListener('click', (event) => {
        event.preventDefault();
        addMassage();
    });
    document.getElementById('addVoucherPurchaseBtn').addEventListener('click', (event) => {
        event.preventDefault();
        addVoucherPurchase();
    });
    document.getElementById('addPriceListItemBtn').addEventListener('click', (event) => {
        event.preventDefault();
        addPriceListItem();
    });
    document.getElementById('addClientNoteBtn').addEventListener('click', (event) => {
        event.preventDefault();
        addClientNote();
    });

    // --- Tlačítka pro přepínání viditelnosti tabulek ---
    document.getElementById('toggleClientsBtn').addEventListener('click', () => toggleTableSection('clientTableContainer', 'toggleClientsBtn'));
document.getElementById('togglePricelistBtn')
    .addEventListener('click', () => {
        toggleTableSection('priceListTableContainer', 'togglePricelistBtn');
        displayPriceList();
    });
    document.getElementById('toggleGlobalMassageHistoryBtn').addEventListener('click', () => toggleTableSection('globalMassageHistoryTableContainer', 'toggleGlobalMassageHistoryBtn'));
    document.getElementById('toggleVouchersBtn').addEventListener('click', () => toggleTableSection('voucherTableContainer', 'toggleVouchersBtn'));

    // --- Tlačítka v modálních oknech ---
    document.getElementById('closeHelpBtn').addEventListener('click', closeHelpModal);
    
    // Použijeme delegaci událostí pro tlačítka "Zrušit" v modálech
    document.body.addEventListener('click', (e) => {
        const target = e.target.closest('[data-close-modal]');
        if (target) {
            closeModal(target.dataset.closeModal);
        }
    });
}


// Počáteční zobrazení tabulek při načtení stránky
document.addEventListener('DOMContentLoaded', async () => {
    // Inicializace databáze a načtení dat
    try {
        await openDatabase();
        await loadDataFromDB();
    } catch (e) {
        console.error("Nepodařilo se načíst data z databáze.", e);
    }
    
    initEventListeners(); // Inicializace všech statických posluchačů událostí

    document.querySelectorAll('th[data-sort]').forEach(header => {
        header.addEventListener('click', () => {
            const tableId = header.closest('table').id;
            const sortKey = header.getAttribute('data-sort');
            sortTable(tableId, sortKey);
        });
    });

    setupAutocomplete('massageClientName', 'massageClientName-list');
    setupAutocomplete('purchasingClientName', 'purchasingClientName-list');
    setupAutocomplete('clientNoteClientName', 'clientNoteClientName-list');

    updateAllTables();
    checkBackupStatus(); // Spustí kontrolu zálohování po načtení stránky    
});

// ============================
// Aktivní zvýraznění lišty
// ============================
(function() {
    const moduleMap = {
        "1._maserna": "maserna",
        "2._financni_spravce": "finance",
        "3._zaznamnik": "zaznamnik",
        "4._knihovna": "knihovna"
    };

    const path = window.location.pathname;
    const matched = Object.keys(moduleMap).find(key => path.includes(key));

    if (matched) {
        const activeModule = moduleMap[matched];
        const activeLink = document.querySelector(`.module-nav a[data-module="${activeModule}"]`);
        if (activeLink) {
            activeLink.classList.add("active");
            activeLink.setAttribute("aria-current", "page");
        }
    }
})();