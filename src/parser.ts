import { readFileSync } from "fs";

export type MessageRole = "user" | "assistant";

export type ParsedMessage = {
  role: MessageRole;
  text: string;
  timestamp: string;
};

export type ParsedSession = {
  sessionId: string;
  projectPath: string;
  projectName: string;
  gitBranch: string | null;
  version: string | null;
  startedAt: string;
  endedAt: string | null;
  messages: ParsedMessage[];
  messageCount: number;
  toMarkdown: () => string;
};

type RawRecord = {
  type: string;
  subtype?: string;
  sessionId?: string;
  cwd?: string;
  version?: string;
  gitBranch?: string;
  message?: {
    role: string;
    content: string | ContentBlock[];
  };
  timestamp?: string;
  uuid?: string;
};

type ContentBlock = {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  tool_use_id?: string;
  [key: string]: unknown;
};

function projectNameFromPath(projectPath: string): string {
  const parts = projectPath.split("/").filter(Boolean);
  return parts[parts.length - 1] || "unknown";
}

/** Format a UTC ISO timestamp to HH:MM using UTC hours/minutes */
function formatTime(timestamp: string): string {
  // Use UTC slice to avoid locale/timezone issues
  return timestamp.slice(11, 16);
}

function formatDate(timestamp: string): string {
  return timestamp.slice(0, 10);
}

function extractUserText(content: string | ContentBlock[]): string | null {
  if (typeof content === "string") {
    return content;
  }
  // Skip messages that contain tool_result blocks
  const hasToolResult = content.some((b) => b.type === "tool_result");
  if (hasToolResult) {
    return null;
  }
  const texts = content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text!);
  return texts.length > 0 ? texts.join("\n") : null;
}

function extractAssistantText(content: string | ContentBlock[]): string | null {
  if (typeof content === "string") {
    return content === "(no content)" ? null : content;
  }
  // Only extract text blocks — skip thinking, tool_use, and everything else
  const texts = content
    .filter((b) => b.type === "text" && b.text && b.text !== "(no content)")
    .map((b) => b.text!);
  return texts.length > 0 ? texts.join("\n") : null;
}

export function parseSession(filePath: string): ParsedSession {
  const raw = readFileSync(filePath, "utf-8");
  const lines = raw.trim().split("\n").filter(Boolean);

  let sessionId = "";
  let projectPath = "";
  let gitBranch: string | null = null;
  let version: string | null = null;
  let firstTimestamp: string | null = null;
  let lastTimestamp: string | null = null;
  const messages: ParsedMessage[] = [];

  for (const line of lines) {
    let record: RawRecord;
    try {
      record = JSON.parse(line);
    } catch {
      continue; // skip malformed lines
    }

    // Track timestamps for session duration
    if (record.timestamp) {
      if (!firstTimestamp) firstTimestamp = record.timestamp;
      lastTimestamp = record.timestamp;
    }

    // Extract metadata from first available record
    if (record.sessionId && !sessionId) sessionId = record.sessionId;
    if (record.cwd && !projectPath) projectPath = record.cwd;
    if (record.gitBranch && !gitBranch) gitBranch = record.gitBranch;
    if (record.version && !version) version = record.version;

    // Only process user and assistant message records
    if (record.type !== "user" && record.type !== "assistant") continue;
    if (!record.message) continue;

    const timestamp = record.timestamp || "";

    if (record.type === "user") {
      const text = extractUserText(record.message.content);
      if (text) {
        messages.push({ role: "user", text, timestamp });
      }
    } else if (record.type === "assistant") {
      const text = extractAssistantText(record.message.content);
      if (text) {
        messages.push({ role: "assistant", text, timestamp });
      }
    }
  }

  const projectName = projectNameFromPath(projectPath);

  return {
    sessionId,
    projectPath,
    projectName,
    gitBranch,
    version,
    startedAt: firstTimestamp || "",
    endedAt: lastTimestamp || null,
    messages,
    messageCount: messages.length,
    toMarkdown() {
      const startTime = firstTimestamp ? formatTime(firstTimestamp) : "??:??";
      const endTime = lastTimestamp ? formatTime(lastTimestamp) : "??:??";
      const date = firstTimestamp ? formatDate(firstTimestamp) : "unknown";

      let md = `# Session: ${projectName}\n`;
      md += `**Date:** ${date} ${startTime} - ${endTime}`;
      if (gitBranch) md += ` | **Branch:** ${gitBranch}`;
      md += ` | **Project:** ${projectPath}\n\n---\n\n`;

      for (const msg of messages) {
        const time = formatTime(msg.timestamp);
        const speaker = msg.role === "user" ? "User" : "Claude";
        const firstLine = msg.text.split("\n")[0];
        const truncated = msg.text.includes("\n")
          ? firstLine + " [...]"
          : firstLine;
        md += `**${speaker} (${time}):** ${truncated}\n`;
      }

      return md;
    },
  };
}
