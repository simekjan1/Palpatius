// ==========================
// IndexedDB – základ
// ==========================

const DB_NAME = "notesApp";
const DB_VERSION = 1;
const STORE_NAME = "notes";

let db = null;
let currentNoteId = null;
let renamingNoteId = null;
let searchQuery = "";

// Stav sbalených poznámek
const collapsedNotes = new Set();
let firstLoad = true; // Pomocná proměnná pro sbalení při startu

// ==========================
// Otevření databáze
// ==========================

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject("Nepodařilo se otevřít databázi");

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => {
      db = request.result;
      resolve();
    };
  });
}

// ==========================
// DB operace
// ==========================

function getAllNotes() {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
  });
}

function saveNote(note) {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(note);
    tx.oncomplete = () => resolve();
  });
}

function deleteNote(id) {
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
  });
}

// ==========================
// UI prvky
// ==========================

const tree = document.getElementById("notesTree");
const editor = document.getElementById("noteEditor");
const addBtn = document.getElementById("addNoteBtn");
const deleteBtn = document.getElementById("deleteNoteBtn");
const exportMdBtn = document.getElementById("exportTxtBtn");
const exportJsonBtn = document.getElementById("exportJsonBtn");
const importJsonBtn = document.getElementById("importJsonBtn");
const importFileInput = document.getElementById("importFileInput");
const searchInput = document.getElementById("searchInput"); // Předpokládá existenci v HTML

// ==========================
// Vyhledávání
// ==========================

if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderTree();
  });
}

// ==========================
// Klávesnice ve stromu
// ==========================

tree.addEventListener("keydown", (e) => {
  const items = [...tree.querySelectorAll('[role="treeitem"]')];
  const active = document.activeElement;
  const currentIndex = items.findIndex(i => i === active);

  if (currentIndex === -1) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    items[currentIndex + 1]?.focus();
  }

  if (e.key === "ArrowUp") {
    e.preventDefault();
    items[currentIndex - 1]?.focus();
  }

  if (e.key === "Enter" && !renamingNoteId) {
    e.preventDefault();
    const noteId = active?.dataset?.id;
    if (noteId) selectNote(noteId);
  }

  if (e.key === "Delete") {
    e.preventDefault();
    deleteBtn.click();
  }

  if (e.key === "ArrowLeft") {
    e.preventDefault();
    const noteId = active?.dataset?.id;
    if (noteId) {
      collapsedNotes.add(noteId);
      renderTree();
    }
  }

  if (e.key === "ArrowRight") {
    e.preventDefault();
    const noteId = active?.dataset?.id;
    if (noteId) {
      collapsedNotes.delete(noteId);
      renderTree();
    }
  }

  if (e.key === "F2") {
    e.preventDefault();
    const noteId = active?.dataset?.id;
    if (noteId) {
      renamingNoteId = noteId;
      renderTree();
    }
  }
});

// ==========================
// Poznámky - akce
// ==========================

addBtn.addEventListener("click", async () => {
  const id = crypto.randomUUID();
  const note = {
    id,
    parentId: currentNoteId || null,
    title: "",
    content: "",
    created: Date.now(),
    updated: Date.now()
  };

  await saveNote(note);
  renamingNoteId = id;
  // Pokud přidáváme podpoznámku, musíme rodiče rozbalit
  if (currentNoteId) collapsedNotes.delete(currentNoteId);
  await renderTree();
});

async function createChildNote(parentId) {
  const id = crypto.randomUUID();
  const note = {
    id,
    parentId,
    title: "",
    content: "",
    created: Date.now(),
    updated: Date.now()
  };

  await saveNote(note);
  renamingNoteId = id;
  collapsedNotes.delete(parentId);
  await renderTree();
}

deleteBtn.addEventListener("click", async () => {
  if (!currentNoteId) return;
  const ok = confirm("Opravdu chceš smazat tuto poznámku a všechny její podpoznámky?");
  if (!ok) return;

  const notes = await getAllNotes();
  await deleteBranch(currentNoteId, notes);

  currentNoteId = null;
  editor.value = "";
  await renderTree();
});

async function deleteBranch(id, notes) {
  const children = notes.filter(n => n.parentId === id);
  for (const child of children) {
    await deleteBranch(child.id, notes);
  }
  collapsedNotes.delete(id);
  await deleteNote(id);
}

// ==========================
// Editor – autosave (Optimalizováno)
// ==========================

editor.addEventListener("input", async () => {
  if (!currentNoteId) return;

  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  
  const request = store.get(currentNoteId);
  request.onsuccess = () => {
    const note = request.result;
    if (note) {
      note.content = editor.value;
      note.updated = Date.now();
      store.put(note);
    }
  };
});

// ==========================
// Strom poznámek
// ==========================

async function renderTree() {
  const activeId = document.activeElement?.dataset?.id || null;
  const notes = await getAllNotes();

  // Při prvním načtení všechno sbalíme
  if (firstLoad && notes.length > 0) {
    notes.forEach(n => collapsedNotes.add(n.id));
    firstLoad = false;
  }

  tree.innerHTML = "";
  renderBranch(null, notes, 1);

  if (activeId) {
    const el = tree.querySelector(`[data-id="${activeId}"]`);
    el?.focus();
  }
}

