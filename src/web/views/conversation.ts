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
