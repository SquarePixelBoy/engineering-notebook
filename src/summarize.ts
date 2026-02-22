import { Database } from "bun:sqlite";

const SUMMARIZE_MODEL = "claude-sonnet-4-5-20250514";

export type SessionGroup = {
  date: string;
  projectId: string;
  projectName: string;
  sessionIds: string[];
  conversations: string[];
};

type ConvoRow = {
  session_id: string;
  date: string;
  project_id: string;
  display_name: string;
  conversation_markdown: string;
};

/** Group unsummarized sessions by date and project */
export function groupSessionsByDateAndProject(
  db: Database,
  filterDate?: string,
  filterProject?: string
): SessionGroup[] {
  let whereClause = `
    WHERE NOT EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.date = date(s.started_at)
        AND je.project_id = s.project_id
    )
  `;
  const params: string[] = [];
  if (filterDate) {
    whereClause += " AND date(s.started_at) = ?";
    params.push(filterDate);
  }
  if (filterProject) {
    whereClause += " AND s.project_id = ?";
    params.push(filterProject);
  }

  const rows = db
    .query(
      `
      SELECT
        c.session_id,
        date(s.started_at) as date,
        s.project_id,
        p.display_name,
        c.conversation_markdown
      FROM conversations c
      JOIN sessions s ON c.session_id = s.id
      JOIN projects p ON s.project_id = p.id
      ${whereClause}
      ORDER BY s.started_at
    `
    )
    .all(...params) as ConvoRow[];

  // Group by date+project
  const groups = new Map<string, SessionGroup>();
  for (const row of rows) {
    const key = `${row.date}|${row.project_id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        date: row.date,
        projectId: row.project_id,
        projectName: row.display_name,
        sessionIds: [],
        conversations: [],
      });
    }
    const group = groups.get(key)!;
    group.sessionIds.push(row.session_id);
    group.conversations.push(row.conversation_markdown);
  }

  return Array.from(groups.values());
}

/** Build the prompt for LLM summarization */
export function buildSummaryPrompt(group: SessionGroup): string {
  const conversationText = group.conversations.join("\n\n---\n\n");
  return `You are writing an engineering journal entry for ${group.date}, project "${group.projectName}".

Given the following conversation transcripts from coding sessions, write a concise narrative covering:
- What the developer was working on
- What approaches they tried
- What problems they encountered
- What they shipped or resolved
- Any notable technical decisions

Write in first person from the developer's perspective. Keep it concise — 2-4 paragraphs.

Also extract:
1. A JSON array of topic tags (3-8 short phrases like "auth bug", "websocket refactor", "test coverage")
2. A JSON array of any git commits mentioned (empty array if none)

Format your response as:

SUMMARY:
<your narrative here>

TOPICS:
<JSON array of topic strings>

COMMITS:
<JSON array of commit descriptions>

Here are the session transcripts:

${conversationText}`;
}

type SummaryResult = {
  summary: string;
  topics: string[];
  commits: string[];
};

/** Parse the LLM response into structured fields */
export function parseSummaryResponse(response: string): SummaryResult {
  const summaryMatch = response.match(
    /SUMMARY:\s*\n([\s\S]*?)(?=\nTOPICS:)/
  );
  const topicsSection = response.match(
    /TOPICS:\s*\n([\s\S]*?)(?=\nCOMMITS:|$)/
  );
  const commitsSection = response.match(
    /COMMITS:\s*\n([\s\S]*?)$/
  );

  const summary = summaryMatch ? summaryMatch[1].trim() : response.trim();

  let topics: string[] = [];
  if (topicsSection) {
    try {
      topics = JSON.parse(topicsSection[1].trim());
    } catch {
      topics = [];
    }
  }

  let commits: string[] = [];
  if (commitsSection) {
    try {
      commits = JSON.parse(commitsSection[1].trim());
    } catch {
      commits = [];
    }
  }

  return { summary, topics, commits };
}

/** Run LLM summarization using Claude Agent SDK */
export async function summarizeGroup(
  group: SessionGroup,
  db: Database
): Promise<void> {
  const { query } = await import("@anthropic-ai/claude-agent-sdk");
  const prompt = buildSummaryPrompt(group);

  let responseText = "";

  const result = query({
    prompt,
    options: {
      model: SUMMARIZE_MODEL,
      maxTurns: 1,
      tools: [],
      permissionMode: "default",
    },
  });

  for await (const message of result) {
    if (message.type === "assistant") {
      const content = message.message.content;
      for (const block of content) {
        if ("text" in block && typeof block.text === "string") {
          responseText += block.text;
        }
      }
    }
  }

  if (!responseText.trim()) {
    throw new Error("Empty response from LLM");
  }

  const parsed = parseSummaryResponse(responseText);

  db.prepare(
    `
    INSERT INTO journal_entries (date, project_id, session_ids, summary, topics, commits, generated_at, model_used)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
    ON CONFLICT(date, project_id) DO UPDATE SET
      summary = excluded.summary,
      topics = excluded.topics,
      commits = excluded.commits,
      generated_at = excluded.generated_at,
      session_ids = excluded.session_ids
  `
  ).run(
    group.date,
    group.projectId,
    JSON.stringify(group.sessionIds),
    parsed.summary,
    JSON.stringify(parsed.topics),
    JSON.stringify(parsed.commits),
    SUMMARIZE_MODEL
  );
}

/** Summarize all unsummarized groups */
export async function summarizeAll(
  db: Database,
  filterDate?: string,
  filterProject?: string,
  onProgress?: (done: number, total: number, group: SessionGroup) => void
): Promise<{ summarized: number; errors: string[] }> {
  const groups = groupSessionsByDateAndProject(db, filterDate, filterProject);
  let summarized = 0;
  const errors: string[] = [];

  for (const group of groups) {
    try {
      onProgress?.(summarized, groups.length, group);
      await summarizeGroup(group, db);
      summarized++;
    } catch (err) {
      errors.push(`${group.date}/${group.projectId}: ${err}`);
    }
  }

  return { summarized, errors };
}
