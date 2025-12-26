// ======================================================
// Palpatius Offline Check – script.js
// Diagnostický nástroj (read-only, testovací)
// ======================================================

(function () {
  const runBtn = document.getElementById("runBtn");
  const resetBtn = document.getElementById("resetBtn");

  const resultsList = document.getElementById("resultsList");
  const resultsEmpty = document.getElementById("resultsEmpty");
  const summaryText = document.getElementById("summaryText");
  const statusEl = document.getElementById("formStatus");

  const logOutput = document.getElementById("logOutput");

  const metaOnline = document.getElementById("metaOnline");
  const metaUA = document.getElementById("metaUA");
  const metaTime = document.getElementById("metaTime");

  let passed = 0;
  let failed = 0;

  /* ---------- Pomocné funkce ---------- */

  function log(msg) {
    logOutput.value += msg + "\n";
  }

  function addResult(label, ok, detail = "") {
    const li = document.createElement("li");
    li.className = `result-item ${ok ? "result-ok" : "result-fail"}`;
    li.innerHTML = `
      <strong>${label}</strong>
      <span>${ok ? "OK" : "CHYBA"}</span>
      ${detail ? `<div class="result-detail">${detail}</div>` : ""}
    `;
    resultsList.appendChild(li);

    if (ok) passed++;
    else failed++;
  }

  function resetUI() {
    resultsList.innerHTML = "";
    resultsList.appendChild(resultsEmpty);
    summaryText.textContent = "—";
    logOutput.value = "";
    passed = 0;
    failed = 0;
  }

  /* ---------- Testy ---------- */

  async function testOnlineStatus() {
    const online = navigator.onLine;
    metaOnline.textContent = online ? "online" : "offline";
    addResult("Stav připojení (navigator.onLine)", true, online ? "Prohlížeč hlásí online." : "Prohlížeč hlásí offline.");
    log(`Online status: ${online}`);
  }

  async function testLocalStorage() {
    try {
      const key = "__palpatius_test__";
      localStorage.setItem(key, "ok");
      const val = localStorage.getItem(key);
      localStorage.removeItem(key);

      if (val === "ok") {
        addResult("LocalStorage", true, "Zápis a čtení proběhlo úspěšně.");
        log("LocalStorage OK");
      } else {
        throw new Error("Hodnota neodpovídá");
      }
    } catch (e) {
      addResult("LocalStorage", false, e.message);
      log("LocalStorage ERROR: " + e.message);
    }
  }

  async function testIndexedDB() {
    return new Promise((resolve) => {
      const request = indexedDB.open("palpatius_offline_test", 1);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        db.createObjectStore("testStore", { keyPath: "id" });
      };

      request.onsuccess = (e) => {
        const db = e.target.result;
        const tx = db.transaction("testStore", "readwrite");
        const store = tx.objectStore("testStore");

        store.put({ id: 1, value: "ok" });

        tx.oncomplete = () => {
          const readTx = db.transaction("testStore", "readonly");
          const readStore = readTx.objectStore("testStore");
          const getReq = readStore.get(1);

          getReq.onsuccess = () => {
            if (getReq.result && getReq.result.value === "ok") {
              addResult("IndexedDB", true, "Zápis, čtení i mazání proběhlo úspěšně.");
              log("IndexedDB OK");
            } else {
              addResult("IndexedDB", false, "Čtení testovacích dat selhalo.");
              log("IndexedDB READ ERROR");
            }

            indexedDB.deleteDatabase("palpatius_offline_test");
            resolve();
          };

          getReq.onerror = () => {
            addResult("IndexedDB", false, "Chyba při čtení dat.");
            log("IndexedDB READ ERROR");
            resolve();
          };
        };

        tx.onerror = () => {
          addResult("IndexedDB", false, "Chyba při zápisu.");
          log("IndexedDB WRITE ERROR");
          resolve();
        };
      };

      request.onerror = () => {
        addResult("IndexedDB", false, "Nelze otevřít databázi.");
        log("IndexedDB OPEN ERROR");
        resolve();
      };
    });
  }

  async function testFileExport() {
    try {
      const blob = new Blob(["Palpatius Offline Check – test exportu"], {
        type: "text/plain"
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "palpatius_offline_test.txt";
      a.click();
      URL.revokeObjectURL(url);

      addResult("Export souboru", true, "Soubor byl vytvořen ke stažení.");
      log("File export OK");
    } catch (e) {
      addResult("Export souboru", false, e.message);
      log("File export ERROR: " + e.message);
    }
  }

  /* ---------- Spuštění ---------- */

  async function runChecks() {
    resetUI();
    resultsEmpty.remove();

    statusEl.textContent = "Probíhá kontrola…";

    metaUA.textContent = navigator.userAgent;
    metaTime.textContent = new Date().toLocaleString("cs-CZ");

    await testOnlineStatus();
    await testIndexedDB();
    await testLocalStorage();
    await testFileExport();

    summaryText.textContent =
      failed === 0
        ? `Vše v pořádku (${passed} / ${passed} testů OK)`
        : `Pozor: ${failed} z ${passed + failed} testů selhalo`;

    statusEl.textContent = "Kontrola dokončena.";
  }

  /* ---------- Události ---------- */

  runBtn.addEventListener("click", runChecks);

  resetBtn.addEventListener("click", () => {
    resetUI();
    statusEl.textContent = "Resetováno.";
  });
})();
