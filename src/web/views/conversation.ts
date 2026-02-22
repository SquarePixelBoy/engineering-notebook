/**
 * Shared module for rendering conversation markdown into styled chat messages.
 *
 * The stored conversation format looks like:
 *   **User (17:37):** Fix the login bug [...]
 *   **Claude (17:37):** Let me investigate this...
 *
 * This module parses those lines and renders them as visually distinct message blocks.
 */

const MESSAGE_REGEX =
  /^\*\*(User|Claude|Jesse|Assistant|Human)\s*\((\d{2}:\d{2})\):\*\*\s*(.+)$/;

type ParsedMessage = {
  speaker: string;
  time: string;
  body: string;
  role: "user" | "claude";
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseMessages(markdown: string): ParsedMessage[] {
  const lines = markdown.split("\n");
  const messages: ParsedMessage[] = [];
  let current: ParsedMessage | null = null;

  for (const line of lines) {
    const match = line.match(MESSAGE_REGEX);
    if (match) {
      // Start of a new message -- push any accumulated message first
      if (current) {
        messages.push(current);
      }
      const speaker = match[1]!;
      const role: "user" | "claude" =
        speaker === "Claude" || speaker === "Assistant" ? "claude" : "user";
      current = {
        speaker,
        time: match[2]!,
        body: match[3]!,
        role,
      };
    } else if (current) {
      // Continuation line for the current message
      if (line.trim() === "") {
        current.body += "\n";
      } else {
        current.body += "\n" + line;
      }
    }
    // Lines before the first message header are ignored
  }

  // Don't forget the last message
  if (current) {
    messages.push(current);
  }

  return messages;
}

export function renderConversation(markdown: string): string {
  if (!markdown || markdown.trim() === "") {
    return '<div class="conversation"><p class="stat">No conversation data.</p></div>';
  }

  const messages = parseMessages(markdown);

  if (messages.length === 0) {
    // Fallback: if parsing found no structured messages, render escaped raw text
    return `<div class="conversation"><pre style="white-space: pre-wrap; font-size: 0.85rem;">${escapeHtml(markdown)}</pre></div>`;
  }

  let html = '<div class="conversation">';

  for (const msg of messages) {
    const cssClass = msg.role === "user" ? "msg-user" : "msg-claude";
    const displayName =
      msg.speaker === "User" || msg.speaker === "Human"
        ? "Jesse"
        : msg.speaker === "Assistant"
          ? "Claude"
          : msg.speaker;

    html += `<div class="msg ${cssClass}">`;
    html += `<div class="msg-header">`;
    html += `<span class="msg-speaker">${escapeHtml(displayName)}</span>`;
    html += `<span class="msg-time">${escapeHtml(msg.time)}</span>`;
    html += `</div>`;

    // Escape the body text but convert newlines to <br> for readability
    const escapedBody = escapeHtml(msg.body.trim());
    const formattedBody = escapedBody.replace(/\n/g, "<br>");
    html += `<div class="msg-body">${formattedBody}</div>`;

    html += `</div>`;
  }

  html += "</div>";
  return html;
}
