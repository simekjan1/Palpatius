// =================================================================
// PALPATIUS UI UTILITIES (ui.js) - VYLEPŠENÁ VERZE
// Tento soubor obsahuje sdílené funkce pro uživatelské rozhraní.
// Změny zahrnují lepší správu listenerů, robustnější focus
// a vylepšenou přístupnost (A11y).
// =================================================================

// ZMĚNA: Tyto proměnné už nejsou globální, ale "soukromé" v rámci tohoto skriptu.
let elementToFocusOnClose = null;

// ZMĚNA: Definujeme si handlery pro event listenery, abychom je mohli později snadno odstranit.
let handleOkClick;
let handleCancelClick;
let handleKeydown;

/**
 * Spravuje "focus trap", aby uživatel nemohl opustit modální okno pomocí klávesy Tab.
 * @param {HTMLElement} modalElement - Element modálního okna.
 * @param {boolean} shouldTrap - True pro zapnutí, false pro vypnutí.
 */
function manageFocusTrap(modalElement, shouldTrap) {
    const focusableElements = modalElement.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const firstFocusableElement = focusableElements[0];
    const lastFocusableElement = focusableElements[focusableElements.length - 1];

    handleKeydown = function(e) {
        if (e.key === 'Tab') {
            if (e.shiftKey) { // Shift + Tab
                if (document.activeElement === firstFocusableElement) {
                    lastFocusableElement.focus();
                    e.preventDefault();
                }
            } else { // Tab
                if (document.activeElement === lastFocusableElement) {
                    firstFocusableElement.focus();
                    e.preventDefault();
                }
            }
        } else if (e.key === 'Escape') {
            closeCustomModal();
        }
    };

    if (shouldTrap) {
        modalElement.addEventListener('keydown', handleKeydown);
    } else {
        modalElement.removeEventListener('keydown', handleKeydown);
    }
}

/**
 * Zobrazí modální okno s vlastní zprávou a spravuje focus.
 * @param {string} message - Zpráva k zobrazení.
 * @param {string} [title='Zpráva'] - Titulek modálního okna.
 * @param {Function} [onConfirm=null] - Callback funkce pro potvrzení.
 * @param {boolean} [showCancel=false] - Zda zobrazit tlačítko "Zrušit".
 */
function showCustomModal(message, title = 'Zpráva', onConfirm = null, showCancel = false) {
    // ZMĚNA: Ukládáme si odkaz na prvek, na který vrátíme focus. Už to není globální proměnná.
    elementToFocusOnClose = document.activeElement;

    const modal = document.getElementById('customMessageModal');
    if (!modal) return;

    document.getElementById('modalMessageTitle').textContent = title;
    document.getElementById('modalMessage').innerHTML = message;

    const okButton = document.getElementById('modalOkButton');
    const cancelButton = document.getElementById('modalCancelButton');

    // ZMĚNA: Používáme explicitní addEventListener a removeEventListener místo cloneNode a onclick.
    // Nejprve odstraníme staré listenery, pokud by tam nějaké zůstaly.
    if (handleOkClick) okButton.removeEventListener('click', handleOkClick);
    if (handleCancelClick) cancelButton.removeEventListener('click', handleCancelClick);

    // Vytvoříme nové handlery pro aktuální volání.
    handleOkClick = () => {
        if (onConfirm) onConfirm();
        closeCustomModal();
    };
    handleCancelClick = closeCustomModal;

    // A připojíme je.
    okButton.addEventListener('click', handleOkClick);
    cancelButton.addEventListener('click', handleCancelClick);

    cancelButton.style.display = showCancel ? 'inline-block' : 'none';

    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');

    // ZMĚNA: Používáme requestAnimationFrame místo nespolehlivého setTimeout.
    requestAnimationFrame(() => {
        okButton.focus();
    });

    // ZMĚNA: Zapneme focus trap pomocí nové, vyčleněné funkce.
    manageFocusTrap(modal, true);
}

/**
 * Zavře hlavní modální okno a vrátí focus.
 */
function closeCustomModal() {
    const modal = document.getElementById('customMessageModal');
    if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');

        // ZMĚNA: Vypneme focus trap a uklidíme po sobě event listener.
        manageFocusTrap(modal, false);

        // ZMĚNA: Odstraníme listenery z tlačítek, abychom předešli memory leakům.
        const okButton = document.getElementById('modalOkButton');
        const cancelButton = document.getElementById('modalCancelButton');
        if (okButton && handleOkClick) okButton.removeEventListener('click', handleOkClick);
        if (cancelButton && handleCancelClick) cancelButton.removeEventListener('click', handleCancelClick);
    }
    
    if (elementToFocusOnClose) {
        elementToFocusOnClose.focus();
    }
    
    // Vynulujeme reference pro jistotu.
    elementToFocusOnClose = null;
    handleOkClick = null;
    handleCancelClick = null;
}

/**
 * Zavře jakékoliv modální okno podle jeho ID a vrátí focus.
 * @param {string} modalId - ID modálního okna.
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
        if (elementToFocusOnClose) {
            elementToFocusOnClose.focus();
        }
    }
}