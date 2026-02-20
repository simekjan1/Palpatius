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
