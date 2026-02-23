# UX Redesign Implementation Plan

> **For Claude:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark-themed flat-list web UI with a professional three-panel Ink & Paper layout supporting journal (by-date) and project (by-project) pivot views.

**Architecture:** Server-rendered HTML via Hono, HTMX for panel-level updates without full page reloads. Three-panel layout: index panel (dates or projects), entries panel (journal summaries), conversation panel (transcript). Layout shell renders once; panels update via HTMX partials.

**Tech Stack:** Bun, Hono, SQLite (bun:sqlite), HTMX 2.0.4

**Spec:** `docs/plans/2026-02-22-ux-redesign-design.md`

---

## File Structure

| File | Responsibility | Change |
|------|---------------|--------|
| `src/web/views/layout.ts` | HTML shell, CSS variables, three-panel structure, top bar | Complete rewrite |
| `src/web/views/conversation.ts` | Parse markdown → merged messages with outset gutter labels | Complete rewrite |
| `src/web/views/journal.ts` | Journal tab: date index (panel 1) + entries (panel 2) | Complete rewrite |
| `src/web/views/projects.ts` | Projects tab: project index (panel 1) + timeline (panel 2) | Complete rewrite |
| `src/web/views/session.ts` | Render conversation into panel 3 with session navigation | Rewrite |
| `src/web/views/search.ts` | Search results page in new styling | Restyle |
| `src/web/views/settings.ts` | Settings page — read/write config | New file |
| `src/web/server.ts` | Routes: full pages + HTMX partials for panel updates | Add partial routes |
| `src/config.ts` | Add `summary_instructions: string` to Config type | Small addition |
| `src/web/views/helpers.ts` | Shared `escapeHtml`, `formatTime`, `formatDate`, time-bucket grouping | New file (extract duplication) |

**Key decomposition decisions:**
- `helpers.ts` extracts the 4 copies of `escapeHtml` and shared formatting functions into one place
- Each view file renders only its panel content (HTML fragment), not the full page — `layout.ts` wraps them
- HTMX partial routes return bare HTML fragments; full-page routes return `layout.ts` shell + initial panel content
- Journal and Projects views each export separate functions for panel 1 and panel 2 so the server can return them independently

---

## Chunk 1: Foundation

### Task 1: Extract shared helpers

**Files:**
- Create: `src/web/views/helpers.ts`
- Test: `src/web/views/helpers.test.ts`

Currently `escapeHtml` is duplicated in `conversation.ts`, `journal.ts`, `projects.ts`, `search.ts`, and `session.ts`. `formatDate` and `formatTime` are in `journal.ts`. Extract them all.

- [ ] **Step 1: Create helpers with tests**

Create `src/web/views/helpers.test.ts`:

```typescript
import { describe, test, expect } from "bun:test";
import { escapeHtml, formatDate, formatTime, formatTimeAmPm, groupByTimeBucket } from "./helpers";

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
    const { formatDateShort } = require("./helpers");
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
    const today = "2026-02-22";
    const thisWeek = "2026-02-19";
    const lastWeek = "2026-02-12";
    const older = "2026-01-15";

    const result = groupByTimeBucket(
      [today, thisWeek, lastWeek, older],
      new Date("2026-02-22T12:00:00Z")
    );

    expect(result.get("Today")).toEqual([today]);
    expect(result.get("This Week")).toEqual([thisWeek]);
    expect(result.get("Last Week")).toEqual([lastWeek]);
    expect(result.get("Older")).toEqual([older]);
  });

  test("omits empty buckets", () => {
    const result = groupByTimeBucket(
      ["2026-02-22"],
      new Date("2026-02-22T12:00:00Z")
    );
    expect(result.has("Today")).toBe(true);
    expect(result.has("This Week")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/web/views/helpers.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement helpers**

Create `src/web/views/helpers.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/web/views/helpers.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/web/views/helpers.ts src/web/views/helpers.test.ts
git commit -m "refactor: extract shared view helpers (escapeHtml, formatDate, time buckets)"
```

---

### Task 2: Rewrite layout shell

**Files:**
- Modify: `src/web/views/layout.ts` (complete rewrite)

The layout provides the HTML shell with CSS variables, the top bar, and the three-panel container. The actual panel content is injected by the route handlers.

The layout needs to support two modes:
1. **Full page** — three panels pre-filled (initial load)
2. **Search/settings** — single content area (no three-panel)

- [ ] **Step 1: Rewrite layout.ts**

Replace the entire contents of `src/web/views/layout.ts` with the new layout. The function signature changes to accept structured panel content:

```typescript
import { escapeHtml } from "./helpers";

type ThreePanelContent = {
  activeTab: "journal" | "projects";
  panel1: string;
  panel2: string;
  panel3: string;
};

type SingleContent = {
  body: string;
};

type LayoutContent = ThreePanelContent | SingleContent;

function isThreePanel(c: LayoutContent): c is ThreePanelContent {
  return "panel1" in c;
}

