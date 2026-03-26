export const STORAGE_KEYS = {
  selectedCalendarId: "selectedCalendarId",
  selectedCalendarColor: "selectedCalendarColor",
  selectedCalendarSummary: "selectedCalendarSummary"
} as const;

export const API = {
  calendarList: "https://www.googleapis.com/calendar/v3/users/me/calendarList",
  eventsBase: "https://www.googleapis.com/calendar/v3/calendars"
} as const;

export const BADGE = {
  leadMinutes: 10,
  alarmName: "calendar-badge-refresh",
  refreshIntervalMinutes: 1
} as const;
