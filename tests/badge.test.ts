import { describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/i18n.js", () => ({
  t: (key: string) => (key === "minutesUnit" ? "min" : key)
}));

import { badgeTextForRemaining } from "../src/lib/badge.js";

describe("badge text", () => {
  it("shows 0 for non-positive minutes", () => {
    expect(badgeTextForRemaining(0)).toBe("0min");
    expect(badgeTextForRemaining(-3)).toBe("0min");
  });

  it("shows remaining minutes", () => {
    expect(badgeTextForRemaining(9)).toBe("9min");
  });
});
