/* FS Extra – SANDBOX VERSION
   Nepoužívá žádné globální Palpatius skripty.
*/

/* ============================================
   1) IndexedDB – Inicializace
   ============================================ */

const DB_NAME = "fs_extra";
const DB_VERSION = 1;

async function initFsExtraDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains("channels")) {
        const store = db.createObjectStore("channels", {
          keyPath: "id",
          autoIncrement: true
        });
        store.createIndex("name", "name", { unique: false });
      }

      if (!db.objectStoreNames.contains("transactions")) {
        const store = db.createObjectStore("transactions", {
          keyPath: "id",
          autoIncrement: true
        });
        store.createIndex("idFS", "idFS", { unique: false });
        store.createIndex("status", "status", { unique: false });
      }
    };

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/* ============================================
   2) Ukládání / Úprava kanálů
   ============================================ */

async function saveChannelToDB(channel) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("channels", "readwrite");
      tx.objectStore("channels").add(channel);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    };
  });
}

async function updateChannelInDB(index, newData) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("channels", "readwrite");
      const store = tx.objectStore("channels");

      const existing = channels[index];
      if (!existing) return resolve();

      const updated = { ...existing, ...newData };
      store.put(updated);

      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    };
  });
}

async function loadChannelsFromDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction("channels", "readonly");
      const req = tx.objectStore("channels").getAll();

      req.onsuccess = () => {
        channels = req.result || [];
        renderChannels();
        fillChannelSelect(); 
        resolve();
      };
      req.onerror = () => reject(req.error);
    };
  });
}

let channels = [];

initFsExtraDB().then(loadChannelsFromDB);

/* ============================================
   3) Render kanálů + formuláře
   ============================================ */

