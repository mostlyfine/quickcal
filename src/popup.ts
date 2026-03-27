import {
  formatDate,
  hourLabels,
  dayRange,
  eventStartDate,
  eventEndDate,
  isAllDayEvent,
  clamp,
  toErrorMessage,
  type CalendarEvent
} from "./lib/date.js";
import { applyDocumentLanguage, getSupportedLocale, t } from "./lib/i18n.js";
import { loadSelectedCalendars, loadDayEventsForCalendars, type StoredCalendar } from "./lib/google-calendar.js";
import { CALENDAR_EVENT_COLOR } from "./lib/config.js";

const MINUTES_PER_DAY = 24 * 60;
let ROW_HEIGHT = 48;
const START_HOUR = 8;
const END_HOUR = 20;
const START_MINUTE = START_HOUR * 60;
const DISPLAY_ROWS = END_HOUR - START_HOUR + 1; // 8〜20の13行

let currentDate = new Date();
let calendars: StoredCalendar[] = [];

interface PopupUI {
  todayDate: HTMLButtonElement;
  goToday: HTMLButtonElement;
  prevDay: HTMLButtonElement;
  nextDay: HTMLButtonElement;
  addEvent: HTMLButtonElement;
  openOptions: HTMLButtonElement;
  closePopup: HTMLButtonElement;
  message: HTMLDivElement;
  allDaySection: HTMLElement;
  allDayEvents: HTMLDivElement;
  timeline: HTMLElement;
  timeLabels: HTMLDivElement;
  grid: HTMLDivElement;
  tzLabel: HTMLDivElement;
  template: HTMLTemplateElement;
  popupTitle: HTMLTitleElement;
  popupHeading: HTMLSpanElement;
  eventPopupOverlay: HTMLDivElement;
}

const ui: PopupUI = {
  todayDate: document.getElementById("today-date") as HTMLButtonElement,
  goToday: document.getElementById("go-today") as HTMLButtonElement,
  prevDay: document.getElementById("prev-day") as HTMLButtonElement,
  nextDay: document.getElementById("next-day") as HTMLButtonElement,
  addEvent: document.getElementById("add-event") as HTMLButtonElement,
  openOptions: document.getElementById("open-options") as HTMLButtonElement,
  closePopup: document.getElementById("close-popup") as HTMLButtonElement,
  message: document.getElementById("message") as HTMLDivElement,
  allDaySection: document.getElementById("all-day-section") as HTMLElement,
  allDayEvents: document.getElementById("all-day-events") as HTMLDivElement,
  timeline: document.querySelector(".timeline") as HTMLElement,
  timeLabels: document.getElementById("time-labels") as HTMLDivElement,
  grid: document.getElementById("grid") as HTMLDivElement,
  tzLabel: document.getElementById("tz-label") as HTMLDivElement,
  template: document.getElementById("event-template") as HTMLTemplateElement,
  popupTitle: document.getElementById("popup-title") as HTMLTitleElement,
  popupHeading: document.getElementById("popup-heading") as HTMLSpanElement,
  eventPopupOverlay: document.getElementById("event-popup-overlay") as HTMLDivElement
};

function applyStaticTexts(): void {
  ui.popupTitle.textContent = t("popupTitle");
  ui.popupHeading.textContent = t("popupTitle");
  ui.addEvent.title = t("popupAddEventTitle");
  ui.openOptions.title = t("popupSettingsTitle");
  ui.closePopup.title = t("popupCloseTitle");
  ui.goToday.textContent = t("popupTodayButton");
}

function setMessage(text = "", isError = true): void {
  if (!text) {
    ui.message.classList.add("hidden");
    ui.message.textContent = "";
    return;
  }
  ui.message.classList.remove("hidden");
  ui.message.style.background = isError ? "#fce8e6" : "#e6f4ea";
  ui.message.style.color = isError ? "#c5221f" : "#137333";
  ui.message.textContent = text;
}

function updateDateLabel(): void {
  ui.todayDate.textContent = formatDate(currentDate);
}

function computeRowHeight(): void {
  ROW_HEIGHT = ui.timeline.clientHeight / DISPLAY_ROWS;
  document.documentElement.style.setProperty("--row-height", `${ROW_HEIGHT}px`);
}

function renderTimeAxis(): void {
  ui.timeLabels.innerHTML = "";
  ui.grid.innerHTML = "";

  const labels = hourLabels().slice(START_HOUR, END_HOUR + 1);
  for (const label of labels) {
    const el = document.createElement("div");
    el.className = "time-label";
    el.textContent = label;
    ui.timeLabels.appendChild(el);

    const line = document.createElement("div");
    line.className = "hour-line";
    ui.grid.appendChild(line);
  }

  const layer = document.createElement("div");
  layer.className = "event-layer";
  ui.grid.appendChild(layer);
}

