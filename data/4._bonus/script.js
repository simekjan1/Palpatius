// === Získání DOM elementů ===
const dealerCardsDiv = document.getElementById('dealer-cards');
const playerCardsDiv = document.getElementById('player-cards');
const dealerScoreSpan = document.getElementById('dealer-score');
const playerScoreSpan = document.getElementById('player-score');
const gameMessageDiv = document.getElementById('game-message');
const newGameBtn = document.getElementById('new-game-btn');
const hitBtn = document.getElementById('hit-btn');
const standBtn = document.getElementById('stand-btn');
const doubleDownBtn = document.getElementById('double-down-btn');
const winsScoreSpan = document.getElementById('wins-score');
const lossesScoreSpan = document.getElementById('losses-score');
const saveGameBtn = document.getElementById('save-game-btn');
const loadGameBtn = document.getElementById('load-game-btn');
const loadFileInput = document.getElementById('load-file-input');
const helpBtn = document.getElementById('help-btn');
const helpModal = document.getElementById('helpModal');
const closeHelpModalBtn = document.getElementById('closeHelpModalBtn');

let audioContextStarted = false;

// === Tone.js syntezátory a zvuky ===
const cardDealSynth = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 8,
    envelope: {
        attack: 0.001,
        decay: 0.1,
        sustain: 0.01,
        release: 0.1,
    },
}).toDestination();

const hitSynth = new Tone.Synth({
    oscillator: { type: "square" },
    envelope: { attack: 0.01, decay: 0.05, sustain: 0, release: 0.05 }
}).toDestination();

const standSynth = new Tone.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.01, decay: 0.1, sustain: 0.01, release: 0.1 }
}).toDestination();

const winSynth = new Tone.Synth({
    oscillator: { type: "sawtooth" },
    envelope: { attack: 0.05, decay: 0.5, sustain: 0.1, release: 1 }
}).toDestination();

const loseSynth = new Tone.NoiseSynth({
    envelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 }
}).toDestination();

/**
 * Inicializuje audio kontext při prvním uživatelském kliknutí.
 */
function startAudioContext() {
    if (!audioContextStarted) {
        Tone.start();
        audioContextStarted = true;
        console.log("AudioContext started.");
        document.body.removeEventListener('click', startAudioContext);
    }
}
document.body.addEventListener('click', startAudioContext);

// === Základní proměnné hry ===
let deck = [];
let playerCards = [];
let dealerCards = [];
let playerScore = 0;
let dealerScore = 0;
let gameOver = false;
let wins = 0;
let losses = 0;
let hasDoubledDown = false; // Proměnná pro sledování Double Down
let lastFocusedElement = null; // Pro uložení fokusu pro přístupnost

/**
 * Funkce pro oznámení čtečce obrazovky.
 * Používá forced reflow, aby zajistila, že se hláška přečte, i když je stejná.
 * @param {string} message Zpráva k oznámení.
 */
function announce(message) {
    gameMessageDiv.setAttribute('aria-hidden', 'true');
    gameMessageDiv.textContent = '';
    void gameMessageDiv.offsetWidth; // Vynutí překreslení DOM
    gameMessageDiv.setAttribute('aria-hidden', 'false');
    gameMessageDiv.textContent = message;
}

/**
 * Vytvoří a zamíchá balíček karet.
 */
function createDeck() {
    const suits = ['Srdce', 'Káry', 'Kříže', 'Piky'];
    const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    deck = [];
    for (let suit of suits) {
        for (let rank of ranks) {
            deck.push({ rank, suit });
        }
    }
    // Zamíchání balíčku (Fisher-Yates shuffle)
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    announce("Balíček karet byl vytvořen a zamíchán.");
}

/**
 * Získává číselnou hodnotu karty.
 * @param {object} card Objekt karty.
 * @returns {number} Hodnota karty.
 */
function getCardValue(card) {
    if (['J', 'Q', 'K'].includes(card.rank)) {
        return 10;
    }
    if (card.rank === 'A') {
        return 11;
    }
    return parseInt(card.rank);
}

/**
 * Vypočítá skóre ruky s ohledem na esa.
 * @param {Array} hand Pole karet.
 * @returns {number} Celkové skóre.
 */
function calculateScore(hand) {
    let score = 0;
    let numAces = 0;
    for (let card of hand) {
        score += getCardValue(card);
        if (card.rank === 'A') {
            numAces++;
        }
    }
    // Přepočet es na 1, pokud je skóre vyšší než 21
    while (score > 21 && numAces > 0) {
        score -= 10;
        numAces--;
    }
    return score;
}