function renderChannels() {
  const tbody = document.getElementById("channels-table-body");
  tbody.innerHTML = "";

  channels.forEach((ch, index) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${ch.name}</td>
      <td>${ch.percent || 0}%</td>
      <td>${ch.fixed || 0} Kč</td>
      <td>${ch.note || ""}</td>
      <td><button class="btn-outline edit-channel" data-index="${index}">Upravit</button></td>
    `;

    tbody.appendChild(tr);
  });
}

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("edit-channel")) {
    const index = parseInt(e.target.dataset.index);
    openEditChannelForm(index);
  }
});

document.getElementById("add-channel").onclick = () => {
  document.getElementById("channel-form").classList.remove("hidden");
};

document.getElementById("channel-form-element").onsubmit = async (e) => {
  e.preventDefault();

  const form = document.getElementById("channel-form");
  const editingIndex = form.dataset.editing;
  const editMode = editingIndex !== undefined;

  const data = {
    name: document.getElementById("channel-name").value.trim(),
    percent: parseFloat(document.getElementById("channel-percent").value) || 0,
    fixed: parseFloat(document.getElementById("channel-fixed").value) || 0,
    note: document.getElementById("channel-note").value.trim()
  };

  if (!editMode) {
    await saveChannelToDB(data);
  } else {
    await updateChannelInDB(editingIndex, data);
    delete form.dataset.editing;
  }

  await loadChannelsFromDB();

  e.target.reset();
  form.classList.add("hidden");
};

function openEditChannelForm(index) {
  const ch = channels[index];
  if (!ch) return;

  const form = document.getElementById("channel-form");
  form.dataset.editing = index;

  document.getElementById("channel-name").value = ch.name;
  document.getElementById("channel-percent").value = ch.percent;
  document.getElementById("channel-fixed").value = ch.fixed;
  document.getElementById("channel-note").value = ch.note || "";

  form.classList.remove("hidden");
}

/* ============================================
   4) Transakce – načítání z hlavní DB FS / Filtrování
   ============================================ */

let transactions = [];

async function loadFsTransactions() {
  return new Promise((resolve, reject) => {
    // Používáme DB_VERSION 2 z hlavního FS a cílíme na Object Store 'financialData' a klíč 'currentData'
    const request = indexedDB.open("palpatiusFinancialDB", 2); 

    request.onsuccess = () => {
      const db = request.result;
      
      const req = db.transaction("financialData", "readonly")
                    .objectStore("financialData")
                    .get("currentData"); // Získá celý objekt s daty

      req.onsuccess = () => {
        // Vracíme jen pole transakcí zevnitř uloženého objektu
        if (req.result && req.result.data && Array.isArray(req.result.data.transactions)) {
          resolve(req.result.data.transactions);
        } else {
          resolve([]); // V případě chyby nebo prázdné DB vrátíme prázdné pole
        }
      };
      req.onerror = () => reject(req.error);
    };
    
    request.onerror = () => reject(request.error);
  });
}

async function loadTransactionsFromDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onsuccess = () => {
      const db = request.result;
      const req = db.transaction("transactions", "readonly")
                    .objectStore("transactions")
                    .getAll();

      req.onsuccess = () => {
        transactions = req.result || [];
        resolve();
      };
    };
  });
}

async function syncTransactionsToFsExtra(fsList) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onsuccess = () => {
      const db = request.result;
      const store = db.transaction("transactions", "readwrite").objectStore("transactions");

      const getReq = store.getAll();
      getReq.onsuccess = () => {
        const known = new Set(getReq.result.map(t => t.idFS));

        fsList.forEach(row => {
          // Ukládáme jen PŘÍJMY z hlavního FS, protože poplatky se vztahují jen k nim.
          if (!known.has(row.id) && row.type === 'income') {
            store.add({
              idFS: row.id,
              date: row.date,
              desc: row.description,
              brutto: row.amount,
              channelId: null,
              netto: null,
              status: "pending"
            });
          }
        });

        resolve();
      };
    };
  });
}

document.getElementById("load-transactions").onclick = async () => {
  const fsList = await loadFsTransactions();
  await syncTransactionsToFsExtra(fsList);
  await loadTransactionsFromDb();
  filterAndRenderTransactions(); 
};

function filterAndRenderTransactions() {
  const filterStatus = document.getElementById("filter-status").value;

  const filteredTransactions = transactions.filter(t => {
    if (filterStatus === "all") {
      return true;
    }
    const transactionStatus = t.status; 
    const requiredStatus = filterStatus === "done" ? "completed" : "pending";
    
    return transactionStatus === requiredStatus;
  });

  renderTransactions(filteredTransactions);
}

function renderTransactions(list) {
  const tbody = document.getElementById("transactions-table-body");
  tbody.innerHTML = "";

  const transactionsToRender = list || transactions;

  transactionsToRender.forEach((t) => { 
    const channel = channels.find(c => c.id === t.channelId);

    let nettoText = "";
    if (channel) {
      const fee = (t.brutto * (channel.percent / 100)) + channel.fixed;
      const calculatedNetto = t.brutto - fee;
      
      nettoText = Math.round(calculatedNetto) + " Kč";
    } else {
      nettoText = "N/A"; 
    }

    // Předáváme T.ID, ne index.
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.date}</td>
      <td>${t.desc}</td>
      <td>${t.brutto} Kč</td> 
      <td>${channel ? channel.name : "Nepřiřazeno"}</td> 
      <td>${nettoText}</td> 
      <td><button class="btn-outline assign-channel" data-id="${t.id}">Přiřadit</button></td> 
    `;
    
    tbody.appendChild(tr);
  });
}

document.getElementById("filter-status").onchange = filterAndRenderTransactions;

/* ============================================
   5) Přiřazení kanálu
   ============================================ */

document.addEventListener("click", (e) => {
  if (e.target.classList.contains("assign-channel")) {
    // Čteme data-id
    const id = e.target.dataset.id;
    openAssignChannelDialog(id);
  }
});

