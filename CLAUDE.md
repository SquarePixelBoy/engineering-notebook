# Engineering Notebook — Customized Fork

This is a locally customized version of [prime-radiant-inc/engineering-notebook](https://github.com/prime-radiant-inc/engineering-notebook). The original tool ingests Claude Code session JSONL files, generates LLM-powered summaries via Haiku, and serves a browsable web journal.

## Fork Setup

**Forked on GitHub** as [SquarePixelBoy/engineering-notebook](https://github.com/SquarePixelBoy/engineering-notebook).

Git remotes:
- `origin` → `SquarePixelBoy/engineering-notebook` (our fork — push here)
- `upstream` → `prime-radiant-inc/engineering-notebook` (Jesse's original)

### Syncing with upstream

When Jesse pushes updates and we want to pull them in while keeping our customizations:

```bash
# 1. Fetch the latest from Jesse
git fetch upstream

# 2. Rebase our commits on top of his latest
git rebase upstream/main
```

If there are **no conflicts** (Jesse didn't touch our 3 customized files), it just works.

If there **are conflicts** (Jesse edited the same files we modified):
```bash
# Git will stop and show which files conflict. Open them — look for:
#   <<<<<<< HEAD        (Jesse's version)
#   =======
#   >>>>>>> our-commit  (our version)
#
# Edit the file to keep the right mix of both, then:
git add <conflicted-file>
git rebase --continue

# If it gets too messy and you want to start over:
git rebase --abort
```

After resolving:
```bash
# 3. Push updated history to our fork
git push --force-with-lease origin main
```

### Which files are at risk of conflicts

| File | What we changed | Conflict risk |
|------|----------------|---------------|
| `src/parser.ts` | 1 line (removed truncation) | Low |
| `src/web/views/conversation.ts` | Regex, noise filtering, merge logic | Medium |
| `src/web/views/layout.ts` | Theme, CSS, toggles (~290 lines added) | Medium-high |
| `CLAUDE.md` | Our file, doesn't exist upstream | None |
| `docs/claudecode/` | Our directory, doesn't exist upstream | None |

## What This Tool Does

1. **Ingest** (`engineering-notebook ingest`) — scans `~/.claude/projects/` for session JSONL files, extracts human-readable text (strips tool calls, thinking blocks), stores in SQLite
2. **Summarize** (`engineering-notebook summarize --all`) — groups sessions by date+project, sends to Haiku via Claude Agent SDK (uses existing Claude Code auth, no API key needed), generates headline + summary + topics + open questions
3. **Serve** (`engineering-notebook serve`) — web UI on localhost:3000 with three-panel layout (HTMX + Hono)

## Shell Aliases (defined in ~/dotfiles/.zsh/aliases.zsh)

```
journal            → engineering-notebook serve
journal-ingest     → engineering-notebook ingest
journal-summarize  → engineering-notebook summarize --all
journal-sync       → engineering-notebook ingest && engineering-notebook summarize --all
```

## Customizations Made

All modifications are in two files: `src/web/views/layout.ts` and `src/web/views/conversation.ts`, plus one line in `src/parser.ts`.

### parser.ts
- `toMarkdown()` — removed first-line truncation (`[...]`), now saves full message text to DB

### conversation.ts
- **Dynamic regex** — `MESSAGE_REGEX` replaced with `buildMessageRegex()` that constrains matches to known speaker names (pixel, Claude, Codex, etc.), preventing bold text inside responses from splitting messages
- **System noise filtering** — `isSystemNoise()`, `hasSystemNoise()`, `stripSystemNoise()` functions filter `<task-notification>`, `<system-reminder>`, `<local-command-caveat>`, `<command-name>` etc.
- **Two-pass rendering** — clean view (system noise filtered, consecutive Claude messages merged) and raw view (all messages including system noise) rendered separately
- **System message label** — pure system noise messages show "system" label instead of user's name in raw view
- **Collapsible messages** — messages with >8 `<br><br>` breaks get collapsed with "Show more" / "Show less" toggle

### layout.ts

#### Themes
- **Two themes**: Light (original) + Cursor Dark Modern (custom)
- Toggle button in top bar (sun/moon icon), persisted in localStorage
- Cursor theme values: `--bg: #181818`, `--surface: #252525`, `--border: #2B2B2B`
- Custom per-theme variables: `--msg-user-color`, `--msg-claude-color`, `--headline-color`

#### Transcript styling
- **User messages**: `--msg-user-color` (#B8B8B8 in Cursor), 14px, weight 400, background `var(--surface)`
- **Claude messages**: `--msg-claude-color` (#BABABA in Cursor), 15px, weight 400, background `rgba(128,128,128,0.04)`
- **User label**: `var(--text)`, **Claude label**: `var(--text-faint)`
- **System messages** (raw view only): `opacity: 0.5`, italic, label color `var(--text-ghost)`
- **Entry headline**: `var(--headline-color)` (#B8B8B8 in Cursor)

#### UI additions
- **Theme toggle** — top bar, cycles light/cursor
- **Raw toggle** (`</>`) — top bar + Alt+R hotkey, shows/hides system messages and raw message bodies
- **Fullscreen toggle** — top bar + Alt+F hotkey, hides left/center panels for full-width transcript reading
- **Expand/Collapse all** (↕) — top bar + Alt+E hotkey, toggles all collapsible messages at once
- **Double-click** on collapsible messages to expand/collapse (clears text selection after)
- **Index item selection** — JS click handler removes `selected` class from previous item

#### CSS changes
- Custom scrollbars matching theme (`--bg` track, `--border` thumb)
- Minimum font sizes bumped from 10-11px to 12px globally
- Entry summary: 14px weight 400 (was 13px weight 300)
- Entry tags: 13px with more padding (was 12px)
- Panel index background: `var(--bg)` (was `var(--surface)`), selected items: `var(--surface)`
- Hover on index items: `rgba(128,128,128,0.08)` (works in both light/dark)
- Collapsible messages: `max-height: 12em`, fade-out gradient, "Show more"/"Show less" buttons

## Pending Plans

### Lazy loading transcript (docs/claudecode/plans/lazy-loading-transcript.md)
Defer transcript HTML loading until user clicks "Load transcript" button. Uses HTMX pattern already in the codebase. New endpoint `/api/journal/transcript`. Reduces initial page load from ~500KB to near-zero for long sessions.

### Contributing back upstream
Some customizations (dynamic regex, system noise filtering, collapsible messages) could benefit the original project. Consider opening PRs for generalizable features — if accepted, those changes merge into upstream and reduce our diff/conflict surface.

## Tech Stack

- **Runtime**: Bun v1.1+
- **Web framework**: Hono
- **UI**: HTMX (no JS framework)
- **Database**: SQLite (Bun native), at `~/.config/engineering-notebook/notebook.db`
- **Summarization**: Claude Haiku via `@anthropic-ai/claude-agent-sdk` (uses Claude Code OAuth auth)
- **Config**: `~/.config/engineering-notebook/config.json` (created on first settings save, uses defaults if missing)

## Development

```bash
# Start server
bun run src/index.ts serve

# Run tests
bun test

# Re-ingest sessions (after parser changes)
engineering-notebook ingest --force

# Summarize new sessions
engineering-notebook summarize --all
```

## Key Architecture Notes

- All CSS is inline in `layout.ts` (no external stylesheets)
- All JS is inline in `layout.ts` (no external scripts, except HTMX CDN)
- CSS uses variables (`--bg`, `--text`, etc.) — theme switching overrides these via `[data-theme]` selector on `<html>`
- Conversation rendering: markdown → parseMessages (regex) → mergeConsecutive → renderMessages (HTML)
- Two parallel HTML renders per conversation: clean (`.msg-clean`) and raw (`.msg-raw`), toggled via CSS class on `#panel-detail`
