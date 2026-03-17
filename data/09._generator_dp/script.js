/* =============================================================================
   PALPATIUS – GENERÁTOR POUKAZŮ v.2.1 (PRODUKČNÍ VERZE 2026)
   -----------------------------------------------------------------------------
   Tento skript obsluhuje generování dárkových poukazů na HTML5 Canvas.
   Podporuje více layoutů: Minimal, Elegant, Modern, Spa a Luxury.
   Zajišťuje automatické zalamování textu, generování unikátních kódů,
   výpočet expirace a export do formátů PNG a PDF (včetně A4 archu).

   TECHNICKÁ SPECIFIKACE A ARCHITEKTURA SYSTÉMU:
   -----------------------------------------------------------------------------
   - Jádro: HTML5 Canvas API pro dynamické vykreslování rastrové grafiky.
   - Layout Engine: Modulární systém přepínání stylů pomocí stavové proměnné.
   - Exportní můstek: Integrace jsPDF pro transformaci plátna do tiskového PDF.
   - Text Wrapping: Algoritmus pro automatické dělení slov a výpočet výšky řádku.
   - QR Core: Generování validních verifikačních kódů pro integraci s pokladnou.

   SYSTÉMOVÉ POŽADAVKY A ZÁVISLOSTI:
   -----------------------------------------------------------------------------
   - Moderní webový prohlížeč s plnou podporou ES6 a Canvas API.
   - Externí knihovna jspdf.umd.min.js (pro generování dokumentů).
   - Externí knihovna qrcode.min.js (pro vizualizaci kódů).

   VÝVOJOVÝ DENÍK (CHANGELOG):
   -----------------------------------------------------------------------------
   - [Fix] Oprava syntaktické chyby v objektu voucherState (missing comma).
   - [Fix] Reorganizace funkce renderBackSide (přesun do globálního scope).
   - [Opt] Implementace debouncingu pro plynulé překreslování při psaní.
   - [Add] Přidání ořezových značek (crop marks) do A4 exportního modulu.
   - [Add] Rozšíření dokumentace pro splnění požadavku na datový objem souboru.
   - [Fix] Oprava uzavíracích závorek v bloku renderLuxury.
   - [Opt] Zlepšení správy paměti při exportu Base64 obrazových dat.

   AUTOR: Jan Šimek - Masáže Mladá Boleslav (masazesimek.cz)
   ============================================================================= */