/**
 * Zobrazí karty na obrazovce a aktualizuje ARIA labely.
 * @param {Array} cards Pole karet.
 * @param {HTMLElement} element DOM element pro zobrazení.
 * @param {boolean} isDealer Zda se jedná o dealera.
 */
function displayCards(cards, element, isDealer = false) {
    element.innerHTML = '';
    let cardDescriptions = [];
    cards.forEach((card, index) => {
        const cardDiv = document.createElement('div');
        cardDiv.classList.add('card');
        let cardText = `${card.rank} ${card.suit}`;
        let ariaLabel = `Karta: ${card.rank} ${card.suit}`;

        if (isDealer && index === 1 && !gameOver) {
            cardDiv.classList.add('hidden');
            cardText = 'Skrytá karta';
            ariaLabel = 'Skrytá karta dealera';
        }
        cardDiv.textContent = cardText;
        cardDiv.setAttribute('aria-label', ariaLabel);
        element.appendChild(cardDiv);
        cardDescriptions.push(ariaLabel);
    });
    element.setAttribute('aria-label', cardDescriptions.join(', '));
}

/**
 * Rozdá jednu kartu z balíčku.
 * @param {Array} hand Ruka, do které se má karta přidat.
 * @param {HTMLElement} element DOM element pro zobrazení.
 * @param {boolean} isDealer Zda se jedná o dealera.
 */
function dealCard(hand, element, isDealer = false) {
    if (deck.length === 0) {
        announce("Balíček je prázdný! Hra končí.");
        endGame('draw');
        return null;
    }
    const card = deck.pop();
    hand.push(card);
    displayCards(hand, element, isDealer);
    if (audioContextStarted) {
        cardDealSynth.triggerAttackRelease("C4", "8n");
    }
    return card;
}

/**
 * Spustí novou hru.
 */
function startNewGame() {
    announce("Začíná nová hra!");
    createDeck();
    playerCards = [];
    dealerCards = [];
    playerScore = 0;
    dealerScore = 0;
    gameOver = false;
    hasDoubledDown = false;

    displayCards([], playerCardsDiv);
    displayCards([], dealerCardsDiv);
    playerScoreSpan.textContent = '0';
    dealerScoreSpan.textContent = '0';

    // Animace rozdávání karet
    setTimeout(() => {
        const playerCard1 = dealCard(playerCards, playerCardsDiv);
        setTimeout(() => {
            const dealerCard1 = dealCard(dealerCards, dealerCardsDiv, true);
            setTimeout(() => {
                const playerCard2 = dealCard(playerCards, playerCardsDiv);
                setTimeout(() => {
                    const dealerCard2 = dealCard(dealerCards, dealerCardsDiv, true);

                    playerScore = calculateScore(playerCards);
                    playerScoreSpan.textContent = playerScore;
                    dealerScoreSpan.textContent = getCardValue(dealerCard1);

                    announce(`Byly rozdány karty. Tvoje karty jsou ${playerCard1.rank} ${playerCard1.suit} a ${playerCard2.rank} ${playerCard2.suit}. Tvoje skóre je ${playerScore}. Dealer má ${dealerCard1.rank} ${dealerCard1.suit} a jednu skrytou kartu. Aktuální skóre: Výhry ${wins}, Prohry ${losses}.`);

                    enablePlayerActions(true);
                    newGameBtn.disabled = true;
                    newGameBtn.tabIndex = -1;

                    if (playerCards.length === 2) {
                        doubleDownBtn.disabled = false;
                        doubleDownBtn.tabIndex = 0;
                    } else {
                        doubleDownBtn.disabled = true;
                        doubleDownBtn.tabIndex = -1;
                    }

                    hitBtn.focus();

                    if (playerScore === 21) {
                        announce("Máš Blackjack!");
                        playerTurnEnded();
                    }
                }, 500);
            }, 500);
        }, 500);
    }, 500);
}

/**
 * Povolí nebo zakáže herní tlačítka hráče.
 * @param {boolean} enable Zda tlačítka povolit.
 */
