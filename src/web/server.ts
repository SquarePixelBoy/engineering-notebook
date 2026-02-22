import { Hono } from "hono";
import { Database } from "bun:sqlite";
import { renderLayout } from "./views/layout";
import { renderJournal } from "./views/journal";
import { renderProjects } from "./views/projects";
import { renderSearch, renderSearchResults } from "./views/search";
import { renderSession } from "./views/session";
import { renderConversation } from "./views/conversation";

export function createApp(db: Database): Hono {
  const app = new Hono();

  // Daily Journal
  app.get("/", (c) => {
    const page = parseInt(c.req.query("page") || "1");
    return c.html(renderLayout("Engineering Notebook", renderJournal(db, page)));
  });

  // Projects index
  app.get("/projects", (c) => {
    return c.html(renderLayout("Projects", renderProjects(db)));
  });

  // Project timeline
  app.get("/project/:id", (c) => {
    const projectId = c.req.param("id");
    const page = parseInt(c.req.query("page") || "1");
    return c.html(
      renderLayout(
        `Project: ${projectId}`,
        renderJournal(db, page, projectId)
      )
    );
  });

  // Search
  app.get("/search", (c) => {
    const q = c.req.query("q") || "";
    if (c.req.header("HX-Request")) {
      return c.html(renderSearchResults(db, q));
    }
    return c.html(renderLayout("Search", renderSearch(db, q)));
  });

  // Session detail
  app.get("/session/:id", (c) => {
    const sessionId = c.req.param("id");
    return c.html(renderLayout("Session", renderSession(db, sessionId)));
  });

  // API: get conversations for HTMX expand
  app.get("/api/conversations", (c) => {
    const sessionIdsRaw = c.req.query("session_ids");
    if (!sessionIdsRaw) return c.text("Missing session_ids", 400);

    let sessionIds: string[];
    try {
      sessionIds = JSON.parse(decodeURIComponent(sessionIdsRaw));
    } catch {
      return c.text("Invalid session_ids", 400);
    }

    const placeholders = sessionIds.map(() => "?").join(",");
    const convos = db
      .query(
        `SELECT session_id, conversation_markdown FROM conversations WHERE session_id IN (${placeholders}) ORDER BY session_id`
      )
      .all(...sessionIds) as { session_id: string; conversation_markdown: string }[];

    let html = "";
    for (const convo of convos) {
      html += renderConversation(convo.conversation_markdown);
    }

    return c.html(html);
  });

  return app;
}
