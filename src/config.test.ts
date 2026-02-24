import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { loadConfig, saveConfig, defaultConfig, type Config } from "./config";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("config", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "notebook-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("defaultConfig has expected shape", () => {
    const config = defaultConfig();
    expect(config.sources).toEqual(["~/.claude/projects"]);
    expect(config.exclude).toContain("-private-tmp*");
    expect(config.port).toBe(3000);
    expect(config.db_path).toContain("notebook.db");
  });

  test("loadConfig returns default when no file exists", () => {
    const config = loadConfig(join(tempDir, "nonexistent.json"));
    expect(config.sources).toEqual(["~/.claude/projects"]);
  });

  test("saveConfig writes and loadConfig reads back", () => {
    const configPath = join(tempDir, "config.json");
    const config: Config = {
      sources: ["/custom/path"],
      exclude: ["test-*"],
      db_path: join(tempDir, "test.db"),
      port: 4000,
      day_start_hour: 5,
      summary_instructions: "",
      remote_sources: [],
      auto_sync_interval: 60,
    };
    saveConfig(configPath, config);
    const loaded = loadConfig(configPath);
    expect(loaded).toEqual(config);
  });
});
