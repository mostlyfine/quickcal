import { describe, expect, it } from "vitest";
import { clamp, dayRange, minutesDiff } from "../src/lib/date.js";

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
