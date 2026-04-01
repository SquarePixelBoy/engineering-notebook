import { escapeHtml, formatTimeAmPm } from "./helpers";

function buildMessageRegex(userDisplayName: string, assistantDisplayName: string): RegExp {
  const names = new Set(['User', 'Human', 'Claude', 'Codex', 'Assistant', userDisplayName, assistantDisplayName]);
  const escaped = [...names].filter(Boolean).map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = `^\\*\\*(${escaped.join('|')})\\s*\\((?:\\d{4}-\\d{2}-\\d{2}\\s+)?(\\d{2}:\\d{2})\\):\\*\\*\\s*(.+)$`;
  return new RegExp(pattern);
}

export function inferUserDisplayName(projectPath: string | null | undefined): string {
  if (!projectPath) return "User";

  const unixHomeMatch = projectPath.match(/^\/(?:Users|home)\/([^/]+)/);
  if (unixHomeMatch?.[1]) return unixHomeMatch[1];

  const windowsHomeMatch = projectPath.match(/^[A-Za-z]:\\Users\\([^\\]+)/);
  if (windowsHomeMatch?.[1]) return windowsHomeMatch[1];

  return "User";
}

export function inferAssistantDisplayName(sourcePath: string | null | undefined): string {
  if (!sourcePath) return "Claude";
  const normalized = sourcePath.replace(/\\/g, "/").toLowerCase();
  return normalized.includes("/.codex/") ? "Codex" : "Claude";
}

function isAssistantSpeaker(speaker: string): boolean {
  const normalized = speaker.trim().toLowerCase();
  return normalized === "claude" || normalized === "assistant" || normalized === "codex";
}

const SYSTEM_NOISE_PATTERNS = [
  /^<system-reminder>/,
  /^<task-notification>/,
  /^<local-command-caveat>/,
  /^<local-command-stdout>/,
  /^<command-name>/,
  /^<command-message>/,
];

function isSystemNoise(body: string): boolean {
  const trimmed = body.trim();
  return SYSTEM_NOISE_PATTERNS.some(p => p.test(trimmed));
}

function hasSystemNoise(body: string): boolean {
  return /<system-reminder>|<task-notification>|<local-command-caveat>|<local-command-stdout>|<command-name>|<command-message>/.test(body);
}

function stripSystemNoise(body: string): string {
  return body
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/<task-notification>[\s\S]*?<\/task-notification>/g, "")
    .replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, "")
    .replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g, "")
    .replace(/<command-name>[\s\S]*?<\/command-name>/g, "")
    .replace(/<command-message>[\s\S]*?<\/command-message>/g, "")
    .replace(/<command-args>[\s\S]*?<\/command-args>/g, "")
    .trim();
}

type ParsedMessage = {
  speaker: string;
  displayName: string;
  time: string;
  body: string;
  role: "user" | "claude";
};

function parseMessages(
  markdown: string,
  userDisplayName: string,
  assistantDisplayName: string
): ParsedMessage[] {
  const messageRegex = buildMessageRegex(userDisplayName, assistantDisplayName);
  const lines = markdown.split("\n");
  const messages: ParsedMessage[] = [];
  let current: ParsedMessage | null = null;

  for (const line of lines) {
    const match = line.match(messageRegex);
    if (match) {
      if (current) messages.push(current);
      const speaker = match[1]!.trim();
      const role: "user" | "claude" = isAssistantSpeaker(speaker) ? "claude" : "user";
      const displayName =
        speaker === "User" || speaker === "Human" ? userDisplayName :
        isAssistantSpeaker(speaker) ? assistantDisplayName : speaker;
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

export function renderConversation(
  markdown: string,
  userDisplayName = "User",
  assistantDisplayName = "Claude"
): string {
  if (!markdown || markdown.trim() === "") {
    return '<div class="empty-state">No conversation data.</div>';
  }

  const allMessages = parseMessages(markdown, userDisplayName, assistantDisplayName);
  if (allMessages.length === 0) {
    return `<div class="transcript"><pre style="white-space: pre-wrap; font-size: 13px;">${escapeHtml(markdown)}</pre></div>`;
  }

  // For clean view: filter out pure system noise before merging
  // so consecutive Claude messages aren't split by noise
  const cleanMessages = allMessages.filter(msg => !(msg.role === "user" && isSystemNoise(msg.body)));
  const merged = mergeConsecutive(cleanMessages);

  // For raw view: merge all messages including system noise
  const mergedRaw = mergeConsecutive(allMessages);
  // Helper to render a list of messages
  function renderMessages(msgList: ParsedMessage[], extraClass: string, rawMode = false): string {
    let out = '';
    let prev: string | null = null;
    for (const msg of msgList) {
      const speakerChange = prev !== null && prev !== msg.role;
      const bodyClass = msg.role === "user" ? "msg-body-user" : "msg-body-claude";
      const timeAmPm = formatTimeAmPm(msg.time);

      const mixedSystem = !rawMode && hasSystemNoise(msg.body);
      const body = mixedSystem ? stripSystemNoise(msg.body) : msg.body;

      const escaped = escapeHtml(body);
      const formatted = escaped
        .replace(/\n\n/g, "<br><br>")
        .replace(/\n/g, " ");

      const firstBreak = formatted.indexOf("<br><br>");
      let withTime: string;
      if (firstBreak === -1) {
        withTime = `${formatted} <span class="msg-time">${timeAmPm}</span>`;
      } else {
        withTime = formatted.slice(0, firstBreak) +
          ` <span class="msg-time">${timeAmPm}</span>` +
          formatted.slice(firstBreak);
      }

      const isLong = (formatted.match(/<br><br>/g) || []).length > 8;
      const collapseClass = isLong ? ' msg-collapsible msg-collapsed' : '';
      const expandBtn = isLong ? '<button class="msg-expand" onclick="toggleMsg(this)">Show more</button>' : '';

      const isNoise = msg.role === "user" && isSystemNoise(msg.body);
      const noiseClass = isNoise ? ' msg-system' : '';
      const label = isNoise ? 'system' : msg.displayName;

      out += `<div class="msg msg-${msg.role}${noiseClass}${extraClass}${speakerChange ? " msg-speaker-change" : ""}">`;
      out += `<div class="msg-label">${escapeHtml(label)}</div>`;
      out += `<div class="${bodyClass}${collapseClass}">${withTime}</div>`;
      out += expandBtn;
      out += `</div>`;
      prev = msg.role;
    }
    return out;
  }

  let html = '<div class="transcript">';
  // Clean view (default): system noise filtered, consecutive Claude merged
  html += renderMessages(merged, ' msg-clean');
  // Raw view (Alt+R): all messages including system noise
  html += renderMessages(mergedRaw, ' msg-raw', true);
  html += '</div>';
  return html;
}
