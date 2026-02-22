import { describe, test, expect } from "bun:test";
import { parseSession, type ParsedSession } from "./parser";
import { join } from "path";

const fixturePath = join(import.meta.dir, "../tests/fixtures/sample-session.jsonl");

describe("parseSession", () => {
  test("extracts session metadata", () => {
    const session = parseSession(fixturePath);
    expect(session.sessionId).toBe("test-session-1");
    expect(session.projectPath).toBe("/Users/jesse/projects/myapp");
    expect(session.gitBranch).toBe("main");
    expect(session.version).toBe("2.1.25");
    expect(session.startedAt).toBeTruthy();
    expect(session.endedAt).toBeTruthy();
  });

  test("extracts only user text and assistant text messages", () => {
    const session = parseSession(fixturePath);
    // Should have: "Fix the login bug", "I'll investigate...", "Found the bug...", "Great, fix it please", "Fixed the comparison..."
    // Should NOT have: thinking blocks, tool_use blocks, tool_result blocks, progress, system
    expect(session.messages.length).toBe(5);
  });

  test("skips tool_result user messages", () => {
    const session = parseSession(fixturePath);
    const userMessages = session.messages.filter((m) => m.role === "user");
    expect(userMessages.length).toBe(2);
    expect(userMessages[0].text).toBe("Fix the login bug");
    expect(userMessages[1].text).toBe("Great, fix it please");
  });

  test("skips thinking blocks from assistant", () => {
    const session = parseSession(fixturePath);
    const assistantMessages = session.messages.filter((m) => m.role === "assistant");
    for (const msg of assistantMessages) {
      expect(msg.text).not.toContain("Let me look at");
    }
  });

  test("skips assistant messages with only tool_use or thinking", () => {
    const session = parseSession(fixturePath);
    const assistantMessages = session.messages.filter((m) => m.role === "assistant");
    expect(assistantMessages.length).toBe(3);
  });

  test("generates conversation markdown", () => {
    const session = parseSession(fixturePath);
    const md = session.toMarkdown();
    expect(md).toContain("# Session: myapp");
    expect(md).toContain("**User (17:37):** Fix the login bug");
    expect(md).toContain("**Claude (17:37):** I'll investigate the login flow.");
    expect(md).toContain("**Claude (17:38):** Found the bug.");
    expect(md).toContain("**User (17:39):** Great, fix it please");
    expect(md).not.toContain("thinking");
    expect(md).not.toContain("tool_use");
    expect(md).not.toContain("tool_result");
  });

  test("counts messages correctly", () => {
    const session = parseSession(fixturePath);
    expect(session.messageCount).toBe(5);
  });
});
