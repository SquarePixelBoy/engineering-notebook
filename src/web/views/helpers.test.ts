import { describe, test, expect } from "bun:test";
import { escapeHtml, formatDate, formatDateShort, formatTime, formatTimeAmPm, groupByTimeBucket } from "./helpers";

describe("escapeHtml", () => {
  test("escapes HTML entities", () => {
    expect(escapeHtml('<script>"alert&</script>')).toBe(
      "&lt;script&gt;&quot;alert&amp;&lt;/script&gt;"
    );
  });

  test("passes through clean strings", () => {
    expect(escapeHtml("hello world")).toBe("hello world");
  });
});

describe("formatDate", () => {
  test("formats ISO date as readable string", () => {
    const result = formatDate("2026-02-21");
    expect(result).toContain("February");
    expect(result).toContain("21");
    expect(result).toContain("Saturday");
  });
});

describe("formatDateShort", () => {
  // e.g., "Sat, Feb 21"
  test("formats as short day + month + day", () => {
    const result = formatDateShort("2026-02-21");
    expect(result).toContain("Sat");
    expect(result).toContain("Feb");
    expect(result).toContain("21");
  });
});

describe("formatTime", () => {
  test("extracts HH:MM from ISO datetime", () => {
    expect(formatTime("2026-02-21T17:37:00Z")).toBe("17:37");
  });
});

describe("formatTimeAmPm", () => {
  test("converts 24h time to 12h AM/PM", () => {
    expect(formatTimeAmPm("17:37")).toBe("5:37 PM");
    expect(formatTimeAmPm("09:05")).toBe("9:05 AM");
    expect(formatTimeAmPm("00:00")).toBe("12:00 AM");
    expect(formatTimeAmPm("12:00")).toBe("12:00 PM");
  });
});

describe("groupByTimeBucket", () => {
  test("groups dates into Today / This Week / Last Week / Older", () => {
    const today = "2026-02-22"; // Sunday
    const lastWeek = "2026-02-19"; // Thursday of last week (>= 2026-02-15)
    const olderInRange = "2026-02-12"; // Thursday, older than last week start
    const older = "2026-01-15";

    const result = groupByTimeBucket(
      [today, lastWeek, olderInRange, older],
      new Date("2026-02-22T12:00:00Z")
    );

    expect(result.get("Today")).toEqual([today]);
    expect(result.get("Last Week")).toEqual([lastWeek]);
    expect(result.get("Older")).toEqual([olderInRange, older]);
  });

  test("omits empty buckets", () => {
    const result = groupByTimeBucket(
      ["2026-02-22"],
      new Date("2026-02-22T12:00:00Z")
    );
    expect(result.has("Today")).toBe(true);
    expect(result.has("This Week")).toBe(false);
    expect(result.has("Last Week")).toBe(false);
  });
});
