// Funkce pro zobrazení aktuálního času na hlavní stránce
function updateTime() {
    const timeElement = document.getElementById('current-time');
    if (timeElement) {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' };
        timeElement.textContent = now.toLocaleDateString('cs-CZ', options);
    }
}

// Spustíme funkci hned po načtení stránky
updateTime();
// A pak ji budeme opakovat každou sekundu, aby byl čas stále aktuální
setInterval(updateTime, 1000);