function renderBranch(parentId, notes, level) {
  const children = notes.filter(n => n.parentId === parentId);

  children.forEach(note => {
    const hasChildren = notes.some(n => n.parentId === note.id);
    const matchesSearch = note.title.toLowerCase().includes(searchQuery) || 
                          note.content.toLowerCase().includes(searchQuery);
    
    // Pokud vyhledáváme a tahle větev ani její potomci nevyhovují, nevykreslíme nic
    if (searchQuery && !matchesSearch && !hasSubtreeMatch(note.id, notes, searchQuery)) {
      return;
    }

    // Pokud vyhledáváme a potomek vyhovuje, automaticky rozbalíme
    if (searchQuery && hasSubtreeMatch(note.id, notes, searchQuery)) {
      collapsedNotes.delete(note.id);
    }

    const isCollapsed = collapsedNotes.has(note.id);

    const item = document.createElement("div");
    item.role = "treeitem";
    item.tabIndex = 0;
    item.dataset.id = note.id;
    item.setAttribute("aria-level", level);
    item.style.paddingLeft = `${level * 1.2}rem`;
    item.className = note.id === currentNoteId ? "tree-item active" : "tree-item";
    if (matchesSearch && searchQuery) item.classList.add("search-match");

    // Toggle button
    if (hasChildren) {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.textContent = isCollapsed ? "▸" : "▾";
      toggle.className = "toggle-btn";
      toggle.onclick = (e) => {
        e.stopPropagation();
        if (collapsedNotes.has(note.id)) collapsedNotes.delete(note.id);
        else collapsedNotes.add(note.id);
        renderTree();
      };
      item.appendChild(toggle);
    } else {
      const spacer = document.createElement("span");
      spacer.innerHTML = "&nbsp;&nbsp;&nbsp;";
      item.appendChild(spacer);
    }

    // Inline editace nebo label
    if (note.id === renamingNoteId) {
      const input = document.createElement("input");
      input.type = "text";
      input.value = note.title;
      input.addEventListener("keydown", async (e) => {
        if (e.key === "Enter") {
          note.title = input.value.trim() || "Bez názvu";
          await saveNote(note);
          renamingNoteId = null;
          await renderTree();
          selectNote(note.id);
        }
        if (e.key === "Escape") {
          renamingNoteId = null;
          if (!note.title) await deleteNote(note.id);
          await renderTree();
        }
      });
      item.appendChild(input);
      tree.appendChild(item);
      setTimeout(() => input.focus(), 0);
      return;
    }

    const label = document.createElement("span");
    label.className = "note-label";
    label.textContent = note.title || "Bez názvu";
    item.appendChild(label);

    item.addEventListener("click", () => selectNote(note.id));

    tree.appendChild(item);

    if (hasChildren && !isCollapsed) {
      renderBranch(note.id, notes, level + 1);
    }
  });
}

// Pomocná funkce pro vyhledávání v podstromu
function hasSubtreeMatch(parentId, notes, query) {
  const children = notes.filter(n => n.parentId === parentId);
  return children.some(n => 
    n.title.toLowerCase().includes(query) || 
    n.content.toLowerCase().includes(query) || 
    hasSubtreeMatch(n.id, notes, query)
  );
}

// ==========================
// Výběr poznámky
// ==========================

async function selectNote(id) {
  const notes = await getAllNotes();
  const note = notes.find(n => n.id === id);
  if (!note) return;

  currentNoteId = id;
  editor.value = note.content;
  
  // Vizuální označení
  const items = tree.querySelectorAll('[role="treeitem"]');
  items.forEach(item => {
    item.setAttribute("aria-selected", item.dataset.id === id ? "true" : "false");
    if (item.dataset.id === id) item.classList.add("active");
    else item.classList.remove("active");
  });
}

// ==========================
// Exporty a Import (zůstávají podobné, jen s drobným čištěním)
// ==========================

exportMdBtn.addEventListener("click", async () => {
  const notes = await getAllNotes();
  let output = "";
  function buildMd(parentId, level) {
    notes.filter(n => n.parentId === parentId).forEach(note => {
      output += `${"#".repeat(level)} ${note.title || "Bez názvu"}\n\n${note.content}\n\n`;
      buildMd(note.id, level + 1);
    });
  }
  buildMd(null, 1);
  downloadFile(output, "poznamky.md", "text/markdown");
});

exportJsonBtn.addEventListener("click", async () => {
  const notes = await getAllNotes();
  downloadFile(JSON.stringify({ exportedAt: new Date(), notes }, null, 2), "poznamky.json", "application/json");
});

importJsonBtn.addEventListener("click", () => importFileInput.click());

importFileInput.addEventListener("change", async () => {
  const file = importFileInput.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (confirm("Import přepíše všechny poznámky. Pokračovat?")) {
      const existing = await getAllNotes();
      for (const n of existing) await deleteNote(n.id);
      for (const n of data.notes) await saveNote(n);
      location.reload();
    }
  } catch (e) { alert("Chyba při importu."); }
});

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// Start
openDatabase().then(renderTree).catch(console.error);