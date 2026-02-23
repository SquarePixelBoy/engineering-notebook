# Engineering Notebook — UX Redesign

## Goal

Replace the current dark-themed, flat-list web UI with a professional three-panel layout using an Ink & Paper visual identity. Two pivot views (by-date and by-project) share the same three-panel structure. Conversation transcripts get a purpose-built rendering with speaker labels in a right-justified gutter.

## Visual Identity: Ink & Paper

- Background: warm off-white `#fafaf9`
- Headlines: Georgia serif
- Body text: system sans-serif (`-apple-system, system-ui, sans-serif`)
- Minimal color — hierarchy through typography weight, size, and muted tones
- No colored borders, no dark theme, no background tints per speaker

### Color Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#fafaf9` | Page background |
| `--surface` | `#f5f5f4` | Left panel background, tags, selected states |
| `--border` | `#e7e5e4` | Panel dividers, section borders |
| `--border-subtle` | `#f5f5f4` | Hairline separators within content |
| `--text` | `#1c1917` | Primary text, user message body |
| `--text-secondary` | `#292524` | User message body (medium weight) |
| `--text-muted` | `#57534e` | Claude message body, secondary info |
| `--text-faint` | `#78716c` | Tags, tertiary metadata |
| `--text-ghost` | `#a8a29e` | Timestamps, stats, section labels |

## Layout: Three-Panel with Top Tab Bar

```
┌─────────────────────────────────────────────────────────────┐
│ Engineering Notebook   [Journal] [Projects]    [Search] [⚙] │
├──────────┬────────────────┬─────────────────────────────────┤
│          │                │                                 │
│  Index   │   Entries      │   Conversation                  │
│  Panel   │   Panel        │   Panel                         │
│  (~200px)│   (~340px)     │   (flex)                        │
│          │                │                                 │
│          │                │                                 │
└──────────┴────────────────┴─────────────────────────────────┘
```

### Top Bar

- Left: "Engineering Notebook" in Georgia bold 15px
- Center-left: Tab links — "Journal" and "Projects" (active tab gets `font-weight: 600` + 2px bottom border)
- Right: Search input field (placeholder text, `#f5f5f4` background, rounded), settings gear icon

### Panel 1: Index (~200px, `--surface` background)

Content depends on active tab:

**Journal tab:** List of dates, grouped by time bucket (This Week / Last Week / etc). Each date shows the day name + project names listed underneath.

```
This Week
┌─────────────────────┐
│ Sat, Feb 21          │  ← selected (white bg)
│   engineering-notebook│
│   superpowers        │
│   sen                │
├─────────────────────┤
│ Fri, Feb 20          │
│   engineering-notebook│
│   sen                │
└─────────────────────┘
```

**Projects tab:** List of all projects sorted by recency. Each shows project name and "Last active" date.

### Panel 2: Entries (~340px)

Content depends on active tab and selected index item:

**Journal tab (date selected):** Shows journal entries for that date. Each entry:
1. Project label — 11px uppercase, `--text-ghost`, letter-spacing 0.05em
2. Headline — 15px Georgia bold, `--text`
3. Summary — 13px sans light (300), `--text-muted`, 1.5 line-height
4. Topic tags — 10px pills with `--surface` background
5. Stats — 11px `--text-ghost` ("4 sessions · 5:37 PM – 11:52 PM")

Selected entry gets `--surface` background with 6px border-radius.

**Projects tab (project selected):** Shows timeline of entries for that project, grouped by time bucket (Today / This Week / Last Week / Older). Each entry shows date, headline, summary snippet, stats.

### Panel 3: Conversation (flex remaining width)

Shows the conversation transcript for the selected entry's sessions. At the top, a session navigator: "Session 1 of 4 · Next →"

## Conversation Transcript Design

```
         ┌──────────────────────────────────────────────
         │
  Jesse  │  Fix the login bug  5:37 PM
         │
         │─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ (no separator, same exchange)
         │
 Claude  │  I'll investigate the login flow. Let me check
         │  the authentication middleware and the session
         │  handler... [...]  5:37 PM
         │
         │  Found the bug. The issue is in comparePassword
         │  where the hash comparison uses == instead of a
         │  constant-time comparison function. [...]
         │
         ├──────────────────────────────────────────────  (hairline on speaker change)
         │
  Jesse  │  Great, fix it please  5:39 PM
         │
```

