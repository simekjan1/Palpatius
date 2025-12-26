/* ============================================
   TXT / MD Helper – script.js
   Offline nástroj bez ukládání dat
   ============================================ */

const editor = document.getElementById("editor");
const preview = document.getElementById("preview");
const fileNameInput = document.getElementById("fileName");
const exportTypeSelect = document.getElementById("exportType");
const statusEl = document.getElementById("formStatus");

/* ============================================
   Pomocné funkce
   ============================================ */

function setStatus(text) {
  statusEl.textContent = text;
}

function getCaretPosition(el) {
  return {
    start: el.selectionStart,
    end: el.selectionEnd
  };
}

function insertAtCursor(el, text) {
  const { start, end } = getCaretPosition(el);
  const value = el.value;

  el.value = value.slice(0, start) + text + value.slice(end);
  const newPos = start + text.length;

  el.setSelectionRange(newPos, newPos);
  el.focus();

  syncPreview();
}

/* ============================================
   Šablony
   ============================================ */

function getTemplate(type) {
  const now = new Date();

  switch (type) {
    case "md_h1":
      return "# Nadpis\n\n";
    case "md_h2":
      return "## Podnadpis\n\n";
    case "md_hr":
      return "\n---\n\n";
    case "md_list":
      return "- položka\n- položka\n- položka\n\n";
    case "md_code":
      return "```text\n\n```\n\n";
    case "txt_line":
      return "\n====================\n\n";
    case "txt_box":
      return "\n--------------------\n\n--------------------\n\n";
    case "date":
      return now.toLocaleDateString("cs-CZ");
    case "time":
      return now.toLocaleTimeString("cs-CZ", { hour: "2-digit", minute: "2-digit" });
    default:
      return "";
  }
}

/* ============================================
   Vkládání šablon
   ============================================ */

document.querySelectorAll("[data-insert]").forEach(btn => {
  btn.addEventListener("click", () => {
    const type = btn.dataset.insert;
    const tpl = getTemplate(type);
    insertAtCursor(editor, tpl);
    setStatus("Vložena šablona.");
  });

  btn.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      btn.click();
    }
  });
});

/* ============================================
   Náhled
   ============================================ */

function syncPreview() {
  preview.value = editor.value;
}

editor.addEventListener("input", syncPreview);

/* ============================================
   Export
   ============================================ */

function getExportFileName(ext) {
  const base =
    fileNameInput.value.trim() ||
    `text_${new Date().toISOString().slice(0, 10)}`;

  return `${base}.${ext}`;
}

function exportText(ext) {
  const content = editor.value;

  if (!content.trim()) {
    setStatus("Nelze exportovat prázdný text.");
    return;
  }

  const blob = new Blob([content], {
    type: "text/plain;charset=utf-8"
  });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = getExportFileName(ext);
  a.click();

  URL.revokeObjectURL(a.href);
  setStatus(`Soubor ${a.download} byl vytvořen.`);
}

document.getElementById("exportBtn").addEventListener("click", () => {
  exportText(exportTypeSelect.value);
});

document.getElementById("exportMdBtn").addEventListener("click", () => {
  exportText("md");
});

document.getElementById("exportTxtBtn").addEventListener("click", () => {
  exportText("txt");
});

/* ============================================
   Vymazání obsahu
   ============================================ */

document.getElementById("clearBtn").addEventListener("click", () => {
  editor.value = "";
  preview.value = "";
  setStatus("Obsah vymazán.");
  editor.focus();
});

/* ============================================
   Inicializace
   ============================================ */

document.addEventListener("DOMContentLoaded", () => {
  syncPreview();
  setStatus("Připraveno.");
});
