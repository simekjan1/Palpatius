/*
 Palpatius kontroler
 -------------------
 Pouze čtecí nástroj pro kontrolu aktivity modulů.
 Neprovádí žádné zápisy ani úpravy dat.
*/

const MODULES = [
    {
        key: "maserna",
        label: "Masérna",
        dbName: "palpatiusMasernaDB",
        storeName: "masernaData",
        recordKey: "currentData"
    },
    {
        key: "finance",
        label: "Finanční správce",
        dbName: "palpatiusFinancialDB",
        storeName: "financialData",
        recordKey: "currentData"
    },
    {
        key: "zaznamnik",
        label: "Záznamník",
        dbName: "PalpatiusZaznamnikDB",
        storeName: "zaznamnikData",
        recordKey: "currentData"
    },
    {
        key: "knihovna",
        label: "Knihovna",
        dbName: "PalpatiusKnihovnaDB",
        storeName: "knihovnaData",
        recordKey: "currentData"
    }
];

/**
 * Pokusí se otevřít databázi a načíst záznam.
 * @param {Object} module
 * @returns {Promise<boolean>} true = data existují, false = neexistují
 */
function checkModuleActivity(module) {
    return new Promise((resolve) => {
        try {
            const request = indexedDB.open(module.dbName);

            request.onerror = () => {
                resolve(false);
            };

            request.onsuccess = () => {
                const db = request.result;

                if (!db.objectStoreNames.contains(module.storeName)) {
                    db.close();
                    resolve(false);
                    return;
                }

                const tx = db.transaction(module.storeName, "readonly");
                const store = tx.objectStore(module.storeName);
                const getReq = store.get(module.recordKey);

                getReq.onsuccess = () => {
                    db.close();
                    resolve(!!getReq.result);
                };

                getReq.onerror = () => {
                    db.close();
                    resolve(false);
                };
            };
        } catch (e) {
            resolve(false);
        }
    });
}

/**
 * Aktualizuje řádek tabulky podle výsledku.
 */
function updateRow(moduleKey, hasData) {
    const row = document.querySelector(`tr[data-module="${moduleKey}"]`);
    if (!row) return;

    const activityCell = row.querySelector(".last-activity");
    const statusCell = row.querySelector(".status");

    if (hasData) {
        activityCell.textContent = "Data existují";
        statusCell.textContent = "Aktivní";
        statusCell.classList.add("status-active");
    } else {
        activityCell.textContent = "Nikdy";
        statusCell.textContent = "Bez dat";
        statusCell.classList.add("status-empty");
    }
}

/**
 * Inicializace kontroleru
 */
async function initController() {
    for (const module of MODULES) {
        updateRow(module.key, false); // výchozí stav

        const hasData = await checkModuleActivity(module);
        updateRow(module.key, hasData);
    }
}

document.addEventListener("DOMContentLoaded", initController);