interface LayoutInfo {
  column: number;
  totalColumns: number;
  from: number;
  to: number;
}

function computeLayout(events: CalendarEvent[]): LayoutInfo[] {
  const dayStart = dayRange(currentDate).start;

  const ranges = events.map((e) => {
    const from = clamp((eventStartDate(e).getTime() - dayStart.getTime()) / 60000, 0, MINUTES_PER_DAY);
    const to = clamp((eventEndDate(e).getTime() - dayStart.getTime()) / 60000, 0, MINUTES_PER_DAY);
    return { from, to: Math.max(to, from + 1) };
  });

  // Assign columns greedily: for each event, find the first column not occupied by an overlapping event
  const columns: number[] = new Array(events.length).fill(0);
  for (let i = 0; i < events.length; i++) {
    const used = new Set<number>();
    for (let j = 0; j < i; j++) {
      if (ranges[j].from < ranges[i].to && ranges[i].from < ranges[j].to) {
        used.add(columns[j]);
      }
    }
    let col = 0;
    while (used.has(col) && col < 2) col++;
    columns[i] = Math.min(col, 2);
  }

  // For each event, determine totalColumns by checking all overlapping events' max column
  const result: LayoutInfo[] = [];
  for (let i = 0; i < events.length; i++) {
    let maxCol = columns[i];
    for (let j = 0; j < events.length; j++) {
      if (i !== j && ranges[j].from < ranges[i].to && ranges[i].from < ranges[j].to) {
        maxCol = Math.max(maxCol, columns[j]);
      }
    }
    result.push({ column: columns[i], totalColumns: maxCol + 1, from: ranges[i].from, to: ranges[i].to });
  }

  return result;
}

function eventStyle(layout: LayoutInfo): Partial<CSSStyleDeclaration> {
  const top = ((layout.from - START_MINUTE) / 60) * ROW_HEIGHT;
  const height = Math.max(((layout.to - layout.from) / 60) * ROW_HEIGHT, 20);
  const widthPct = 100 / layout.totalColumns;
  const leftPct = widthPct * layout.column;

  return {
    top: `${top}px`,
    height: `${height}px`,
    width: `calc(${widthPct}% - 4px)`,
    left: `calc(${leftPct}% + 2px)`
  };
}

const timeFmt = new Intl.DateTimeFormat(getSupportedLocale(), {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});

function formatTimeRange(event: CalendarEvent): string {
  if (isAllDayEvent(event)) return t("popupAllDay");
  return `${timeFmt.format(eventStartDate(event))} - ${timeFmt.format(eventEndDate(event))}`;
}

function colorWithAlpha(hex?: string, alpha = "55"): string {
  if (!hex || !hex.startsWith("#")) return `${CALENDAR_EVENT_COLOR}55`;
  if (hex.length === 7) return `${hex}${alpha}`;
  return hex;
}

function renderAllDay(events: CalendarEvent[]): void {
  ui.allDayEvents.innerHTML = "";
  if (!events.length) {
    ui.allDaySection.classList.add("hidden");
    return;
  }
  ui.allDaySection.classList.remove("hidden");

  events.forEach((event) => {
    const pill = document.createElement("div");
    pill.className = "all-day-pill";
    pill.style.background = colorWithAlpha(event.colorId ? CALENDAR_EVENT_COLOR : event.backgroundColor || event.calendarColor);
    pill.textContent = event.summary || t("popupUntitled");
    pill.addEventListener("click", () => showEventPopup(event));
    ui.allDayEvents.appendChild(pill);
  });
}

function renderNowLine(isToday: boolean): void {
  const layer = ui.grid.querySelector(".event-layer") as HTMLElement;
  layer.querySelector(".now-line")?.remove();
  if (!isToday) return;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  if (currentMinutes < START_MINUTE || currentMinutes >= END_HOUR * 60) return;
  const top = ((currentMinutes - START_MINUTE) / 60) * ROW_HEIGHT;
  const line = document.createElement("div");
  line.className = "now-line";
  line.style.top = `${top}px`;
  layer.appendChild(line);
}

