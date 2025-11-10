/* backup.js
    Automatické zálohování IndexedDB pro Palpatius
    - non-invazivní: obaluje IDB object store metody
    - ukládá JSON zálohy do složky vybrané uživatelem (File System Access API)
      nebo nabízí download pokud API není dostupné
    - přístupnost: tlačítka mají aria-* a tabindex
    - všechny výjimky ošetřeny v try...catch
    Prefixy: všechny proměnné/funkce mají prefix backup_
*/

/* ========== Konfigurace ========== */
// Default názvy DB pokud browser nepodporuje indexedDB.databases()
const backup_defaultDBNames = [
    'palpatiusMasernaDB',
    'palpatiusFinancialDB',
    'PalpatiusZaznamnikDB',
    'PalpatiusKnihovnaDB'
];

const backup_debounceMs = 1200; // malé sloučení více operací do jedné zálohy
const backup_filenamePrefix = 'palpatius_backup_'; // prefix pro soubory

/* ========== Stav modulu ========== */
let backup_dirHandle = null;       // File System Access: handle vybrané složky
let backup_scheduled = false;
let backup_lastExport = null;

/* ========== Helper funkce ========== */

/** Získat časové razítko ve formátu YYYYMMDD_HHMMSS */
function backup_timeStamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/** Bezpečné volání konzole (pokud není) */
function backup_log(...args) {
    try { console.log('[backup]','', ...args); } catch(e){ /* ticho */ }
}

/** Fallback pro download JSON (pokud FS Access není k dispozici) */
function backup_downloadJSON(text, filename) {
    try {
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        backup_log('Stáhnutí zálohy:', filename);
    } catch (err) {
        console.error('[backup] Chyba při downloadu zálohy:', err);
    }
}

/* ========== Snímání databází ========== */

/**
 * Pokusí se získat seznam databází pomocí experimentalní indexedDB.databases().
 * Pokud není dostupné, vrátí backup_defaultDBNames.
 */
async function backup_getDatabaseNames() {
    try {
        if (indexedDB && typeof indexedDB.databases === 'function') {
            const dbs = await indexedDB.databases();
            // dbs může být pole objektů s { name, version }
            const names = dbs.map(x => x.name).filter(Boolean);
            if (names.length) {
                backup_log('Nalezené DB (indexedDB.databases):', names);
                return names;
            }
        }
    } catch (err) {
        // Některé prohlížeče vyhazují bezpečnostní chybu — to je OK, použij default
        backup_log('indexedDB.databases() nereagovalo, použiju default seznam.');
    }
    // fallback
    return backup_defaultDBNames.slice();
}

/**
 * Export jedné DB: otevře, projde object storey a načte všechna data.
 * Výstup: { dbName, version, objectStores: { storeName: [records...] } }
 */
function backup_exportDatabase(dbName) {
    return new Promise((resolve) => {
        try {
            const req = indexedDB.open(dbName);
            req.onsuccess = (evt) => {
                try {
                    const db = evt.target.result;
                    const out = { dbName, version: db.version, objectStores: {} };
                    const stores = Array.from(db.objectStoreNames || []);
                    if (!stores.length) {
                        db.close();
                        resolve(out);
                        return;
                    }
                    let pending = stores.length;
                    stores.forEach(storeName => {
                        try {
                            const tx = db.transaction(storeName, 'readonly');
                            const store = tx.objectStore(storeName);
                            const getAllReq = store.getAll();
                            getAllReq.onsuccess = () => {
                                out.objectStores[storeName] = getAllReq.result || [];
                                pending--;
                                if (pending === 0) {
                                    db.close();
                                    resolve(out);
                                }
                            };
                            getAllReq.onerror = () => {
                                // pokud selže jeden store, logneme a vrátíme prázdné pole
                                out.objectStores[storeName] = [];
                                pending--;
                                if (pending === 0) {
                                    db.close();
                                    resolve(out);
                                }
                            };
                        } catch (errStore) {
                            out.objectStores[storeName] = [];
                            pending--;
                            if (pending === 0) {
                                db.close();
                                resolve(out);
                            }
                        }
                    });
                } catch (errInner) {
                    backup_log('Chyba při čtení DB (onsuccess):', dbName, errInner);
                    resolve({ dbName, version: null, objectStores: {} });
                }
            };
            req.onerror = () => {
                backup_log('Nelze otevřít DB (onerror):', dbName);
                resolve({ dbName, version: null, objectStores: {} });
            };
            req.onupgradeneeded = () => {
                // Nic neděláme — nechceme měnit schéma DB
            };
        } catch (err) {
            backup_log('Chyba při pokusu o export DB:', dbName, err);
            resolve({ dbName, version: null, objectStores: {} });
        }
    });
}

