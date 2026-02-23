export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(isoStr: string): string {
  const match = isoStr.match(/T(\d{2}:\d{2})/);
  return match ? match[1]! : isoStr;
}

export function formatTimeAmPm(time24: string): string {
  const [hourStr, min] = time24.split(":");
  let hour = parseInt(hourStr!, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  if (hour === 0) hour = 12;
  else if (hour > 12) hour -= 12;
  return `${hour}:${min} ${ampm}`;
}

/**
 * Group an array of YYYY-MM-DD date strings into time buckets
 * relative to `now`. Returns a Map preserving insertion order
 * (Today → This Week → Last Week → Older). Empty buckets are omitted.
 */
export function groupByTimeBucket(
  dates: string[],
  now: Date = new Date()
): Map<string, string[]> {
  const todayStr = now.toISOString().slice(0, 10);

  // Start of this week (Sunday)
  const dayOfWeek = now.getUTCDay();
  const startOfWeek = new Date(now);
  startOfWeek.setUTCDate(now.getUTCDate() - dayOfWeek);
  startOfWeek.setUTCHours(0, 0, 0, 0);
  const startOfWeekStr = startOfWeek.toISOString().slice(0, 10);

  // Start of last week
  const startOfLastWeek = new Date(startOfWeek);
  startOfLastWeek.setUTCDate(startOfLastWeek.getUTCDate() - 7);
  const startOfLastWeekStr = startOfLastWeek.toISOString().slice(0, 10);

  const buckets = new Map<string, string[]>();

  for (const date of dates) {
    let bucket: string;
    if (date === todayStr) {
      bucket = "Today";
    } else if (date >= startOfWeekStr) {
      bucket = "This Week";
    } else if (date >= startOfLastWeekStr) {
      bucket = "Last Week";
    } else {
      bucket = "Older";
    }
    if (!buckets.has(bucket)) buckets.set(bucket, []);
    buckets.get(bucket)!.push(date);
  }

  return buckets;
}