function showEventPopup(event: CalendarEvent): void {
  const overlay = ui.eventPopupOverlay;
  const popup = overlay.querySelector(".event-popup") as HTMLElement;

  (popup.querySelector(".event-popup-title") as HTMLElement).textContent =
    event.summary || t("popupUntitled");
  (popup.querySelector(".event-popup-time") as HTMLElement).textContent =
    formatTimeRange(event);

  const locationEl = popup.querySelector(".event-popup-location") as HTMLAnchorElement;
  if (event.location) {
    locationEl.textContent = event.location;
    locationEl.href = `https://www.google.com/maps/search/${encodeURIComponent(event.location)}`;
    locationEl.classList.remove("hidden");
    locationEl.onclick = (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: locationEl.href });
    };
  } else {
    locationEl.classList.add("hidden");
  }

  const descEl = popup.querySelector(".event-popup-description") as HTMLElement;
  if (event.description) {
    descEl.textContent = event.description;
    descEl.classList.remove("hidden");
  } else {
    descEl.classList.add("hidden");
  }

  const linkEl = popup.querySelector(".event-popup-link") as HTMLAnchorElement;
  if (event.htmlLink) {
    linkEl.href = event.htmlLink;
    linkEl.textContent = t("popupOpenInGoogleCalendar");
    linkEl.classList.remove("hidden");
    linkEl.onclick = (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: event.htmlLink! });
    };
  } else {
    linkEl.classList.add("hidden");
  }

  overlay.classList.remove("hidden");
}

function hideEventPopup(): void {
  ui.eventPopupOverlay.classList.add("hidden");
}

function renderTimed(events: CalendarEvent[]): void {
  const layer = ui.grid.querySelector(".event-layer") as HTMLElement;
  layer.innerHTML = "";
  if (!events.length) return;

  const layouts = computeLayout(events);
  events.forEach((event, i) => {
    const node = ui.template.content.firstElementChild!.cloneNode(true) as HTMLElement;
    (node.querySelector(".event-title") as HTMLElement).textContent = event.summary || t("popupUntitled");
    (node.querySelector(".event-time") as HTMLElement).textContent = formatTimeRange(event);
    const color = event.backgroundColor || event.calendarColor;
    node.style.background = colorWithAlpha(color);
    node.style.border = `1.5px solid ${color || CALENDAR_EVENT_COLOR}`;
    Object.assign(node.style, eventStyle(layouts[i]));

    node.addEventListener("click", () => showEventPopup(event));

    layer.appendChild(node);
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}


async function renderEvents(): Promise<void> {
  setMessage();
  updateDateLabel();

  const isToday = isSameDay(currentDate, new Date());

  if (!calendars.length) {
    setMessage(t("popupNoCalendarSelected"));
    renderAllDay([]);
    computeRowHeight();
    renderTimed([]);
    renderNowLine(isToday);
    return;
  }

  try {
    const events = await loadDayEventsForCalendars(calendars, currentDate);
    const allDay: CalendarEvent[] = [];
    const timed: CalendarEvent[] = [];
    for (const e of events) {
      (isAllDayEvent(e) ? allDay : timed).push(e);
    }
    renderAllDay(allDay);
    computeRowHeight();
    renderTimed(timed);
    renderNowLine(isToday);
  } catch (error) {
    const message = toErrorMessage(error);
    setMessage(t("popupEventLoadFailed", message));
    computeRowHeight();
    renderNowLine(isToday);
  }
}

function bindActions(): void {
  const goToday = () => {
    currentDate = new Date();
    void renderEvents();
  };
  ui.goToday.addEventListener("click", goToday);
  ui.todayDate.addEventListener("click", goToday);
  ui.prevDay.addEventListener("click", () => {
    currentDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
    void renderEvents();
  });
  ui.nextDay.addEventListener("click", () => {
    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    void renderEvents();
  });
  ui.addEvent.addEventListener("click", () => {
    const d = currentDate;
    const pad = (n: number) => String(n).padStart(2, "0");
    const dateStr = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&dates=${dateStr}/${dateStr}`;
    chrome.tabs.create({ url });
  });
  ui.openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());
  ui.closePopup.addEventListener("click", () => window.close());
  ui.popupHeading.addEventListener("click", () => chrome.tabs.create({ url: "https://calendar.google.com/calendar/r" }));

  ui.eventPopupOverlay.addEventListener("click", (e) => {
    if (e.target === ui.eventPopupOverlay) hideEventPopup();
  });
  (ui.eventPopupOverlay.querySelector(".event-popup-close") as HTMLElement)
    .addEventListener("click", () => hideEventPopup());
}

async function init(): Promise<void> {
  applyDocumentLanguage();
  applyStaticTexts();
  bindActions();
  computeRowHeight();
  renderTimeAxis();
  const timeZoneLabel = new Intl.DateTimeFormat(getSupportedLocale(), {
    timeZoneName: "shortOffset"
  }).format(new Date());
  const gmtOffset = timeZoneLabel.match(/GMT(?:[+-]\d{1,2}(?::\d{2})?)?$/)?.[0];
  ui.tzLabel.textContent = gmtOffset ?? timeZoneLabel;

  calendars = await loadSelectedCalendars();
  await renderEvents();
}

void init().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  setMessage(t("popupInitFailed", message));
});