/**
 * Export všech DB v seznamu
 */
async function backup_exportAllDatabases() {
    const names = await backup_getDatabaseNames();
    const results = [];
    for (const n of names) {
        try {
            const r = await backup_exportDatabase(n);
            results.push(r);
        } catch (err) {
            backup_log('Chyba exportu DB:', n, err);
            results.push({ dbName: n, version: null, objectStores: {} });
        }
    }
    return results;
}

/* ========== Ukládání zálohy ========== */

/** Uloží JSON do vybrané složky (FS Access) */
async function backup_writeToDirectory(text, filename) {
    try {
        if (!backup_dirHandle) throw new Error('Žádná složka není vybrána');
        const fileHandle = await backup_dirHandle.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(text);
        await writable.close();
        backup_log('Záloha uložena do složky:', filename);
        return true;
    } catch (err) {
        backup_log('Nelze zapsat do složky:', err);
        return false;
    }
}

/** Hlavní funkce: export + uložení (FS Access nebo download) */
async function backup_performExport() {
    try {
        const all = await backup_exportAllDatabases();
        const meta = {
            exportedAt: new Date().toISOString(),
            palpatiusVersion: 'unknown' // můžeš doplnit verzi, pokud ji máš
        };
        const payload = { meta, data: all };
        const text = JSON.stringify(payload, null, 2);
        const filename = `${backup_filenamePrefix}${backup_timeStamp()}.json`;

        // Pokus se uložit do vybrané složky
        if (backup_dirHandle) {
            const ok = await backup_writeToDirectory(text, filename);
            if (!ok) {
                // pokud selže, nabídneme fallback download
                backup_downloadJSON(text, filename);
            }
        } else {
            // fallback: nabídni download
            backup_downloadJSON(text, filename);
        }

        backup_lastExport = { filename, time: new Date().toISOString() };
        backup_updateStatus(`Záloha provedena: ${filename}`);
    } catch (err) {
        console.error('[backup] Chyba při exportu všech DB:', err);
        backup_updateStatus('Chyba zálohy - zkontroluj konzoli');
    }
}

/* ========== Schedulování záloh (debounce) ========== */
function backup_scheduleExport() {
    if (backup_scheduled) return;
    backup_scheduled = true;
    setTimeout(async () => {
        backup_scheduled = false;
        await backup_performExport();
    }, backup_debounceMs);
}

/* ========== Interception IDB změn ========== */

/**
 * Obalí IDBObjectStore.prototype.add/put/delete tak, aby po úspěchu spustil zálohu.
 * Nezasahujeme do logiky návratových hodnot, pouze přidáme onsuccess handler.
 */
function backup_wrapIDBMethods() {
    try {
        const proto = IDBObjectStore && IDBObjectStore.prototype;
        if (!proto) return;

        ['add', 'put', 'delete'].forEach(methodName => {
            if (typeof proto[methodName] !== 'function') return;
            const orig = proto[methodName];
            proto[methodName] = function(...args) {
                try {
                    const req = orig.apply(this, args);
                    // pokud vrací IDBRequest, přidáme onsuccess listener
                    if (req && typeof req.addEventListener === 'function') {
                        req.addEventListener('success', () => {
                            try {
                                backup_scheduleExport();
                            } catch (e) { /* ignore */ }
                        });
                    } else if (req && typeof req.onsuccess !== 'undefined') {
                        const prev = req.onsuccess;
                        req.onsuccess = function(ev) {
                            try { if (typeof prev === 'function') prev.call(this, ev); } catch(e){}
                            try { backup_scheduleExport(); } catch(e){}
                        };
                    } else {
                        // pokud nelze zjistit, prostě naplánuj zálohu
                        backup_scheduleExport();
                    }
                    return req;
                } catch (err) {
                    // pokud se něco pokazí, nebráníme původní chybě
                    backup_log('Chyba v obalení IDB metody', methodName, err);
                    return orig.apply(this, args);
                }
            };
        });
        backup_log('IDB metody byly obaleny pro automatické zálohování.');
    } catch (err) {
        backup_log('Nelze obalit IDB metody:', err);
    }
}

/* ========== UI: drobné ovládání pro uživatele = */

