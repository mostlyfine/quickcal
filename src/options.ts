import {
  authorize,
  loadCalendarList,
  loadSelectedCalendars,
  saveSelectedCalendars,
  type GoogleCalendar
} from "./lib/google-calendar.js";
import { applyDocumentLanguage, t } from "./lib/i18n.js";
import { toErrorMessage } from "./lib/date.js";
import { DEFAULT_COLOR, MESSAGE_TYPES } from "./lib/config.js";

interface OptionsUI {
  connect: HTMLButtonElement;
  reload: HTMLButtonElement;
  save: HTMLButtonElement;
  closeOptions: HTMLButtonElement;
  form: HTMLFormElement;
  message: HTMLParagraphElement;
}

const ui: OptionsUI = {
  connect: document.getElementById("connect") as HTMLButtonElement,
  reload: document.getElementById("reload") as HTMLButtonElement,
  save: document.getElementById("save") as HTMLButtonElement,
  closeOptions: document.getElementById("close-options") as HTMLButtonElement,
  form: document.getElementById("calendar-form") as HTMLFormElement,
  message: document.getElementById("message") as HTMLParagraphElement
};

let calendars: GoogleCalendar[] = [];

function applyStaticTexts(): void {
  (document.getElementById("options-title") as HTMLTitleElement).textContent = t("optionsTitle");
  (document.getElementById("options-heading") as HTMLHeadingElement).textContent = t("optionsHeading");
  (document.getElementById("options-description") as HTMLParagraphElement).textContent = t("optionsDescription");
  ui.connect.textContent = t("optionsConnect");
  ui.reload.textContent = t("optionsReload");
  ui.save.textContent = t("optionsSave");
  ui.closeOptions.textContent = t("optionsClose");
}

function setMessage(text = "", ok = false): void {
  if (!text) {
    ui.message.classList.add("hidden");
    ui.message.textContent = "";
    return;
  }
  ui.message.classList.remove("hidden");
  ui.message.style.background = ok ? "#e6f4ea" : "#fce8e6";
  ui.message.style.color = ok ? "#137333" : "#c5221f";
  ui.message.textContent = text;
}

function renderCalendarList(selectedIds: string[] = []): void {
  ui.form.innerHTML = "";
  if (!calendars.length) {
    setMessage(t("optionsCalendarListEmpty"));
    ui.save.disabled = true;
    return;
  }

  calendars.forEach((cal) => {
    const label = document.createElement("label");
    label.className = "calendar-option";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "calendarId";
    checkbox.value = cal.id;
    checkbox.checked = selectedIds.includes(cal.id);

    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = cal.backgroundColor || DEFAULT_COLOR;

    const text = document.createElement("span");
    text.textContent = cal.summary || t("popupUntitled");

    label.append(checkbox, dot, text);
    ui.form.appendChild(label);
  });

  ui.save.disabled = false;
}

async function reloadCalendars(interactive = false): Promise<void> {
  setMessage();
  try {
    const [list, selected] = await Promise.all([loadCalendarList(interactive), loadSelectedCalendars()]);
    calendars = list;
    renderCalendarList(selected.map((c) => c.id));
  } catch (error) {
    const message = toErrorMessage(error);
    setMessage(t("optionsCalendarFetchFailed", message));
  }
}

async function onSave(): Promise<void> {
  const fd = new FormData(ui.form);
  const selectedIds = fd.getAll("calendarId").filter((v): v is string => typeof v === "string");
  if (!selectedIds.length) {
    setMessage(t("optionsSelectCalendarPrompt"));
    return;
  }

  const selected = calendars.filter((c) => selectedIds.includes(c.id));
  if (!selected.length) {
    setMessage(t("optionsSelectedCalendarNotFound"));
    return;
  }

  await saveSelectedCalendars(selected);
  await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.refreshBadge });
  window.close();
}

ui.connect.addEventListener("click", async () => {
  try {
    await authorize(true);
    await reloadCalendars(false);
  } catch (error) {
    const message = toErrorMessage(error);
    setMessage(t("optionsConnectFailed", message));
  }
});

ui.reload.addEventListener("click", () => {
  void reloadCalendars(false);
});
ui.save.addEventListener("click", () => {
  void onSave();
});
ui.closeOptions.addEventListener("click", () => {
  window.close();
});

applyDocumentLanguage();
applyStaticTexts();
void reloadCalendars(false);
