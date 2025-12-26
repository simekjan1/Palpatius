"use strict";

/**
 * Backup Protocol Tools (offline)
 * Kostra v0.1 – UI workflow + datové modely + export/import skeleton
 * Pozn.: IndexedDB je připravené jako vrstva, ale můžeš ji napojit postupně.
 */

/* -----------------------------
   1) Konstanty a pomocné funkce
-------------------------------- */

const DB_NAME = "backupProtocolDB";
const DB_VERSION = 1;

const STORE_DEVICES = "devices";
const STORE_STATUSES = "statuses";

const STATE_LABELS = {
  OK: "🟢 OK",
  PARTIAL: "🟡 ČÁSTEČNĚ",
  OUTDATED: "🔴 NEAKTUÁLNÍ",
  UNKNOWN: "⚪ NEZNÁMÝ",
};

function uuid() {
  // Jednoduchý UUID v4 (bez závislostí). Pro náš účel OK.
  if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function toLocalDateTimeInputValue(date) {
  // do <input type="datetime-local"> – bez timezone
  const pad = (n) => String(n).padStart(2, "0");
  const d = date;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatHumanDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("cs-CZ");
}

function downloadTextFile(filename, content, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

/* -----------------------------
   2) Stav aplikace v paměti
-------------------------------- */

const appState = {
  devices: /** @type {BackupDevice[]} */ ([]),
  statuses: /** @type {BackupStatus[]} */ ([]),
  lastExportIso: null,
};

/**
 * @typedef {Object} BackupDevice
 * @property {string} id
 * @property {string} name
 * @property {"SSD"|"HDD"|"PC"|"FLASH"|"NAS"|"OTHER"} category
 * @property {""|"external"|"internal"|"virtual"} type
 * @property {string} location
 * @property {string} capacity
 * @property {string} purpose
 * @property {string} note
 * @property {boolean} isActive
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * @typedef {Object} BackupStatus
 * @property {string} id
 * @property {string} backupDeviceId
 * @property {"OK"|"PARTIAL"|"OUTDATED"|"UNKNOWN"} state
 * @property {string} lastUpdateDateTime
 * @property {string} diffAgainstPC
 * @property {string} changeSinceLast
 * @property {string} changeDescription
 * @property {string} note
 * @property {string} createdAt
 */

/* -----------------------------
   3) DOM reference
-------------------------------- */

const $ = (id) => document.getElementById(id);

const dom = {
  statDevices: $("statDevices"),
  statStatuses: $("statStatuses"),
  statLastExport: $("statLastExport"),
  emptyState: $("emptyState"),
  devicesList: $("devicesList"),
  liveRegion: $("liveRegion"),

  btnAddDevice: $("btnAddDevice"),
  btnAddStatus: $("btnAddStatus"),
  btnExportMarkdown: $("btnExportMarkdown"),
  btnExportJson: $("btnExportJson"),
  btnImportJson: $("btnImportJson"),

  dlgDevice: $("dlgDevice"),
  formDevice: $("formDevice"),
  btnCancelDevice: $("btnCancelDevice"),

  dlgStatus: $("dlgStatus"),
  formStatus: $("formStatus"),
  btnCancelStatus: $("btnCancelStatus"),

  statusDevice: $("statusDevice"),
  statusLastUpdate: $("statusLastUpdate"),

  fileImportJson: $("fileImportJson"),
};

/* -----------------------------
   4) A11y: aria-live helper
-------------------------------- */

function announce(message) {
  dom.liveRegion.textContent = message;
}

/* -----------------------------
   5) IndexedDB – kostra
-------------------------------- */

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = req.result;

      if (!db.objectStoreNames.contains(STORE_DEVICES)) {
        const store = db.createObjectStore(STORE_DEVICES, { keyPath: "id" });
        store.createIndex("isActive", "isActive", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_STATUSES)) {
        const store = db.createObjectStore(STORE_STATUSES, { keyPath: "id" });
        store.createIndex("backupDeviceId", "backupDeviceId", { unique: false });
        store.createIndex("lastUpdateDateTime", "lastUpdateDateTime", { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbGetAll(storeName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(storeName, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
    tx.objectStore(storeName).put(value);
  });
}

async function dbClear(storeName) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const req = tx.objectStore(storeName).clear();
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

/* -----------------------------
   6) Načtení dat a render
-------------------------------- */

async function loadFromDb() {
  try {
    appState.devices = await dbGetAll(STORE_DEVICES);
    appState.statuses = await dbGetAll(STORE_STATUSES);
  } catch (e) {
    announce("Nepodařilo se načíst data z IndexedDB. Zkus export/import JSON.");
    appState.devices = appState.devices || [];
    appState.statuses = appState.statuses || [];
  }
}

function getHistoryForDevice(deviceId) {
  return appState.statuses
    .filter(s => s.backupDeviceId === deviceId)
    .slice()
    .sort((a, b) => new Date(b.lastUpdateDateTime).getTime() - new Date(a.lastUpdateDateTime).getTime());
}

function getLatestStatusForDevice(deviceId) {
  const list = appState.statuses
    .filter(s => s.backupDeviceId === deviceId)
    .slice()
    .sort((a, b) => new Date(b.lastUpdateDateTime).getTime() - new Date(a.lastUpdateDateTime).getTime());
  return list[0] || null;
}

function renderStats() {
  dom.statDevices.textContent = String(appState.devices.length);
  dom.statStatuses.textContent = String(appState.statuses.length);
  dom.statLastExport.textContent = appState.lastExportIso ? formatHumanDateTime(appState.lastExportIso) : "—";
}

function renderDeviceSelect() {
  dom.statusDevice.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.disabled = true;
  placeholder.selected = true;
  placeholder.textContent = appState.devices.length ? "Vyber…" : "Nejprve přidej zařízení…";
  dom.statusDevice.appendChild(placeholder);

  for (const d of appState.devices.filter(x => x.isActive !== false)) {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = d.name;
    dom.statusDevice.appendChild(opt);
  }
}

function renderDevices() {
  dom.devicesList.innerHTML = "";
  const activeDevices = appState.devices.filter(d => d.isActive !== false);

  dom.emptyState.hidden = activeDevices.length > 0;

  for (const d of activeDevices) {
    const latest = getLatestStatusForDevice(d.id);
    const history = getHistoryForDevice(d.id);

    const details = document.createElement("details");
    details.className = "device";
    details.dataset.deviceId = d.id;

    const summary = document.createElement("summary");
    const summaryWrap = document.createElement("div");
    summaryWrap.className = "device-summary";

    const title = document.createElement("span");
    title.textContent = d.name;

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = latest ? STATE_LABELS[latest.state] : STATE_LABELS.UNKNOWN;

    const dateBadge = document.createElement("span");
    dateBadge.className = "badge badge-muted";
    dateBadge.textContent = latest ? formatHumanDateTime(latest.lastUpdateDateTime) : "Bez záznamu";

    summaryWrap.appendChild(title);
    summaryWrap.appendChild(badge);
    summaryWrap.appendChild(dateBadge);
    summary.appendChild(summaryWrap);

    const body = document.createElement("div");
    body.className = "device-body";

    const meta = document.createElement("div");
    meta.innerHTML = `
      <div><strong>Kategorie:</strong> ${escapeHtml(d.category || "—")}</div>
      <div><strong>Typ:</strong> ${escapeHtml(d.type || "—")}</div>
      <div><strong>Umístění:</strong> ${escapeHtml(d.location || "—")}</div>
      <div><strong>Kapacita:</strong> ${escapeHtml(d.capacity || "—")}</div>
      <div><strong>Účel:</strong> ${escapeHtml(d.purpose || "—")}</div>
      <div><strong>Poznámka:</strong> ${escapeHtml(d.note || "—")}</div>
    `;

    const sep = document.createElement("hr");
    sep.className = "sep";

    const latestBox = document.createElement("div");
    latestBox.innerHTML = `
      <div><strong>Poslední stav:</strong> ${latest ? STATE_LABELS[latest.state] : STATE_LABELS.UNKNOWN}</div>
      <div><strong>Poslední aktualizace:</strong> ${latest ? escapeHtml(formatHumanDateTime(latest.lastUpdateDateTime)) : "—"}</div>
      <div><strong>Rozdíl vůči PC:</strong> ${latest ? escapeHtml(latest.diffAgainstPC || "—") : "—"}</div>
      <div><strong>Změna od minula:</strong> ${latest ? escapeHtml(latest.changeSinceLast || "—") : "—"}</div>
      <div><strong>Popis změny:</strong> ${latest ? escapeHtml(latest.changeDescription || "—") : "—"}</div>
      <div><strong>Poznámky:</strong> ${latest ? escapeHtml(latest.note || "—") : "—"}</div>
    `;

    const historyDetails = document.createElement("details");
    historyDetails.className = "history";

    const historySummary = document.createElement("summary");
    historySummary.textContent = `Historie stavů (${history.length})`;
    historyDetails.appendChild(historySummary);

    const historyWrap = document.createElement("div");
    historyWrap.className = "history-body";

    if (!history.length) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "Zatím bez záznamů.";
      historyWrap.appendChild(p);
    } else {
      const ul = document.createElement("ul");
      ul.className = "history-list";

      for (const s of history) {
        const li = document.createElement("li");
        li.className = "history-item";
        li.dataset.statusId = s.id;

        const dt = formatHumanDateTime(s.lastUpdateDateTime);
        const diff = s.diffAgainstPC?.trim() ? s.diffAgainstPC.trim() : "—";
        const change = s.changeSinceLast?.trim() ? s.changeSinceLast.trim() : "—";
        const desc = s.changeDescription?.trim() ? s.changeDescription.trim() : "—";
        const note = s.note?.trim() ? s.note.trim() : "—";

        li.innerHTML = `
          <div class="history-top">
            <span class="badge">${STATE_LABELS[s.state]}</span>
            <span class="badge badge-muted">${escapeHtml(dt)}</span>
          </div>
          <div class="history-kv"><strong>Rozdíl vůči PC:</strong> ${escapeHtml(diff)}</div>
          <div class="history-kv"><strong>Změna od minula:</strong> ${escapeHtml(change)}</div>
          <div class="history-kv"><strong>Popis změny:</strong> ${escapeHtml(desc)}</div>
          <div class="history-kv"><strong>Poznámky:</strong> ${escapeHtml(note)}</div>
          <div class="actions" style="margin-top: 0.5rem">
            <button type="button" class="btn btn-sm" data-action="editStatus">Upravit</button>
            <button type="button" class="btn btn-sm" data-action="deleteStatus">Smazat</button>
          </div>
        `;

        ul.appendChild(li);
      }

      historyWrap.appendChild(ul);
    }

    historyDetails.appendChild(historyWrap);

    const actions = document.createElement("div");
    actions.className = "actions";
    actions.innerHTML = `
      <button type="button" class="btn" data-action="addStatus">Přidat stav (pro toto zařízení)</button>
      <button type="button" class="btn" data-action="editDevice">Upravit zařízení</button>
      <button type="button" class="btn" data-action="deactivateDevice">Deaktivovat zařízení</button>
    `;

    body.appendChild(meta);
    body.appendChild(sep);
    body.appendChild(latestBox);
    body.appendChild(historyDetails);
    body.appendChild(actions);

    details.appendChild(summary);
    details.appendChild(body);
    dom.devicesList.appendChild(details);
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderAll() {
  renderStats();
  renderDeviceSelect();
  renderDevices();
}

/* -----------------------------
   7) Dialogy: otevřít / zavřít
-------------------------------- */

function openDialog(dialogEl, focusEl) {
  if (typeof dialogEl.showModal === "function") dialogEl.showModal();
  else dialogEl.setAttribute("open", "open");
  if (focusEl) setTimeout(() => focusEl.focus(), 0);
}

function closeDialog(dialogEl) {
  if (typeof dialogEl.close === "function") dialogEl.close();
  else dialogEl.removeAttribute("open");
}

/* -----------------------------
   8) CRUD: zařízení
-------------------------------- */

function resetDeviceForm() {
  dom.formDevice.reset();
  $("deviceId").value = "";
}

function fillDeviceForm(device) {
  $("deviceId").value = device.id;
  $("deviceCategory").value = device.category || "";
  $("deviceName").value = device.name || "";
  $("deviceType").value = device.type || "";
  $("deviceLocation").value = device.location || "";
  $("deviceCapacity").value = device.capacity || "";
  $("devicePurpose").value = device.purpose || "";
  $("deviceNote").value = device.note || "";
}

async function saveDeviceFromForm() {
  const id = $("deviceId").value || uuid();

  /** @type {BackupDevice} */
  const device = {
    id,
    name: $("deviceName").value.trim(),
    category: $("deviceCategory").value,
    type: $("deviceType").value,
    location: $("deviceLocation").value.trim(),
    capacity: $("deviceCapacity").value.trim(),
    purpose: $("devicePurpose").value.trim(),
    note: $("deviceNote").value.trim(),
    isActive: true,
    createdAt: $("deviceId").value ? (findDevice(id)?.createdAt || nowIso()) : nowIso(),
    updatedAt: nowIso(),
  };

  if (!device.category || !device.name) {
    announce("Chybí povinné údaje: kategorie a název.");
    return false;
  }

  const existingIdx = appState.devices.findIndex(d => d.id === id);
  if (existingIdx >= 0) appState.devices[existingIdx] = device;
  else appState.devices.push(device);

  try { await dbPut(STORE_DEVICES, device); } catch (_) {}

  announce(`Způsob zálohy „${device.name}“ uložen.`);
  return true;
}

function findDevice(id) {
  return appState.devices.find(d => d.id === id) || null;
}

async function deactivateDevice(deviceId) {
  const d = findDevice(deviceId);
  if (!d) return;
  d.isActive = false;
  d.updatedAt = nowIso();
  try { await dbPut(STORE_DEVICES, d); } catch (_) {}
  announce(`Zařízení „${d.name}“ bylo deaktivováno.`);
}

/* -----------------------------
   9) CRUD: stavy
-------------------------------- */

// === ADD: editace a mazání stavů ===

function fillStatusForm(status) {
  $("statusId").value = status.id;

  dom.statusDevice.value = status.backupDeviceId;
  dom.statusDevice.disabled = true; // 🔒 zákaz změny zařízení při editaci

  $("statusState").value = status.state;
  dom.statusLastUpdate.value =
    toLocalDateTimeInputValue(new Date(status.lastUpdateDateTime));

  $("statusDiff").value = status.diffAgainstPC || "";
  $("statusChangeSince").value = status.changeSinceLast || "";
  $("statusChangeDesc").value = status.changeDescription || "";
  $("statusNote").value = status.note || "";
}

async function deleteStatus(statusId) {
  const idx = appState.statuses.findIndex(s => s.id === statusId);
  if (idx === -1) return;

  const status = appState.statuses[idx];
  const device = findDevice(status.backupDeviceId);

  const ok = confirm(
    `Opravdu smazat stav zálohy${device ? ` pro „${device.name}“` : ""}?\nTuto akci nelze vrátit.`
  );
  if (!ok) return;

  appState.statuses.splice(idx, 1);

  try {
    const db = await openDb();
    const tx = db.transaction(STORE_STATUSES, "readwrite");
    tx.objectStore(STORE_STATUSES).delete(statusId);
  } catch (_) {}

  announce("Stav zálohy byl smazán.");
  renderAll();
}

function resetStatusForm() {
  dom.formStatus.reset();
  $("statusId").value = "";
  dom.statusDevice.disabled = false; // 🔓 povolit při novém stavu
  dom.statusLastUpdate.value = toLocalDateTimeInputValue(new Date());
}

function presetStatusDevice(deviceId) {
  dom.statusDevice.value = deviceId;
}

async function saveStatusFromForm() {
  const existingId = $("statusId").value;
  const isEdit = Boolean(existingId);
  const backupDeviceId = dom.statusDevice.value;

  /** @type {BackupStatus} */
  const status = {
    id: isEdit ? existingId : uuid(),
    backupDeviceId,
    state: $("statusState").value,
    lastUpdateDateTime: new Date($("statusLastUpdate").value).toISOString(),
    diffAgainstPC: $("statusDiff").value.trim(),
    changeSinceLast: $("statusChangeSince").value.trim(),
    changeDescription: $("statusChangeDesc").value.trim(),
    note: $("statusNote").value.trim(),
    createdAt: isEdit
      ? appState.statuses.find(s => s.id === existingId)?.createdAt || nowIso()
      : nowIso(),
  };

  if (!status.backupDeviceId || !status.state || !status.lastUpdateDateTime) {
    announce("Chybí povinné údaje: zařízení, stav a datum/čas.");
    return false;
  }

  if (isEdit) {
    const idx = appState.statuses.findIndex(s => s.id === existingId);
    if (idx !== -1) appState.statuses[idx] = status;
  } else {
    appState.statuses.push(status);
  }

  try { await dbPut(STORE_STATUSES, status); } catch (_) {}

  $("statusId").value = "";
  dom.statusDevice.disabled = false;

  const d = findDevice(status.backupDeviceId);
  announce(isEdit ? "Stav zálohy byl upraven." : `Stav zálohy uložen${d ? ` pro „${d.name}“` : ""}.`);
  return true;
}

/* -----------------------------
   10) Export MD / JSON + Import JSON
-------------------------------- */

function buildExportJson() {
  return {
    formatVersion: "1.0",
    exportedAt: new Date().toISOString(),
    application: {
      name: "Backup Protocol Tools",
      type: "offline",
      storage: "IndexedDB",
    },
    metadata: {
      author: "—",
      note: "Kompletní export dat zálohovací aplikace",
    },
    data: {
      devices: appState.devices,
      statuses: appState.statuses,
    },
  };
}

function exportJson() {
  const obj = buildExportJson();
  const content = JSON.stringify(obj, null, 2);
  const filename = `backup-protocol-export-${new Date().toISOString().slice(0,10)}.json`;
  downloadTextFile(filename, content, "application/json;charset=utf-8");
  appState.lastExportIso = new Date().toISOString();
  renderStats();
  announce("JSON záloha byla vytvořena a stažena.");
}

function buildMarkdown() {
  const lines = [];
  lines.push("# Zálohovací protokol");
  lines.push("");
  lines.push("**Vygenerováno aplikací:** Backup Protocol Tools  ");
  lines.push(`**Datum exportu:** ${new Date().toISOString().slice(0,10)}  `);
  lines.push("");
  lines.push("## Legenda stavů");
  lines.push("");
  lines.push("- 🟢 **OK** – záloha aktuální, bez rozdílů");
  lines.push("- 🟡 **ČÁSTEČNĚ** – drobné rozdíly, nekritické");
  lines.push("- 🔴 **NEAKTUÁLNÍ** – záloha chybí nebo je výrazně zastaralá");
  lines.push("- ⚪ **NEZNÁMÝ** – stav nebyl ověřen");
  lines.push("");
  lines.push("## Zálohovaná zařízení");
  lines.push("");

  const devices = appState.devices.filter(d => d.isActive !== false);

  for (const d of devices) {
    const latest = getLatestStatusForDevice(d.id);
    const history = appState.statuses
      .filter(s => s.backupDeviceId === d.id)
      .slice()
      .sort((a, b) => new Date(b.lastUpdateDateTime).getTime() - new Date(a.lastUpdateDateTime).getTime());

    lines.push(`### ${d.name}`);
    lines.push("");
    lines.push(`- **Kategorie:** ${d.category || "—"}`);
    lines.push(`- **Typ:** ${d.type || "—"}`);
    lines.push(`- **Umístění:** ${d.location || "—"}`);
    lines.push(`- **Kapacita:** ${d.capacity || "—"}`);
    lines.push(`- **Účel:** ${d.purpose || "—"}`);
    lines.push(`- **Poznámka:** ${d.note || "—"}`);
    lines.push("");

    lines.push("#### Poslední stav");
    lines.push("");
    if (latest) {
      lines.push(`- **Stav:** ${STATE_LABELS[latest.state]}`);
      lines.push(`- **Poslední aktualizace zálohy:** ${formatHumanDateTime(latest.lastUpdateDateTime)}`);
      lines.push(`- **Rozdíl vůči PC:** ${latest.diffAgainstPC || "—"}`);
      lines.push(`- **Změna od minula:** ${latest.changeSinceLast || "—"}`);
      lines.push(`- **Popis změny:** ${latest.changeDescription || "—"}`);
      lines.push(`- **Poznámky:** ${latest.note || "—"}`);
    } else {
      lines.push(`- **Stav:** ${STATE_LABELS.UNKNOWN}`);
      lines.push(`- **Poslední aktualizace zálohy:** —`);
      lines.push(`- **Rozdíl vůči PC:** —`);
      lines.push(`- **Změna od minula:** —`);
      lines.push(`- **Popis změny:** —`);
      lines.push(`- **Poznámky:** —`);
    }
    lines.push("");

    lines.push("#### Historie stavů");
    lines.push("");
    if (!history.length) {
      lines.push("- (zatím bez záznamů)");
    } else {
      for (const s of history) {
        const dt = formatHumanDateTime(s.lastUpdateDateTime);
        const short = s.diffAgainstPC ? `  \n  ${s.diffAgainstPC}` : "";
        lines.push(`- **${dt}** – ${STATE_LABELS[s.state]}${short}`);
        lines.push("");
      }
      if (lines[lines.length - 1] === "") lines.pop();
    }
    lines.push("");
  }

  lines.push("## Poznámky");
  lines.push("");
  lines.push("Tento soubor je exportem. Ruční úpravy zde nemění data uložená v aplikaci.");
  lines.push("");

  return lines.join("\n");
}

function exportMarkdown() {
  const md = buildMarkdown();
  const filename = `Zalohovaci_protokol-${new Date().toISOString().slice(0,10)}.md`;
  downloadTextFile(filename, md, "text/markdown;charset=utf-8");
  appState.lastExportIso = new Date().toISOString();
  renderStats();
  announce("Markdown soubor byl vytvořen a stažen.");
}

function validateImportObject(obj) {
  if (!obj || typeof obj !== "object") return { ok: false, error: "Soubor není JSON objekt." };
  if (!obj.formatVersion) return { ok: false, error: "Chybí formatVersion." };
  if (!obj.data || typeof obj.data !== "object") return { ok: false, error: "Chybí data sekce." };
  if (!Array.isArray(obj.data.devices)) return { ok: false, error: "data.devices není pole." };
  if (!Array.isArray(obj.data.statuses)) return { ok: false, error: "data.statuses není pole." };

  const ids = new Set(obj.data.devices.map(d => d.id));
  for (const s of obj.data.statuses) {
    if (!ids.has(s.backupDeviceId)) {
      return { ok: false, error: "Nalezen stav bez odpovídajícího zařízení (backupDeviceId)." };
    }
  }
  return { ok: true };
}

async function importJsonFile(file) {
  const text = await file.text();
  let obj;
  try { obj = JSON.parse(text); }
  catch { announce("Soubor nejde načíst jako JSON."); return; }

  const v = validateImportObject(obj);
  if (!v.ok) { announce(`Import odmítnut: ${v.error}`); return; }

  announce("Probíhá obnova dat z JSON zálohy…");
  try {
    await dbClear(STORE_DEVICES);
    await dbClear(STORE_STATUSES);

    for (const d of obj.data.devices) await dbPut(STORE_DEVICES, d);
    for (const s of obj.data.statuses) await dbPut(STORE_STATUSES, s);

    await loadFromDb();
    renderAll();
    announce(`Import dokončen. Načteno ${appState.devices.length} zařízení a ${appState.statuses.length} stavů.`);
  } catch (e) {
    announce("Import selhal. Data nebyla spolehlivě obnovena.");
  }
}

/* -----------------------------
   11) Eventy
-------------------------------- */

function wireEvents() {
  dom.btnAddDevice.addEventListener("click", () => {
    resetDeviceForm();
    $("dlgDeviceTitle").textContent = "Přidat způsob zálohy";
    openDialog(dom.dlgDevice, $("deviceCategory"));
    announce("Formulář pro přidání způsobu zálohy otevřen.");
  });

  dom.btnAddStatus.addEventListener("click", () => {
    if (!appState.devices.filter(d => d.isActive !== false).length) {
      announce("Nejdřív přidej alespoň jedno zařízení.");
      return;
    }
    resetStatusForm();
    openDialog(dom.dlgStatus, dom.statusDevice);
    announce("Formulář pro přidání stavu zálohy otevřen.");
  });

  dom.btnExportJson.addEventListener("click", exportJson);
  dom.btnExportMarkdown.addEventListener("click", exportMarkdown);

  dom.btnImportJson.addEventListener("click", () => {
    dom.fileImportJson.value = "";
    dom.fileImportJson.click();
  });

  dom.fileImportJson.addEventListener("change", async () => {
    const file = dom.fileImportJson.files && dom.fileImportJson.files[0];
    if (!file) return;
    await importJsonFile(file);
  });

  dom.btnCancelDevice.addEventListener("click", () => closeDialog(dom.dlgDevice));
  dom.btnCancelStatus.addEventListener("click", () => closeDialog(dom.dlgStatus));

  dom.formDevice.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ok = await saveDeviceFromForm();
    if (!ok) return;
    closeDialog(dom.dlgDevice);
    renderAll();
  });

  dom.formStatus.addEventListener("submit", async (e) => {
    e.preventDefault();
    const ok = await saveStatusFromForm();
    if (!ok) return;
    closeDialog(dom.dlgStatus);
    renderAll();
  });

  // Delegace akcí v seznamu zařízení
  dom.devicesList.addEventListener("click", async (e) => {
    const statusBtn = e.target.closest("button[data-action]");
    if (statusBtn) {
      const action = statusBtn.dataset.action;
      const statusEl = e.target.closest(".history-item");
      const statusId = statusEl?.dataset?.statusId;
      
      // Pokračuj jen pokud jde o akce se stavem (edit/delete)
      if (statusId) {
        const status = appState.statuses.find(s => s.id === statusId);
        if (!status) return;

        if (action === "editStatus") {
          resetStatusForm();
          fillStatusForm(status);
          openDialog(dom.dlgStatus, dom.statusDevice);
          announce("Úprava stavu zálohy.");
          return;
        }

        if (action === "deleteStatus") {
          await deleteStatus(statusId);
          return;
        }
      }
    }

    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const deviceEl = e.target.closest(".device");
    const deviceId = deviceEl?.dataset?.deviceId;
    if (!deviceId) return;

    const action = btn.dataset.action;
    const device = findDevice(deviceId);
    if (!device) return;

    if (action === "addStatus") {
      resetStatusForm();
      openDialog(dom.dlgStatus, dom.statusDevice);
      presetStatusDevice(deviceId);
      announce(`Přidání stavu pro „${device.name}“.`);
      return;
    }

    if (action === "editDevice") {
      resetDeviceForm();
      fillDeviceForm(device);
      $("dlgDeviceTitle").textContent = "Upravit zařízení";
      openDialog(dom.dlgDevice, $("deviceName"));
      announce(`Úprava zařízení „${device.name}“.`);
      return;
    }

    if (action === "deactivateDevice") {
      const sure = confirm(`Deaktivovat zařízení „${device.name}“? (Data se nesmažou.)`);
      if (!sure) return;
      await deactivateDevice(deviceId);
      renderAll();
    }
  });
}

/* -----------------------------
   12) Start aplikace
-------------------------------- */

async function start() {
  dom.statusLastUpdate.value = toLocalDateTimeInputValue(new Date());

  await loadFromDb();
  renderAll();
  wireEvents();

  announce(appState.devices.length
    ? "Aplikace připravena. Data načtena."
    : "Aplikace připravena. Žádná data nebyla nalezena.");
}

start();