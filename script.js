// Funkce pro formátování data na český styl
function formatCzechDateTime(date) {
    const options = {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    };
    
    const formattedDate = date.toLocaleDateString('cs-CZ', options);
    const formattedTime = date.toLocaleTimeString('cs-CZ', { hour12: false });

    return `${formattedDate} – ${formattedTime}`;
}

// Aktualizace času na stránce
function updateTime() {
    const timeElement = document.getElementById('current-time');
    if (!timeElement) return;

    const now = new Date();
    timeElement.textContent = formatCzechDateTime(now);
}

// Aktualizace ihned po načtení + každou sekundu
updateTime();
setInterval(updateTime, 1000);

// Jemná animace easter eggu při hoveru / focusu
document.addEventListener('DOMContentLoaded', () => {
    const egg = document.querySelector('.game-link-fixed');
    if (!egg) return;

    const triggerAnimation = () => {
        egg.classList.remove('game-link-animate');
        void egg.offsetWidth; // restart animace
        egg.classList.add('game-link-animate');
    };

    egg.addEventListener('mouseenter', triggerAnimation);
    egg.addEventListener('focus', triggerAnimation);
});