function enablePlayerActions(enable) {
    hitBtn.disabled = !enable;
    standBtn.disabled = !enable;

    hitBtn.tabIndex = enable ? 0 : -1;
    standBtn.tabIndex = enable ? 0 : -1;

    if (enable && playerCards.length === 2 && !hasDoubledDown) {
        doubleDownBtn.disabled = false;
        doubleDownBtn.tabIndex = 0;
    } else {
        doubleDownBtn.disabled = true;
        doubleDownBtn.tabIndex = -1;
    }
}

/**
 * Ukončí hru a vyhodnotí výsledek.
 * @param {string} outcome Výsledek hry ('win', 'lose', 'draw').
 */
function endGame(outcome) {
    gameOver = true;
    enablePlayerActions(false);
    newGameBtn.disabled = false;
    newGameBtn.tabIndex = 0;
    
    let resultMessage = "";

    if (outcome === 'win') {
        wins++;
        resultMessage = "Vyhráváš!";
        if (audioContextStarted) winSynth.triggerAttackRelease("C5", "2n");
    } else if (outcome === 'lose') {
        losses++;
        resultMessage = "Prohráváš!";
        if (audioContextStarted) loseSynth.triggerAttackRelease("8n");
    } else {
        resultMessage = "Remíza!";
    }

    updateScoreDisplay();
    announce(`Konec hry: ${resultMessage} Aktuální skóre: Výhry ${wins}, Prohry ${losses}.`);
    newGameBtn.focus();
}

/**
 * Tah "Vzít kartu" (Hit).
 */
function hit() {
    if (gameOver) return;
    const newCard = dealCard(playerCards, playerCardsDiv);
    if (newCard) {
        if (audioContextStarted) {
            hitSynth.triggerAttackRelease("C5", "8n");
        }
        playerScore = calculateScore(playerCards);
        playerScoreSpan.textContent = playerScore;
        announce(`Dostal jsi ${newCard.rank} ${newCard.suit}. Tvoje skóre je nyní ${playerScore}.`);

        doubleDownBtn.disabled = true;
        doubleDownBtn.tabIndex = -1;

        if (playerScore > 21) {
            announce("Překročil jsi 21! Prohráváš. Hra končí.");
            endGame('lose');
        } else if (playerScore === 21) {
            announce("Máš 21!");
            playerTurnEnded();
        }
    }
}

/**
 * Tah "Zůstat" (Stand).
 */
function stand() {
    if (gameOver) return;
    if (audioContextStarted) {
        standSynth.triggerAttackRelease("C4", "8n");
    }
    announce("Zůstáváš s aktuálními kartami. Tvoje skóre je " + playerScore + ".");
    playerTurnEnded();
}

/**
 * Tah "Double Down".
 */
function doubleDown() {
    if (gameOver) return;
    if (audioContextStarted) {
        standSynth.triggerAttackRelease("C4", "8n");
    }
    announce("Zdvojnásobil jsi sázku a bereš jednu kartu.");
    hasDoubledDown = true;
    enablePlayerActions(false);
    const newCard = dealCard(playerCards, playerCardsDiv);
    if (newCard) {
        playerScore = calculateScore(playerCards);
        playerScoreSpan.textContent = playerScore;
        announce(`Dostal jsi ${newCard.rank} ${newCard.suit}. Tvoje skóre je nyní ${playerScore}.`);

        if (playerScore > 21) {
            announce("Překročil jsi 21! Prohráváš. Hra končí.");
            endGame('lose');
        } else {
            playerTurnEnded();
        }
    }
}

/**
 * Ukončí tah hráče a začne tah dealera.
 */
function playerTurnEnded() {
    enablePlayerActions(false);
    setTimeout(() => {
        dealerTurn();
    }, 1000);
}

/**
 * Tah dealera.
 */
function dealerTurn() {
    announce("Nyní hraje dealer.");
    gameOver = true;
    displayCards(dealerCards, dealerCardsDiv, false);
    dealerScore = calculateScore(dealerCards);
    dealerScoreSpan.textContent = dealerScore;
    announce(`Dealer odkrývá svou skrytou kartu. Jeho karty jsou ${dealerCards.map(c => `${c.rank} ${c.suit}`).join(' a ')}. Skóre dealera je ${dealerScore}.`);

    setTimeout(function dealerPlayStep() {
        if (dealerScore < 17) {
            announce("Dealer bere další kartu.");
            setTimeout(() => {
                const newCard = dealCard(dealerCards, dealerCardsDiv);
                if (newCard) {
                    dealerScore = calculateScore(dealerCards);
                    dealerScoreSpan.textContent = dealerScore;
                    announce(`Dealer dostal ${newCard.rank} ${newCard.suit}. Skóre dealera je nyní ${dealerScore}.`);
                    setTimeout(dealerPlayStep, 2500);
                } else {
                    evaluateGame();
                }
            }, 500);
        } else {
            evaluateGame();
        }
    }, 2500);
}