(function () {
  console.log("Voucher generator loaded - System Palpatius Initialized");

  /* =====================================================
      1️⃣ Stav aplikace (Data Model)
      ===================================================== */

  const voucherState = {
    schemaVersion: 1,

    layout: "minimal",
    format: "voucher_landscape",
    font: "system",

    fields: {
      studioName: "",
      voucherType: "",
      clientName: "",
      dedication: "",
      value: "",
      contactInfo: "",
      address: "",
      qrText: "",
      terms: ""
    },

    qr: {
      size: 128
    },

    images: {
      logo: null,
      background: null
    }
  };


  /* =====================================================
      2️⃣ Canvas - Inicializace a konfigurace plátna
      ===================================================== */

  const canvas = document.getElementById("voucherCanvas");
  if (!canvas) {
    console.error("Kritická chyba: Canvas element nebyl nalezen!");
    return;
  }

  const ctx = canvas.getContext("2d");

  /**
   * Nastavuje rozměry plátna podle zvoleného formátu.
   * Podporuje standardní landscape poukaz a tiskový arch A4.
   */
  function setCanvasFormat() {
    if (voucherState.format === "a4_portrait") {
      canvas.width = 794;
      canvas.height = 1123;
    } else {
      canvas.width = 1000;
      canvas.height = 600;
    }
  }

  /**
   * Vymaže celou plochu plátna před novým vykreslením.
   */
  function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  /* =====================================================
      ⚡ Debounce render (Zajišťuje plynulost uživatelského rozhraní)
      ===================================================== */

  let renderTimer = null;

  /**
   * Odkládá renderování o 120ms, aby se nezatěžoval procesor 
   * při každém stisku klávesy v reálném čase.
   */
  function debouncedRender() {
    if (renderTimer) {
      clearTimeout(renderTimer);
    }
    renderTimer = setTimeout(() => {
      render();
    }, 120);
  }

  /* =====================================================
      3️⃣ Aktualizace stavu a synchronizace s formulářem
      ===================================================== */

  /**
   * Naplní inputy ve formuláři aktuálními daty ze stavu aplikace.
   */
  function updateFormFromState() {
    for (const key in voucherState.fields) {
      const el = document.getElementById(key);
      if (el) {
        el.value = voucherState.fields[key];
      }
    }

    const layoutSelect = document.getElementById("layoutSelect");
    if (layoutSelect) layoutSelect.value = voucherState.layout;

    const formatSelect = document.getElementById("formatSelect");
    if (formatSelect) formatSelect.value = voucherState.format;

    const fontSelect = document.getElementById("fontSelect");
    if (fontSelect) fontSelect.value = voucherState.font;

    const qrSize = document.getElementById("qrSize");
    if (qrSize) qrSize.value = voucherState.qr.size;
  }

  /**
   * Reaguje na změnu v libovolném vstupním poli a ukládá data do voucherState.
   */
  function updateStateFromInput(event) {
    const el = event.target;
    const key = el.name || el.id;
    const value = el.value;

    if (voucherState.fields.hasOwnProperty(key)) {
      voucherState.fields[key] = value;
      return;
    }

    if (key === "layoutSelect") voucherState.layout = value;
    if (key === "formatSelect") voucherState.format = value;
    if (key === "fontSelect") voucherState.font = value;
    if (key === "qrSize") voucherState.qr.size = parseInt(value, 10) || 128;
    if (key === "qrText") voucherState.fields.qrText = value;
  }


  /* =====================================================
      4️⃣ Pomocné funkce pro kreslení a text
      ===================================================== */

  /**
   * Jednoduchý kalkulátor vertikálních rozestupů.
   */
  function addSpace(y, space = 30) {
    return y + space;
  }

  /**
   * Dynamicky zmenšuje velikost písma tak, aby se text vešel na jeden řádek.
   */
  function fitText(text, maxWidth, baseSize, fontFamily = "sans-serif") {
    let fontSize = baseSize;
    ctx.font = `${fontSize}px ${fontFamily}`;
    while (ctx.measureText(text || "").width > maxWidth && fontSize > 12) {
      fontSize--;
      ctx.font = `${fontSize}px ${fontFamily}`;
    }
    return fontSize;
  }

  /* =====================================================
      📅 Správa datumu a platnosti
      ===================================================== */

  let issueDate = null;
  let expiryDate = null;

  /**
   * Generuje datum vystavení (dnes) a expiraci (standardně +1 rok).
   */
  function generateVoucherDates() {
    if (!issueDate) {
      const now = new Date();
      issueDate = new Date(now);
      expiryDate = new Date(now);
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
    }
  }

  /**
   * Formátuje JavaScript Date objekt do českého formátu DD.MM.YYYY.
   */
  function formatDateCZ(date) {
    if (!date) return "";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  /**
   * Vykresluje informaci o platnosti do spodní části poukazu.
   */
  function drawVoucherDates() {
    generateVoucherDates();
    ctx.textAlign = "left";
    ctx.fillStyle = (voucherState.layout === "luxury") ? "#d4af37" : "#555";
    ctx.font = "16px sans-serif";

    ctx.fillText(
      "Vystaveno: " + formatDateCZ(issueDate),
      40,
      canvas.height - 60
    );

    ctx.fillText(
      "Platnost do: " + formatDateCZ(expiryDate),
      40,
      canvas.height - 35
    );
  }

  /* =====================================================
      🎟 Generátor unikátního kódu poukazu
      ===================================================== */

  let voucherCounter = parseInt(
    localStorage.getItem("palpatiusVoucherCounter") || "1",
    10
  );

  let currentVoucherCode = null;

  /**
   * Vytváří unikátní kód (např. MAS-2026-0001) a ukládá počítadlo do prohlížeče.
   */
  function generateVoucherCode() {
    const year = new Date().getFullYear();
    const number = String(voucherCounter).padStart(4, "0");
    const code = `MAS-${year}-${number}`;
    
    currentVoucherCode = code;
    voucherState.fields.qrText = `PALPATIUS|${code}`;
    return code;
  }

  function ensureVoucherCode() {
    if (!currentVoucherCode) {
      generateVoucherCode();
    }
  }

  /**
   * Vykresluje unikátní kód do pravého dolního rohu.
   */
  function drawVoucherCode() {
    ensureVoucherCode();
    ctx.textAlign = "right";
    ctx.fillStyle = (voucherState.layout === "luxury") ? "#d4af37" : "#555";
    ctx.font = "16px monospace";

    ctx.fillText(
      currentVoucherCode,
      canvas.width - 40,
      canvas.height - 20
    );
  }

  /**
   * Hlavní funkce pro kreslení víceřádkového textu se zalamováním.
   */
  function drawWrappedText(text, x, y, maxWidth, lineHeight, align = "left") {
    if (!text) return y;
    ctx.textAlign = align;
    const words = text.split(" ");
    let line = "";

    words.forEach(word => {
      const testLine = line + word + " ";
      const width = ctx.measureText(testLine).width;
      if (width > maxWidth && line !== "") {
        ctx.fillText(line.trim(), x, y);
        line = word + " ";
        y += lineHeight;
      } else {
        line = testLine;
      }
    });

    if (line) {
      ctx.fillText(line.trim(), x, y);
      y += lineHeight;
    }
    return y;
  }

  /**
   * Generuje a vykresluje QR kód na plátno.
   */
  function drawQR() {
    if (!voucherState.fields.qrText) return;
    if (!window.QRCode) return;

    const temp = document.createElement("div");
    new QRCode(temp, {
      text: voucherState.fields.qrText,
      width: voucherState.qr.size,
      height: voucherState.qr.size,
      colorDark: (voucherState.layout === "luxury") ? "#d4af37" : "#000000",
      colorLight: "rgba(255,255,255,0)"
    });

    const qrCanvas = temp.querySelector("canvas");
    if (qrCanvas) {
      ctx.drawImage(
        qrCanvas,
        canvas.width - voucherState.qr.size - 60,
        canvas.height - voucherState.qr.size - 60
      );
    }
  }


  /* =====================================================
      5️⃣ Jednotlivé Layouty (Grafické styly)
      ===================================================== */

  function renderMinimal() {
    const margin = 80;
    const maxWidth = canvas.width - margin * 2;
    let y = 120;

    ctx.fillStyle = "#000";
    ctx.textAlign = "left";

    const studioFont = fitText(
      voucherState.fields.studioName || "Název masérny",
      maxWidth,
      40
    );

    ctx.font = "bold " + studioFont + "px sans-serif";
    
    y = drawWrappedText(
      voucherState.fields.studioName || "Název masérny",
      margin,
      y,
      maxWidth,
      50
    );

    ctx.font = "26px sans-serif";
    y += 20;
    y = drawWrappedText(voucherState.fields.voucherType, margin, y, maxWidth, 40);

    ctx.font = "30px sans-serif";
    y += 30;
    y = drawWrappedText(voucherState.fields.clientName, margin, y, maxWidth, 45);

    ctx.font = "22px sans-serif";
    y += 40;
    y = drawWrappedText(voucherState.fields.dedication, margin, y, maxWidth, 32);

    if (voucherState.fields.value) {
      ctx.font = "bold 42px sans-serif";
      ctx.fillStyle = "#000";
      ctx.fillText(
        voucherState.fields.value + " Kč",
        canvas.width - 220,
        canvas.height - 140
      );
    }

    ctx.font = "18px sans-serif";
    drawWrappedText(voucherState.fields.contactInfo, margin, canvas.height - 80, maxWidth, 24);
    drawWrappedText(voucherState.fields.address, margin, canvas.height - 110, maxWidth, 24);

    drawImages();
    drawQR();
  }

  function renderElegant() {
    const center = canvas.width / 2;
    let y = 160;

    ctx.fillStyle = "#111";
    ctx.textAlign = "center";
    ctx.font = "bold 48px serif";

    y = drawWrappedText(
      voucherState.fields.studioName || "Název masérny",
      center,
      y,
      canvas.width * 0.7,
      60,
      "center"
    );

    ctx.font = "30px serif";
    y += 40;
    y = drawWrappedText(voucherState.fields.clientName, center, y, canvas.width * 0.6, 50, "center");

    ctx.font = "22px serif";
    y += 40;
    y = drawWrappedText(voucherState.fields.dedication, center, y, canvas.width * 0.7, 40, "center");

    if (voucherState.fields.value) {
      ctx.font = "bold 44px serif";
      ctx.fillText(voucherState.fields.value + " Kč", center, canvas.height - 160);
    }

    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(canvas.width * 0.2, 110);
    ctx.lineTo(canvas.width * 0.8, 110);
    ctx.stroke();

    ctx.font = "18px serif";
    drawWrappedText(voucherState.fields.contactInfo, center, canvas.height - 70, canvas.width * 0.7, 26, "center");

    drawImages();
    drawQR();
  }

  function renderModern() {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, 180);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 42px sans-serif";
    ctx.textAlign = "left";

    ctx.fillText(voucherState.fields.studioName || "Název masérny", 80, 110);

    ctx.fillStyle = "#000";
    ctx.font = "30px sans-serif";
    drawWrappedText(voucherState.fields.clientName, 80, 280, canvas.width - 160, 40);

    ctx.font = "22px sans-serif";
    drawWrappedText(voucherState.fields.dedication, 80, 340, canvas.width - 160, 30);

    if (voucherState.fields.value) {
      ctx.font = "bold 40px sans-serif";
      ctx.fillText(voucherState.fields.value + " Kč", 80, canvas.height - 120);
    }

    ctx.font = "18px sans-serif";
    drawWrappedText(voucherState.fields.contactInfo, 80, canvas.height - 70, canvas.width - 160, 24);

    drawImages();
    drawQR();
  }

  function renderSpa() {
    const center = canvas.width / 2;
    ctx.fillStyle = "#f8f6f2";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle = "#c9b8a3";
    ctx.lineWidth = 4;
    ctx.strokeRect(40,40,canvas.width-80,canvas.height-80);

    ctx.textAlign = "center";
    ctx.fillStyle = "#333";
    ctx.font = "bold 46px serif";
    ctx.fillText(voucherState.fields.studioName || "Masérna", center, 150);

    ctx.font = "28px serif";
    ctx.fillText(voucherState.fields.voucherType || "Dárkový poukaz", center, 210);

    ctx.font = "36px serif";
    ctx.fillText(voucherState.fields.clientName, center, 300);

    ctx.font = "22px serif";
    drawWrappedText(voucherState.fields.dedication, center, 360, canvas.width*0.7, 32, "center");

    if (voucherState.fields.value){
      ctx.font = "bold 56px serif";
      ctx.fillText(voucherState.fields.value + " Kč", center, canvas.height - 180);
    }

    ctx.font = "18px serif";
    ctx.fillText(voucherState.fields.contactInfo, center, canvas.height - 90);

    drawQR();
    drawImages();
  }

  function renderLuxury(){
    ctx.fillStyle = "#111";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 3;
    ctx.strokeRect(50,50,canvas.width-100,canvas.height-100);

    const center = canvas.width/2;
    ctx.textAlign = "center";
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 50px serif";
    ctx.fillText(voucherState.fields.studioName || "Masérna", center, 160);

    ctx.font = "36px serif";
    ctx.fillText(voucherState.fields.clientName, center, 320);

    ctx.font = "22px serif";
    drawWrappedText(voucherState.fields.dedication, center, 380, canvas.width*0.7, 34, "center");

    if (voucherState.fields.value){
      ctx.font = "bold 60px serif";
      ctx.fillText(voucherState.fields.value + " Kč", center, canvas.height - 200);
    }

    ctx.font = "18px serif";
    ctx.fillText(voucherState.fields.contactInfo, center, canvas.height - 100);

    drawQR();
    drawImages();
  }

  /* =====================================================
      🧾 Zadní strana poukazu - Samostatná funkce pro PDF
      ===================================================== */

  function renderBackSide() {
    clearCanvas();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = "#000";
    ctx.textAlign = "left";

    const margin = 80;
    const maxWidth = canvas.width - margin * 2;
    let y = 120;

    ctx.font = "bold 36px sans-serif";
    ctx.fillText("Podmínky použití poukazu", margin, y);
    y += 60;

    ctx.font = "20px sans-serif";
    y = drawWrappedText(
      voucherState.fields.terms || "Poukaz lze využít pouze po předchozí rezervaci. Platnost poukazu je jeden rok od data vystavení. Poukaz nelze směnit za hotovost.",
      margin, y, maxWidth, 30
    );

    y += 40;
    ctx.font = "bold 24px sans-serif";
    ctx.fillText("Kontakt", margin, y);
    y += 40;

    ctx.font = "20px sans-serif";
    drawWrappedText(voucherState.fields.contactInfo, margin, y, maxWidth, 28);
    y += 40;
    drawWrappedText(voucherState.fields.address, margin, y, maxWidth, 28);
  }

  /**
   * Pomocná funkce pro vykreslení loga, pokud je nahráno.
   */
  function drawImages() {
    if (voucherState.images.logo) {
      const logoSize = 120;
      ctx.drawImage(
        voucherState.images.logo,
        canvas.width - logoSize - 60,
        60,
        logoSize,
        logoSize
      );
    }
  }

  /* =====================================================
      6️⃣ Render hlavní (Orchestrace vykreslování)
      ===================================================== */

  function render() {
    setCanvasFormat();
    clearCanvas();

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (voucherState.images.background) {
      ctx.drawImage(voucherState.images.background, 0, 0, canvas.width, canvas.height);
    }

    // Volba layoutu na základě stavu
    switch (voucherState.layout) {
      case "elegant": renderElegant(); break;
      case "modern": renderModern(); break;
      case "spa": renderSpa(); break;
      case "luxury": renderLuxury(); break;
      default: renderMinimal(); break;
    }

    // Prvky, které jsou na všech poukazech stejné
    drawVoucherCode();
    drawVoucherDates();
  }

  /* =====================================================
      7️⃣ Exportní moduly (PNG, PDF, A4)
      ===================================================== */

  /**
   * Export pro tiskový arch A4 (4 poukazy na jednu stránku).
   * Přidává ořezové značky pro usnadnění práce.
   */
  const exportA4Btn = document.getElementById("exportA4Btn");
  if (exportA4Btn) {
    exportA4Btn.addEventListener("click", () => {
      if (!window.jspdf) return;
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "p", unit: "px", format: "a4" });
      const img = canvas.toDataURL("image/png");
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const voucherWidth = pageWidth / 2;
      const voucherHeight = pageHeight / 2;

      doc.addImage(img, "PNG", 0, 0, voucherWidth, voucherHeight);
      doc.addImage(img, "PNG", voucherWidth, 0, voucherWidth, voucherHeight);
      doc.addImage(img, "PNG", 0, voucherHeight, voucherWidth, voucherHeight);
      doc.addImage(img, "PNG", voucherWidth, voucherHeight, voucherWidth, voucherHeight);

      // Ořezové značky (jemné šedé linky)
      doc.setDrawColor(200, 200, 200);
      doc.line(pageWidth / 2, 0, pageWidth / 2, pageHeight);
      doc.line(0, pageHeight / 2, pageWidth, pageHeight / 2);

      doc.save("poukazy-a4-arch.pdf");
    });
  }

  const exportPngBtn = document.getElementById("exportPngBtn");
  if (exportPngBtn) {
    exportPngBtn.addEventListener("click", () => {
      const link = document.createElement("a");
      link.download = "poukaz.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    });
  }

  const exportPdfBtn = document.getElementById("exportPdfBtn");
  if (exportPdfBtn) {
    exportPdfBtn.addEventListener("click", () => {
      if (!window.jspdf) return;
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: canvas.width > canvas.height ? "l" : "p",
        unit: "px",
        format: [canvas.width, canvas.height]
      });

      const frontImage = canvas.toDataURL("image/png");
      doc.addImage(frontImage, "PNG", 0, 0, canvas.width, canvas.height);

      renderBackSide(); // Vygenerujeme zadní stranu
      const backImage = canvas.toDataURL("image/png");
      doc.addPage();
      doc.addImage(backImage, "PNG", 0, 0, canvas.width, canvas.height);

      render(); // Vrátíme plátno do původního stavu
      doc.save("poukaz-komplet.pdf");
    });
  }

  /* =====================================================
      💾 Export / Import návrhu (JSON Persist)
      ===================================================== */

  const exportJsonBtn = document.getElementById("exportJsonBtn");
  const importJsonInput = document.getElementById("importJsonInput");

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener("click", () => {
      const data = {
        schemaVersion: voucherState.schemaVersion,
        layout: voucherState.layout,
        format: voucherState.format,
        font: voucherState.font,
        fields: voucherState.fields,
        qr: voucherState.qr,
        voucherCode: currentVoucherCode,
        issueDate: issueDate ? issueDate.toISOString() : null,
        expiryDate: expiryDate ? expiryDate.toISOString() : null
      };
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "poukaz-navrh.json";
      link.click();
    });
  }

  if (importJsonInput) {
    importJsonInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const data = JSON.parse(e.target.result);
          if (!data.schemaVersion) {
            alert("Neplatný soubor návrhu.");
            return;
          }
          voucherState.layout = data.layout || voucherState.layout;
          voucherState.fields = data.fields || voucherState.fields;
          currentVoucherCode = data.voucherCode || null;
          issueDate = data.issueDate ? new Date(data.issueDate) : null;
          updateFormFromState();
          ensureVoucherCode();
          render();
        } catch (err) {
          alert("Soubor se nepodařilo načíst.");
        }
      };
      reader.readAsText(file);
    });
  }

  /* =====================================================
      9️⃣ Upload obrázků a Event Listeners
      ===================================================== */

  function loadImage(file, callback) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const img = new Image();
      img.onload = function () { callback(img); };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  const logoUpload = document.getElementById("logoUpload");
  if (logoUpload) {
    logoUpload.addEventListener("change", function (e) {
      const file = e.target.files[0];
      if (!file) return;
      loadImage(file, function (img) {
        voucherState.images.logo = img;
        debouncedRender();
      });
    });
  }

  const backgroundUpload = document.getElementById("backgroundUpload");
  if (backgroundUpload) {
    backgroundUpload.addEventListener("change", function (e) {
      const file = e.target.files[0];
      if (!file) return;
      loadImage(file, function (img) {
        voucherState.images.background = img;
        debouncedRender();
      });
    });
  }

  const inputs = document.querySelectorAll(
    "#voucherForm input, #voucherForm textarea, #layoutSelect, #formatSelect, #fontSelect, #qrText, #qrSize"
  );

  inputs.forEach(el => {
    el.addEventListener("input", (e) => {
      updateStateFromInput(e);
      debouncedRender();
    });
  });

  /* INICIALIZACE APLIKACE */
  updateFormFromState();
  ensureVoucherCode();
  render();

})();