export function renderLayout(title: string, content: LayoutContent): string {
  const journalActive = isThreePanel(content) && content.activeTab === "journal";
  const projectsActive = isThreePanel(content) && content.activeTab === "projects";

  let bodyHtml: string;
  if (isThreePanel(content)) {
    bodyHtml = `
      <div class="panels">
        <div class="panel panel-index" id="panel-index">${content.panel1}</div>
        <div class="panel panel-entries" id="panel-entries">${content.panel2}</div>
        <div class="panel panel-detail" id="panel-detail">${content.panel3}</div>
      </div>`;
  } else {
    bodyHtml = `<div class="single-content">${content.body}</div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <script src="https://unpkg.com/htmx.org@2.0.4"></script>
  <style>
    :root {
      --bg: #fafaf9;
      --surface: #f5f5f4;
      --border: #e7e5e4;
      --border-subtle: #f5f5f4;
      --text: #1c1917;
      --text-secondary: #292524;
      --text-muted: #57534e;
      --text-faint: #78716c;
      --text-ghost: #a8a29e;
      --font-serif: Georgia, 'Times New Roman', serif;
      --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; overflow: hidden; }
    body {
      font-family: var(--font-sans);
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      display: flex;
      flex-direction: column;
    }

    /* Top bar */
    .top-bar {
      display: flex;
      align-items: center;
      padding: 0 20px;
      border-bottom: 1px solid var(--border);
      background: var(--bg);
      flex-shrink: 0;
      height: 44px;
    }
    .top-bar .logo {
      font-weight: 700;
      font-size: 15px;
      color: var(--text);
      font-family: var(--font-serif);
      margin-right: 32px;
      text-decoration: none;
    }
    .top-bar nav { display: flex; gap: 0; height: 100%; }
    .top-bar nav a {
      font-size: 13px;
      color: var(--text-faint);
      text-decoration: none;
      padding: 0 16px;
      display: flex;
      align-items: center;
      height: 100%;
      border-bottom: 2px solid transparent;
    }
    .top-bar nav a:hover { color: var(--text-muted); }
    .top-bar nav a.active {
      font-weight: 600;
      color: var(--text);
      border-bottom-color: var(--text);
    }
    .top-bar .spacer { flex: 1; }
    .top-bar .search-field {
      background: var(--surface);
      border: none;
      border-radius: 5px;
      padding: 6px 12px;
      font-size: 12px;
      color: var(--text);
      width: 180px;
      font-family: var(--font-sans);
    }
    .top-bar .search-field::placeholder { color: var(--text-ghost); }
    .top-bar .search-field:focus { outline: 1px solid var(--border); }
    .top-bar .settings-link {
      width: 28px;
      height: 28px;
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-ghost);
      text-decoration: none;
      font-size: 16px;
      margin-left: 8px;
    }
    .top-bar .settings-link:hover { color: var(--text-muted); background: var(--surface); }

    /* Three-panel layout */
    .panels {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    .panel { overflow-y: auto; }
    .panel-index {
      width: 200px;
      background: var(--surface);
      border-right: 1px solid var(--border);
      flex-shrink: 0;
      padding: 12px 0;
    }
    .panel-entries {
      width: 340px;
      border-right: 1px solid var(--border);
      flex-shrink: 0;
      padding: 20px;
    }
    .panel-detail {
      flex: 1;
      padding: 20px 24px;
    }

    /* Single content (search, settings) */
    .single-content {
      flex: 1;
      max-width: 720px;
      margin: 0 auto;
      padding: 32px 24px;
      overflow-y: auto;
    }

    /* Index panel items */
    .index-section-label {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-ghost);
      padding: 8px 14px 4px;
    }
    .index-item {
      padding: 8px 14px;
      margin: 0 6px 2px;
      border-radius: 5px;
      cursor: pointer;
      text-decoration: none;
      display: block;
      color: inherit;
    }
    .index-item:hover { background: rgba(0,0,0,0.03); }
    .index-item.selected { background: var(--bg); }
    .index-item-title {
      font-size: 13px;
      color: var(--text-muted);
    }
    .index-item.selected .index-item-title {
      font-weight: 600;
      color: var(--text);
    }
    .index-item-sub {
      font-size: 11px;
      color: var(--text-ghost);
      margin-top: 2px;
    }
    .index-item.selected .index-item-sub { color: var(--text-faint); }

    /* Entry cards in panel 2 */
    .entry-card {
      padding: 14px;
      margin-bottom: 12px;
      border-radius: 6px;
      cursor: pointer;
      text-decoration: none;
      display: block;
      color: inherit;
    }
    .entry-card:hover { background: var(--surface); }
    .entry-card.selected { background: var(--surface); }
    .entry-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-ghost);
      margin-bottom: 4px;
    }
    .entry-headline {
      font-size: 15px;
      font-weight: 600;
      color: var(--text);
      font-family: var(--font-serif);
      margin-bottom: 6px;
    }
    .entry-summary {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.5;
      font-weight: 300;
    }
    .entry-tags {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 6px;
    }
    .entry-tag {
      font-size: 10px;
      padding: 1px 6px;
      background: var(--surface);
      border-radius: 3px;
      color: var(--text-faint);
    }
    .entry-card.selected .entry-tag { background: var(--border); }
    .entry-stats {
      font-size: 11px;
      color: var(--text-ghost);
      margin-top: 6px;
    }

    /* Conversation transcript */
    .conversation-nav {
      font-size: 11px;
      color: var(--text-ghost);
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .conversation-nav a {
      color: var(--text-ghost);
      text-decoration: underline;
      cursor: pointer;
    }
    .transcript {
      padding-left: 88px;
      position: relative;
    }
    .msg { margin-bottom: 10px; position: relative; }
    .msg-speaker-change { padding-top: 10px; border-top: 1px solid var(--border-subtle); }
    .msg-label {
      position: absolute;
      left: -84px;
      top: 0;
      width: 72px;
      text-align: right;
      font-weight: 700;
      font-size: 14px;
      color: var(--text);
    }
    .msg-body-user {
      color: var(--text-secondary);
      line-height: 1.6;
      font-size: 14px;
      font-weight: 500;
    }
    .msg-body-claude {
      color: var(--text-muted);
      line-height: 1.55;
      font-size: 14px;
      font-weight: 300;
    }
    .msg-time {
      font-size: 11px;
      color: var(--text-ghost);
      margin-left: 6px;
      font-weight: 400;
    }

    /* Search page */
    .search-box {
      width: 100%;
      padding: 10px 14px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      font-size: 14px;
      font-family: var(--font-sans);
      margin-bottom: 24px;
    }
    .search-box:focus { outline: none; border-color: var(--text-ghost); }
    mark { background: #fef3c7; color: var(--text); padding: 1px 2px; border-radius: 2px; }

    /* Settings page */
    .settings-group { margin-bottom: 24px; }
    .settings-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 6px;
    }
    .settings-help {
      font-size: 12px;
      color: var(--text-ghost);
      margin-bottom: 8px;
    }
    .settings-input {
      width: 100%;
      padding: 8px 12px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 5px;
      color: var(--text);
      font-size: 13px;
      font-family: var(--font-sans);
    }
    .settings-input:focus { outline: none; border-color: var(--text-ghost); }
    textarea.settings-input { min-height: 80px; resize: vertical; }
    .settings-btn {
      padding: 8px 20px;
      background: var(--text);
      color: var(--bg);
      border: none;
      border-radius: 5px;
      font-size: 13px;
      cursor: pointer;
      font-family: var(--font-sans);
    }
    .settings-btn:hover { opacity: 0.85; }

    /* Misc */
    .page-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--text);
      font-family: var(--font-serif);
      margin-bottom: 20px;
    }
    .empty-state {
      color: var(--text-ghost);
      font-size: 14px;
      padding: 40px 20px;
      text-align: center;
    }
    code {
      background: var(--surface);
      padding: 2px 5px;
      border-radius: 3px;
      font-size: 0.9em;
    }
    a { color: var(--text-muted); }
    a:hover { color: var(--text); }
  </style>
</head>
<body>
  <div class="top-bar">
    <a href="/" class="logo">Engineering Notebook</a>
    <nav>
      <a href="/"${journalActive ? ' class="active"' : ""}>Journal</a>
      <a href="/projects"${projectsActive ? ' class="active"' : ""}>Projects</a>
    </nav>
    <div class="spacer"></div>
    <form action="/search" method="get" style="display:flex;">
      <input class="search-field" type="text" name="q" placeholder="Search...">
    </form>
    <a href="/settings" class="settings-link" title="Settings">&#9881;</a>
  </div>
  ${bodyHtml}
</body>
</html>`;
}
```

- [ ] **Step 2: Verify the app still starts (will look broken until views are updated)**

Run: `bun src/index.ts serve`

This will fail because `renderLayout` now expects a different argument type. That's expected — the view files need updating. Just confirm the module imports resolve. Kill the server.

- [ ] **Step 3: Commit**

```bash
git add src/web/views/layout.ts
git commit -m "feat: rewrite layout shell with three-panel structure and Ink & Paper CSS"
```

---

### Task 3: Rewrite conversation renderer

**Files:**
- Modify: `src/web/views/conversation.ts` (complete rewrite)

The new conversation renderer:
- Merges consecutive messages from the same speaker into one block
- Places speaker labels in a right-justified gutter
- Uses font-weight 500 for user, 300 for Claude
- Puts timestamps inline after first line of content
- Adds hairline separator on speaker changes

- [ ] **Step 1: Write tests for the new conversation renderer**

Create `src/web/views/conversation.test.ts`:

```typescript
import { describe, test, expect } from "bun:test";
import { renderConversation } from "./conversation";

describe("renderConversation", () => {
  test("renders empty state for missing markdown", () => {
    const html = renderConversation("");
    expect(html).toContain("No conversation data");
  });

  test("renders user message with outset label and inline timestamp", () => {
    const md = "**User (2026-02-21 17:37):** Fix the login bug";
    const html = renderConversation(md);
    expect(html).toContain("msg-label");
    expect(html).toContain("Jesse");
    expect(html).toContain("msg-body-user");
    expect(html).toContain("Fix the login bug");
    expect(html).toContain("5:37 PM");
  });

  test("renders Claude message with light weight class", () => {
    const md = "**Claude (2026-02-21 17:37):** I'll investigate";
    const html = renderConversation(md);
    expect(html).toContain("msg-body-claude");
    expect(html).toContain("Claude");
  });

  test("merges consecutive messages from same speaker", () => {
    const md = [
      "**Claude (2026-02-21 17:37):** First message",
      "**Claude (2026-02-21 17:38):** Second message",
    ].join("\n");
    const html = renderConversation(md);
    // Should only have one "Claude" label, not two
    const labelMatches = html.match(/msg-label/g);
    expect(labelMatches?.length).toBe(1);
    // Both messages should be in the body
    expect(html).toContain("First message");
    expect(html).toContain("Second message");
  });

  test("adds separator on speaker change", () => {
    const md = [
      "**User (2026-02-21 17:37):** Fix the bug",
      "**Claude (2026-02-21 17:37):** On it",
      "**User (2026-02-21 17:39):** Thanks",
    ].join("\n");
    const html = renderConversation(md);
    // The second user message should have speaker-change separator
    expect(html).toContain("msg-speaker-change");
  });

  test("does not add separator between consecutive same-speaker messages", () => {
    const md = [
      "**Claude (2026-02-21 17:37):** First part",
      "**Claude (2026-02-21 17:38):** Second part",
    ].join("\n");
    const html = renderConversation(md);
    expect(html).not.toContain("msg-speaker-change");
  });

  test("handles old-format timestamps (HH:MM only)", () => {
    const md = "**User (17:37):** Old format message";
    const html = renderConversation(md);
    expect(html).toContain("Old format message");
    expect(html).toContain("5:37 PM");
  });

  test("normalizes speaker names", () => {
    const md = [
      "**Human (2026-02-21 17:37):** First",
      "**Assistant (2026-02-21 17:37):** Second",
    ].join("\n");
    const html = renderConversation(md);
    expect(html).toContain("Jesse");
    expect(html).toContain("Claude");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/web/views/conversation.test.ts`
Expected: FAIL — old renderer doesn't have the new classes/behavior

- [ ] **Step 3: Implement new conversation renderer**

Replace `src/web/views/conversation.ts` entirely:

```typescript
import { escapeHtml, formatTimeAmPm } from "./helpers";

const MESSAGE_REGEX =
  /^\*\*(User|Claude|Jesse|Assistant|Human)\s*\((?:\d{4}-\d{2}-\d{2}\s+)?(\d{2}:\d{2})\):\*\*\s*(.+)$/;

type ParsedMessage = {
  speaker: string;
  displayName: string;
  time: string;
  body: string;
  role: "user" | "claude";
};

function parseMessages(markdown: string): ParsedMessage[] {
  const lines = markdown.split("\n");
  const messages: ParsedMessage[] = [];
  let current: ParsedMessage | null = null;

  for (const line of lines) {
    const match = line.match(MESSAGE_REGEX);
    if (match) {
      if (current) messages.push(current);
      const speaker = match[1]!;
      const role: "user" | "claude" =
        speaker === "Claude" || speaker === "Assistant" ? "claude" : "user";
      const displayName =
        speaker === "User" || speaker === "Human" ? "Jesse" :
        speaker === "Assistant" ? "Claude" : speaker;
      current = {
        speaker,
        displayName,
        time: match[2]!,
        body: match[3]!,
        role,
      };
    } else if (current) {
      if (line.trim() === "") {
        current.body += "\n";
      } else {
        current.body += "\n" + line;
      }
    }
  }
  if (current) messages.push(current);
  return messages;
}

/**
 * Merge consecutive messages from the same role into single blocks.
 * Returns array of { displayName, role, time (of first msg), body (merged) }.
 */
function mergeConsecutive(messages: ParsedMessage[]): ParsedMessage[] {
  const merged: ParsedMessage[] = [];
  for (const msg of messages) {
    const prev = merged[merged.length - 1];
    if (prev && prev.role === msg.role) {
      // Merge: append body with paragraph break
      prev.body = prev.body.trimEnd() + "\n\n" + msg.body.trim();
    } else {
      merged.push({ ...msg, body: msg.body.trim() });
    }
  }
  return merged;
}

export function renderConversation(markdown: string): string {
  if (!markdown || markdown.trim() === "") {
    return '<div class="empty-state">No conversation data.</div>';
  }

  const messages = parseMessages(markdown);
  if (messages.length === 0) {
    return `<div class="transcript"><pre style="white-space: pre-wrap; font-size: 13px;">${escapeHtml(markdown)}</pre></div>`;
  }

  const merged = mergeConsecutive(messages);
  let html = '<div class="transcript">';
  let prevRole: string | null = null;

  for (const msg of merged) {
    const speakerChange = prevRole !== null && prevRole !== msg.role;
    const bodyClass = msg.role === "user" ? "msg-body-user" : "msg-body-claude";
    const timeAmPm = formatTimeAmPm(msg.time);

    const escapedBody = escapeHtml(msg.body);
    // Convert double-newlines to paragraph breaks
    const formattedBody = escapedBody
      .replace(/\n\n/g, "<br><br>")
      .replace(/\n/g, " ");

    // Insert timestamp after the first line of content
    // Find the first <br><br> or end of string
    const firstBreak = formattedBody.indexOf("<br><br>");
    let bodyWithTime: string;
    if (firstBreak === -1) {
      bodyWithTime = `${formattedBody} <span class="msg-time">${timeAmPm}</span>`;
    } else {
      bodyWithTime =
        formattedBody.slice(0, firstBreak) +
        ` <span class="msg-time">${timeAmPm}</span>` +
        formattedBody.slice(firstBreak);
    }

    html += `<div class="msg${speakerChange ? " msg-speaker-change" : ""}">`;
    html += `<div class="msg-label">${escapeHtml(msg.displayName)}</div>`;
    html += `<div class="${bodyClass}">${bodyWithTime}</div>`;
    html += `</div>`;

    prevRole = msg.role;
  }

  html += "</div>";
  return html;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun test src/web/views/conversation.test.ts`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/web/views/conversation.ts src/web/views/conversation.test.ts
git commit -m "feat: rewrite conversation renderer with outset labels and merged messages"
```

---

## Chunk 2: Panel Views and Routes

### Task 4: Rewrite journal view (panels 1 and 2)

**Files:**
- Modify: `src/web/views/journal.ts` (complete rewrite)

Exports three functions:
- `renderJournalDateIndex(db, selectedDate?)` — Panel 1: date list with project names
- `renderJournalEntries(db, date)` — Panel 2: journal entries for a date
- `renderJournalPage(db, date?)` — Full three-panel content for layout

- [ ] **Step 1: Rewrite journal.ts**

Replace `src/web/views/journal.ts` entirely. The key changes:
- Query distinct dates from journal_entries (not sessions), ordered DESC
- Group dates into time buckets using `groupByTimeBucket`
- For each date in the index, list project names underneath
- Panel 2 shows journal entry cards with the 5-level hierarchy
- Selected states driven by URL params

```typescript
import { Database } from "bun:sqlite";
import { escapeHtml, formatDateShort, formatDate, formatTimeAmPm, formatTime, groupByTimeBucket } from "./helpers";

type JournalEntryRow = {
  id: number;
  date: string;
  project_id: string;
  display_name: string;
  headline: string;
  summary: string;
  topics: string;
  session_ids: string;
};

type DateProjectsRow = {
  date: string;
  projects: string; // comma-separated project display names
};

/**
 * Panel 1: Date index with project names under each date.
 */
export function renderJournalDateIndex(db: Database, selectedDate?: string): string {
  const rows = db.query(`
    SELECT je.date, GROUP_CONCAT(DISTINCT p.display_name) as projects
    FROM journal_entries je
    JOIN projects p ON je.project_id = p.id
    GROUP BY je.date
    ORDER BY je.date DESC
  `).all() as DateProjectsRow[];

  if (rows.length === 0) {
    return '<div class="empty-state">No journal entries yet.<br>Run <code>notebook summarize</code> to generate them.</div>';
  }

  const dates = rows.map(r => r.date);
  const projectsByDate = new Map(rows.map(r => [r.date, r.projects]));
  const buckets = groupByTimeBucket(dates);

  let html = "";
  for (const [bucketName, bucketDates] of buckets) {
    html += `<div class="index-section-label">${escapeHtml(bucketName)}</div>`;
    for (const date of bucketDates) {
      const isSelected = date === selectedDate;
      const projects = projectsByDate.get(date) || "";
      html += `<a class="index-item${isSelected ? " selected" : ""}" href="/?date=${date}" hx-get="/api/journal/entries?date=${date}" hx-target="#panel-entries" hx-push-url="/?date=${date}">`;
      html += `<div class="index-item-title">${formatDateShort(date)}</div>`;
      html += `<div class="index-item-sub">${escapeHtml(projects.replace(/,/g, "<br>"))}</div>`;
      html += `</a>`;
    }
  }
  return html;
}

/**
 * Panel 2: Journal entries for a specific date.
 */
export function renderJournalEntries(db: Database, date: string, selectedEntryId?: number): string {
  const entries = db.query(`
    SELECT je.id, je.date, je.project_id, p.display_name, je.headline, je.summary, je.topics, je.session_ids
    FROM journal_entries je
    JOIN projects p ON je.project_id = p.id
    WHERE je.date = ?
    ORDER BY p.display_name
  `).all(date) as JournalEntryRow[];

  let html = `<div class="page-title">${formatDate(date)}</div>`;

  if (entries.length === 0) {
    html += '<div class="empty-state">No entries for this date.</div>';
    return html;
  }

  for (const entry of entries) {
    const isSelected = entry.id === selectedEntryId;
    const sessionIds = JSON.parse(entry.session_ids || "[]") as string[];
    const topics: string[] = JSON.parse(entry.topics || "[]");

    // Compute time range from sessions
    const timeRange = getSessionTimeRange(db, sessionIds);

    html += `<a class="entry-card${isSelected ? " selected" : ""}" href="/?date=${date}&entry=${entry.id}" hx-get="/api/journal/conversation?entry_id=${entry.id}" hx-target="#panel-detail">`;
    html += `<div class="entry-label">${escapeHtml(entry.display_name)}</div>`;
    if (entry.headline) {
      html += `<div class="entry-headline">${escapeHtml(entry.headline)}</div>`;
    }
    html += `<div class="entry-summary">${escapeHtml(entry.summary)}</div>`;
    if (topics.length > 0) {
      html += `<div class="entry-tags">`;
      for (const t of topics) {
        html += `<span class="entry-tag">${escapeHtml(t)}</span>`;
      }
      html += `</div>`;
    }
    html += `<div class="entry-stats">${sessionIds.length} session${sessionIds.length !== 1 ? "s" : ""}${timeRange ? ` · ${timeRange}` : ""}</div>`;
    html += `</a>`;
  }
  return html;
}

function getSessionTimeRange(db: Database, sessionIds: string[]): string {
  if (sessionIds.length === 0) return "";
  const placeholders = sessionIds.map(() => "?").join(",");
  const row = db.query(`
    SELECT MIN(started_at) as earliest, MAX(COALESCE(ended_at, started_at)) as latest
    FROM sessions WHERE id IN (${placeholders})
  `).get(...sessionIds) as { earliest: string; latest: string } | null;
  if (!row || !row.earliest) return "";
  const start = formatTimeAmPm(formatTime(row.earliest));
  const end = formatTimeAmPm(formatTime(row.latest));
  return start === end ? start : `${start} – ${end}`;
}

/**
 * Full page content: picks the selected or most recent date,
 * returns all three panel contents.
 */
export function renderJournalPage(db: Database, date?: string, entryId?: number): {
  panel1: string;
  panel2: string;
  panel3: string;
} {
  // If no date specified, use the most recent
  if (!date) {
    const row = db.query(`SELECT date FROM journal_entries ORDER BY date DESC LIMIT 1`).get() as { date: string } | null;
    date = row?.date;
  }

  const panel1 = renderJournalDateIndex(db, date);

  if (!date) {
    return { panel1, panel2: '<div class="empty-state">No journal entries yet.</div>', panel3: "" };
  }

  const panel2 = renderJournalEntries(db, date, entryId ?? undefined);

  // Default panel 3: show conversation for first entry if no entry selected
  let panel3 = '<div class="empty-state">Select an entry to view conversations.</div>';
  if (entryId) {
    panel3 = renderEntryConversations(db, entryId);
  } else {
    const firstEntry = db.query(`
      SELECT id FROM journal_entries WHERE date = ? ORDER BY project_id LIMIT 1
    `).get(date) as { id: number } | null;
    if (firstEntry) {
      panel3 = renderEntryConversations(db, firstEntry.id);
    }
  }

  return { panel1, panel2, panel3 };
}

/**
 * Render conversations for a journal entry (for Panel 3).
 */
export function renderEntryConversations(db: Database, entryId: number, sessionIndex: number = 0): string {
  const entry = db.query(`SELECT session_ids FROM journal_entries WHERE id = ?`).get(entryId) as { session_ids: string } | null;
  if (!entry) return '<div class="empty-state">Entry not found.</div>';

  const sessionIds: string[] = JSON.parse(entry.session_ids || "[]");
  if (sessionIds.length === 0) return '<div class="empty-state">No sessions for this entry.</div>';

  const idx = Math.max(0, Math.min(sessionIndex, sessionIds.length - 1));
  const sessionId = sessionIds[idx]!;

  const convo = db.query(`SELECT conversation_markdown FROM conversations WHERE session_id = ?`).get(sessionId) as { conversation_markdown: string } | null;

  let html = "";
  // Session navigator
  if (sessionIds.length > 1) {
    html += `<div class="conversation-nav">`;
    html += `Session ${idx + 1} of ${sessionIds.length}`;
    if (idx > 0) {
      html += ` · <a hx-get="/api/journal/conversation?entry_id=${entryId}&session_idx=${idx - 1}" hx-target="#panel-detail">&larr; Prev</a>`;
    }
    if (idx < sessionIds.length - 1) {
      html += ` · <a hx-get="/api/journal/conversation?entry_id=${entryId}&session_idx=${idx + 1}" hx-target="#panel-detail">Next &rarr;</a>`;
    }
    html += `</div>`;
  }

  if (convo) {
    // Import at top of file — renderConversation from conversation.ts
    const { renderConversation } = require("./conversation");
    html += renderConversation(convo.conversation_markdown);
  } else {
    html += '<div class="empty-state">Conversation not available.</div>';
  }

  return html;
}
```

**Important:** The `require("./conversation")` is a lazy import to avoid circular deps. Alternatively, the server route can compose these — see Task 7.

- [ ] **Step 2: Verify existing tests still pass**

Run: `bun test`
Expected: Some tests may fail due to the layout signature change — that's acceptable until Task 7 wires everything together. The `helpers.test.ts` and `conversation.test.ts` should pass.

- [ ] **Step 3: Commit**

```bash
git add src/web/views/journal.ts
git commit -m "feat: rewrite journal view with date index and entry panels"
```

---

### Task 5: Rewrite projects view (panels 1 and 2)

**Files:**
- Modify: `src/web/views/projects.ts` (complete rewrite)

Same structure as journal but pivoted by project. Exports:
- `renderProjectIndex(db, selectedProject?)` — Panel 1: project list
- `renderProjectTimeline(db, projectId)` — Panel 2: timeline of entries grouped by time bucket
- `renderProjectsPage(db, projectId?)` — Full three-panel content

- [ ] **Step 1: Rewrite projects.ts**

Replace `src/web/views/projects.ts` entirely:

```typescript
import { Database } from "bun:sqlite";
import { escapeHtml, formatDateShort, formatTimeAmPm, formatTime, groupByTimeBucket } from "./helpers";

type ProjectRow = {
  id: string;
  display_name: string;
  last_session_at: string | null;
};

type ProjectEntryRow = {
  id: number;
  date: string;
  headline: string;
  summary: string;
  topics: string;
  session_ids: string;
};

/**
 * Panel 1: Project index sorted by recency.
 */
export function renderProjectIndex(db: Database, selectedProject?: string): string {
  const projects = db.query(`
    SELECT id, display_name, last_session_at
    FROM projects
    ORDER BY last_session_at DESC
  `).all() as ProjectRow[];

  if (projects.length === 0) {
    return '<div class="empty-state">No projects yet.</div>';
  }

  let html = "";
  for (const p of projects) {
    const isSelected = p.id === selectedProject;
    const lastActive = p.last_session_at ? formatDateShort(p.last_session_at.slice(0, 10)) : "No sessions";
    html += `<a class="index-item${isSelected ? " selected" : ""}" href="/projects?project=${encodeURIComponent(p.id)}" hx-get="/api/projects/timeline?project=${encodeURIComponent(p.id)}" hx-target="#panel-entries" hx-push-url="/projects?project=${encodeURIComponent(p.id)}">`;
    html += `<div class="index-item-title">${escapeHtml(p.display_name || p.id)}</div>`;
    html += `<div class="index-item-sub">Last active ${escapeHtml(lastActive)}</div>`;
    html += `</a>`;
  }
  return html;
}

/**
 * Panel 2: Timeline of entries for a project, grouped by time bucket.
 */
export function renderProjectTimeline(db: Database, projectId: string, selectedEntryId?: number): string {
  const project = db.query(`SELECT display_name FROM projects WHERE id = ?`).get(projectId) as { display_name: string } | null;
  const name = project?.display_name || projectId;

  const entries = db.query(`
    SELECT je.id, je.date, je.headline, je.summary, je.topics, je.session_ids
    FROM journal_entries je
    WHERE je.project_id = ?
    ORDER BY je.date DESC
  `).all(projectId) as ProjectEntryRow[];

  let html = `<div class="page-title">${escapeHtml(name)}</div>`;

  if (entries.length === 0) {
    html += '<div class="empty-state">No entries for this project.</div>';
    return html;
  }

  const dates = [...new Set(entries.map(e => e.date))];
  const buckets = groupByTimeBucket(dates);
  const entriesByDate = new Map<string, ProjectEntryRow[]>();
  for (const e of entries) {
    if (!entriesByDate.has(e.date)) entriesByDate.set(e.date, []);
    entriesByDate.get(e.date)!.push(e);
  }

  for (const [bucketName, bucketDates] of buckets) {
    html += `<div class="index-section-label" style="padding: 12px 0 6px; margin-top: 8px;">${escapeHtml(bucketName)}</div>`;
    for (const date of bucketDates) {
      const dateEntries = entriesByDate.get(date) || [];
      for (const entry of dateEntries) {
        const isSelected = entry.id === selectedEntryId;
        const sessionIds: string[] = JSON.parse(entry.session_ids || "[]");
        const topics: string[] = JSON.parse(entry.topics || "[]");

        html += `<a class="entry-card${isSelected ? " selected" : ""}" href="/projects?project=${encodeURIComponent(projectId)}&entry=${entry.id}" hx-get="/api/journal/conversation?entry_id=${entry.id}" hx-target="#panel-detail">`;
        html += `<div class="entry-label">${formatDateShort(date)}</div>`;
        if (entry.headline) {
          html += `<div class="entry-headline">${escapeHtml(entry.headline)}</div>`;
        }
        html += `<div class="entry-summary">${escapeHtml(entry.summary)}</div>`;
        if (topics.length > 0) {
          html += `<div class="entry-tags">`;
          for (const t of topics) {
            html += `<span class="entry-tag">${escapeHtml(t)}</span>`;
          }
          html += `</div>`;
        }
        html += `<div class="entry-stats">${sessionIds.length} session${sessionIds.length !== 1 ? "s" : ""}</div>`;
        html += `</a>`;
      }
    }
  }
  return html;
}

/**
 * Full page content for projects tab.
 */
export function renderProjectsPage(db: Database, projectId?: string, entryId?: number): {
  panel1: string;
  panel2: string;
  panel3: string;
} {
  // If no project specified, use the most recent
  if (!projectId) {
    const row = db.query(`SELECT id FROM projects ORDER BY last_session_at DESC LIMIT 1`).get() as { id: string } | null;
    projectId = row?.id;
  }

  const panel1 = renderProjectIndex(db, projectId);

  if (!projectId) {
    return { panel1, panel2: '<div class="empty-state">No projects yet.</div>', panel3: "" };
  }

  const panel2 = renderProjectTimeline(db, projectId, entryId ?? undefined);

  // Default panel 3
  let panel3 = '<div class="empty-state">Select an entry to view conversations.</div>';
  if (entryId) {
    const { renderEntryConversations } = require("./journal");
    panel3 = renderEntryConversations(db, entryId);
  } else {
    const firstEntry = db.query(`
      SELECT id FROM journal_entries WHERE project_id = ? ORDER BY date DESC LIMIT 1
    `).get(projectId) as { id: number } | null;
    if (firstEntry) {
      const { renderEntryConversations } = require("./journal");
      panel3 = renderEntryConversations(db, firstEntry.id);
    }
  }

  return { panel1, panel2, panel3 };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/web/views/projects.ts
git commit -m "feat: rewrite projects view with project index and timeline panels"
```

---

### Task 6: Rewrite search and add settings page

**Files:**
- Modify: `src/web/views/search.ts` (restyle)
- Create: `src/web/views/settings.ts`
- Modify: `src/config.ts` (add `summary_instructions`)

- [ ] **Step 1: Add summary_instructions to config**

In `src/config.ts`, add `summary_instructions: string` to the Config type and default it to `""`:

In the `Config` type, add after `day_start_hour: number;`:
```typescript
  summary_instructions: string;
```

In `defaultConfig()`, add after `day_start_hour: 5,`:
```typescript
    summary_instructions: "",
```

- [ ] **Step 2: Rewrite search.ts**

Replace `src/web/views/search.ts`:

```typescript
import { Database } from "bun:sqlite";
import { escapeHtml } from "./helpers";

export function renderSearch(db: Database, query: string): string {
  let html = `<div class="page-title">Search</div>`;
  html += `<input class="search-box" type="text" name="q" placeholder="Search journal entries and conversations..."
    hx-get="/search" hx-trigger="keyup changed delay:300ms" hx-target="#results" hx-include="this"
    value="${escapeHtml(query)}">`;
  html += `<div id="results">`;
  if (query) {
    html += renderSearchResults(db, query);
  }
  html += `</div>`;
  return html;
}

export function renderSearchResults(db: Database, query: string): string {
  const pattern = `%${query}%`;

  const journalResults = db.query(`
    SELECT je.id, je.date, je.project_id, p.display_name, je.headline, je.summary, je.topics
    FROM journal_entries je
    JOIN projects p ON je.project_id = p.id
    WHERE je.summary LIKE ? OR je.topics LIKE ? OR je.headline LIKE ?
    ORDER BY je.date DESC
    LIMIT 20
  `).all(pattern, pattern, pattern) as {
    id: number; date: string; project_id: string; display_name: string;
    headline: string; summary: string; topics: string;
  }[];

  const convoResults = db.query(`
    SELECT s.id as session_id, date(s.started_at) as date, p.display_name, s.project_id
    FROM conversations c
    JOIN sessions s ON c.session_id = s.id
    JOIN projects p ON s.project_id = p.id
    WHERE c.conversation_markdown LIKE ?
    ORDER BY s.started_at DESC
    LIMIT 20
  `).all(pattern) as { session_id: string; date: string; display_name: string; project_id: string }[];

  let html = "";

  if (journalResults.length > 0) {
    html += `<div style="margin-bottom: 24px;">`;
    html += `<div class="index-section-label" style="padding: 8px 0;">Journal Entries (${journalResults.length})</div>`;
    for (const r of journalResults) {
      html += `<a class="entry-card" href="/?date=${r.date}&entry=${r.id}" style="display:block;">`;
      html += `<div class="entry-label">${escapeHtml(r.display_name)} · ${r.date}</div>`;
      if (r.headline) {
        html += `<div class="entry-headline">${highlightMatch(escapeHtml(r.headline), query)}</div>`;
      }
      html += `<div class="entry-summary">${highlightMatch(escapeHtml(r.summary), query)}</div>`;
      html += `</a>`;
    }
    html += `</div>`;
  }

  if (convoResults.length > 0) {
    html += `<div>`;
    html += `<div class="index-section-label" style="padding: 8px 0;">Conversations (${convoResults.length})</div>`;
    for (const r of convoResults) {
      html += `<a class="entry-card" href="/session/${r.session_id}" style="display:block;">`;
      html += `<div class="entry-label">${escapeHtml(r.display_name)} · ${r.date}</div>`;
      html += `<div class="entry-summary">View session</div>`;
      html += `</a>`;
    }
    html += `</div>`;
  }

  if (journalResults.length === 0 && convoResults.length === 0) {
    html += `<div class="empty-state">No results for "${escapeHtml(query)}"</div>`;
  }

  return html;
}

function highlightMatch(text: string, query: string): string {
  if (!query) return text;
  const regex = new RegExp(`(${escapeRegex(query)})`, "gi");
  return text.replace(regex, `<mark>$1</mark>`);
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
```

- [ ] **Step 3: Create settings.ts**

Create `src/web/views/settings.ts`:

```typescript
import { escapeHtml } from "./helpers";
import type { Config } from "../../config";

export function renderSettings(config: Config): string {
  let html = `<div class="page-title">Settings</div>`;
  html += `<form method="POST" action="/settings">`;

  // Summary instructions
  html += `<div class="settings-group">`;
  html += `<div class="settings-label">Custom Summary Instructions</div>`;
  html += `<div class="settings-help">Additional context sent to the LLM when generating summaries. E.g., "Focus on architectural decisions" or "Include commit hashes".</div>`;
  html += `<textarea class="settings-input" name="summary_instructions" rows="4">${escapeHtml(config.summary_instructions)}</textarea>`;
  html += `</div>`;

  // Day start hour
  html += `<div class="settings-group">`;
  html += `<div class="settings-label">Day Start Hour</div>`;
  html += `<div class="settings-help">Hour (0–23) when a new "logical day" begins. Messages before this hour belong to the previous day. Default: 5 (5 AM).</div>`;
  html += `<input class="settings-input" type="number" name="day_start_hour" min="0" max="23" value="${config.day_start_hour}" style="width: 80px;">`;
  html += `</div>`;

  // Source directories
  html += `<div class="settings-group">`;
  html += `<div class="settings-label">Source Directories</div>`;
  html += `<div class="settings-help">Paths to scan for Claude session JSONL files (one per line).</div>`;
  html += `<textarea class="settings-input" name="sources" rows="3">${escapeHtml(config.sources.join("\n"))}</textarea>`;
  html += `</div>`;

  // Excluded patterns
  html += `<div class="settings-group">`;
  html += `<div class="settings-label">Excluded Patterns</div>`;
  html += `<div class="settings-help">Glob patterns to skip during ingestion (one per line).</div>`;
  html += `<textarea class="settings-input" name="exclude" rows="3">${escapeHtml(config.exclude.join("\n"))}</textarea>`;
  html += `</div>`;

  // Port
  html += `<div class="settings-group">`;
  html += `<div class="settings-label">Server Port</div>`;
  html += `<input class="settings-input" type="number" name="port" value="${config.port}" style="width: 100px;">`;
  html += `</div>`;

  html += `<button class="settings-btn" type="submit">Save Settings</button>`;
  html += `</form>`;
  return html;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/config.ts src/web/views/search.ts src/web/views/settings.ts
git commit -m "feat: restyle search, add settings page, add summary_instructions config"
```

---

### Task 7: Rewrite server routes

**Files:**
- Modify: `src/web/server.ts` (rewrite to wire new views together)
- Modify: `src/web/views/session.ts` (adapt to new layout)

This is the integration task that wires everything together. Add HTMX partial routes and update full-page routes.

- [ ] **Step 1: Rewrite session.ts**

The session detail page should now render in the three-panel layout, with the appropriate date and entry selected.

```typescript
import { Database } from "bun:sqlite";
import { renderConversation } from "./conversation";
import { escapeHtml, formatTimeAmPm, formatTime } from "./helpers";

/**
 * Render a single session's conversation for Panel 3,
 * with basic session metadata header.
 */
export function renderSessionDetail(db: Database, sessionId: string): string {
  const session = db.query(`
    SELECT s.id, s.project_id, s.started_at, s.ended_at, s.git_branch,
           s.message_count, p.display_name, c.conversation_markdown
    FROM sessions s
    JOIN projects p ON s.project_id = p.id
    LEFT JOIN conversations c ON c.session_id = s.id
    WHERE s.id = ?
  `).get(sessionId) as {
    id: string; project_id: string; started_at: string; ended_at: string | null;
    git_branch: string | null; message_count: number; display_name: string;
    conversation_markdown: string | null;
  } | null;

  if (!session) return '<div class="empty-state">Session not found.</div>';

  let html = `<div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border-subtle);">`;
  html += `<div style="font-size: 13px; font-weight: 600; color: var(--text);">${escapeHtml(session.display_name)}</div>`;
  html += `<div style="font-size: 11px; color: var(--text-ghost); margin-top: 2px;">`;
  html += `${session.started_at.slice(0, 10)} · ${session.message_count} messages`;
  if (session.git_branch) html += ` · ${escapeHtml(session.git_branch)}`;
  html += `</div></div>`;

  if (session.conversation_markdown) {
    html += renderConversation(session.conversation_markdown);
  } else {
    html += '<div class="empty-state">No conversation data.</div>';
  }

  return html;
}
```

- [ ] **Step 2: Rewrite server.ts**

Replace `src/web/server.ts`:

```typescript
import { Hono } from "hono";
import { Database } from "bun:sqlite";
import { renderLayout } from "./views/layout";
import { renderJournalPage, renderJournalEntries, renderEntryConversations, renderJournalDateIndex } from "./views/journal";
import { renderProjectsPage, renderProjectTimeline, renderProjectIndex } from "./views/projects";
import { renderSearch, renderSearchResults } from "./views/search";
import { renderSettings } from "./views/settings";
import { renderSessionDetail } from "./views/session";
import { loadConfig, saveConfig, resolveConfigPath } from "../config";

export function createApp(db: Database): Hono {
  const app = new Hono();

  // ──────────────────────────────────────────
  // Full-page routes
  // ──────────────────────────────────────────

  // Journal (default landing page)
  app.get("/", (c) => {
    const date = c.req.query("date");
    const entryId = c.req.query("entry") ? parseInt(c.req.query("entry")!) : undefined;
    const { panel1, panel2, panel3 } = renderJournalPage(db, date, entryId);
    return c.html(renderLayout("Engineering Notebook", {
      activeTab: "journal",
      panel1,
      panel2,
      panel3,
    }));
  });

  // Projects
  app.get("/projects", (c) => {
    const projectId = c.req.query("project") || undefined;
    const entryId = c.req.query("entry") ? parseInt(c.req.query("entry")!) : undefined;
    const { panel1, panel2, panel3 } = renderProjectsPage(db, projectId, entryId);
    return c.html(renderLayout("Projects — Engineering Notebook", {
      activeTab: "projects",
      panel1,
      panel2,
      panel3,
    }));
  });

  // Session detail — show in journal context
  app.get("/session/:id", (c) => {
    const sessionId = c.req.param("id");
    const panel3 = renderSessionDetail(db, sessionId);
    // Find the date for this session to select it in the index
    const session = db.query(`SELECT date(started_at) as date FROM sessions WHERE id = ?`).get(sessionId) as { date: string } | null;
    const date = session?.date;
    const panel1 = renderJournalDateIndex(db, date || undefined);
    const panel2 = date ? renderJournalEntries(db, date) : '<div class="empty-state">Session not found.</div>';
    return c.html(renderLayout("Session — Engineering Notebook", {
      activeTab: "journal",
      panel1,
      panel2,
      panel3,
    }));
  });

  // Search
  app.get("/search", (c) => {
    const q = c.req.query("q") || "";
    if (c.req.header("HX-Request")) {
      return c.html(renderSearchResults(db, q));
    }
    return c.html(renderLayout("Search — Engineering Notebook", { body: renderSearch(db, q) }));
  });

  // Settings (GET)
  app.get("/settings", (c) => {
    const config = loadConfig();
    return c.html(renderLayout("Settings — Engineering Notebook", { body: renderSettings(config) }));
  });

  // Settings (POST)
  app.post("/settings", async (c) => {
    const body = await c.req.parseBody();
    const config = loadConfig();
    const configPath = resolveConfigPath();

    config.summary_instructions = (body.summary_instructions as string) || "";
    config.day_start_hour = parseInt((body.day_start_hour as string) || "5", 10);
    config.sources = ((body.sources as string) || "").split("\n").map(s => s.trim()).filter(Boolean);
    config.exclude = ((body.exclude as string) || "").split("\n").map(s => s.trim()).filter(Boolean);
    config.port = parseInt((body.port as string) || "3000", 10);

    saveConfig(configPath, config);
    return c.redirect("/settings");
  });

  // ──────────────────────────────────────────
  // HTMX partial routes (return panel HTML fragments)
  // ──────────────────────────────────────────

  // Journal: load entries for a date (Panel 2)
  app.get("/api/journal/entries", (c) => {
    const date = c.req.query("date");
    if (!date) return c.text("Missing date", 400);
    return c.html(renderJournalEntries(db, date));
  });

  // Journal: load conversation for an entry (Panel 3)
  app.get("/api/journal/conversation", (c) => {
    const entryId = parseInt(c.req.query("entry_id") || "0");
    const sessionIdx = parseInt(c.req.query("session_idx") || "0");
    if (!entryId) return c.text("Missing entry_id", 400);
    return c.html(renderEntryConversations(db, entryId, sessionIdx));
  });

  // Projects: load timeline for a project (Panel 2)
  app.get("/api/projects/timeline", (c) => {
    const projectId = c.req.query("project");
    if (!projectId) return c.text("Missing project", 400);
    return c.html(renderProjectTimeline(db, projectId));
  });

  // Legacy route compatibility: /project/:id redirects to /projects?project=:id
  app.get("/project/:id", (c) => {
    const projectId = c.req.param("id");
    return c.redirect(`/projects?project=${encodeURIComponent(projectId)}`);
  });

  return app;
}
```

- [ ] **Step 3: Run the app and verify manually**

Run: `bun src/index.ts serve`

Open `http://localhost:3000` in a browser. Verify:
- Three-panel layout renders
- Journal tab shows dates in panel 1, entries in panel 2
- Clicking a date loads entries via HTMX
- Clicking an entry loads conversation in panel 3
- Projects tab works similarly
- Search page renders with new styling
- Settings page shows config values

- [ ] **Step 4: Commit**

```bash
git add src/web/views/session.ts src/web/server.ts
git commit -m "feat: wire three-panel layout with HTMX partial routes"
```

---

## Chunk 3: Cleanup

### Task 8: Remove dead code and fix imports

**Files:**
- Modify: Various view files to use `helpers.ts` imports instead of local `escapeHtml`

- [ ] **Step 1: Update imports in all view files**

In each view file that still has a local `escapeHtml` function, remove it and import from `helpers.ts`. Files to check:
- `journal.ts` — should already import from helpers
- `projects.ts` — should already import from helpers
- `conversation.ts` — should already import from helpers
- `search.ts` — has its own `escapeHtml`, remove and import from helpers
- `session.ts` — should already import from helpers

Also remove the old `/api/conversations` route from `server.ts` if it's no longer used by any view.

- [ ] **Step 2: Run all tests**

Run: `bun test`
Expected: All tests pass (helpers, conversation, summarize, parser, config, db, ingest)

- [ ] **Step 3: Run the app one final time**

Run: `bun src/index.ts serve`

Walk through every route:
- `/` — Journal with panels
- `/projects` — Projects with panels
- `/session/<id>` — Session in journal context
- `/search` — Search page
- `/settings` — Settings page
- HTMX interactions: click dates, entries, session navigation

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: clean up imports, remove dead code after UX redesign"
```

---

## Summary

| Task | What it does | Key files |
|------|-------------|-----------|
| 1 | Extract shared helpers | `helpers.ts`, `helpers.test.ts` |
| 2 | Layout shell with CSS + three-panel structure | `layout.ts` |
| 3 | Conversation renderer with outset labels | `conversation.ts`, `conversation.test.ts` |
| 4 | Journal view (date index + entries panels) | `journal.ts` |
| 5 | Projects view (project index + timeline panels) | `projects.ts` |
| 6 | Search restyle + settings page + config update | `search.ts`, `settings.ts`, `config.ts` |
| 7 | Server routes wiring everything together | `server.ts`, `session.ts` |
| 8 | Import cleanup and verification | All view files |

**Dependency order:** Tasks 1–3 are independent foundations. Task 4–6 depend on Task 1 (helpers). Task 7 depends on Tasks 2–6. Task 8 depends on Task 7.