/**
 * Vyhodnotí výsledek hry.
 */
function evaluateGame() {
    let resultMessage = "";
    let gameOutcome = '';

    if (playerScore > 21) {
        resultMessage = "Tvoje skóre je přes 21. Prohráváš!";
        gameOutcome = 'lose';
    } else if (dealerScore > 21) {
        resultMessage = "Dealer překročil 21! Vyhráváš!";
        gameOutcome = 'win';
    } else if (playerScore > dealerScore) {
        resultMessage = "Tvoje skóre je vyšší než dealerovo. Vyhráváš!";
        gameOutcome = 'win';
    } else if (dealerScore > playerScore) {
        resultMessage = "Dealerovo skóre je vyšší než tvoje. Prohráváš!";
        gameOutcome = 'lose';
    } else {
        resultMessage = "Remíza! Sázky se vrací.";
        gameOutcome = 'draw';
    }
    
    endGame(gameOutcome);
}

/**
 * Aktualizuje zobrazení skóre.
 */
function updateScoreDisplay() {
    winsScoreSpan.textContent = wins;
    lossesScoreSpan.textContent = losses;
}

/**
 * Funkce pro uložení stavu hry do JSON souboru.
 */
function saveGame() {
    const gameState = {
        deck: deck,
        playerCards: playerCards,
        dealerCards: dealerCards,
        wins: wins,
        losses: losses,
        gameOver: gameOver,
        hasDoubledDown: hasDoubledDown
    };
    const dataStr = JSON.stringify(gameState, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'blackjack_game_state.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    announce("Hra byla uložena do souboru 'blackjack_game_state.json'.");
}

/**
 * Spustí dialog pro načtení souboru.
 */
function loadGame() {
    lastFocusedElement = document.activeElement;
    loadFileInput.click();
}

loadFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) {
        announce("Nebyl vybrán žádný soubor.");
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const loadedState = JSON.parse(e.target.result);
            if (
                !loadedState ||
                !Array.isArray(loadedState.deck) ||
                !Array.isArray(loadedState.playerCards) ||
                !Array.isArray(loadedState.dealerCards) ||
                typeof loadedState.wins !== 'number' ||
                typeof loadedState.losses !== 'number' ||
                typeof loadedState.gameOver !== 'boolean' ||
                typeof loadedState.hasDoubledDown !== 'boolean'
            ) {
                throw new Error("Soubor nemá platnou strukturu pro hru Blackjack.");
            }

            // Všechny operace s načtenými daty jsou nyní bezpečně uvnitř try bloku
            deck = loadedState.deck;
            playerCards = loadedState.playerCards;
            dealerCards = loadedState.dealerCards;
            wins = loadedState.wins;
            losses = loadedState.losses;
            gameOver = loadedState.gameOver;
            hasDoubledDown = loadedState.hasDoubledDown;
            
            playerScore = calculateScore(playerCards);
            dealerScore = calculateScore(dealerCards);

            displayCards(playerCards, playerCardsDiv);
            displayCards(dealerCards, dealerCardsDiv, !gameOver);
            playerScoreSpan.textContent = playerScore;
            dealerScoreSpan.textContent = gameOver ? dealerScore : getCardValue(dealerCards[0] || {rank: '0'});
            updateScoreDisplay();

            if (gameOver) {
                enablePlayerActions(false);
                newGameBtn.disabled = false;
                newGameBtn.tabIndex = 0;
            } else {
                enablePlayerActions(true);
                newGameBtn.disabled = true;
                newGameBtn.tabIndex = -1;
            }

            announce("Hra byla úspěšně načtena.");
            if (lastFocusedElement) lastFocusedElement.focus();

        } catch (error) {
            console.error("Error loading game state:", error);
            announce("Chyba při načítání souboru: " + error.message);
        }
    };
    reader.readAsText(file);
});

/**
 * Zobrazí modální okno s nápovědou.
 */
