import {
  formatDate,
  hourLabels,
  eventStartDate,
  eventEndDate,
  isAllDayEvent,
  clamp,
  type CalendarEvent
} from "./lib/date.js";
import { applyDocumentLanguage, getSupportedLocale, t } from "./lib/i18n.js";
import { loadSelectedCalendar, loadDayEvents, type StoredCalendar } from "./lib/google-calendar.js";

const MINUTES_PER_DAY = 24 * 60;
const ROW_HEIGHT = 52;

let currentDate = new Date();
let calendar: StoredCalendar | null = null;

interface PopupUI {
  todayDate: HTMLButtonElement;
  goToday: HTMLButtonElement;
  prevDay: HTMLButtonElement;
  nextDay: HTMLButtonElement;
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
  allDayLabel: HTMLDivElement;
}

const ui: PopupUI = {
  todayDate: document.getElementById("today-date") as HTMLButtonElement,
  goToday: document.getElementById("go-today") as HTMLButtonElement,
  prevDay: document.getElementById("prev-day") as HTMLButtonElement,
  nextDay: document.getElementById("next-day") as HTMLButtonElement,
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
  allDayLabel: document.getElementById("all-day-label") as HTMLDivElement
};

function applyStaticTexts(): void {
  ui.popupTitle.textContent = t("popupTitle");
  ui.popupHeading.textContent = t("popupTitle");
  ui.openOptions.title = t("popupSettingsTitle");
  ui.closePopup.title = t("popupCloseTitle");
  ui.goToday.textContent = t("popupTodayButton");
  ui.allDayLabel.textContent = t("popupAllDay");
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

function renderTimeAxis(): void {
  ui.timeLabels.innerHTML = "";
  ui.grid.innerHTML = "";

  const labels = hourLabels();
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

function eventStyle(event: CalendarEvent, index: number, columns: number): Partial<CSSStyleDeclaration> {
  const start = eventStartDate(event);
  const end = eventEndDate(event);
  const dayStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 0, 0, 0, 0);

  const from = clamp((start.getTime() - dayStart.getTime()) / 60000, 0, MINUTES_PER_DAY);
  const to = clamp((end.getTime() - dayStart.getTime()) / 60000, 0, MINUTES_PER_DAY);
  const top = (from / 60) * ROW_HEIGHT;
  const height = Math.max(((to - from) / 60) * ROW_HEIGHT, 20);
  const widthPct = 100 / columns;
  const leftPct = widthPct * index;

  return {
    top: `${top}px`,
    height: `${height}px`,
    width: `calc(${widthPct}% - 4px)`,
    left: `calc(${leftPct}% + 2px)`
  };
}

function formatTimeRange(event: CalendarEvent): string {
  if (isAllDayEvent(event)) return t("popupAllDay");
  const start = eventStartDate(event);
  const end = eventEndDate(event);
  const fmt = new Intl.DateTimeFormat(getSupportedLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  return `${fmt.format(start)} - ${fmt.format(end)}`;
}

function colorWithAlpha(hex?: string, alpha = "55"): string {
  if (!hex || !hex.startsWith("#")) return "#fbbc0455";
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
    pill.style.background = colorWithAlpha(event.colorId ? "#fbbc04" : event.backgroundColor || calendar?.color);
    pill.textContent = event.summary || t("popupUntitled");
    ui.allDayEvents.appendChild(pill);
  });
}

function renderNowLine(isToday: boolean): void {
  const layer = ui.grid.querySelector(".event-layer") as HTMLElement;
  layer.querySelector(".now-line")?.remove();
  if (!isToday) return;

  const now = new Date();
  const top = ((now.getHours() * 60 + now.getMinutes()) / 60) * ROW_HEIGHT;
  const line = document.createElement("div");
  line.className = "now-line";
  line.style.top = `${top}px`;
  layer.appendChild(line);
}

function renderTimed(events: CalendarEvent[]): void {
  const layer = ui.grid.querySelector(".event-layer") as HTMLElement;
  layer.innerHTML = "";
  if (!events.length) return;

  const columns = Math.min(3, Math.max(1, events.length > 4 ? 3 : 2));
  events.forEach((event, i) => {
    const node = ui.template.content.firstElementChild!.cloneNode(true) as HTMLElement;
    (node.querySelector(".event-title") as HTMLElement).textContent = event.summary || t("popupUntitled");
    (node.querySelector(".event-time") as HTMLElement).textContent = formatTimeRange(event);
    node.style.background = colorWithAlpha(event.backgroundColor || calendar?.color);
    Object.assign(node.style, eventStyle(event, i % columns, columns));
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

function scrollTimelineToInitialPosition(): void {
  const now = new Date();
  if (!isSameDay(currentDate, now)) {
    ui.timeline.scrollTop = 0;
    return;
  }

  const minutesFromTop = Math.max(0, now.getHours() * 60 + now.getMinutes() - 60);
  const desiredTop = (minutesFromTop / 60) * ROW_HEIGHT;
  ui.timeline.scrollTop = Math.max(0, desiredTop);
}

function scheduleInitialTimelineScroll(): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scrollTimelineToInitialPosition();
    });
  });
}

async function renderEvents(): Promise<void> {
  setMessage();
  updateDateLabel();

  const isToday = isSameDay(currentDate, new Date());

  if (!calendar?.id) {
    setMessage(t("popupNoCalendarSelected"));
    renderAllDay([]);
    renderTimed([]);
    renderNowLine(isToday);
    return;
  }

  try {
    const events = await loadDayEvents(calendar.id, currentDate, false);
    renderAllDay(events.filter(isAllDayEvent));
    renderTimed(events.filter((e) => !isAllDayEvent(e)));
    renderNowLine(isToday);
    scheduleInitialTimelineScroll();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setMessage(t("popupEventLoadFailed", message));
    renderNowLine(isToday);
  }
}

function bindActions(): void {
  ui.goToday.addEventListener("click", () => {
    currentDate = new Date();
    void renderEvents();
  });
  ui.todayDate.addEventListener("click", () => {
    currentDate = new Date();
    void renderEvents();
  });
  ui.prevDay.addEventListener("click", () => {
    currentDate = new Date(currentDate.getTime() - 24 * 60 * 60 * 1000);
    void renderEvents();
  });
  ui.nextDay.addEventListener("click", () => {
    currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
    void renderEvents();
  });
  ui.openOptions.addEventListener("click", () => chrome.runtime.openOptionsPage());
  ui.closePopup.addEventListener("click", () => window.close());
}

async function init(): Promise<void> {
  applyDocumentLanguage();
  applyStaticTexts();
  bindActions();
  renderTimeAxis();
  const timeZoneLabel = new Intl.DateTimeFormat(getSupportedLocale(), {
    timeZoneName: "shortOffset"
  }).format(new Date());
  const gmtOffset = timeZoneLabel.match(/GMT(?:[+-]\d{1,2}(?::\d{2})?)?$/)?.[0];
  ui.tzLabel.textContent = gmtOffset ?? timeZoneLabel;

  calendar = await loadSelectedCalendar();
  await renderEvents();
}

void init().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  setMessage(t("popupInitFailed", message));
});
