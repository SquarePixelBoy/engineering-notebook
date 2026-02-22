import { loadConfig, expandPath } from "./config";
import { initDb, closeDb } from "./db";
import { scanSources, ingestSessions } from "./ingest";

const command = process.argv[2];

switch (command) {
  case "ingest": {
    const config = loadConfig();
    const db = initDb(config.db_path);

    const force = process.argv.includes("--force");

    // Collect sources: config + any --source args
    const sources = config.sources.map(expandPath);
    const sourceIdx = process.argv.indexOf("--source");
    if (sourceIdx !== -1 && process.argv[sourceIdx + 1]) {
      sources.push(expandPath(process.argv[sourceIdx + 1]));
    }

    console.log(`Scanning ${sources.length} source(s)...`);
    const files = scanSources(sources, config.exclude);
    console.log(`Found ${files.length} session file(s)`);

    const result = ingestSessions(files, db, force);
    console.log(
      `Ingested: ${result.ingested}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`
    );
    if (result.errors.length > 0) {
      for (const err of result.errors.slice(0, 10)) {
        console.error(`  ${err}`);
      }
    }
    closeDb();
    break;
  }
  case "summarize":
    console.log("TODO: summarize");
    break;
  case "serve":
    console.log("TODO: serve");
    break;
  case "config":
    console.log("TODO: config");
    break;
  default:
    console.log("Usage: notebook <ingest|summarize|serve|config>");
    process.exit(1);
}