// Opravená funkce pro zobrazení dialogu (včetně kontroly kanálů a obsahu dialogu)
function openAssignChannelDialog(id) {
  // Najdeme transakci v globálním poli podle ID
const t = transactions.find(trans => trans.id === Number(id));
  if (!t) return;

  const panel = document.getElementById("assign-channel-panel");
  const list = document.getElementById("assign-channel-list");

  // KONTROLA: Zajištění, že máme nějaké kanály
  if (channels.length === 0) {
      // Tady jsem přidal alert, abys věděl, proč se dialog neobjeví
      alert("Nejsou definovány žádné platební kanály. Přidejte je prosím v sekci 'Platební kanály'.");
      return;
  }
  
  list.innerHTML = "";
  
  // Přidání hlavičky dialogu pro lepší UX
  const header = document.createElement("h3");
  header.textContent = `Přiřadit kanál k transakci: ${t.desc} (${t.brutto} Kč)`;
  header.className = "text-lg font-semibold mb-3";
  list.appendChild(header);


  channels.forEach((ch) => {
    const b = document.createElement("button");
    b.className = "btn-outline w-full px-3 py-2 my-1";
    b.textContent = `${ch.name} (${ch.percent}% + ${ch.fixed} Kč)`;

    b.onclick = async () => {
      await assignChannelToTransaction(t, ch);
      panel.classList.add("hidden");
      await loadTransactionsFromDb();
      filterAndRenderTransactions(); 
      calculateSummary(); 
    };

    list.appendChild(b);
  });

  // Tlačítko Zavřít
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Zavřít";
  closeBtn.className = "btn-secondary w-full px-3 py-2 mt-3";
  closeBtn.onclick = () => panel.classList.add("hidden");
  list.appendChild(closeBtn);

  // Zobrazí se panel
  panel.classList.remove("hidden");
}

async function assignChannelToTransaction(t, channel) {
  const netto = t.brutto - (t.brutto * (channel.percent / 100)) - channel.fixed;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onsuccess = () => {
      const db = request.result;

      const updated = {
        ...t,
        channelId: channel.id,
        netto: Math.round(netto), 
        status: "completed"
      };

      const tx = db.transaction("transactions", "readwrite");
      tx.objectStore("transactions").put(updated);
      tx.oncomplete = resolve;
      tx.onerror = reject;
    };
  });
}

/* ============================================
   6) Souhrny
   ============================================ */

function fillChannelSelect() {
    const select = document.getElementById("summary-channel");
    select.innerHTML = '<option value="all">Všechny kanály</option>'; 
    
    channels.forEach(ch => {
        const option = document.createElement("option");
        option.value = ch.id;
        option.textContent = ch.name;
        select.appendChild(option);
    });
}

