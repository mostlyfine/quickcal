import { BADGE } from "./lib/config.js";
import { eventStartDate, minutesDiff } from "./lib/date.js";
import { loadSelectedCalendar, loadUpcomingEvents } from "./lib/google-calendar.js";
import { badgeTextForRemaining } from "./lib/badge.js";

function clearBadge(): void {
  chrome.action.setBadgeText({ text: "" });
}

function colorToBadge(color: string): string {
  if (!color || !color.startsWith("#")) return "#1a73e8";
  return color;
}

async function updateBadge(): Promise<void> {
  try {
    const calendar = await loadSelectedCalendar();
    if (!calendar.id) {
      clearBadge();
      return;
    }

    const now = new Date();
    const events = await loadUpcomingEvents(calendar.id, now, false);
    const next = events.find((event) => {
      if (!event.start?.dateTime) return false;
      const start = eventStartDate(event);
      const remaining = minutesDiff(now, start);
      return remaining <= BADGE.leadMinutes && remaining >= 0;
    });

    if (!next) {
      clearBadge();
      return;
    }

    const remaining = minutesDiff(now, eventStartDate(next));
    chrome.action.setBadgeBackgroundColor({ color: colorToBadge(calendar.color) });
    chrome.action.setBadgeText({ text: badgeTextForRemaining(remaining) });
  } catch {
    clearBadge();
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(BADGE.alarmName, { periodInMinutes: BADGE.refreshIntervalMinutes });
  void updateBadge();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(BADGE.alarmName, { periodInMinutes: BADGE.refreshIntervalMinutes });
  void updateBadge();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === BADGE.alarmName) {
    void updateBadge();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "refresh-badge") {
    updateBadge().then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});
