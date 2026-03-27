import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/i18n.js", () => ({
  getSupportedLocale: () => "ja"
}));

import {
  clamp,
  dayRange,
  eventEndDate,
  eventStartDate,
  formatDate,
  hourLabels,
  isAllDayEvent,
  minutesDiff,
  toErrorMessage,
  toIso,
  type CalendarEvent
} from "../src/lib/date.js";

describe("date utilities", () => {
  it("clamp should keep number in range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it("dayRange should return start/end of day", () => {
    const { start, end } = dayRange(new Date("2026-03-25T12:34:56+09:00"));
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
  });

  it("minutesDiff should return minute difference", () => {
    const from = new Date("2026-03-25T10:00:00Z");
    const to = new Date("2026-03-25T10:45:00Z");
    expect(minutesDiff(from, to)).toBe(45);
  });
});

describe("formatDate", () => {
  it("formats date with locale ja", () => {
    // 2026-03-25 is Wednesday
    const result = formatDate(new Date("2026-03-25T12:00:00+09:00"));
    expect(result).toMatch(/3/);
    expect(result).toMatch(/25/);
  });

  it("accepts string input", () => {
    const result = formatDate("2026-01-01T00:00:00Z");
    expect(result).toMatch(/1/);
  });

  it("accepts number input", () => {
    const ts = new Date("2026-06-15T00:00:00Z").getTime();
    const result = formatDate(ts);
    expect(result).toMatch(/6/);
    expect(result).toMatch(/15/);
  });
});

describe("toIso", () => {
  it("converts Date to ISO string", () => {
    const date = new Date("2026-03-25T12:00:00Z");
    expect(toIso(date)).toBe("2026-03-25T12:00:00.000Z");
  });

  it("converts number timestamp to ISO string", () => {
    const ts = new Date("2026-01-01T00:00:00Z").getTime();
    expect(toIso(ts)).toBe("2026-01-01T00:00:00.000Z");
  });

  it("converts string to ISO string", () => {
    expect(toIso("2026-06-15T09:30:00Z")).toBe("2026-06-15T09:30:00.000Z");
  });
});

describe("hourLabels", () => {
  it("returns 24 labels", () => {
    const labels = hourLabels();
    expect(labels).toHaveLength(24);
  });

  it("starts with 00:00 and ends with 23:00", () => {
    const labels = hourLabels();
    expect(labels[0]).toBe("00:00");
    expect(labels[23]).toBe("23:00");
  });

  it("pads single digit hours", () => {
    const labels = hourLabels();
    expect(labels[5]).toBe("05:00");
  });
});

describe("eventStartDate / eventEndDate", () => {
  it("returns dateTime when present", () => {
    const event: CalendarEvent = {
      start: { dateTime: "2026-03-25T10:00:00+09:00" },
      end: { dateTime: "2026-03-25T11:00:00+09:00" }
    };
    expect(eventStartDate(event).toISOString()).toBe("2026-03-25T01:00:00.000Z");
    expect(eventEndDate(event).toISOString()).toBe("2026-03-25T02:00:00.000Z");
  });

  it("falls back to date when dateTime is absent", () => {
    const event: CalendarEvent = {
      start: { date: "2026-03-25" },
      end: { date: "2026-03-26" }
    };
    const start = eventStartDate(event);
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(2); // March = 2
    expect(start.getDate()).toBe(25);
  });

  it("returns epoch when both are absent", () => {
    const event: CalendarEvent = { start: {}, end: {} };
    expect(eventStartDate(event).getTime()).toBe(0);
    expect(eventEndDate(event).getTime()).toBe(0);
  });
});

describe("isAllDayEvent", () => {
  it("returns true when both start.date and end.date exist", () => {
    const event: CalendarEvent = {
      start: { date: "2026-03-25" },
      end: { date: "2026-03-26" }
    };
    expect(isAllDayEvent(event)).toBe(true);
  });

  it("returns false for timed events", () => {
    const event: CalendarEvent = {
      start: { dateTime: "2026-03-25T10:00:00Z" },
      end: { dateTime: "2026-03-25T11:00:00Z" }
    };
    expect(isAllDayEvent(event)).toBe(false);
  });

  it("returns false when only start.date exists", () => {
    const event: CalendarEvent = {
      start: { date: "2026-03-25" },
      end: { dateTime: "2026-03-25T11:00:00Z" }
    };
    expect(isAllDayEvent(event)).toBe(false);
  });
});

describe("toErrorMessage", () => {
  it("extracts message from Error", () => {
    expect(toErrorMessage(new Error("something failed"))).toBe("something failed");
  });

  it("converts string to string", () => {
    expect(toErrorMessage("raw error")).toBe("raw error");
  });

  it("converts number to string", () => {
    expect(toErrorMessage(42)).toBe("42");
  });

  it("converts null to string", () => {
    expect(toErrorMessage(null)).toBe("null");
  });
});
