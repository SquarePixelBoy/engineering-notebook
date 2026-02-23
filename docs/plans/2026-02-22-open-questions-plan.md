# Open Questions Extraction Implementation Plan

> **For Claude:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract open questions and unresolved items from session transcripts during summarization and display them in journal/project entry cards.

**Architecture:** Extend the existing LLM summarization prompt to also return an `OPEN_QUESTIONS` field (JSON array of strings). Store in a new `open_questions` column on `journal_entries`. Render as a bullet list in the entry cards in both journal and projects views.

**Tech Stack:** Bun, SQLite (bun:sqlite), Claude Agent SDK (Haiku), HTMX

**Spec:** Approved in brainstorming — no separate design doc.

---

## File Structure

| File | Responsibility | Change |
|------|---------------|--------|
| `src/db.ts` | Database schema | Add `ALTER TABLE` migration for `open_questions` column |
| `src/summarize.ts` | Summarization pipeline | Update prompt, parser, result type, INSERT |
| `src/summarize.test.ts` | Summarize tests | Update parser test, add open_questions test |
| `src/web/views/journal.ts` | Journal entry cards | Add `open_questions` to type, query, rendering |
| `src/web/views/projects.ts` | Project timeline cards | Add `open_questions` to type, query, rendering |
| `src/web/views/layout.ts` | CSS styles | Add `.entry-questions` styles |

---

### Task 1: Add open_questions column to schema

**Files:**
- Modify: `src/db.ts`

SQLite doesn't support `ADD COLUMN IF NOT EXISTS`, so we use a try/catch around `ALTER TABLE`. This is a common pattern for SQLite migrations.

- [ ] **Step 1: Add the ALTER TABLE migration to initDb**

In `src/db.ts`, after the `CREATE INDEX` statements (after line 61, before closing the template literal and `_db = db`), add:

```typescript
  // Migrations
  try {
    db.exec(`ALTER TABLE journal_entries ADD COLUMN open_questions TEXT NOT NULL DEFAULT '[]'`);
  } catch {
    // Column already exists — ignore
  }
```

- [ ] **Step 2: Run existing tests to verify nothing breaks**

