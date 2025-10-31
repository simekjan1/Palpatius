// =================================================================
// PALPATIUS FINANCIAL MANAGER LOGIC (script.js)
// Tento soubor obsahuje veškerou logiku pro modul Finanční správce.
// =================================================================

// Globální úložiště dat
let financialData = {
    transactions: [],
    annualMassages: {}, // Ukládáme zde roční počty masáží
    stockItems: []
};

// --- Začátek kódu pro práci s IndexDB ---
const DB_NAME = 'palpatiusFinancialDB';
const DB_VERSION = 1;
let db;

/**
 * Otevře IndexedDB databázi. Pokud neexistuje, vytvoří ji a object store.
 * @returns {Promise<IDBDatabase>} Promise s databázovým objektem.
 */
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('financialData')) {
                db.createObjectStore('financialData', { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('IndexedDB databáze Palpatius-Finanční správce byla úspěšně otevřena.');
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
        const transaction = db.transaction(['financialData'], 'readonly');
        const store = transaction.objectStore('financialData');
        const request = store.get('currentData');

        request.onsuccess = (event) => {
            if (request.result) {
                financialData = request.result.data;
                console.log('Data byla úspěšně načtena z lokálního úložiště.');
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
    const transaction = db.transaction(['financialData'], 'readwrite');
    const store = transaction.objectStore('financialData');
    const dataToSave = {
        id: 'currentData',
        data: financialData
    };
    const request = store.put(dataToSave); // Uložíme si request do proměnné

    request.onsuccess = () => {
        // Tichý úspěch, není třeba uživatele rušit
        // console.log('Finanční data úspěšně uložena do IndexedDB.');
    };

    request.onerror = (event) => {
        console.error('Chyba při ukládání finančních dat do IndexedDB:', event.target.error);
        // Použijeme existující funkci showCustomModal, která musí být v common.js
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
// --- Konec kódu pro práci s IndexDB ---

// OPRAVA: Odstraněny duplicitní proměnné, které jsou již v common.js
let sortStates = {}; // Pro uchování stavu třídění

/**
* Otevře modální okno s nápovědou.
*/
function openHelpModal() {
    lastFocusedElement = document.activeElement;
    const modal = document.getElementById('helpModal');
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
    modal.focus();
}

/**
* Zavře modální okno s nápovědou.
*/
function closeHelpModal() {
    const modal = document.getElementById('helpModal');
    modal.style.display = 'none';
    modal.classList.add('hidden');
    if (lastFocusedElement) {
        lastFocusedElement.focus();
    }
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
            if (form.id !== formId) {
                form.classList.add('hidden');
                document.querySelector(`button[aria-controls="${form.id}"]`)?.setAttribute('aria-expanded', 'false');
            }
        });
        targetForm.classList.remove('hidden');
        document.querySelector(`button[aria-controls="${formId}"]`)?.setAttribute('aria-expanded', 'true');
        activeFormId = formId;
        targetForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        targetForm.querySelector('input, textarea, select, button')?.focus();
    }
}

// --- Funkce pro rozbalování/sbalování sekcí s tabulkami ---
function toggleTableSection(containerId, buttonId) {
    const container = document.getElementById(containerId);
    const button = document.getElementById(buttonId);
    const isHidden = container.classList.contains('hidden');
    container.classList.toggle('hidden');
    button.textContent = isHidden ? 'Sbalit' : 'Zobrazit';
    button.setAttribute('aria-expanded', String(isHidden));
}


// --- Funkce pro Transakce (Účetnictví) ---
function addTransaction() {
    const dateInput = document.getElementById('transactionDate').value;
    const date = parseDateFromInput(dateInput);
    const type = document.getElementById('transactionType').value;
    const amount = parseFloat(document.getElementById('transactionAmount').value);
    const description = document.getElementById('transactionDescription').value.trim();

    if (!date || !type || isNaN(amount) || amount <= 0 || !description) {
        showCustomModal('Vyplňte prosím všechna pole transakce (Datum, Typ, Částka, Popis).', 'Chyba zadání');
        return;
    }

    const newTransaction = {
        id: Date.now().toString(),
        date,
        type,
        amount,
        description
    };
    financialData.transactions.push(newTransaction);
    document.getElementById('transactionDate').value = '';
    document.getElementById('transactionType').value = 'income';
    document.getElementById('transactionAmount').value = '';
    document.getElementById('transactionDescription').value = '';
    updateTables();
    toggleForm('transactionFormSection');
    autoSave();
}

function editTransaction(id) {
    const t = financialData.transactions.find(trans => trans.id === id);
    if (!t) return;
    const dateForInput = formatDateForInput(t.date);

    showCustomModal(`
        <div>
            <label for="editTransactionDate">Datum:</label>
            <input type="date" id="editTransactionDate" value="${dateForInput}" />
        </div>
        <div>
            <label for="editTransactionType">Typ:</label>
            <select id="editTransactionType">
                <option value="income" ${t.type === 'income' ? 'selected' : ''}>Příjem</option>
                <option value="expense" ${t.type === 'expense' ? 'selected' : ''}>Výdaj</option>
            </select>
        </div>
        <div>
            <label for="editTransactionAmount">Částka (Kč):</label>
            <input type="number" id="editTransactionAmount" value="${t.amount}" placeholder="Částka (Kč)" />
        </div>
        <div>
            <label for="editTransactionDescription">Popis transakce:</label>
            <input type="text" id="editTransactionDescription" value="${t.description}" placeholder="Popis transakce" />
        </div>
    `, `Upravit transakci`, () => {
        submitEditTransaction(id);
    }, true);
}

function submitEditTransaction(id) {
    const t = financialData.transactions.find(trans => trans.id === id);
    if (!t) return;
    t.date = parseDateFromInput(document.getElementById('editTransactionDate').value);
    t.type = document.getElementById('editTransactionType').value;
    t.amount = parseFloat(document.getElementById('editTransactionAmount').value);
    t.description = document.getElementById('editTransactionDescription').value;
    closeCustomModal(); 
    updateTables();
    autoSave();
}

function deleteTransaction(id) {
    confirmAndDeleteItem('transaction', id);
}

function displayTransactions() {
    const tbody = document.querySelector('#transactionTable tbody');
    tbody.innerHTML = '';
    const filter = document.getElementById('globalFilterInput').value.toLowerCase();
    
    let filteredTransactions = financialData.transactions.filter(t => 
        t.description.toLowerCase().includes(filter) || 
        t.amount.toString().includes(filter) ||
        t.date.includes(filter)
    );

    const sortKey = sortStates['transactionTable'] ? sortStates['transactionTable'].key : 'date';
    const sortDirection = sortStates['transactionTable'] ? sortStates['transactionTable'].direction : 'desc';

    filteredTransactions.sort((a, b) => {
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

    filteredTransactions.forEach(t => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${t.date}</td>
            <td>${t.type === 'income' ? 'Příjem' : 'Výdaj'}</td>
            <td>${t.description}</td>
            <td>${t.amount.toLocaleString('cs-CZ')} Kč</td>
            <td>
                <button class="btn-secondary" onclick="editTransaction('${t.id}')">Upravit</button>
                <button class="btn-danger" onclick="deleteTransaction('${t.id}')">Smazat</button>
                <button class="btn-export" onclick="exportItemToTxt('transaction', '${t.id}')">Export TXT</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function displayMonthlySummaries() {
    const tbody = document.querySelector('#monthlySummaryTable tbody');
    tbody.innerHTML = '';
    
    const monthlyData = {};

    financialData.transactions.forEach(t => {
        const ym = getYearMonth(t.date);
        if (!monthlyData[ym]) {
            monthlyData[ym] = { ym, income: 0, expenses: 0, profit: 0 };
        }
        if (t.type === 'income') {
            monthlyData[ym].income += t.amount || 0;
        } else {
            monthlyData[ym].expenses += t.amount || 0;
        }
        monthlyData[ym].profit = monthlyData[ym].income - monthlyData[ym].expenses;
    });
    
    let sortedMonths = Object.values(monthlyData);

    const sortKey = sortStates['monthlySummaryTable'] ? sortStates['monthlySummaryTable'].key : 'ym';
    const sortDirection = sortStates['monthlySummaryTable'] ? sortStates['monthlySummaryTable'].direction : 'asc';
    
    sortedMonths.sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];
        if (sortKey === 'ym') {
            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        } else {
            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        }
        return 0;
    });

    sortedMonths.forEach(data => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${data.ym}</td>
            <td>${data.income.toLocaleString('cs-CZ')} Kč</td>
            <td>${data.expenses.toLocaleString('cs-CZ')} Kč</td>
            <td>${data.profit.toLocaleString('cs-CZ')} Kč</td>
        `;
        tbody.appendChild(row);
    });
}

function displayAnnualSummaries() {
    const tbody = document.querySelector('#annualSummaryTable tbody');
    tbody.innerHTML = '';

    const annualData = {};
    const years = new Set();

    financialData.transactions.forEach(t => {
        const year = getYear(t.date);
        years.add(year);
        if (!annualData[year]) {
            annualData[year] = { year, income: 0, expenses: 0, profit: 0 };
        }
        if (t.type === 'income') {
            annualData[year].income += t.amount || 0;
        } else {
            annualData[year].expenses += t.amount || 0;
        }
        annualData[year].profit = annualData[year].income - annualData[year].expenses;
    });

    let sortedYears = Object.values(annualData);

    const sortKey = sortStates['annualSummaryTable'] ? sortStates['annualSummaryTable'].key : 'year';
    const sortDirection = sortStates['annualSummaryTable'] ? sortStates['annualSummaryTable'].direction : 'asc';

    sortedYears.sort((a, b) => {
        let valA = a[sortKey];
        let valB = b[sortKey];
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    sortedYears.forEach(data => {
        const massagesCount = financialData.annualMassages[data.year] || 0;
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${data.year}</td>
            <td>${data.income.toLocaleString('cs-CZ')} Kč</td>
            <td>${data.expenses.toLocaleString('cs-CZ')} Kč</td>
            <td>${data.profit.toLocaleString('cs-CZ')} Kč</td>
            <td>${massagesCount}</td>
            <td>
                <button class="btn-secondary" onclick="editAnnualMassages(${data.year})">Upravit počet masáží</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function editAnnualMassages(year) {
    const currentCount = financialData.annualMassages[year] || 0;
    showCustomModal(`
        <div>
            <label for="editMassagesCount">Počet masáží:</label>
            <input type="number" id="editMassagesCount" value="${currentCount}" min="0" />
        </div>
    `, `Upravit počet masáží pro rok ${year}`, () => {
        submitEditAnnualMassages(year);
    }, true);
}

function submitEditAnnualMassages(year) {
    const newCount = parseInt(document.getElementById('editMassagesCount').value);
    if (!isNaN(newCount) && newCount >= 0) {
        financialData.annualMassages[year] = newCount;
    } else {
        showCustomModal('Zadejte prosím platné číslo pro počet masáží.', 'Chyba zadání');
    }
    closeCustomModal();
    updateTables();
    autoSave();
}

function addItemToStock() {
    const name = document.getElementById('itemName').value.trim();
    const unit = document.getElementById('itemUnit').value.trim();
    const quantity = parseInt(document.getElementById('itemQuantity').value);
    const minQuantity = parseInt(document.getElementById('itemMinQuantity').value);

    if (!name || !unit || isNaN(quantity) || isNaN(minQuantity) || quantity < 0 || minQuantity < 0) {
        showCustomModal('Prosím, vyplňte všechna pole správně.', 'Chyba zadání');
        return;
    }
    financialData.stockItems.push({ id: Date.now().toString(), name, unit, quantity, minQuantity });
    document.getElementById('itemName').value = '';
    document.getElementById('itemUnit').value = '';
    document.getElementById('itemQuantity').value = '';
    document.getElementById('itemMinQuantity').value = '';
    updateTables();
    toggleForm('stockItemFormSection');
    autoSave();
}

function adjustStockQuantity(id) {
    const item = financialData.stockItems.find(i => i.id === id);
    if (!item) return;

    document.getElementById('adjustStockModalTitle').textContent = `Upravit množství: ${item.name}`;
    document.getElementById('adjustStockModalItemName').textContent = `Aktuálně na skladě: ${item.quantity} ${item.unit}`;
    document.getElementById('adjustAmountInput').value = '';
    
    lastFocusedElement = document.activeElement;
    const modal = document.getElementById('adjustStockQuantityModal');
    modal.style.display = 'flex';
    modal.focus();
    
    document.getElementById('submitAdjustQuantityBtn').onclick = () => submitAdjustQuantity(id);
}

function submitAdjustQuantity(id) {
    const item = financialData.stockItems.find(i => i.id === id);
    if (!item) return;
    const adjustAmount = parseInt(document.getElementById('adjustAmountInput').value);

    if (isNaN(adjustAmount)) {
        showCustomModal('Prosím, zadejte platné číslo pro změnu množství.', 'Chyba zadání');
        return;
    }
    const newQuantity = item.quantity + adjustAmount;
    if (newQuantity < 0) {
        showCustomModal('Množství na skladě nemůže klesnout pod nulu!', 'Chyba zadání');
        return;
    }
    item.quantity = newQuantity;
    closeModal('adjustStockQuantityModal');
    updateTables();
    autoSave();
}

function editStockItem(id) {
    const item = financialData.stockItems.find(i => i.id === id);
    if (!item) return;

    showCustomModal(`
        <div>
            <label for="editName">Název položky:</label>
            <input type="text" id="editName" value="${item.name}" />
        </div>
        <div>
            <label for="editUnit">Jednotka:</label>
            <input type="text" id="editUnit" value="${item.unit}" />
        </div>
        <div>
            <label for="editQuantity">Množství na skladě:</label>
            <input type="number" id="editQuantity" value="${item.quantity}" min="0" />
        </div>
        <div>
            <label for="editMinQuantity">Minimální množství:</label>
            <input type="number" id="editMinQuantity" value="${item.minQuantity}" min="0" />
        </div>
    `, `Upravit položku skladu`, () => {
        submitEditStockItem(id);
    }, true);
}

function submitEditStockItem(id) {
    const item = financialData.stockItems.find(i => i.id === id);
    if (!item) return;
    item.name = document.getElementById('editName').value;
    item.unit = document.getElementById('editUnit').value;
    const newQuantity = parseInt(document.getElementById('editQuantity').value);
    const newMinQuantity = parseInt(document.getElementById('editMinQuantity').value);

    if (isNaN(newQuantity) || isNaN(newMinQuantity) || newQuantity < 0 || newMinQuantity < 0) {
        showCustomModal('Prosím, zadejte platná čísla.', 'Chyba zadání');
        return;
    }
    item.quantity = newQuantity;
    item.minQuantity = newMinQuantity;
    closeCustomModal();
    updateTables();
    autoSave();
}

function deleteStockItem(id) {
    confirmAndDeleteItem('stockItem', id);
}

function displayStockItems() {
    const tbody = document.querySelector('#stockTable tbody');
    tbody.innerHTML = '';
    const filter = document.getElementById('globalFilterInput').value.toLowerCase();

    let filteredStockItems = financialData.stockItems.filter(item =>
        item.name.toLowerCase().includes(filter) ||
        item.unit.toLowerCase().includes(filter) ||
        item.quantity.toString().includes(filter)
    );

    const sortKey = sortStates['stockTable'] ? sortStates['stockTable'].key : 'name';
    const sortDirection = sortStates['stockTable'] ? sortStates['stockTable'].direction : 'asc';
    
    filteredStockItems.sort((a, b) => {
        let valA, valB;
        if (sortKey === 'quantity' || sortKey === 'minQuantity') {
            valA = a[sortKey];
            valB = b[sortKey];
        } else if (sortKey === 'status') {
            const statusA = a.quantity <= a.minQuantity ? 1 : 0; // Low stock first
            const statusB = b.quantity <= b.minQuantity ? 1 : 0;
            valA = statusA;
            valB = statusB;
        } else {
            valA = a[sortKey].toLowerCase();
            valB = b[sortKey].toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    filteredStockItems.forEach(item => {
        const row = document.createElement('tr');
        let statusText = 'OK';
        let rowClass = '';
        if (item.quantity <= item.minQuantity) {
            statusText = 'Nízký stav!';
            rowClass = 'low-stock';
        }
        row.className = rowClass;
        row.innerHTML = `
            <td>${item.name}</td>
            <td>${item.unit}</td>
            <td>${item.quantity}</td>
            <td>${item.minQuantity}</td>
            <td>${statusText}</td>
            <td>
                <button class="btn-primary" onclick="adjustStockQuantity('${item.id}')">Upravit množství</button>
                <button class="btn-secondary" onclick="editStockItem('${item.id}')">Upravit položku</button>
                <button class="btn-danger" onclick="deleteStockItem('${item.id}')">Smazat</button>
                <button class="btn-export" onclick="exportItemToTxt('stockItem', '${item.id}')">Export TXT</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function confirmAndDeleteItem(type, id) {
    showCustomModal('Opravdu chcete odstranit tento záznam?', 'Potvrdit smazání', () => {
        if (type === 'transaction') {
            financialData.transactions = financialData.transactions.filter(t => t.id !== id);
        } else if (type === 'stockItem') {
            financialData.stockItems = financialData.stockItems.filter(i => i.id !== id);
        }
        updateTables();
        autoSave();
    }, true);
}

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
    updateTables();
}

function updateTables() {
    displayTransactions();
    displayMonthlySummaries();
    displayAnnualSummaries();
    displayStockItems();
}

function clearFilter() {
    document.getElementById('globalFilterInput').value = '';
    updateTables();
}

function exportAllData() {
    try {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(financialData, null, 2));
        const dl = document.createElement('a');
        dl.setAttribute("href", dataStr);
        dl.setAttribute("download", "financni_data.json");
        dl.click();
        showCustomModal("Všechna finanční data byly úspěšně exportována jako JSON.");
    } catch (error) {
        console.error("Chyba při exportu JSON dat:", error);
        showCustomModal("Nastala chyba při exportu dat.", 'Chyba exportu');
    }
}

function importAllData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
        try {
            const importedData = JSON.parse(e.target.result);
             if (
                importedData && typeof importedData === 'object' &&
                'transactions' in importedData && Array.isArray(importedData.transactions) &&
                'annualMassages' in importedData && typeof importedData.annualMassages === 'object' &&
                'stockItems' in importedData && Array.isArray(importedData.stockItems)
            ) {
                showCustomModal(
                    'Opravdu chcete přepsat všechna stávající data?',
                    'Potvrdit import',
                    async () => {
                        importedData.transactions.forEach(item => item.id = item.id ? String(item.id) : Date.now().toString());
                        importedData.stockItems.forEach(item => item.id = item.id ? String(item.id) : Date.now().toString());
                        financialData = importedData;
                        await saveDataToDB();
                        updateTables();
                        showCustomModal('Finanční data byla úspěšně importována!');
                    },
                    true
                );
            } else {
                showCustomModal('Chyba: Importovaný soubor nemá očekávaný formát.', 'Chyba importu');
            }
        } catch (e) {
            console.error("Chyba při importu JSON souboru:", e);
            showCustomModal('Chyba při čtení JSON souboru: ' + e.message, 'Chyba importu');
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

function exportItemToTxt(type, id) {
    let item, fileName, content = "", dataToExport = {};
    switch (type) {
        case 'transaction':
            item = financialData.transactions.find(t => t.id === id);
            if (!item) return;
            dataToExport = { "Datum": item.date, "Typ": item.type === 'income' ? 'Příjem' : 'Výdaj', "Popis": item.description, "Částka": `${item.amount.toLocaleString('cs-CZ')} Kč` };
            fileName = `transakce_${item.date.replace(/\./g, '_')}_${item.id}.txt`;
            break;
        case 'stockItem':
            item = financialData.stockItems.find(i => i.id === id);
            if (!item) return;
            dataToExport = { "Název položky": item.name, "Jednotka": item.unit, "Množství na skladě": `${item.quantity}`, "Minimální množství": `${item.minQuantity}`, "Stav": item.quantity <= item.minQuantity ? 'Nízký stav!' : 'OK' };
            fileName = `sklad_${item.name.replace(/\s/g, '_')}_${item.id}.txt`;
            break;
        default: showCustomModal('Nelze exportovat tento typ záznamu do TXT.', 'Chyba exportu'); return;
    }
    for (const key in dataToExport) { content += `${key}: ${dataToExport[key]}\n`; }
    if (item && content) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
        showCustomModal(`Záznam byl úspěšně exportován jako "${fileName}".`, "Export úspěšný");
    } else {
        showCustomModal('Nepodařilo se najít záznam pro export.', 'Chyba exportu');
    }
}

function initEventListeners() {
    document.getElementById('exportAllBtn').addEventListener('click', exportAllData);
    document.getElementById('importAllInput').addEventListener('change', importAllData);
    document.getElementById('helpBtn').addEventListener('click', openHelpModal);
    document.getElementById('clearFilterBtn').addEventListener('click', clearFilter);
    document.getElementById('globalFilterInput').addEventListener('input', updateTables);

    document.getElementById('toggleTransactionFormBtn').addEventListener('click', () => toggleForm('transactionFormSection'));
    document.getElementById('toggleStockItemFormBtn').addEventListener('click', () => toggleForm('stockItemFormSection'));
    
    document.getElementById('addTransactionBtn').addEventListener('click', (event) => {
        event.preventDefault();
        addTransaction();
    });
    document.getElementById('addStockItemBtn').addEventListener('click', (event) => {
        event.preventDefault();
        addItemToStock();
    });
    
    document.getElementById('toggleTransactionsBtn').addEventListener('click', () => toggleTableSection('transactionTableContainer', 'toggleTransactionsBtn'));
    document.getElementById('toggleMonthlySummaryBtn').addEventListener('click', () => toggleTableSection('monthlySummaryTableContainer', 'toggleMonthlySummaryBtn'));
    document.getElementById('toggleAnnualSummaryBtn').addEventListener('click', () => toggleTableSection('annualSummaryTableContainer', 'toggleAnnualSummaryBtn'));
    document.getElementById('toggleStockBtn').addEventListener('click', () => toggleTableSection('stockTableContainer', 'toggleStockBtn'));

    document.getElementById('closeHelpBtn').addEventListener('click', closeHelpModal);

    document.body.addEventListener('click', (e) => {
        const target = e.target.closest('[data-close-modal]');
        if (target) {
            closeModal(target.dataset.closeModal);
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await openDatabase();
        await loadDataFromDB();
    } catch (e) {
        console.error("Nepodařilo se načíst data z databáze.", e);
    }
    
    initEventListeners();

    document.querySelectorAll('th[data-sort]').forEach(header => {
        header.addEventListener('click', () => {
            const tableId = header.closest('table').id;
            const sortKey = header.getAttribute('data-sort');
            sortTable(tableId, sortKey);
        });
    });
    
    updateTables();
});