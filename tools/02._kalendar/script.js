/* ===============================
   Palpatius – Offline kalendář
   Jednoduchý, přístupný, offline
   =============================== */

"use strict";

/* ---------- Konstanty ---------- */

const MONTHS = [
  "leden","únor","březen","duben","květen","červen",
  "červenec","srpen","září","říjen","listopad","prosinec"
];

const WEEKDAYS = ["Po","Út","St","Čt","Pá","So","Ne"];

const grid = document.getElementById("calendarGrid");
const monthLabel = document.getElementById("monthLabel");
const selectedDateText = document.getElementById("selectedDateText");
const srStatus = document.getElementById("srStatus");

const prevBtn = document.getElementById("prevMonthBtn");
const nextBtn = document.getElementById("nextMonthBtn");
const todayBtn = document.getElementById("todayBtn");

const dayButtons = [...grid.querySelectorAll(".day")];

/* ---------- Stav ---------- */

let today = new Date();
let currentYear = today.getFullYear();
let currentMonth = today.getMonth();
let focusedIndex = 0;

/* ---------- Pomocné funkce ---------- */

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayIndex(year, month) {
  // Pondělí = 0
  const jsDay = new Date(year, month, 1).getDay(); // 0 = neděle
  return jsDay === 0 ? 6 : jsDay - 1;
}

function formatFullDate(date) {
  return `${date.getDate()}. ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/* ---------- Render ---------- */

function renderCalendar(year, month) {
  const totalDays = daysInMonth(year, month);
  const startIndex = firstDayIndex(year, month);

  monthLabel.textContent = `${MONTHS[month]} ${year}`;

  dayButtons.forEach(btn => {
    btn.textContent = "";
    btn.disabled = true;
    btn.className = "day";
    btn.setAttribute("aria-label", "Prázdné pole");
  });

  for (let day = 1; day <= totalDays; day++) {
    const index = startIndex + day - 1;
    const btn = dayButtons[index];

    btn.textContent = day;
    btn.disabled = false;

    const dateObj = new Date(year, month, day);
    const label = formatFullDate(dateObj);

    btn.setAttribute("aria-label", label);
    btn.dataset.date = dateObj.toISOString();

    if (
      day === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear()
    ) {
      btn.classList.add("today");
      focusedIndex = index;
    }
  }

  setFocus(focusedIndex);
}

/* ---------- Fokus ---------- */

function setFocus(index) {
  dayButtons.forEach(b => b.tabIndex = -1);

  const btn = dayButtons[index];
  if (btn && !btn.disabled) {
    btn.tabIndex = 0;
    btn.focus();
    focusedIndex = index;
    updateSelectedDay(btn);
  }
}

/* ---------- Výběr dne ---------- */

function updateSelectedDay(btn) {
  if (!btn || btn.disabled) return;

  const date = new Date(btn.dataset.date);
  const text = formatFullDate(date);

  selectedDateText.textContent = text;
  srStatus.textContent = `Vybrán den ${text}`;
}

/* ---------- Klávesnice ---------- */

grid.addEventListener("keydown", (e) => {
  let newIndex = focusedIndex;

  switch (e.key) {
    case "ArrowRight": newIndex += 1; break;
    case "ArrowLeft": newIndex -= 1; break;
    case "ArrowDown": newIndex += 7; break;
    case "ArrowUp": newIndex -= 7; break;
    default: return;
  }

  e.preventDefault();

  if (dayButtons[newIndex] && !dayButtons[newIndex].disabled) {
    setFocus(newIndex);
  }
});

/* ---------- Klik ---------- */

dayButtons.forEach((btn, index) => {
  btn.addEventListener("click", () => {
    setFocus(index);
  });
});

/* ---------- Ovládání měsíců ---------- */

prevBtn.addEventListener("click", () => {
  currentMonth--;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  focusedIndex = 0;
  renderCalendar(currentYear, currentMonth);
});

nextBtn.addEventListener("click", () => {
  currentMonth++;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  focusedIndex = 0;
  renderCalendar(currentYear, currentMonth);
});

todayBtn.addEventListener("click", () => {
  currentYear = today.getFullYear();
  currentMonth = today.getMonth();
  renderCalendar(currentYear, currentMonth);
});

/* ---------- Start ---------- */

renderCalendar(currentYear, currentMonth);
