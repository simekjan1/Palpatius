// Hlavní datová struktura pro všechny typy záznamů
let data = {
    notes: [],
    todos: [],
    events: [],
    ideas: []
};
let masernaClients = []; // Pole pro uložení klientů z Masérny

// --- Začátek kódu pro práci s IndexDB ---
const DB_NAME = 'PalpatiusZaznamnikDB';
const DB_VERSION = 1;
let db;

const MASERNA_DB_NAME = 'palpatiusMasernaDB';
const MASERNA_DB_VERSION = 1;

/**
 * Otevře IndexedDB databázi. Pokud neexistuje, vytvoří ji a vytvoří object store.
 * @returns {Promise<IDBDatabase>} Vrátí Promise s databázovým objektem.
 */
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('zaznamnikData')) {
                db.createObjectStore('zaznamnikData', { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('IndexedDB databáze Palpatius-Záznamník byla úspěšně otevřena.');
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
 * Načte data z databáze a nahradí jimi aktuální globální proměnnou 'data'.
 * @returns {Promise<void>}
 */
async function loadDataFromDB() {
    if (!db) {
        await openDatabase();
    }
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['zaznamnikData'], 'readonly');
        const store = transaction.objectStore('zaznamnikData');
        const request = store.get('currentData');

        request.onsuccess = (event) => {
            if (request.result) {
                data = request.result.data;
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
 * Uloží aktuální globální data do IndexedDB.
 */
function saveDataToDB() {
    if (!db) {
        console.error("Databáze není otevřena.");
        return;
    }
    const transaction = db.transaction(['zaznamnikData'], 'readwrite');
    const store = transaction.objectStore('zaznamnikData');
    const dataToSave = {
        id: 'currentData',
        data: data
    };
    const request = store.put(dataToSave); // Uložíme si request do proměnné

    request.onsuccess = () => {
        console.log('Data záznamníku byla automaticky uložena.');
    };

    request.onerror = (event) => {
        console.error('Chyba při ukládání dat záznamníku do IndexedDB:', event.target.error);
        showCustomModal('Kritická chyba! Data se nepodařilo automaticky uložit. Doporučujeme okamžitě exportovat data ručně a obnovit stránku.', 'Chyba ukládání');
    };
}


/**
 * Automatické ukládání dat po každé změně.
 */
function autoSave() {
    saveDataToDB();
}

// --- Nová funkce pro načítání klientů z Masérny ---
async function loadClientsFromMasernaDB() {
    return new Promise((resolve, reject) => {
        const masernaRequest = indexedDB.open(MASERNA_DB_NAME, MASERNA_DB_VERSION);

        masernaRequest.onsuccess = (event) => {
            const masernaDB = event.target.result;
            // Zkontrolujeme, jestli object store existuje, než otevřeme transakci
            if (!masernaDB.objectStoreNames.contains('masernaData')) {
                 console.warn('Object store "masernaData" v databázi Masérny neexistuje. Klienti nebudou načteni.');
                 resolve();
                 return;
            }
            const transaction = masernaDB.transaction(['masernaData'], 'readonly');
            const store = transaction.objectStore('masernaData');
            
            const getRequest = store.get('currentData');
            
            getRequest.onsuccess = () => {
                const masernaData = getRequest.result ? getRequest.result.data : { clients: [] };
                masernaClients = masernaData.clients.map(client => ({
                    id: client.id,
                    name: client.name
                }));
                populateClientSelects();
                console.log('Klienti z Masérny úspěšně načteni.');
                resolve();
            };

            getRequest.onerror = (event) => {
                console.error('Chyba při načítání klientů z Masérny:', event.target.error);
                resolve(); // Ponecháme to, ať to neblokuje aplikaci, když se klienti nenačtou
            };
        };

        masernaRequest.onerror = (event) => {
            console.error('Nepodařilo se otevřít databázi Masérny:', event.target.error);
            resolve();
        };
    });
}

/**
 * Naplní rozbalovací menu pro výběr klienta.
 */
function populateClientSelects() {
    const selects = document.querySelectorAll('select[id$="ClientSelect"]');
    selects.forEach(select => {
        const originalValue = select.value;
        select.innerHTML = '<option value="">-- Vyberte klienta --</option>'; 
        masernaClients.forEach(client => {
            const option = document.createElement('option');
            option.value = client.id;
            option.textContent = client.name;
            select.appendChild(option);
        });
        select.value = originalValue;
    });
}

/**
 * Získá jméno klienta podle ID.
 * @param {string} clientId ID klienta.
 * @returns {string} Jméno klienta, nebo 'Neznámý klient'.
 */
function getClientNameById(clientId) {
    if (!clientId) return '---';
    const client = masernaClients.find(c => c.id === clientId);
    return client ? client.name : 'Neznámý klient';
}

/**
 * Vygeneruje HTML kód pro <option> prvky se seznamem klientů.
 * @param {string | null} selectedClientId ID klienta, který má být předvybraný.
 * @returns {string} HTML string s <option> prvky.
 */
function getClientOptionsHTML(selectedClientId) {
    let optionsHTML = '<option value="">-- Vyberte klienta --</option>';
    masernaClients.forEach(client => {
        const isSelected = client.id === selectedClientId ? 'selected' : '';
        optionsHTML += `<option value="${client.id}" ${isSelected}>${client.name}</option>`;
    });
    return optionsHTML;
}

// --- Konec kódu pro práci s IndexDB ---

let currentFilter = 'all';
let currentView = 'main';
let currentTodoListId = null;
let sortStates = {};

const typeIcons = {
    'note': '📝', 'todo_list': '✅', 'event': '🗓️', 'idea': '💡'
};
const typeColors = {
    'note': 'text-blue-300', 'todo_list': 'text-green-400', 'event': 'text-orange-400', 'idea': 'text-red-400'
};

function openHelpModal() {
    lastFocusedElement = document.activeElement;
    const modal = document.getElementById('helpModal');
    modal.style.display = 'flex';
    modal.classList.remove('hidden');
    modal.focus();
}

function closeHelpModal() {
    closeModal('helpModal');
}

function formatDateForInput(dateString) { if (!dateString) return ''; const parts = dateString.split('.'); if (parts.length === 3) { return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`; } return dateString; }
function parseDateFromInput(dateString) { if (!dateString) return ''; const parts = dateString.split('-'); if (parts.length === 3) { return `${parts[2]}.${parts[1]}.${parts[0]}`; } return dateString; }
function formatDateForDisplay(dateString) { if (!dateString) return ''; const [year, month, day] = dateString.split('-'); return `${day}.${month}.${year}`; }


let activeFormId = null;
function toggleForm(formId) {
    const targetForm = document.getElementById(formId);
    if (activeFormId === formId) {
        targetForm.classList.add('hidden');
        document.querySelector(`button[aria-controls="${formId}"]`).setAttribute('aria-expanded', 'false');
        activeFormId = null;
    } else {
        document.querySelectorAll('.form-section').forEach(form => {
            if (form.id !== formId) {
                form.classList.add('hidden');
                document.querySelector(`button[aria-controls="${form.id}"]`)?.setAttribute('aria-expanded', 'false');
            }
        });
        targetForm.classList.remove('hidden');
        document.querySelector(`button[aria-controls="${formId}"]`).setAttribute('aria-expanded', 'true');
        activeFormId = formId;
        targetForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        targetForm.querySelector('input, textarea, select, button')?.focus();
    }
}

function addNote() {
    const title = document.getElementById('noteTitle').value.trim();
    const clientId = document.getElementById('noteClientSelect').value.trim();
    const text = document.getElementById('noteText').value.trim();

    if (!title || !text) {
        showCustomModal('Prosím, vyplňte název i text poznámky.', 'Chyba');
        return;
    }

    data.notes.push({
        id: Date.now(),
        type: 'note',
        title: title,
        text: text,
        clientId: clientId || null
    });

    document.getElementById('noteTitle').value = '';
    document.getElementById('noteText').value = '';
    document.getElementById('noteClientSelect').value = '';
    
    updateTable();
    toggleForm('noteFormSection');
    autoSave();
}

function viewNote(id) {
    const note = data.notes.find(n => n.id === id);
    showCustomModal(`<p class="text-gray-300 text-left"><strong>Text:</strong><br>${note.text.replace(/\n/g, '<br>')}</p>`, `Poznámka: ${note.title}`, null, false);
}

function editNote(id) {
    const note = data.notes.find(n => n.id === id);
    const modalContent = `
        <div>
            <label for="editNoteTitle">Název poznámky:</label>
            <input type="text" id="editNoteTitle" value="${note.title}" placeholder="Název poznámky" />
        </div>
        <div>
            <label for="editNoteClientSelect" class="mt-4">Přidat ke klientovi (nepovinné):</label>
            <select id="editNoteClientSelect" class="w-full">${getClientOptionsHTML(note.clientId)}</select>
        </div>
        <div>
            <label for="editNoteText">Text poznámky:</label>
            <textarea id="editNoteText" placeholder="Poznámka">${note.text}</textarea>
        </div>
    `;
    showCustomModal(modalContent, 'Upravit poznámku', () => submitEditNote(id), true);
}

function submitEditNote(id) {
    const note = data.notes.find(n => n.id === id);
    note.title = document.getElementById('editNoteTitle').value.trim();
    note.clientId = document.getElementById('editNoteClientSelect').value.trim() || null;
    note.text = document.getElementById('editNoteText').value.trim();
    closeModal('customMessageModal');
    updateTable();
    autoSave();
}

function showTodoListDetails(listId) {
    currentView = 'todoListDetail';
    currentTodoListId = listId;
    document.getElementById('globalControls').classList.add('hidden');
    document.getElementById('addButtonsSection').classList.add('hidden');
    document.getElementById('globalFilterInput').parentElement.classList.add('hidden');
    document.querySelector('.btn-toggle-filter').parentElement.classList.add('hidden');
    document.getElementById('mainDataTable').classList.add('hidden');
    
    const list = data.todos.find(l => l.id === listId);
    document.getElementById('currentTodoListName').textContent = `Úkoly v listu: ${list ? list.name : ''}`;
    document.getElementById('todoListDetailSection').classList.remove('hidden');
    
    updateTasksTable();
    toggleForm('todoFormSection');
    document.getElementById('taskText').focus();
}

function goBackToMainView() {
    currentView = 'main';
    currentTodoListId = null;
    document.getElementById('globalControls').classList.remove('hidden');
    document.getElementById('addButtonsSection').classList.remove('hidden');
    document.getElementById('globalFilterInput').parentElement.classList.remove('hidden');
    document.querySelector('.btn-toggle-filter').parentElement.classList.remove('hidden');
    document.getElementById('mainDataTable').classList.remove('hidden');
    document.getElementById('todoListDetailSection').classList.add('hidden');
    document.getElementById('todoFormSection').classList.add('hidden');
    updateTable();
}

function addTodoList() {
    const listName = document.getElementById('newListName').value.trim();
    if (!listName) {
        showCustomModal('Prosím, zadejte název To-Do listu.', 'Chyba');
        return;
    }
    data.todos.push({
        id: Date.now(),
        type: 'todo_list',
        name: listName,
        tasks: []
    });
    document.getElementById('newListName').value = '';
    updateTable();
    toggleForm('todoListFormSection');
    autoSave();
}

function showAddTodoTaskForm() {
    toggleForm('todoFormSection');
    document.getElementById('taskText').focus();
}

function addTask() {
    const clientId = document.getElementById('taskClientSelect').value.trim();
    const text = document.getElementById('taskText').value.trim();
    const dueDate = document.getElementById('taskDueDate').value;
    const priority = document.getElementById('taskPriority').value;

    if (!text) {
        showCustomModal('Prosím, vyplňte popis úkolu.', 'Chyba');
        return;
    }
    if (currentTodoListId === null) {
        showCustomModal('Nejdříve musíte vybrat nebo vytvořit To-Do list.', 'Chyba');
        return;
    }
    
    const list = data.todos.find(l => l.id === currentTodoListId);
    if (list) {
        list.tasks.push({
            id: Date.now(),
            type: 'todo_task',
            text: text,
            dueDate: dueDate,
            priority: priority,
            completed: false,
            clientId: clientId || null
        });
        document.getElementById('taskText').value = '';
        document.getElementById('taskDueDate').value = '';
        document.getElementById('taskPriority').value = 'nízká';
        document.getElementById('taskClientSelect').value = '';
        
        updateTasksTable();
        toggleForm('todoFormSection');
        autoSave();
    }
}

function toggleTaskCompletionInList(taskId) {
    const list = data.todos.find(l => l.id === currentTodoListId);
    if (list) {
        const task = list.tasks.find(t => t.id === taskId);
        if (task) {
            task.completed = !task.completed;
            updateTasksTable();
            autoSave();
        }
    }
}

function editTaskInList(taskId) {
    const list = data.todos.find(l => l.id === currentTodoListId);
    if (!list) return;
    const task = list.tasks.find(t => t.id === taskId);
    if (!task) return;

    const modalContent = `
        <div>
            <label for="editTaskClientSelect" class="mt-4">Přidat ke klientovi (nepovinné):</label>
            <select id="editTaskClientSelect" class="w-full">${getClientOptionsHTML(task.clientId)}</select>
        </div>
        <div>
            <label for="editTaskText">Popis úkolu:</label>
            <input type="text" id="editTaskText" value="${task.text}" placeholder="Popis úkolu" />
        </div>
        <div>
            <label for="editTaskDueDate">Termín (datum):</label>
            <input type="date" id="editTaskDueDate" value="${task.dueDate}" />
        </div>
        <div>
            <label for="editTaskPriority">Priorita:</label>
            <select id="editTaskPriority">
                <option value="nízká" ${task.priority === 'nízká' ? 'selected' : ''}>Nízká</option>
                <option value="střední" ${task.priority === 'střední' ? 'selected' : ''}>Střední</option>
                <option value="vysoká" ${task.priority === 'vysoká' ? 'selected' : ''}>Vysoká</option>
            </select>
        </div>
    `;
    showCustomModal(modalContent, 'Upravit úkol', () => submitEditTaskInList(taskId), true);
}

function submitEditTaskInList(taskId) {
    const list = data.todos.find(l => l.id === currentTodoListId);
    if (!list) return;
    const task = list.tasks.find(t => t.id === taskId);
    if (!task) return;
    
    task.clientId = document.getElementById('editTaskClientSelect').value.trim() || null;
    task.text = document.getElementById('editTaskText').value.trim();
    task.dueDate = document.getElementById('editTaskDueDate').value;
    task.priority = document.getElementById('editTaskPriority').value;
    
    closeModal('customMessageModal');
    updateTasksTable();
    autoSave();
}

function deleteTaskInList(taskId) {
    confirmAndDeleteItem('todo_task', taskId, currentTodoListId);
}

function handleTaskTableKeydown(event, taskId) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        toggleTaskCompletionInList(taskId);
        event.target.focus();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        const currentRow = event.target.closest('tr');
        let newRow;
        if (event.key === 'ArrowUp') {
            newRow = currentRow.previousElementSibling;
        } else {
            newRow = currentRow.nextElementSibling;
        }
        if (newRow) {
            newRow.querySelector('input[type="checkbox"]').focus();
        }
    }
}

function updateTasksTable() {
    const tbody = document.querySelector('#todoListTasksTable tbody');
    tbody.innerHTML = '';
    const list = data.todos.find(l => l.id === currentTodoListId);
    if (!list) return;

    const sortKey = sortStates['todoListTasksTable'] ? sortStates['todoListTasksTable'].key : 'dueDate';
    const sortDirection = sortStates['todoListTasksTable'] ? sortStates['todoListTasksTable'].direction : 'asc';

    const tasks = [...list.tasks].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        
        let valA, valB;
        const priorityOrder = { 'vysoká': 3, 'střední': 2, 'nízká': 1 };
        
        if (sortKey === 'priority') {
            valA = priorityOrder[a.priority] || 0;
            valB = priorityOrder[b.priority] || 0;
        } else if (sortKey === 'dueDate') {
            valA = a.dueDate ? a.dueDate : '9999-12-31';
            valB = b.dueDate ? b.dueDate : '9999-12-31';
        } else {
            valA = (a[sortKey] || '').toLowerCase();
            valB = (b[sortKey] || '').toLowerCase();
        }

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
    
    tasks.forEach(task => {
        const row = document.createElement('tr');
        const completedClass = task.completed ? 'todo-completed' : '';
        const priorityClass = `todo-priority-${task.priority}`;
        row.innerHTML = `
            <td class="${completedClass}"><input type="checkbox" id="task-${task.id}" ${task.completed ? 'checked' : ''} tabindex="0" onclick="toggleTaskCompletionInList(${task.id})"></td>
            <td class="${completedClass}">${task.clientId ? getClientNameById(task.clientId) : '---'}</td>
            <td class="${completedClass}"><label for="task-${task.id}" class="cursor-pointer">${task.text}</label></td>
            <td class="${completedClass}">${formatDateForDisplay(task.dueDate)}</td>
            <td class="${completedClass} ${priorityClass}">${task.priority}</td>
            <td>
                <button class="btn-secondary" onclick="editTaskInList(${task.id})">Upravit</button>
                <button class="btn-danger" onclick="deleteTaskInList(${task.id})">Smazat</button>
                <button class="btn-export" onclick="exportItemToTxt('todo_task', ${task.id})">Export TXT</button>
            </td>
        `;
        const checkbox = row.querySelector(`#task-${task.id}`);
        if (checkbox) {
            checkbox.addEventListener('keydown', (event) => handleTaskTableKeydown(event, task.id));
        }
        tbody.appendChild(row);
    });
}

function editTodoListName(listId) {
    const list = data.todos.find(l => l.id === listId);
    if (!list) return;
    const modalContent = `
        <div>
            <label for="editListName">Název listu:</label>
            <input type="text" id="editListName" value="${list.name}" placeholder="Název listu" />
        </div>
    `;
    showCustomModal(modalContent, 'Upravit název To-Do listu', () => submitEditTodoListName(listId), true);
}

function submitEditTodoListName(listId) {
    const list = data.todos.find(l => l.id === listId);
    if (!list) return;
    list.name = document.getElementById('editListName').value.trim();
    closeModal('customMessageModal');
    updateTable();
    autoSave();
}

function addEvent() {
    const clientId = document.getElementById('eventClientSelect').value.trim();
    const date = document.getElementById('eventDate').value;
    const time = document.getElementById('eventTime').value;
    const title = document.getElementById('eventTitle').value.trim();
    const description = document.getElementById('eventDescription').value.trim();

    if (!date || !time || !title) {
        showCustomModal('Prosím, vyplňte Datum, Čas a Název události.', 'Chyba');
        return;
    }
    
    data.events.push({
        id: Date.now(),
        type: 'event',
        date: date,
        time: time,
        title: title,
        description: description,
        clientId: clientId || null
    });

    document.getElementById('eventClientSelect').value = '';
    document.getElementById('eventDate').value = '';
    document.getElementById('eventTime').value = '';
    document.getElementById('eventTitle').value = '';
    document.getElementById('eventDescription').value = '';
    
    updateTable();
    toggleForm('eventFormSection');
    autoSave();
}

function viewEvent(id) {
    const event = data.events.find(e => e.id === id);
    showCustomModal(`<p class="text-gray-300 text-left"><strong>Datum:</strong> ${formatDateForDisplay(event.date)}</p><p class="text-gray-300 text-left"><strong>Čas:</strong> ${event.time}</p><p class="text-gray-300 text-left"><strong>Popis:</strong><br>${event.description.replace(/\n/g, '<br>')}</p>`, `Událost: ${event.title}`, null, false);
}

function editEvent(id) {
    const event = data.events.find(e => e.id === id);
    const modalContent = `
        <div>
            <label for="editEventClientSelect" class="mt-4">Přidat ke klientovi (nepovinné):</label>
            <select id="editEventClientSelect" class="w-full">${getClientOptionsHTML(event.clientId)}</select>
        </div>
        <div>
            <label for="editEventDate">Datum události:</label>
            <input type="date" id="editEventDate" value="${event.date}" />
        </div>
        <div>
            <label for="editEventTime">Čas události:</label>
            <input type="time" id="editEventTime" value="${event.time}" />
        </div>
        <div>
            <label for="editEventTitle">Název události:</label>
            <input type="text" id="editEventTitle" value="${event.title}" placeholder="Název události" />
        </div>
        <div>
            <label for="editEventDescription">Popis události / Poznámky:</label>
            <textarea id="editEventDescription" placeholder="Popis události / Poznámky">${event.description}</textarea>
        </div>
    `;
    showCustomModal(modalContent, 'Upravit událost', () => submitEditEvent(id), true);
}

function submitEditEvent(id) {
    const event = data.events.find(e => e.id === id);
    event.clientId = document.getElementById('editEventClientSelect').value.trim() || null;
    event.date = document.getElementById('editEventDate').value;
    event.time = document.getElementById('editEventTime').value;
    event.title = document.getElementById('editEventTitle').value.trim();
    event.description = document.getElementById('editEventDescription').value.trim();
    closeModal('customMessageModal');
    updateTable();
    autoSave();
}

function addIdea() {
    const title = document.getElementById('ideaTitle').value.trim();
    const clientId = document.getElementById('ideaClientSelect').value.trim();
    const description = document.getElementById('ideaDescription').value.trim();
    const category = document.getElementById('ideaCategory').value;

    if (!title || !description) {
        showCustomModal('Prosím, vyplňte název i popis nápadu.', 'Chyba');
        return;
    }
    
    const newIdea = {
        id: Date.now(),
        type: 'idea',
        title: title,
        description: description,
        category: category,
        clientId: clientId || null
    };
    
    data.ideas.push(newIdea);
    
    document.getElementById('ideaTitle').value = '';
    document.getElementById('ideaDescription').value = '';
    document.getElementById('ideaCategory').value = 'Obecné';
    document.getElementById('ideaClientSelect').value = '';
    
    updateTable();
    toggleForm('ideaFormSection');
    autoSave();
    showIdeaActionsModal(newIdea);
}

function viewIdea(id) {
    const idea = data.ideas.find(i => i.id === id);
    showCustomModal(`<p class="text-gray-300 text-left"><strong>Popis:</strong><br>${idea.description.replace(/\n/g, '<br>')}</p>`, `Nápad: ${idea.title} (${idea.category})`, null, false);
}

function editIdea(id) {
    const idea = data.ideas.find(i => i.id === id);
    const modalContent = `
        <div>
            <label for="editIdeaTitle">Název nápadu:</label>
            <input type="text" id="editIdeaTitle" value="${idea.title}" placeholder="Název nápadu" />
        </div>
        <div>
            <label for="editIdeaClientSelect" class="mt-4">Přidat ke klientovi (nepovinné):</label>
            <select id="editIdeaClientSelect" class="w-full">${getClientOptionsHTML(idea.clientId)}</select>
        </div>
        <div>
            <label for="editIdeaDescription">Popis nápadu / detailní poznámky:</label>
            <textarea id="editIdeaDescription" placeholder="Popis nápadu / detailní poznámky">${idea.description}</textarea>
        </div>
        <div>
            <label for="editIdeaCategory">Kategorie nápadu:</label>
            <select id="editIdeaCategory">
                <option value="Obecné" ${idea.category === 'Obecné' ? 'selected' : ''}>Obecné</option>
                <option value="Marketing" ${idea.category === 'Marketing' ? 'selected' : ''}>Marketing</option>
                <option value="Služby" ${idea.category === 'Služby' ? 'selected' : ''}>Nové služby</option>
                <option value="Studio" ${idea.category === 'Studio' ? 'selected' : ''}>Vylepšení studia</option>
                <option value="AI" ${idea.category === 'AI' ? 'selected' : ''}>AI a technologie</option>
                <option value="Ostatní" ${idea.category === 'Ostatní' ? 'selected' : ''}>Ostatní</option>
            </select>
        </div>
    `;
    showCustomModal(modalContent, 'Upravit nápad', () => submitEditIdea(id), true);
}

function submitEditIdea(id) {
    const idea = data.ideas.find(i => i.id === id);
    idea.title = document.getElementById('editIdeaTitle').value.trim();
    idea.clientId = document.getElementById('editIdeaClientSelect').value.trim() || null;
    idea.description = document.getElementById('editIdeaDescription').value.trim();
    idea.category = document.getElementById('editIdeaCategory').value;
    closeModal('customMessageModal');
    updateTable();
    autoSave();
}

function filterByType(type) {
    currentFilter = type;
    document.querySelectorAll('.btn-toggle-filter').forEach(btn => {
        btn.classList.remove('bg-blue-600', 'text-white');
        btn.classList.add('bg-gray-700', 'text-gray-300');
    });
    
    const activeBtn = document.querySelector(`.btn-toggle-filter[data-filter="${type}"]`);
    if (activeBtn) {
        activeBtn.classList.remove('bg-gray-700', 'text-gray-300');
        activeBtn.classList.add('bg-blue-600', 'text-white');
    }
    
    updateTable();
}

function confirmAndDeleteItem(type, id, todoListId = null) {
    showCustomModal('Opravdu chcete odstranit tento záznam?', 'Potvrdit smazání', () => {
        doDeleteItem(type, id, todoListId);
    }, true);
}

function doDeleteItem(type, id, todoListId = null) {
    if (type === 'todo_task' && todoListId !== null) {
        const list = data.todos.find(list => list.id === todoListId);
        if (list) {
            list.tasks = list.tasks.filter(task => task.id !== id);
            updateTasksTable();
        }
    } else {
        if (type === 'todo_list') {
            data.todos = data.todos.filter(item => item.id !== id);
        } else if (data[`${type}s`]) {
            data[`${type}s`] = data[`${type}s`].filter(item => item.id !== id);
        }
    }
    
    closeModal('customMessageModal');
    updateTable();
    autoSave();
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
    
    if (tableId === 'todoListTasksTable') {
        updateTasksTable();
    } else {
        updateTable();
    }
}

function updateTable() {
    if (currentView === 'todoListDetail') {
        updateTasksTable();
        return;
    }
    
    const tbody = document.querySelector('#mainDataTable tbody');
    tbody.innerHTML = '';
    
    const filterInput = document.getElementById('globalFilterInput').value.toLowerCase();
    
    let allItems = [];
    if (currentFilter === 'all' || currentFilter === 'note') allItems = allItems.concat(data.notes.map(n => ({ ...n, displayType: 'Poznámka' })));
    if (currentFilter === 'all' || currentFilter === 'todo_list') allItems = allItems.concat(data.todos.map(list => ({ id: list.id, type: 'todo_list', name: list.name, taskCount: list.tasks.length, displayType: 'To-Do List' })));
    if (currentFilter === 'all' || currentFilter === 'event') allItems = allItems.concat(data.events.map(e => ({ ...e, displayType: 'Událost' })));
    if (currentFilter === 'all' || currentFilter === 'idea') allItems = allItems.concat(data.ideas.map(i => ({ ...i, displayType: 'Nápad' })));
    
    const filteredItems = allItems.filter(item => {
        const searchable = (item.title || item.text || item.name || '') + ' ' + (item.description || '') + ' ' + (item.category || '') + ' ' + (item.priority || '') + ' ' + (item.dueDate || item.date || '') + ' ' + (item.time || '');
        return searchable.toLowerCase().includes(filterInput);
    });
    
    const sortKey = sortStates['mainDataTable'] ? sortStates['mainDataTable'].key : 'type';
    const sortDirection = sortStates['mainDataTable'] ? sortStates['mainDataTable'].direction : 'asc';
    
    const finalSortedItems = filteredItems.sort((a, b) => {
        let valA, valB;
        if (sortKey === 'type') { valA = a.type.toLowerCase(); valB = b.type.toLowerCase(); }
        else if (sortKey === 'title') { valA = (a.title || a.name || '').toLowerCase(); valB = (b.title || b.name || '').toLowerCase(); }
        else if (sortKey === 'category') { valA = (a.category || a.priority || '').toLowerCase(); valB = (b.category || b.priority || '').toLowerCase(); }
        else if (sortKey === 'clientName') { valA = getClientNameById(a.clientId).toLowerCase(); valB = getClientNameById(b.clientId).toLowerCase(); }
        else { valA = (a.date || a.dueDate || '').toLowerCase(); valB = (b.date || a.dueDate || '').toLowerCase(); }
        
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
    
    finalSortedItems.forEach(item => {
        const row = document.createElement('tr');
        let cell1 = '', cell2 = '', cell3 = '', cell4 = '', cell5 = '', actionButtons = '';
        
        switch (item.type) {
            case 'note':
                cell1 = `<span class="item-type-note">${typeIcons.note} ${item.displayType}</span>`;
                cell2 = item.clientId ? getClientNameById(item.clientId) : '---';
                cell3 = `<button class="text-left" onclick="viewNote(${item.id})">${item.title}</button>`;
                cell4 = item.text.substring(0, 50) + (item.text.length > 50 ? '...' : '');
                cell5 = '---';
                actionButtons = `<button class="btn-secondary" onclick="editItem('${item.type}', ${item.id})">Upravit</button><button class="btn-danger" onclick="confirmAndDeleteItem('${item.type}', ${item.id})">Smazat</button><button class="btn-export" onclick="exportItemToTxt('${item.type}', ${item.id})">Export TXT</button>`;
                break;
            case 'todo_list':
                cell1 = `<span class="item-type-todo_list">${typeIcons.todo_list} ${item.displayType}</span>`;
                cell2 = '---';
                cell3 = `<button class="text-left" onclick="showTodoListDetails(${item.id})">${item.name}</button>`;
                cell4 = `${item.taskCount} úkolů`;
                cell5 = '---';
                actionButtons = `<button class="btn-secondary" onclick="editTodoListName(${item.id})">Upravit</button><button class="btn-danger" onclick="confirmAndDeleteItem('todo_list', ${item.id})">Smazat</button>`;
                break;
            case 'event':
                cell1 = `<span class="item-type-event">${typeIcons.event} ${item.displayType}</span>`;
                cell2 = item.clientId ? getClientNameById(item.clientId) : '---';
                cell3 = `<button class="text-left" onclick="viewEvent(${item.id})">${item.title}</button>`;
                cell4 = `${formatDateForDisplay(item.date)} ${item.time}`;
                cell5 = item.description.substring(0, 50) + (item.description.length > 50 ? '...' : '');
                actionButtons = `<button class="btn-secondary" onclick="editItem('${item.type}', ${item.id})">Upravit</button><button class="btn-danger" onclick="confirmAndDeleteItem('${item.type}', ${item.id})">Smazat</button><button class="btn-export" onclick="exportItemToTxt('${item.type}', ${item.id})">Export TXT</button>`;
                break;
            case 'idea':
                cell1 = `<span class="item-type-idea">${typeIcons.idea} ${item.displayType}</span>`;
                cell2 = item.clientId ? getClientNameById(item.clientId) : '---';
                cell3 = `<button class="text-left" onclick="viewIdea(${item.id})">${item.title}</button>`;
                cell4 = item.description.substring(0, 50) + (item.description.length > 50 ? '...' : '');
                cell5 = item.category;
                actionButtons = `<button class="btn-secondary" onclick="editItem('${item.type}', ${item.id})">Upravit</button><button class="btn-danger" onclick="confirmAndDeleteItem('${item.type}', ${item.id})">Smazat</button><button class="btn-export" onclick="exportItemToTxt('${item.type}', ${item.id})">Export TXT</button>`;
                break;
        }
        
        row.innerHTML = `<td>${cell1}</td><td>${cell2}</td><td>${cell3}</td><td>${cell4}</td><td>${cell5}</td><td>${actionButtons}</td>`;
        tbody.appendChild(row);
    });
}

function editItem(type, id) {
    switch (type) {
        case 'note': editNote(id); break;
        case 'todo_list': editTodoListName(id); break;
        case 'todo_task': editTaskInList(id); break;
        case 'event': editEvent(id); break;
        case 'idea': editIdea(id); break;
    }
}

function exportItemToTxt(type, id) {
    let item, content = '';
    let filename = 'zaznam';

    switch (type) {
        case 'note':
            item = data.notes.find(n => n.id === id); if (!item) return;
            content = `--- Poznámka ---\nNázev: ${item.title}\nKlient: ${item.clientId ? getClientNameById(item.clientId) : '---'}\nText: ${item.text}\n`;
            filename = item.title;
            break;
        case 'todo_task':
            const list = data.todos.find(l => l.tasks.some(t => t.id === id));
            item = list ? list.tasks.find(t => t.id === id) : null; if (!item) return;
            content = `--- Úkol (To-Do) ---\nList: ${list.name}\nKlient: ${item.clientId ? getClientNameById(item.clientId) : '---'}\nPopis: ${item.text}\nTermín: ${formatDateForDisplay(item.dueDate)}\nPriorita: ${item.priority}\nSplněno: ${item.completed ? 'Ano' : 'Ne'}\n`;
            filename = item.text;
            break;
        case 'event':
            item = data.events.find(e => e.id === id); if (!item) return;
            content = `--- Událost ---\nNázev: ${item.title}\nKlient: ${item.clientId ? getClientNameById(item.clientId) : '---'}\nDatum: ${formatDateForDisplay(item.date)}\nČas: ${item.time}\nPopis: ${item.description}\n`;
            filename = item.title;
            break;
        case 'idea':
            item = data.ideas.find(i => i.id === id); if (!item) return;
            content = `--- Nápad/Inspirace ---\nNázev: ${item.title}\nKlient: ${item.clientId ? getClientNameById(item.clientId) : '---'}\nKategorie: ${item.category}\nPopis: ${item.description}\n`;
            filename = item.title;
            break;
        default: return;
    }

    filename = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dataStr = "data:text/plain;charset=utf-8," + encodeURIComponent(content);
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", `${filename}_${type}_${id}.txt`);
    dl.click();
}

function clearFilter() {
    document.getElementById('globalFilterInput').value = '';
    filterByType('all');
}

function exportAllData() {
    try {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data, null, 2));
        const dl = document.createElement('a');
        dl.setAttribute("href", dataStr);
        dl.setAttribute("download", "centralni_zaznamnik.json");
        dl.click();
        showCustomModal("Všechna data osobního záznamníku byla úspěšně exportována jako JSON.", "Export dokončen");
    } catch (error) {
        console.error("Chyba při exportu JSON dat:", error);
        showCustomModal("Nastala chyba při exportu dat. Zkuste to prosím znovu.", 'Chyba exportu');
    }
}

function importAllData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
        try {
            const importedData = JSON.parse(e.target.result);
            if (importedData && typeof importedData === 'object' && 'notes' in importedData && Array.isArray(importedData.notes) && 'todos' in importedData && Array.isArray(importedData.todos) && 'events' in importedData && Array.isArray(importedData.events) && 'ideas' in importedData && Array.isArray(importedData.ideas)) {
                
                importedData.notes.forEach(item => item.id = Number(item.id) || Date.now());
                importedData.todos.forEach(list => {
                    list.id = Number(list.id) || Date.now();
                    list.tasks.forEach(task => {
                        task.id = Number(task.id) || Date.now();
                        task.completed = (task.completed === true);
                        if (typeof task.dueDate !== 'string') task.dueDate = '';
                        if (typeof task.priority !== 'string') task.priority = 'nízká';
                    });
                });
                importedData.events.forEach(item => item.id = Number(item.id) || Date.now());
                importedData.ideas.forEach(item => item.id = Number(item.id) || Date.now());

                data = importedData;
                await saveDataToDB();
                updateTable();
                showCustomModal('Data byla úspěšně importována do centrálního záznamníku!', "Import dokončen");
            } else {
                showCustomModal('Chyba: Importovaný soubor nemá očekávaný formát pro osobní záznamník.', 'Chyba importu');
            }
        } catch (e) {
            console.error("Chyba při čtení JSON souboru:", e);
            showCustomModal('Chyba při čtení JSON souboru: ' + e.message, 'Chyba importu');
        }
    };
    reader.readAsText(file);
}

function showIdeaActionsModal(idea) {
    lastFocusedElement = document.activeElement;
    const modal = document.getElementById('ideaActionsModal');
    const addPricelistBtn = document.getElementById('addIdeaToPricelistBtn');
    const addTodoBtn = document.getElementById('addIdeaToTodoBtn');
    const closeBtn = document.getElementById('closeIdeaActionsModalBtn');
    
    addPricelistBtn.onclick = () => sendToMasernaPricelist(idea);
    addTodoBtn.onclick = () => convertIdeaToTodo(idea);
    closeBtn.onclick = () => closeModal('ideaActionsModal');
    
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => { modal.focus(); }, 100);
}

function sendToMasernaPricelist(idea) {
    const masernaRequest = indexedDB.open(MASERNA_DB_NAME, MASERNA_DB_VERSION);
    masernaRequest.onsuccess = (event) => {
        const masernaDB = event.target.result;
        if (!masernaDB.objectStoreNames.contains('masernaData')) {
            console.warn('Object store "masernaData" v Masérně neexistuje.');
            closeModal('ideaActionsModal');
            return;
        }
        
        const transaction = masernaDB.transaction(['masernaData'], 'readwrite');
        const store = transaction.objectStore('masernaData');
        const getRequest = store.get('currentData');
        
        getRequest.onsuccess = () => {
            const masernaData = getRequest.result ? getRequest.result.data : { clients: [], priceListItems: [], globalMassageHistory: [], voucherPurchases: [] };
            
            const newPriceListItem = {
                id: Date.now().toString(),
                year: new Date().getFullYear().toString(),
                type: 'nová položka',
                name: idea.title,
                length: '?? min',
                price: 0,
                count: 0,
                total: 0
            };
            
            masernaData.priceListItems.push(newPriceListItem);
            
            const dataToSave = { id: 'currentData', data: masernaData };
            const putRequest = store.put(dataToSave);
            
            putRequest.onsuccess = () => {
                showCustomModal('Váš nápad **"' + idea.title + '"** byl úspěšně odeslán do ceníku v Masérně. Nezapomeňte tam doplnit detaily!', 'Odesláno do Masérny');
            };
            putRequest.onerror = () => {
                showCustomModal('Nastala chyba při odesílání nápadu do Masérny.', 'Chyba');
            };
        };
    };
    masernaRequest.onerror = () => {
        showCustomModal('Nelze odeslat nápad. Nepodařilo se připojit k databázi Masérny.', 'Chyba připojení');
    };
    
    closeModal('ideaActionsModal');
}

function convertIdeaToTodo(idea) {
    if (data.todos.length === 0) {
        showCustomModal('Nelze přidat úkol, protože nemáte žádný To-Do list. Vytvořte prosím nejdříve list.', 'Chyba');
        closeModal('ideaActionsModal');
        return;
    }
    
    const firstTodoList = data.todos[0];
    firstTodoList.tasks.push({
        id: Date.now(),
        type: 'todo_task',
        text: idea.title,
        dueDate: '',
        priority: 'střední',
        completed: false,
        clientId: idea.clientId || null
    });
    
    autoSave();
    closeModal('ideaActionsModal');
    showCustomModal('Váš nápad byl úspěšně přidán jako úkol do To-Do listu: **' + firstTodoList.name + '**', 'Úkol přidán');
    updateTable();
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await openDatabase();
        await loadClientsFromMasernaDB();
        await loadDataFromDB();
    } catch (e) {
        console.error("Nepodařilo se načíst data z databáze.", e);
    }
    
    document.querySelectorAll('th[data-sort]').forEach(header => {
        header.addEventListener('click', () => {
            const tableId = header.closest('table').id;
            const sortKey = header.getAttribute('data-sort');
            sortTable(tableId, sortKey);
        });
    });

    document.getElementById('modalOkButton').addEventListener('click', () => {
        if(pendingConfirmCallback) {
            pendingConfirmCallback();
        }
        closeModal('customMessageModal');
    });

    const cancelButton = document.getElementById('modalCancelButton');
    if (cancelButton) {
        cancelButton.addEventListener('click', () => closeModal('customMessageModal'));
    }

    document.getElementById('customMessageModal').addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal('customMessageModal');
    });
    
    document.querySelectorAll('.btn-toggle-filter').forEach(button => {
        button.addEventListener('click', () => {
            filterByType(button.dataset.filter);
        });
    });

    updateTable();
    filterByType('all');
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