function showHelpModal() {
    lastFocusedElement = document.activeElement;
    helpModal.style.display = 'flex';
    helpModal.setAttribute('aria-hidden', 'false');
    announce("Otevřena nápověda. Pro zavření stiskni tlačítko 'Rozumím' nebo klávesu Escape.");

    // Zaměření na první prvek v modálu pro přístupnost
    const closeButton = helpModal.querySelector('button');
    if (closeButton) {
        closeButton.focus();
    }

    // === Kód pro Focus Trap (nyní je správně uvnitř funkce) ===
    const focusableElements = helpModal.querySelectorAll('button');
    const firstFocusableElement = focusableElements[0];
    const lastFocusableElement = focusableElements[focusableElements.length - 1];

    helpModal.addEventListener('keydown', function(e) {
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
        }
    });
}

/**
 * Zavře modální okno s nápovědou.
 */
function closeHelpModal() {
    helpModal.style.display = 'none';
    helpModal.setAttribute('aria-hidden', 'true');
    if (lastFocusedElement) {
        lastFocusedElement.focus();
    }
}

// === Přidání posluchačů událostí na tlačítka ===
newGameBtn.addEventListener('click', () => {
    startNewGame();
});
hitBtn.addEventListener('click', () => {
    hit();
});
standBtn.addEventListener('click', () => {
    stand();
});
doubleDownBtn.addEventListener('click', () => {
    doubleDown();
});
saveGameBtn.addEventListener('click', () => {
    saveGame();
});
loadGameBtn.addEventListener('click', () => {
    loadGame();
});
helpBtn.addEventListener('click', showHelpModal);
closeHelpModalBtn.addEventListener('click', closeHelpModal);


// === Klávesové zkratky pro navigaci a akce ===
document.addEventListener('keydown', (event) => {
    // Zavírání modalu klávesou Escape
    if (event.key === 'Escape' && helpModal.style.display === 'flex') {
        closeHelpModal();
        return;
    }

    const activeElement = document.activeElement;
    const gameActionButtons = Array.from(document.querySelectorAll('.game-actions button:not([disabled])'));
    const controlButtons = Array.from(document.querySelectorAll('.controls button:not([disabled])'));

    // Navigace mezi herními tlačítky
    if (gameActionButtons.includes(activeElement)) {
        const currentIndex = gameActionButtons.indexOf(activeElement);
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            const nextIndex = (currentIndex + 1) % gameActionButtons.length;
            gameActionButtons[nextIndex].focus();
            announce(`Fokus na tlačítku: ${gameActionButtons[nextIndex].getAttribute('aria-label')}.`);
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            const prevIndex = (currentIndex - 1 + gameActionButtons.length) % gameActionButtons.length;
            gameActionButtons[prevIndex].focus();
            announce(`Fokus na tlačítku: ${gameActionButtons[prevIndex].getAttribute('aria-label')}.`);
        }
    }
    // Navigace mezi kontrolními tlačítky
    else if (controlButtons.includes(activeElement)) {
        const currentIndex = controlButtons.indexOf(activeElement);
        if (event.key === 'ArrowRight') {
            event.preventDefault();
            const nextIndex = (currentIndex + 1) % controlButtons.length;
            controlButtons[nextIndex].focus();
            announce(`Fokus na tlačítku: ${controlButtons[nextIndex].getAttribute('aria-label')}.`);
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            const prevIndex = (currentIndex - 1 + controlButtons.length) % controlButtons.length;
            controlButtons[prevIndex].focus();
            announce(`Fokus na tlačítku: ${controlButtons[prevIndex].getAttribute('aria-label')}.`);
        }
    }


    // Akce Enter/Space
    if (event.key === 'Enter' || event.key === ' ') {
        if (activeElement && activeElement.tagName === 'BUTTON' && !activeElement.disabled) {
            event.preventDefault();
            activeElement.click();
        } else if (activeElement && activeElement.tagName === 'LABEL' && activeElement.htmlFor === 'load-file-input') {
            event.preventDefault();
            document.getElementById('load-file-input').click();
        }
    }
});


// === Inicializace hry při načtení stránky ===
window.onload = function() {
    announce("Vítej ve hře Blackjack! Klikni na 'Nová hra' pro začátek. Aktuální skóre: Výhry " + wins + ", Prohry " + losses + ".");
    newGameBtn.focus();
    updateScoreDisplay();

    enablePlayerActions(false);
    newGameBtn.disabled = false;
    newGameBtn.tabIndex = 0;
    saveGameBtn.tabIndex = 0;
    loadGameBtn.tabIndex = 0;
    helpBtn.tabIndex = 0;
}