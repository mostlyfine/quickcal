import { BADGE, DEFAULT_COLOR, MESSAGE_TYPES } from "./lib/config.js";
import { eventStartDate, minutesDiff } from "./lib/date.js";
import { loadSelectedCalendars, loadUpcomingEventsForCalendars } from "./lib/google-calendar.js";
import { badgeTextForRemaining } from "./lib/badge.js";

function clearBadge(): void {
  chrome.action.setBadgeText({ text: "" });
}

function colorToBadge(color: string): string {
  if (!color || !color.startsWith("#")) return DEFAULT_COLOR;
  return color;
}

async function updateBadge(): Promise<void> {
  try {
    const calendarList = await loadSelectedCalendars();
    if (!calendarList.length) {
      clearBadge();
      return;
    }

    const now = new Date();
    const events = await loadUpcomingEventsForCalendars(calendarList, now);
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
    chrome.action.setBadgeBackgroundColor({ color: colorToBadge(next.calendarColor || calendarList[0].color) });
    chrome.action.setBadgeText({ text: badgeTextForRemaining(remaining) });
  } catch {
    clearBadge();
  }
}

function initBadge(): void {
  chrome.alarms.create(BADGE.alarmName, { periodInMinutes: BADGE.refreshIntervalMinutes });
  void updateBadge();
}

chrome.runtime.onInstalled.addListener(initBadge);
chrome.runtime.onStartup.addListener(initBadge);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === BADGE.alarmName) {
    void updateBadge();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === MESSAGE_TYPES.refreshBadge) {
    updateBadge().then(() => sendResponse({ ok: true }));
    return true;
  }
  return false;
});
