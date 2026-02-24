import { describe, test, expect } from "bun:test";
import { cacheDir, buildRsyncCommand } from "./sync";
import { homedir } from "os";
import { join } from "path";

describe("sync", () => {
  describe("cacheDir", () => {
    const base = join(homedir(), ".config", "engineering-notebook", "remotes");

    test("sanitizes name to safe directory", () => {
      expect(cacheDir("Work MacBook")).toBe(join(base, "work-macbook"));
    });

    test("handles spaces and special characters", () => {
      expect(cacheDir("My Remote!@#Server")).toBe(
        join(base, "my-remote-server")
      );
    });

    test("collapses multiple dashes", () => {
      expect(cacheDir("a---b")).toBe(join(base, "a-b"));
    });

    test("strips leading and trailing dashes", () => {
      expect(cacheDir("--name--")).toBe(join(base, "name"));
    });

    test("falls back to 'unnamed' for empty result", () => {
      expect(cacheDir("!!!")).toBe(join(base, "unnamed"));
    });
  });

  describe("buildRsyncCommand", () => {
    test("produces correct rsync invocation", () => {
      const source = {
        name: "Test",
        host: "jesse@macbook.local",
        path: "~/.claude/projects",
        enabled: true,
      };
      const cmd = buildRsyncCommand(source, "/tmp/cache");
      expect(cmd).toEqual([
        "rsync",
        "-az",
        "--delete",
        "-e",
        "ssh -o BatchMode=yes -o ConnectTimeout=10",
        "jesse@macbook.local:~/.claude/projects/",
        "/tmp/cache/",
      ]);
    });

    test("uses BatchMode and ConnectTimeout", () => {
      const source = {
        name: "X",
        host: "user@host",
        path: "/data",
        enabled: true,
      };
      const cmd = buildRsyncCommand(source, "/dest");
      const sshFlag = cmd[cmd.indexOf("-e") + 1];
      expect(sshFlag).toContain("BatchMode=yes");
      expect(sshFlag).toContain("ConnectTimeout=10");
    });
  });
});
