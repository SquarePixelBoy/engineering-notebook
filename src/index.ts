const command = process.argv[2];

switch (command) {
  case "ingest":
    console.log("TODO: ingest");
    break;
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