### Speaker Label Gutter

- Labels positioned absolutely, 72px wide, **right-justified** to align to the content edge
- Names: 14px bold `--text` (same size as body text)
- Content column starts at ~88px left padding

### Message Body Styles

| Speaker | Font weight | Color | Notes |
|---------|------------|-------|-------|
| User (Jesse) | 500 (medium) | `#292524` | Slightly bolder, full contrast |
| Claude | 300 (light) | `#57534e` | Lighter weight, muted color |

### Timestamps

- Inline after the first line of content (not in the gutter, not on a separate line)
- 11px, `--text-ghost`, small left margin

### Consecutive Messages

- Consecutive messages from the same speaker are **merged into one block** with `<br><br>` paragraph breaks
- No repeated name, no repeated timestamp — just continuous text
- Only the first message in a merged block shows the speaker label and timestamp

### Speaker Change Separators

- Hairline `border-top: 1px solid --border-subtle` with 10px top padding
- Only appears when the speaker changes (user → Claude or Claude → user)

## Settings Page

Accessible via gear icon in top bar. Settings include:

- **Custom summary instructions** — textarea for additional prompt context sent to the LLM when generating summaries (e.g., "Focus on architectural decisions" or "Include commit hashes")
- **Day start hour** — number input, default 5. Controls logical date boundary for session splitting.
- **Source directories** — list of paths to scan for Claude session JSONL files
- **Excluded patterns** — glob patterns to skip during ingestion

Settings are stored in the config file (`notebook.toml` or equivalent). The settings page reads and writes this file.

## Search

Search lives in the top bar as an input field. When focused/typed into, it could either:
- Navigate to a dedicated search results page (current behavior, simpler)
- Show results inline in a dropdown or replace panel 2 content (more integrated)

For v1, keep the dedicated search page approach but restyle it to match the new design. Search results show journal entries and conversation matches with the same entry card styling used in panel 2.

## Routes

Current routes map to the new layout as follows:

| Current Route | New Behavior |
|--------------|-------------|
| `/` | Journal tab, most recent date selected, first entry shown |
| `/projects` | Projects tab, first project selected |
| `/project/:id` | Projects tab with that project selected |
| `/session/:id` | Journal tab with the session's date and entry selected, conversation panel showing that session |
| `/search` | Dedicated search results page |

### HTMX Panel Updates

Panel 2 and Panel 3 update via HTMX when selections change:
- Clicking a date in Panel 1 → `hx-get` loads entries into Panel 2
- Clicking an entry in Panel 2 → `hx-get` loads conversation into Panel 3
- Tab switching (Journal ↔ Projects) → full page navigation or HTMX swap of all three panels

## Files to Modify

| File | Change |
|------|--------|
| `src/web/views/layout.ts` | Complete rewrite — new CSS, three-panel HTML structure, top bar |
| `src/web/views/journal.ts` | Rewrite — render Panel 1 (date index) and Panel 2 (entries) for journal view |
| `src/web/views/projects.ts` | Rewrite — render Panel 1 (project index) and Panel 2 (project timeline) |
| `src/web/views/conversation.ts` | Rewrite — outset gutter labels, merged consecutive messages, font weight distinction |
| `src/web/views/session.ts` | Adapt to render inside Panel 3 |
| `src/web/views/search.ts` | Restyle to match new design |
| `src/web/server.ts` | Add HTMX partial routes for panel updates, settings routes |
| `src/config.ts` | Add `summary_instructions` field |
| New: `src/web/views/settings.ts` | Settings page rendering and form handling |

## What This Does NOT Change

- Database schema (no migrations needed)
- Ingestion pipeline (`src/parser.ts`)
- Summarization pipeline (`src/summarize.ts`)
- CLI commands (`src/index.ts` — only the `serve` command is affected indirectly)
- Test files (existing tests remain valid; new tests for new view functions)