/** Vloží ovládací panel do stránky (nenápadně, přístupně) */
function backup_injectUI() {
    try {
        if (document.getElementById('backup_panel')) return;
        const container = document.createElement('div');
        container.id = 'backup_panel';
        container.style.position = 'fixed';
        container.style.right = '12px';
        container.style.bottom = '12px';
        container.style.zIndex = 9999;
        container.style.background = 'rgba(255,255,255,0.95)';
        container.style.border = '1px solid #ccc';
        container.style.padding = '8px';
        container.style.borderRadius = '8px';
        container.style.boxShadow = '0 2px 6px rgba(0,0,0,0.12)';
        container.style.fontSize = '13px';
        container.style.maxWidth = '240px';

        const title = document.createElement('div');
        title.textContent = 'Zálohy Palpatius';
        title.style.fontWeight = '600';
        title.style.marginBottom = '6px';
        container.appendChild(title);

        const chooseBtn = document.createElement('button');
        chooseBtn.type = 'button';
        chooseBtn.id = 'backup_choose_folder';
        chooseBtn.textContent = 'Vybrat složku pro zálohy';
        // ZMĚNA 1: Lepší ARIA Label
        chooseBtn.setAttribute('aria-label', 'Nastavit automatické zálohování: Vyber složku na disku pro ukládání záloh');
        chooseBtn.tabIndex = 0;
        chooseBtn.style.display = 'block';
        chooseBtn.style.width = '100%';
        chooseBtn.style.marginBottom = '6px';
        chooseBtn.addEventListener('click', async () => {
            try {
                if (window.showDirectoryPicker) {
                    backup_dirHandle = await window.showDirectoryPicker();
                    backup_updateStatus('Vybrána složka pro zálohy');
                } else {
                    backup_updateStatus('Volba složky není ve tvém prohlížeči dostupná.');
                }
            } catch (err) {
                backup_log('Uživatel zrušil výběr složky nebo chyba:', err);
            }
        });
        container.appendChild(chooseBtn);

        const nowBtn = document.createElement('button');
        nowBtn.type = 'button';
        nowBtn.textContent = 'Zálohovat nyní';
        nowBtn.setAttribute('aria-label', 'Vytvořit zálohu nyní');
        nowBtn.tabIndex = 0;
        nowBtn.style.display = 'block';
        nowBtn.style.width = '100%';
        nowBtn.style.marginBottom = '6px';
        nowBtn.addEventListener('click', async () => {
            backup_updateStatus('Probíhá záloha...');
            await backup_performExport();
        });
        container.appendChild(nowBtn);

        const status = document.createElement('div');
        status.id = 'backup_status';
        status.textContent = 'Žádná záloha dosud';
        status.style.fontSize = '12px';
        status.style.marginTop = '4px';
        container.appendChild(status);

        // ZMĚNA 2: Přidání ARIA role a Focus Management pro upozornění čtečky
        container.setAttribute('role', 'region');
        container.setAttribute('aria-label', 'Panel automatických záloh Palpatius. Obsahuje volby pro nastavení zálohování dat.');
        
        document.body.appendChild(container);

        // MAX: Po vložení prvku zajistíme krátký focus pro upozornění čtečky obrazovky
        setTimeout(() => {
            try {
                container.setAttribute('tabindex', '-1'); 
                container.focus();
                // Focus necháme na panelu. Uživatel buď začne tabulovat tlačítka, nebo se přesune jinam.
            } catch(e) {
                /* ignore */
            }
        }, 500); // Půl sekundy na ustálení DOM
        
    } catch (err) {
        backup_log('Nelze vložit UI panel:', err);
    }
}

function backup_updateStatus(text) {
    try {
        const s = document.getElementById('backup_status');
        if (s) s.textContent = text;
        backup_log(text);
    } catch (e) { /* ignore */ }
}

/* ========== Inicializace modulu ========== */
function backup_init() {
    try {
        // 1) obalíme IDB metody tak, abychom věděli o změnách
        if (typeof IDBObjectStore !== 'undefined') {
            backup_wrapIDBMethods();
        }

        // 2) injektujeme UI, aby uživatel mohl vybrat složku nebo spustit ručně
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            backup_injectUI();
        } else {
            window.addEventListener('DOMContentLoaded', backup_injectUI);
        }

        // 3) při zavření okna uděláme poslední zálohu (pokud dojde k události)
        window.addEventListener('beforeunload', () => {
            // synchronní blokování není možné — jen naplánujeme rychlou zálohu
            try { backup_performExport(); } catch (e) { /* ignore */ }
        });

        backup_log('Backup modul inicializován.');
    } catch (err) {
        console.error('[backup] Inicializace selhala:', err);
    }
}

// Start
backup_init();