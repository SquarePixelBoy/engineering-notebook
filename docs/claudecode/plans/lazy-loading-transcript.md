# Plan: Lazy loading transcript via HTMX

**Status:** Pending review
**Date:** 2026-04-01

## Context

Transcript HTML is currently rendered inline when loading an entry — both clean and raw views are in the initial HTML response. For long sessions (300+ messages) this means ~500KB+ of HTML loaded immediately. Lazy loading defers the transcript until the user explicitly wants to read it, making page loads instant.

## How it works now

1. User clicks entry card in Panel 2
2. HTMX calls `GET /api/journal/conversation?entry_id=X`
3. `renderEntryConversations()` in `journal.ts` fetches markdown from DB, calls `renderConversation()` which generates ALL message HTML (clean + raw)
4. Full HTML returned and inserted into `#panel-detail`

## How it will work

1. User clicks entry card in Panel 2
2. HTMX calls `GET /api/journal/conversation?entry_id=X` (same as now)
3. `renderEntryConversations()` returns **only** the session nav + a placeholder with a "Load transcript" button
4. User clicks "Load transcript" → HTMX calls `GET /api/journal/transcript?entry_id=X&session_idx=0`
5. New endpoint returns the rendered conversation HTML → inserted into the placeholder div

## Files to modify

- `src/web/views/journal.ts` — modify `renderEntryConversations()` to show placeholder instead of transcript
- `src/web/server.ts` — add new `/api/journal/transcript` endpoint
- `src/web/views/layout.ts` — CSS for the placeholder + load button

## Change 1: New endpoint (server.ts)

Add after the existing `/api/journal/conversation` endpoint (~line 185):

```typescript
// Journal: lazy-load transcript for an entry session
app.get("/api/journal/transcript", (c) => {
  const entryId = parseInt(c.req.query("entry_id") || "0");
  const sessionIdx = parseInt(c.req.query("session_idx") || "0");
  if (!entryId) return c.text("Missing entry_id", 400);
  return c.html(renderEntryTranscript(db, entryId, sessionIdx));
});
```

## Change 2: Split renderEntryConversations (journal.ts)

Current `renderEntryConversations()` does everything. Split into:

**`renderEntryConversations()`** (modified) — returns session nav + placeholder:
```typescript
// Instead of calling renderConversation(), return:
html += `<div id="transcript-container" class="transcript-placeholder">`;
html += `<button class="load-transcript-btn" hx-get="/api/journal/transcript?entry_id=${entryId}&session_idx=${idx}" hx-target="#transcript-container" hx-swap="outerHTML">Load transcript</button>`;
html += `</div>`;
```

**`renderEntryTranscript()`** (new) — returns just the conversation HTML:
```typescript
export function renderEntryTranscript(db: Database, entryId: number, sessionIndex: number = 0): string {
  // Same DB query as current renderEntryConversations
  // Calls renderConversation() + renderSessionFooter()
  // Returns just the transcript HTML (no nav, no dismiss button)
}
```

This way the dismiss button, session nav (Prev/Next) all stay in the initial load. Only the heavy transcript is lazy.

## Change 3: CSS for placeholder (layout.ts)

```css
.transcript-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}
.load-transcript-btn {
  padding: 8px 20px;
  border-radius: 5px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-muted);
  cursor: pointer;
  font-size: 13px;
  font-family: var(--font-sans);
}
.load-transcript-btn:hover {
  color: var(--text);
  border-color: var(--text-ghost);
}
```

## Change 4: Raw view

The raw HTML is generated together with clean in `renderConversation()`. The lazy load returns both views at once (same as now), just deferred. No extra complexity needed for raw.

## What stays the same

- Visual layout — identical once transcript is loaded
- Clean/raw toggle — works the same
- Collapsible messages — works the same
- Session nav (Prev/Next) — stays in initial load
- Dismiss button — stays in initial load
- Double-click, hotkeys — all work once transcript is loaded

## Execution order

1. Add `renderEntryTranscript()` function in journal.ts
2. Modify `renderEntryConversations()` to return placeholder instead of transcript
3. Add `/api/journal/transcript` endpoint in server.ts
4. Add placeholder CSS in layout.ts

## Verification

1. Kill and restart server
2. Click on an entry — should see "Load transcript" button, instant load
3. Click "Load transcript" — transcript appears with all features (collapsible, clean/raw, dblclick)
4. Session nav (Next/Prev) should still work
5. Alt+R should work after transcript is loaded
6. Try both light and cursor themes

## Open questions

- Consider forking the repo before implementing, to preserve all customizations safely
- Need strategy for syncing upstream updates with our modifications
