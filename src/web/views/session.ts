import { Database } from "bun:sqlite";
import { renderConversation } from "./conversation";

type SessionRow = {
  id: string;
  project_id: string;
  project_path: string;
  source_path: string;
  started_at: string;
  ended_at: string | null;
  git_branch: string | null;
  version: string | null;
  message_count: number;
  display_name: string;
  conversation_markdown: string;
};

export function renderSession(db: Database, sessionId: string): string {
  const session = db
    .query(
      `
    SELECT s.*, p.display_name, c.conversation_markdown
    FROM sessions s
    JOIN projects p ON s.project_id = p.id
    JOIN conversations c ON c.session_id = s.id
    WHERE s.id = ?
  `
    )
    .get(sessionId) as SessionRow | null;

  if (!session) {
    return `<h2>Session not found</h2>`;
  }

  let html = `<h2>${escapeHtml(session.display_name)} — Session</h2>`;
  html += `<div class="stat" style="margin-bottom: 1rem;">`;
  html += `${session.started_at.split("T")[0]} | ${session.message_count} messages`;
  if (session.git_branch) html += ` | branch: ${escapeHtml(session.git_branch)}`;
  html += `<br>Source: <code>${escapeHtml(session.source_path)}</code>`;
  html += `</div>`;

  html += renderConversation(session.conversation_markdown);

  return html;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
