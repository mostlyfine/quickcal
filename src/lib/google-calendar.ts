import { API, DEFAULT_COLOR, STORAGE_KEYS } from "./config.js";
import { dayRange, eventStartDate, toErrorMessage, toIso, type CalendarEvent } from "./date.js";
import { t } from "./i18n.js";

export interface StoredCalendar {
  id: string;
  color: string;
  summary: string;
}

export interface GoogleCalendar {
  id: string;
  summary?: string;
  backgroundColor?: string;
}

export interface GoogleCalendarEvent {
  summary?: string;
  backgroundColor?: string;
  colorId?: string;
  calendarColor?: string;
  location?: string;
  description?: string;
  htmlLink?: string;
  start: {
    dateTime?: string;
    date?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
  };
}

function ensureOAuthClientIdConfigured(): void {
  const clientId = chrome.runtime.getManifest()?.oauth2?.client_id || "";
  if (!clientId || clientId.includes("YOUR_GOOGLE_OAUTH_CLIENT_ID")) {
    throw new Error(t("oauthClientIdNotConfigured"));
  }
}

function normalizeAuthError(error: unknown): string {
  const message = toErrorMessage(error);
  if (/OAuth2 not granted|not signed in|user did not approve|not authorized/i.test(message)) {
    return t("googleAuthIncomplete");
  }
  return t("googleAuthFailed", message);
}

async function withAuthToken(interactive = false): Promise<string> {
  ensureOAuthClientIdConfigured();
  try {
    const tokenResult = await chrome.identity.getAuthToken({ interactive });
    const value = typeof tokenResult === "string" ? tokenResult : tokenResult?.token;
    if (!value) {
      throw new Error(t("googleTokenMissing"));
    }
    return value;
  } catch (error) {
    throw new Error(normalizeAuthError(error));
  }
}

async function fetchJson<T>(url: string, token: string, interactive = false): Promise<T> {
  let currentToken = token;
  let res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${currentToken}`
    }
  });

  if (res.status === 401 && currentToken) {
    await chrome.identity.removeCachedAuthToken({ token: currentToken });
    currentToken = await withAuthToken(interactive);
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${currentToken}`
      }
    });
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function authorize(interactive = true): Promise<string> {
  return withAuthToken(interactive);
}

export async function loadCalendarList(interactive = false): Promise<GoogleCalendar[]> {
  const token = await withAuthToken(interactive);
  const url = new URL(API.calendarList);
  url.searchParams.set("minAccessRole", "reader");
  url.searchParams.set("showDeleted", "false");
  const json = await fetchJson<{ items?: GoogleCalendar[] }>(url.toString(), token, interactive);
  return json.items ?? [];
}

export async function loadDayEvents(
  calendarId: string,
  targetDate: Date,
  interactive = false
): Promise<GoogleCalendarEvent[]> {
  if (!calendarId) return [];
  const token = await withAuthToken(interactive);
  const encoded = encodeURIComponent(calendarId);
  const { start, end } = dayRange(targetDate);
  const url = new URL(`${API.eventsBase}/${encoded}/events`);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("timeMin", toIso(start));
  url.searchParams.set("timeMax", toIso(end));
  const json = await fetchJson<{ items?: GoogleCalendarEvent[] }>(url.toString(), token, interactive);
  return json.items ?? [];
}

export async function loadUpcomingEvents(
  calendarId: string,
  now = new Date(),
  interactive = false
): Promise<GoogleCalendarEvent[]> {
  if (!calendarId) return [];
  const token = await withAuthToken(interactive);
  const encoded = encodeURIComponent(calendarId);
  const end = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const url = new URL(`${API.eventsBase}/${encoded}/events`);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("timeMin", toIso(now));
  url.searchParams.set("timeMax", toIso(end));
  const json = await fetchJson<{ items?: GoogleCalendarEvent[] }>(url.toString(), token, interactive);
  return json.items ?? [];
}

export async function saveSelectedCalendars(calendars: GoogleCalendar[]): Promise<void> {
  const stored: StoredCalendar[] = calendars.map((c) => ({
    id: c.id,
    color: c.backgroundColor || DEFAULT_COLOR,
    summary: c.summary || t("popupTitle")
  }));
  await chrome.storage.sync.set({
    [STORAGE_KEYS.selectedCalendars]: JSON.stringify(stored)
  });
}

export async function loadSelectedCalendars(): Promise<StoredCalendar[]> {
  const stored = await chrome.storage.sync.get([
    STORAGE_KEYS.selectedCalendars,
    STORAGE_KEYS.selectedCalendarId,
    STORAGE_KEYS.selectedCalendarColor,
    STORAGE_KEYS.selectedCalendarSummary
  ]);

  const raw = stored[STORAGE_KEYS.selectedCalendars] as string | undefined;
  if (raw) {
    try {
      return JSON.parse(raw) as StoredCalendar[];
    } catch {
      // fall through to legacy
    }
  }

  const legacyId = stored[STORAGE_KEYS.selectedCalendarId] as string | undefined;
  if (legacyId) {
    return [
      {
        id: legacyId,
        color: (stored[STORAGE_KEYS.selectedCalendarColor] as string) || DEFAULT_COLOR,
        summary: (stored[STORAGE_KEYS.selectedCalendarSummary] as string) || ""
      }
    ];
  }

  return [];
}

function compareByStart(a: CalendarEvent, b: CalendarEvent): number {
  return eventStartDate(a).getTime() - eventStartDate(b).getTime();
}

async function mergeCalendarEvents(
  calendars: StoredCalendar[],
  loader: (calId: string) => Promise<GoogleCalendarEvent[]>
): Promise<GoogleCalendarEvent[]> {
  if (!calendars.length) return [];
  const results = await Promise.all(
    calendars.map(async (cal) => {
      const events = await loader(cal.id);
      return events.map((e) => ({ ...e, calendarColor: cal.color }));
    })
  );
  return results.flat().sort(compareByStart);
}

export function loadDayEventsForCalendars(
  calendars: StoredCalendar[],
  targetDate: Date
): Promise<GoogleCalendarEvent[]> {
  return mergeCalendarEvents(calendars, (id) => loadDayEvents(id, targetDate, false));
}

export function loadUpcomingEventsForCalendars(
  calendars: StoredCalendar[],
  now = new Date()
): Promise<GoogleCalendarEvent[]> {
  return mergeCalendarEvents(calendars, (id) => loadUpcomingEvents(id, now, false));
}