function calculateSummary() {
  const fromDateStr = document.getElementById("summary-from").value;
  const toDateStr = document.getElementById("summary-to").value;
  const selectedChannelId = parseInt(document.getElementById("summary-channel").value); 
  
  // 1. FILTRACE DAT
  const filteredSummaryTransactions = transactions.filter(t => {
    // A. Filtr podle přiřazení (musí být přiřazen kanál a dokončeno)
    if (!t.channelId || t.status !== "completed") {
        return false;
    }
    
    // B. Filtr podle data
    if (fromDateStr && t.date < fromDateStr) {
        return false;
    }
    if (toDateStr && t.date > toDateStr) {
        return false;
    }
    
    // C. Filtr podle kanálu
    if (!isNaN(selectedChannelId) && selectedChannelId !== t.channelId) { 
        return false;
    }
    
    return true;
  });

  // 2. VÝPOČET SOUHRNŮ
  let totalBrutto = 0;
  let totalFees = 0;
  let totalNetto = 0;
  
  const channelSummary = {}; 

  filteredSummaryTransactions.forEach((t) => {
    const chId = t.channelId;
    const brutto = t.brutto || 0;
    
    const netto = t.netto || 0; 
    const fees = brutto - netto;

    // Celkový souhrn
    totalBrutto += brutto;
    totalFees += fees;
    totalNetto += netto;
    
    // Detailní rozpad podle kanálu
    if (!channelSummary[chId]) {
      channelSummary[chId] = {
        count: 0,
        brutto: 0,
        fees: 0,
        netto: 0,
        channelName: channels.find(c => c.id === chId)?.name || 'Neznámý'
      };
    }
    
    channelSummary[chId].count += 1;
    channelSummary[chId].brutto += brutto;
    channelSummary[chId].fees += fees;
    channelSummary[chId].netto += netto;
  });

  // 3. VYKRESLENÍ: Celkový Souhrn
  document.getElementById("sum-brutto").textContent = Math.round(totalBrutto) + " Kč";
  document.getElementById("sum-fees").textContent = Math.round(totalFees) + " Kč";
  document.getElementById("sum-netto").textContent = Math.round(totalNetto) + " Kč";
  
  // 4. VYKRESLENÍ: Detailní tabulka podle kanálů
  const tbodySummary = document.getElementById("summary-table-body");
  tbodySummary.innerHTML = "";
  
  Object.values(channelSummary).forEach(summary => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
          <td>${summary.channelName}</td>
          <td>${summary.count}</td>
          <td>${Math.round(summary.brutto)} Kč</td>
          <td>${Math.round(summary.fees)} Kč</td>
          <td>${Math.round(summary.netto)} Kč</td>
      `;
      tbodySummary.appendChild(tr);
  });
}

// Přiřazení spouštěčů k prvkům Souhrnů
document.getElementById("summary-refresh").onclick = calculateSummary;
document.getElementById("summary-from").onchange = calculateSummary;
document.getElementById("summary-to").onchange = calculateSummary;
document.getElementById("summary-channel").onchange = calculateSummary;


/* ============================================
   7) Sandbox export/import databáze
   ============================================ */

/* ---------- EXPORT JSON ---------- */
document.getElementById("export-json").onclick = async () => {
  const payload = await exportDatabaseAsJson();
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });

  downloadBlob(blob, "fs_extra_backup.json");
};

/* Exportuje celou DB do JSON */
async function exportDatabaseAsJson() {
  const channels = await getAllFromStore("channels");
  const transactions = await getAllFromStore("transactions");

  return {
    exportDate: new Date().toISOString(),
    channels,
    transactions
  };
}

/* ---------- IMPORT JSON ---------- */
document.getElementById("import-json").onclick = async () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json";

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    let data;

    try {
      data = JSON.parse(text);
    } catch (err) {
      alert("Soubor není platný JSON.");
      return;
    }

    if (!data.channels || !data.transactions) {
      alert("JSON soubor neobsahuje potřebná data.");
      return;
    }

    await overwriteDatabase(data.channels, data.transactions);

    await loadChannelsFromDB();
    await loadTransactionsFromDb();
    filterAndRenderTransactions(); 
    calculateSummary(); 

    alert("Import úspěšně dokončen.");
  };

  input.click();
};

/* Přepíše celou IndexedDB novými daty */
async function overwriteDatabase(channels, transactions) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onsuccess = () => {
      const db = request.result;

      const tx = db.transaction(["channels", "transactions"], "readwrite");
      const storeChannels = tx.objectStore("channels");
      const storeTransactions = tx.objectStore("transactions");

      // Vyčistit stará data
      storeChannels.clear();
      storeTransactions.clear();

      // Zapsat nové kanály
      channels.forEach(ch => storeChannels.add(ch));

      // Zapsat nové transakce
      transactions.forEach(t => storeTransactions.add(t));

      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    };

    request.onerror = () => reject(request.error);
  });
}

/* ---------- EXPORT "CELÉ DATABÁZE" ---------- */
document.getElementById("export-db").onclick = async () => {
  const payload = await exportDatabaseAsJson();
  const blob = new Blob([JSON.stringify(payload)], {
    type: "application/json"
  });

  downloadBlob(blob, "fs_extra_full_export.json");
};

/* ---------- Pomocné funkce ---------- */

async function getAllFromStore(storeName) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(storeName, "readonly");
      const req = tx.objectStore(storeName).getAll();

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    };

    request.onerror = () => reject(request.error);
  });
}

/* Vytvoření download odkazu */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

document.querySelectorAll(".collapsible").forEach(section => {
  const btn = section.querySelector(".collapse-toggle");
  const content = section.querySelector(".section-content");

  btn.addEventListener("click", () => {
    const opened = section.classList.toggle("open");
    content.style.maxHeight = opened ? content.scrollHeight + "px" : "0px";
    btn.textContent = opened ? "Zbalit" : "Rozbalit";
  });

  // hide by default
  content.style.maxHeight = "0px";
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
