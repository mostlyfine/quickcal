import { getSupportedLocale } from "./i18n.js";

const HOURS = 24;

export interface CalendarEventTime {
  dateTime?: string;
  date?: string;
}

export interface CalendarEvent {
  summary?: string;
  backgroundColor?: string;
  colorId?: string;
  calendarColor?: string;
  location?: string;
  description?: string;
  htmlLink?: string;
  start: CalendarEventTime;
  end: CalendarEventTime;
}

export function toIso(value: Date | string | number): string {
  return new Date(value).toISOString();
}

export function formatDate(date: Date | string | number): string {
  const d = new Date(date);
  return new Intl.DateTimeFormat(getSupportedLocale(), {
    month: "numeric",
    day: "numeric",
    weekday: "short"
  }).format(d);
}

export function dayRange(date: Date | string | number): { start: Date; end: Date } {
  const d = new Date(date);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { start, end };
}

export function hourLabels(): string[] {
  return Array.from({ length: HOURS }, (_, h) => {
    const hour = `${h}`.padStart(2, "0");
    return `${hour}:00`;
  });
}

export function eventStartDate(event: CalendarEvent): Date {
  return new Date(event.start.dateTime || event.start.date || 0);
}

export function eventEndDate(event: CalendarEvent): Date {
  return new Date(event.end.dateTime || event.end.date || 0);
}

export function isAllDayEvent(event: CalendarEvent): boolean {
  return Boolean(event.start.date && event.end.date);
}

export function minutesDiff(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 60000);
}

export function clamp(num: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, num));
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
