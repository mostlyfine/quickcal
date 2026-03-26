import {
  authorize,
  loadCalendarList,
  loadSelectedCalendar,
  saveSelectedCalendar,
  type GoogleCalendar
} from "./lib/google-calendar.js";
import { applyDocumentLanguage, t } from "./lib/i18n.js";

interface OptionsUI {
  connect: HTMLButtonElement;
  reload: HTMLButtonElement;
  save: HTMLButtonElement;
  form: HTMLFormElement;
  message: HTMLParagraphElement;
}

const ui: OptionsUI = {
  connect: document.getElementById("connect") as HTMLButtonElement,
  reload: document.getElementById("reload") as HTMLButtonElement,
  save: document.getElementById("save") as HTMLButtonElement,
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

function renderCalendarList(selectedId = ""): void {
  ui.form.innerHTML = "";
  if (!calendars.length) {
    setMessage(t("optionsCalendarListEmpty"));
    ui.save.disabled = true;
    return;
  }

  calendars.forEach((cal) => {
    const label = document.createElement("label");
    label.className = "calendar-option";

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "calendarId";
    radio.value = cal.id;
    radio.checked = cal.id === selectedId;

    const dot = document.createElement("span");
    dot.className = "dot";
    dot.style.background = cal.backgroundColor || "#1a73e8";

    const text = document.createElement("span");
    text.textContent = cal.summary || t("popupUntitled");

    label.append(radio, dot, text);
    ui.form.appendChild(label);
  });

  ui.save.disabled = false;
}

async function reloadCalendars(interactive = false): Promise<void> {
  setMessage();
  try {
    calendars = await loadCalendarList(interactive);
    const selected = await loadSelectedCalendar();
    renderCalendarList(selected.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setMessage(t("optionsCalendarFetchFailed", message));
  }
}

async function onSave(): Promise<void> {
  const fd = new FormData(ui.form);
  const selectedId = fd.get("calendarId");
  if (!selectedId || typeof selectedId !== "string") {
    setMessage(t("optionsSelectCalendarPrompt"));
    return;
  }

  const calendar = calendars.find((c) => c.id === selectedId);
  if (!calendar) {
    setMessage(t("optionsSelectedCalendarNotFound"));
    return;
  }

  await saveSelectedCalendar(calendar);
  setMessage(t("optionsSaved"), true);
  await chrome.runtime.sendMessage({ type: "refresh-badge" });
}

ui.connect.addEventListener("click", async () => {
  try {
    await authorize(true);
    await reloadCalendars(false);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setMessage(t("optionsConnectFailed", message));
  }
});

ui.reload.addEventListener("click", () => {
  void reloadCalendars(false);
});
ui.save.addEventListener("click", () => {
  void onSave();
});

applyDocumentLanguage();
applyStaticTexts();
void reloadCalendars(false);