Run: `bun test`
Expected: All 48 tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/db.ts
git commit -m "feat: add open_questions column to journal_entries"
```

---

### Task 2: Update summarization pipeline

**Files:**
- Modify: `src/summarize.ts`
- Modify: `src/summarize.test.ts`

Update the LLM prompt to request `OPEN_QUESTIONS`, the parser to extract it, the result type to include it, and the INSERT to store it.

- [ ] **Step 1: Update the test for parseSummaryResponse**

In `src/summarize.test.ts`, update the existing `parseSummaryResponse` test (around line 55) to include OPEN_QUESTIONS in the test input and verify it's extracted. Also add a new test for when there are no open questions.

Replace the existing test at line 55-63 and add a new test after it:

```typescript
  test("parseSummaryResponse extracts headline, summary, topics, and open questions", () => {
    const response = `HEADLINE: Shipped onboarding flow and fixed auth bug
SUMMARY: Spent the morning building the onboarding wizard. After lunch, fixed a production OAuth token expiry issue caused by clock skew.
TOPICS: ["onboarding flow", "OAuth token bug", "production hotfix"]
OPEN_QUESTIONS: ["Need to add email verification step to onboarding", "Should we add rate limiting to the OAuth refresh endpoint?"]`;
    const result = parseSummaryResponse(response);
    expect(result.headline).toBe("Shipped onboarding flow and fixed auth bug");
    expect(result.summary).toContain("onboarding wizard");
    expect(result.topics).toEqual(["onboarding flow", "OAuth token bug", "production hotfix"]);
    expect(result.openQuestions).toEqual([
      "Need to add email verification step to onboarding",
      "Should we add rate limiting to the OAuth refresh endpoint?",
    ]);
  });

  test("parseSummaryResponse handles missing open questions", () => {
    const response = `HEADLINE: Quick fix
SUMMARY: Fixed a typo.
TOPICS: ["bugfix"]`;
    const result = parseSummaryResponse(response);
    expect(result.openQuestions).toEqual([]);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun test src/summarize.test.ts`
Expected: FAIL — `openQuestions` not in result type

- [ ] **Step 3: Update SummaryResult type**

In `src/summarize.ts`, update the `SummaryResult` type (line 223-227):

```typescript
type SummaryResult = {
  headline: string;
  summary: string;
  topics: string[];
  openQuestions: string[];
};
```

- [ ] **Step 4: Update parseSummaryResponse**

In `src/summarize.ts`, replace the `parseSummaryResponse` function (lines 230-254):

```typescript
/** Parse the LLM response into structured fields */
export function parseSummaryResponse(response: string): SummaryResult {
  const headlineMatch = response.match(
    /HEADLINE:\s*(.*?)(?:\n|$)/
  );
  const summaryMatch = response.match(
    /SUMMARY:\s*([\s\S]*?)(?=\nTOPICS:)/
  );
  const topicsSection = response.match(
    /TOPICS:\s*([\s\S]*?)(?=\nOPEN_QUESTIONS:|\s*$)/
  );
  const openQuestionsSection = response.match(
    /OPEN_QUESTIONS:\s*([\s\S]*?)$/
  );

  const headline = headlineMatch ? headlineMatch[1].trim() : "";
  const summary = summaryMatch ? summaryMatch[1].trim() : response.trim();

  let topics: string[] = [];
  if (topicsSection) {
    try {
      topics = JSON.parse(topicsSection[1].trim());
    } catch {
      topics = [];
    }
  }

  let openQuestions: string[] = [];
  if (openQuestionsSection) {
    try {
      openQuestions = JSON.parse(openQuestionsSection[1].trim());
    } catch {
      openQuestions = [];
    }
  }

  return { headline, summary, topics, openQuestions };
}
```

- [ ] **Step 5: Update buildSummaryPrompt**

In `src/summarize.ts`, update the `buildSummaryPrompt` function (lines 193-221). Add OPEN_QUESTIONS to the examples and the format spec.

In Example 1 (after the TOPICS line), add:
```
OPEN_QUESTIONS: ["Add email verification step to onboarding", "Monitor OAuth token refresh error rates after fix"]
```

In Example 2 (after the TOPICS line), add:
```
OPEN_QUESTIONS: ["Run load test on materialized view refresh under write-heavy workload"]
```

Update the format spec section (the "Format your response EXACTLY as:" block) to:
```
HEADLINE: <one line, what happened today on this project>
SUMMARY: <one paragraph, 2-5 sentences — wins, failures, and dropped threads>
TOPICS: <JSON array of 3-8 short topic phrases>
OPEN_QUESTIONS: <JSON array of 0-5 short phrases — unresolved issues, deferred decisions, dropped threads, open questions. Empty array [] if nothing was left unresolved.>
```

- [ ] **Step 6: Update summarizeGroup INSERT**

In `src/summarize.ts`, in the `summarizeGroup` function, update the INSERT statement (lines 299-318) to include `open_questions`:

```typescript
  db.prepare(
    `
    INSERT INTO journal_entries (date, project_id, session_ids, headline, summary, topics, open_questions, generated_at, model_used)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
    ON CONFLICT(date, project_id) DO UPDATE SET
      headline = excluded.headline,
      summary = excluded.summary,
      topics = excluded.topics,
      open_questions = excluded.open_questions,
      generated_at = excluded.generated_at,
      session_ids = excluded.session_ids
  `
  ).run(
    group.date,
    group.projectId,
    JSON.stringify(group.sessionIds),
    parsed.headline,
    parsed.summary,
    JSON.stringify(parsed.topics),
    JSON.stringify(parsed.openQuestions),
    SUMMARIZE_MODEL
  );
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `bun test src/summarize.test.ts`
Expected: All PASS

- [ ] **Step 8: Commit**

```bash
git add src/summarize.ts src/summarize.test.ts
git commit -m "feat: extract open questions during summarization"
```

---

### Task 3: Display open questions in views

**Files:**
- Modify: `src/web/views/layout.ts` (add CSS)
- Modify: `src/web/views/journal.ts` (add to entry cards)
- Modify: `src/web/views/projects.ts` (add to timeline cards)

- [ ] **Step 1: Add CSS for open questions**

In `src/web/views/layout.ts`, find the `.entry-stats` CSS rule block and add after it:

```css
    .entry-questions {
      margin-top: 6px;
      padding-left: 14px;
      font-size: 12px;
      color: var(--text-faint);
      line-height: 1.5;
    }
    .entry-questions li {
      margin-bottom: 2px;
      list-style-type: '→ ';
    }
```

- [ ] **Step 2: Add open_questions to journal entry cards**

In `src/web/views/journal.ts`:

First, add `open_questions: string;` to the `JournalEntryRow` type (after `session_ids: string;`).

Then update the SELECT query in `renderJournalEntries` to include `je.open_questions`:

```sql
SELECT je.id, je.date, je.project_id, p.display_name, je.headline, je.summary, je.topics, je.session_ids, je.open_questions
```

Then in the entry card rendering loop (inside `renderJournalEntries`), after the topics rendering block and before the stats line, add:

```typescript
    const openQuestions: string[] = JSON.parse(entry.open_questions || "[]");
    if (openQuestions.length > 0) {
      html += `<ul class="entry-questions">`;
      for (const q of openQuestions) {
        html += `<li>${escapeHtml(q)}</li>`;
      }
      html += `</ul>`;
    }
```

- [ ] **Step 3: Add open_questions to project timeline cards**

In `src/web/views/projects.ts`:

First, add `open_questions: string;` to the `ProjectEntryRow` type (after `session_ids: string;`).

Then update the SELECT query in `renderProjectTimeline` to include `je.open_questions`:

```sql
SELECT je.id, je.date, je.headline, je.summary, je.topics, je.session_ids, je.open_questions
```

Then in the entry card rendering loop (inside `renderProjectTimeline`), after the topics rendering block and before the stats line, add:

```typescript
        const openQuestions: string[] = JSON.parse(entry.open_questions || "[]");
        if (openQuestions.length > 0) {
          html += `<ul class="entry-questions">`;
          for (const q of openQuestions) {
            html += `<li>${escapeHtml(q)}</li>`;
          }
          html += `</ul>`;
        }
```

- [ ] **Step 4: Run all tests**

Run: `bun test`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/web/views/layout.ts src/web/views/journal.ts src/web/views/projects.ts
git commit -m "feat: display open questions in journal and project entry cards"
```

---

## Summary

| Task | What it does | Key files |
|------|-------------|-----------|
| 1 | Schema migration — add column | `db.ts` |
| 2 | Summarize pipeline — prompt, parser, storage | `summarize.ts`, `summarize.test.ts` |
| 3 | Display — CSS + journal + projects views | `layout.ts`, `journal.ts`, `projects.ts` |

**Dependency order:** Task 1 must come first (column must exist). Task 2 depends on Task 1. Task 3 depends on Task 1 (needs column in queries) but not on Task 2.
