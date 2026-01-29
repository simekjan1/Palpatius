/* =====================================================
   Palpatius Data Manager
   Pouze čtení JSON exportů – žádné zápisy
   ===================================================== */

let loadedJson = null;
let currentReportText = "";

/* ---------- DOM prvky ---------- */
const fileInput = document.getElementById("jsonFile");
const moduleSelect = document.getElementById("moduleSelect");
const analyzeBtn = document.getElementById("analyzeBtn");
const resetBtn = document.getElementById("resetBtn");
const exportTxtBtn = document.getElementById("exportTxtBtn");

const resultList = document.getElementById("resultList");
const resultEmpty = document.getElementById("resultEmpty");
const statusEl = document.getElementById("formStatus");

const metaModule = document.getElementById("metaModule");
const metaFileName = document.getElementById("metaFileName");
const metaFileSize = document.getElementById("metaFileSize");
const metaLoadState = document.getElementById("metaLoadState");
const rawOutput = document.getElementById("rawOutput");

/* ---------- Pomocné funkce ---------- */

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("status-error", isError);
}

function clearResults() {
  resultList.innerHTML = "";
  resultList.appendChild(resultEmpty);
  exportTxtBtn.disabled = true;
  currentReportText = "";
}

function addResultRow(label, value) {
  const row = document.createElement("div");
  row.className = "result-row";

  const dt = document.createElement("dt");
  dt.textContent = label;

  const dd = document.createElement("dd");
  dd.textContent = value;

  row.appendChild(dt);
  row.appendChild(dd);
  resultList.appendChild(row);
}

function formatDate() {
  const d = new Date();
  return d.toLocaleDateString("cs-CZ");
}

/* ---------- Načtení souboru ---------- */

fileInput.addEventListener("change", () => {
  clearResults();
  loadedJson = null;

  const file = fileInput.files[0];
  if (!file) return;

  metaFileName.textContent = file.name;
  metaFileSize.textContent = `${Math.round(file.size / 1024)} KB`;
  metaLoadState.textContent = "Načítám…";

  const reader = new FileReader();

  reader.onload = () => {
    try {
      loadedJson = JSON.parse(reader.result);
      rawOutput.value = JSON.stringify(loadedJson, null, 2);
      metaLoadState.textContent = "Načteno";
      setStatus("Soubor byl úspěšně načten.");
    } catch (e) {
      metaLoadState.textContent = "Chyba";
      setStatus("Soubor není platný JSON.", true);
      loadedJson = null;
    }
  };

  reader.onerror = () => {
    metaLoadState.textContent = "Chyba";
    setStatus("Soubor se nepodařilo přečíst.", true);
  };

  reader.readAsText(file);
});

/* ---------- Vyhodnocení ---------- */

analyzeBtn.addEventListener("click", () => {
  clearResults();

  if (!loadedJson) {
    setStatus("Nejprve nahraj platný JSON soubor.", true);
    return;
  }

  const module = moduleSelect.value;
  if (!module) {
    setStatus("Vyber modul, ze kterého pochází export.", true);
    return;
  }

  metaModule.textContent = moduleSelect.options[moduleSelect.selectedIndex].text;

  try {
    currentReportText = buildReport(module, loadedJson);
    exportTxtBtn.disabled = false;
    setStatus("Vyhodnocení dokončeno.");
  } catch (e) {
    setStatus(e.message, true);
  }
});

/* ---------- Logika podle modulů ---------- */

function buildReport(module, data) {
  let report = [];
  const header = [
    "Palpatius – Data Manager",
    `Modul: ${moduleSelect.options[moduleSelect.selectedIndex].text}`,
    `Datum: ${formatDate()}`,
    ""
  ];

  report.push(...header);

  switch (module) {
    case "maserna":
      assert(data.clients, "Chybí pole clients");
      addResultRow("Klienti", data.clients.length);
      addResultRow("Masáže", data.globalMassageHistory?.length || 0);
      addResultRow("Poukazy", data.voucherPurchases?.length || 0);
      addResultRow("Poznámky", data.notes?.length || 0);
      addResultRow("Ceníkové položky", data.priceListItems?.length || 0);

      report.push(
        `Klienti: ${data.clients.length}`,
        `Masáže: ${data.globalMassageHistory?.length || 0}`,
        `Poukazy: ${data.voucherPurchases?.length || 0}`,
        `Poznámky: ${data.notes?.length || 0}`,
        `Ceníkové položky: ${data.priceListItems?.length || 0}`
      );
      break;

    case "finance":
      assert(data.transactions, "Chybí pole transactions");
      addResultRow("Transakce", data.transactions.length);
      addResultRow("Měsíční přehledy", data.monthlySummaries?.length || 0);
      addResultRow("Roční přehledy", data.annualSummaries?.length || 0);
      addResultRow("Skladové položky", data.stockItems?.length || 0);

      report.push(
        `Transakce: ${data.transactions.length}`,
        `Měsíční přehledy: ${data.monthlySummaries?.length || 0}`,
        `Roční přehledy: ${data.annualSummaries?.length || 0}`,
        `Skladové položky: ${data.stockItems?.length || 0}`
      );
      break;

    case "zaznamnik":
      assert(data.notes, "Chybí pole notes");
      addResultRow("Poznámky", data.notes.length);
      addResultRow("To-Do listy", data.todos?.length || 0);

      const tasks =
        data.todos?.reduce((sum, list) => sum + (list.tasks?.length || 0), 0) || 0;

      addResultRow("Úkoly celkem", tasks);
      addResultRow("Události", data.events?.length || 0);
      addResultRow("Nápady", data.ideas?.length || 0);

      report.push(
        `Poznámky: ${data.notes.length}`,
        `To-Do listy: ${data.todos?.length || 0}`,
        `Úkoly celkem: ${tasks}`,
        `Události: ${data.events?.length || 0}`,
        `Nápady: ${data.ideas?.length || 0}`
      );
      break;

    case "knihovna":
      assert(Array.isArray(data), "Očekáváno pole záznamů");
      addResultRow("Záznamy", data.length);
      report.push(`Záznamy: ${data.length}`);
      break;

    case "fs_extra":
      assert(data.transactions, "Chybí pole transactions");
      const withChannel = data.transactions.filter(t => t.channelId).length;

      addResultRow("Transakce celkem", data.transactions.length);
      addResultRow("S přiřazeným kanálem", withChannel);

      report.push(
        `Transakce celkem: ${data.transactions.length}`,
        `S přiřazeným kanálem: ${withChannel}`
      );
      break;

    default:
      throw new Error("Neznámý modul.");
  }

  return report.join("\n");
}

/* ---------- Validace ---------- */

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Neplatná struktura dat: ${message}`);
  }
}

/* ---------- Export TXT ---------- */

exportTxtBtn.addEventListener("click", () => {
  if (!currentReportText) return;

  const blob = new Blob([currentReportText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "palpatius_data_report.txt";
  a.click();

  URL.revokeObjectURL(url);
});

/* ---------- Reset ---------- */

resetBtn.addEventListener("click", () => {
  fileInput.value = "";
  moduleSelect.value = "";
  rawOutput.value = "";
  metaModule.textContent = "—";
  metaFileName.textContent = "—";
  metaFileSize.textContent = "—";
  metaLoadState.textContent = "—";
  setStatus("Resetováno.");
  clearResults();
});
