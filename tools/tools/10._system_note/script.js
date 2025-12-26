/* ============================================
   System note – script.js
   Jednoduchý nástroj pro systémové poznámky
   Bez automatického ukládání
   ============================================ */

const noteField = document.getElementById("systemNote");
const exportBtn = document.getElementById("exportBtn");
const clearBtn = document.getElementById("clearBtn");
const statusEl = document.getElementById("status");

/* ============================================
   Pomocné funkce
   ============================================ */

function setStatus(text) {
  statusEl.textContent = text;
}

function getDefaultFileName() {
  const date = new Date().toISOString().slice(0, 10);
  return `system_note_${date}.txt`;
}

/* ============================================
   Export do TXT
   ============================================ */

exportBtn.addEventListener("click", () => {
  const content = noteField.value.trim();

  if (!content) {
    setStatus("Nelze exportovat prázdnou poznámku.");
    return;
  }

  const header =
    "SYSTEM NOTE – Palpatius\n" +
    "=======================\n\n";

  const footer =
    "\n\n-----------------------\n" +
    "Vytvořeno: " +
    new Date().toLocaleString("cs-CZ");

  const blob = new Blob([header + content + footer], {
    type: "text/plain;charset=utf-8"
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = getDefaultFileName();
  a.click();

  URL.revokeObjectURL(a.href);
  setStatus(`Soubor ${a.download} byl vytvořen.`);
});

/* ============================================
   Vymazání obsahu
   ============================================ */

clearBtn.addEventListener("click", () => {
  noteField.value = "";
  noteField.focus();
  setStatus("Obsah byl vymazán.");
});

/* ============================================
   Inicializace
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
  noteField.focus();
  setStatus("Připraveno.");
});
