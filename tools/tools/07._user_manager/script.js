// ======================================================
// Palpatius User Manager – script.js
// Vytváří identifikační Markdown soubor (.md)
// ======================================================

(function () {
  const form = document.getElementById("userForm");
  const createBtn = document.getElementById("createBtn");
  const resetBtn = document.getElementById("resetBtn");
  const statusEl = document.getElementById("formStatus");

  function getValue(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : "";
  }

  function buildMarkdown() {
    const fullName = getValue("fullName");
    const phone = getValue("phone");
    const email = getValue("email");
    const web = getValue("web");

    const company = getValue("company");
    const ico = getValue("ico");
    const address = getValue("address");

    const note = getValue("note");

    const today = new Date();
    const dateStr = today.toLocaleDateString("cs-CZ");

    let md = `# Palpatius – informace o uživateli\n\n`;

    // --- Základní údaje ---
    if (fullName || phone || email || web) {
      md += `## Základní údaje\n`;
      if (fullName) md += `- **Jméno:** ${fullName}\n`;
      if (phone) md += `- **Telefon:** ${phone}\n`;
      if (email) md += `- **E-mail:** ${email}\n`;
      if (web) md += `- **Web:** ${web}\n`;
      md += `\n`;
    }

    // --- Firma / masérna ---
    if (company || ico || address) {
      md += `## Firma / masérna\n`;
      if (company) md += `- **Název:** ${company}\n`;
      if (ico) md += `- **IČO:** ${ico}\n`;
      if (address) md += `- **Adresa:** ${address}\n`;
      md += `\n`;
    }

    // --- Poznámka ---
    if (note) {
      md += `## Poznámka uživatele\n`;
      md += `${note}\n\n`;
    }

    md += `---\n`;
    md += `Tento soubor byl vytvořen nástrojem **Palpatius User Manager**.\n`;
    md += `Slouží pouze k identifikaci vlastníka této lokální instance systému Palpatius.\n\n`;
    md += `**Datum vytvoření:** ${dateStr}\n`;

    return md;
  }

  function downloadMarkdown(content) {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "palpatius-user.md";
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  createBtn.addEventListener("click", () => {
    const mdContent = buildMarkdown();

    // Pokud je úplně prázdný (uživatel nevyplnil nic kromě hlavičky)
    if (!mdContent || mdContent.trim().length === 0) {
      statusEl.textContent = "Není co uložit.";
      return;
    }

    downloadMarkdown(mdContent);
    statusEl.textContent = "Soubor byl vytvořen. Ulož ho do hlavní složky Palpatius.";
  });

  resetBtn.addEventListener("click", () => {
    form.reset();
    statusEl.textContent = "Formulář byl vymazán.";
  });
})();
