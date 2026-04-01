import { escapeHtml } from "./helpers";

type ThreePanelContent = {
  activeTab: "journal" | "projects" | "calendar";
  panel1: string;
  panel2: string;
  panel3: string;
};

type SingleContent = {
  body: string;
  activeTab?: "calendar";
};

type FullWidthContent = {
  fullBody: string;
  activeTab: "calendar";
};

type LayoutContent = ThreePanelContent | SingleContent | FullWidthContent;

function isThreePanel(c: LayoutContent): c is ThreePanelContent {
  return "panel1" in c;
}

function isFullWidth(c: LayoutContent): c is FullWidthContent {
  return "fullBody" in c;
}

export function renderLayout(title: string, content: LayoutContent): string {
  const activeTab = isThreePanel(content) ? content.activeTab
    : isFullWidth(content) ? content.activeTab
    : (content as SingleContent).activeTab;
  const journalActive = activeTab === "journal";
  const projectsActive = activeTab === "projects";
  const calendarActive = activeTab === "calendar";

  let bodyHtml: string;
  if (isThreePanel(content)) {
    bodyHtml = `
      <div class="panels">
        <div class="panel panel-index" id="panel-index">${content.panel1}</div>
        <div class="panel panel-entries" id="panel-entries">${content.panel2}</div>
        <div class="panel panel-detail" id="panel-detail">${content.panel3}</div>
      </div>`;
  } else if (isFullWidth(content)) {
    bodyHtml = `<div class="full-content">${content.fullBody}</div>`;
  } else {
    bodyHtml = `<div class="single-content">${content.body}</div>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <script src="https://unpkg.com/htmx.org@2.0.4"></script>
  <style>
    :root {
      --bg: #fafaf9;
      --surface: #f5f5f4;
      --border: #e7e5e4;
      --border-subtle: #f5f5f4;
      --text: #1c1917;
      --text-secondary: #292524;
      --text-muted: #57534e;
      --text-faint: #78716c;
      --text-ghost: #a8a29e;
      --msg-user-color: #292524;
      --msg-claude-color: #57534e;
      --headline-color: #1c1917;
      --font-serif: Georgia, 'Times New Roman', serif;
      --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    }
    [data-theme="cursor"] {
      --bg: #181818;
      --surface: #252525;
      --border: #2B2B2B;
      --border-subtle: #252525;
      --text: #CCCCCC;
      --text-secondary: #CCCCCC;
      --text-muted: #9D9D9D;
      --text-faint: #868686;
      --text-ghost: #616161;
      --msg-user-color: #B8B8B8;
      --msg-claude-color: #BABABA;
      --headline-color: #B8B8B8;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: var(--bg); }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--text-ghost); }
    html, body { height: 100%; overflow: hidden; }
    body {
      font-family: var(--font-sans);
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      display: flex;
      flex-direction: column;
    }

    /* Top bar */
    .top-bar {
      display: flex;
      align-items: center;
      padding: 0 20px;
      border-bottom: 1px solid var(--border);
      background: var(--bg);
      flex-shrink: 0;
      height: 44px;
    }
    .top-bar .logo {
      font-weight: 700;
      font-size: 15px;
      color: var(--text);
      font-family: var(--font-serif);
      margin-right: 32px;
      text-decoration: none;
    }
    .top-bar nav { display: flex; gap: 0; height: 100%; }
    .top-bar nav a {
      font-size: 13px;
      color: var(--text-faint);
      text-decoration: none;
      padding: 0 16px;
      display: flex;
      align-items: center;
      height: 100%;
      border-bottom: 2px solid transparent;
    }
    .top-bar nav a:hover { color: var(--text-muted); }
    .top-bar nav a.active {
      font-weight: 600;
      color: var(--text);
      border-bottom-color: var(--text);
    }
    .top-bar .spacer { flex: 1; }
    .top-bar .search-field {
      background: var(--surface);
      border: none;
      border-radius: 5px;
      padding: 6px 12px;
      font-size: 12px;
      color: var(--text);
      width: 180px;
      font-family: var(--font-sans);
    }
    .top-bar .search-field::placeholder { color: var(--text-ghost); }
    .top-bar .search-field:focus { outline: 1px solid var(--border); }
    .top-bar .settings-link {
      width: 28px;
      height: 28px;
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-ghost);
      text-decoration: none;
      font-size: 16px;
      margin-left: 8px;
    }
    .top-bar .settings-link:hover { color: var(--text-muted); background: var(--surface); }
    .top-bar .theme-toggle {
      width: 28px;
      height: 28px;
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-ghost);
      background: none;
      border: none;
      font-size: 16px;
      margin-left: 8px;
      cursor: pointer;
      font-family: var(--font-sans);
    }
    .top-bar .theme-toggle:hover { color: var(--text-muted); background: var(--surface); }

    /* Three-panel layout */
    .panels {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    .panel { overflow-y: auto; }
    .panel-index {
      width: 200px;
      background: var(--bg);
      border-right: 1px solid var(--border);
      flex-shrink: 0;
      padding: 12px 0;
    }
    .panel-entries {
      width: 400px;
      border-right: 1px solid var(--border);
      flex-shrink: 0;
      padding: 20px;
    }
    .panel-detail {
      flex: 1;
      padding: 20px 24px;
      position: relative;
    }
    .panel-dismiss {
      position: absolute;
      top: 12px;
      right: 16px;
      font-size: 18px;
      color: var(--text-ghost);
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      line-height: 1;
    }
    .panel-dismiss:hover {
      color: var(--text-muted);
      background: var(--surface);
    }

    /* Single content (search, settings) */
    .single-content {
      flex: 1;
      max-width: 720px;
      margin: 0 auto;
      padding: 32px 24px;
      overflow-y: auto;
    }

    /* Index panel items */
    .index-section-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-ghost);
      padding: 8px 14px 4px;
    }
    .index-item {
      padding: 8px 14px;
      margin: 0 6px 2px;
      border-radius: 5px;
      cursor: pointer;
      text-decoration: none;
      display: block;
      color: inherit;
    }
    .index-item:hover { background: rgba(128,128,128,0.08); }
    .index-item.selected { background: var(--surface); }
    .index-item-title {
      font-size: 13px;
      color: var(--text-muted);
    }
    .index-item.selected .index-item-title {
      font-weight: 600;
      color: var(--text);
    }
    .index-item-sub {
      font-size: 12px;
      color: var(--text-ghost);
      margin-top: 2px;
    }
    .index-item.selected .index-item-sub { color: var(--text-faint); }

    /* Entry cards in panel 2 */
    .entry-card {
      padding: 14px;
      margin-bottom: 12px;
      border-radius: 6px;
      cursor: pointer;
      text-decoration: none;
      display: block;
      color: inherit;
    }
    .entry-card:hover { background: var(--surface); }
    .entry-card.selected { background: var(--surface); }
    .entry-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-ghost);
      margin-bottom: 4px;
    }
    .entry-headline {
      font-size: 15px;
      font-weight: 600;
      color: var(--headline-color);
      font-family: var(--font-serif);
      margin-bottom: 6px;
    }
    .entry-summary {
      font-size: 14px;
      color: var(--text-muted);
      line-height: 1.55;
      font-weight: 400;
    }
    .entry-tags {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-top: 6px;
    }
    .entry-tag {
      font-size: 13px;
      padding: 2px 8px;
      background: var(--surface);
      border-radius: 3px;
      color: var(--text-faint);
    }
    .entry-card.selected .entry-tag { background: var(--border); }
    .entry-stats {
      font-size: 12px;
      color: var(--text-ghost);
      margin-top: 6px;
    }
    .entry-questions-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-ghost);
      margin-top: 8px;
    }
    .entry-questions {
      margin-top: 4px;
      padding-left: 14px;
      font-size: 12px;
      color: var(--text-faint);
      line-height: 1.5;
    }
    .entry-questions li {
      margin-bottom: 2px;
      list-style-type: '→ ';
    }

    /* Conversation transcript */
    .conversation-nav {
      font-size: 12px;
      color: var(--text-ghost);
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .conversation-nav a {
      color: var(--text-ghost);
      text-decoration: underline;
      cursor: pointer;
    }
    .transcript {
      padding-left: 88px;
      position: relative;
    }
    .msg { margin-bottom: 6px; position: relative; padding: 8px 10px; border-radius: 6px; }
    .msg-user { background: var(--surface); }
    .msg-claude { background: rgba(128,128,128,0.04); }
    .msg-speaker-change { margin-top: 14px; border-top: 1px solid var(--border-subtle); padding-top: 10px; }
    .msg-label {
      position: absolute;
      left: -84px;
      top: 8px;
      width: 72px;
      text-align: right;
      font-weight: 700;
      font-size: 14px;
      color: var(--text);
    }
    .msg-system { display: none; opacity: 0.5; font-style: italic; }
    .msg-system .msg-label { color: var(--text-ghost) !important; }
    .msg-raw { display: none; }
    .transcript-raw .msg-system { display: block; }
    .transcript-raw .msg-clean { display: none; }
    .transcript-raw .msg-raw { display: block; }
    .transcript-controls { display: none; }
    .top-bar .raw-toggle {
      width: 28px;
      height: 28px;
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-ghost);
      background: none;
      border: none;
      font-size: 18px;
      margin-left: 8px;
      cursor: pointer;
      font-family: var(--font-sans);
    }
    .top-bar .raw-toggle:hover { color: var(--text-muted); background: var(--surface); }
    .top-bar .raw-toggle.active { color: var(--text); background: var(--surface); }
    .top-bar .fullscreen-toggle {
      width: 28px;
      height: 28px;
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-ghost);
      background: none;
      border: none;
      font-size: 18px;
      margin-left: 8px;
      cursor: pointer;
      font-family: var(--font-sans);
    }
    .top-bar .fullscreen-toggle:hover { color: var(--text-muted); background: var(--surface); }
    .top-bar .fullscreen-toggle.active { color: var(--text); background: var(--surface); }
    .top-bar .expand-all-toggle {
      width: 28px;
      height: 28px;
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-ghost);
      background: none;
      border: none;
      font-size: 18px;
      margin-left: 8px;
      cursor: pointer;
      font-family: var(--font-sans);
    }
    .top-bar .expand-all-toggle:hover { color: var(--text-muted); background: var(--surface); }
    .top-bar .expand-all-toggle.active { color: var(--text); background: var(--surface); }
    .panels-fullscreen .panel-index,
    .panels-fullscreen .panel-entries { display: none; }
    .panels-fullscreen .panel-detail { flex: 1; }
    .msg-collapsible.msg-collapsed {
      max-height: 12em;
      overflow: hidden;
      position: relative;
    }
    .msg-collapsible.msg-collapsed::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 2em;
      background: linear-gradient(transparent, var(--bg));
    }
    .msg-claude .msg-collapsible.msg-collapsed::after {
      background: linear-gradient(transparent, var(--bg));
    }
    .msg-user .msg-collapsible.msg-collapsed::after {
      background: linear-gradient(transparent, var(--surface));
    }
    .msg-expand {
      font-size: 12px;
      color: var(--text-ghost);
      background: none;
      border: none;
      cursor: pointer;
      padding: 2px 0;
      font-family: var(--font-sans);
    }
    .msg-expand:hover { color: var(--text-muted); }
    .msg-user .msg-label { color: var(--text); }
    .msg-claude .msg-label { color: var(--text-faint); }
    .msg-body-user {
      color: var(--msg-user-color);
      line-height: 1.6;
      font-size: 14px;
      font-weight: 400;
    }
    .msg-body-claude {
      color: var(--msg-claude-color);
      line-height: 1.55;
      font-size: 15px;
      font-weight: 400;
    }
    .msg-time {
      font-size: 12px;
      color: var(--text-ghost);
      margin-left: 6px;
      font-weight: 400;
    }

    /* Session footer */
    .session-footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid var(--border-subtle);
    }
    .session-footer-resume {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    .session-footer-resume code {
      font-size: 12px;
      color: var(--text-faint);
      background: var(--surface);
      padding: 4px 8px;
      border-radius: 4px;
      user-select: all;
    }
    .copy-btn {
      font-size: 12px;
      padding: 2px 8px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 3px;
      color: var(--text-ghost);
      cursor: pointer;
    }
    .copy-btn:hover {
      color: var(--text-muted);
      border-color: var(--text-ghost);
    }
    .session-footer-source {
      font-size: 12px;
      color: var(--text-ghost);
    }

    /* Search page */
    .search-box {
      width: 100%;
      padding: 10px 14px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      font-size: 14px;
      font-family: var(--font-sans);
      margin-bottom: 24px;
    }
    .search-box:focus { outline: none; border-color: var(--text-ghost); }
    mark { background: #fef3c7; color: var(--text); padding: 1px 2px; border-radius: 2px; }

    /* Settings page */
    .settings-group { margin-bottom: 24px; }
    .settings-label {
      font-size: 13px;
      font-weight: 600;
      color: var(--text);
      margin-bottom: 6px;
    }
    .settings-help {
      font-size: 12px;
      color: var(--text-ghost);
      margin-bottom: 8px;
    }
    .settings-input {
      width: 100%;
      padding: 8px 12px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 5px;
      color: var(--text);
      font-size: 13px;
      font-family: var(--font-sans);
    }
    .settings-input:focus { outline: none; border-color: var(--text-ghost); }
    textarea.settings-input { min-height: 80px; resize: vertical; }
    .settings-btn {
      padding: 8px 20px;
      background: var(--text);
      color: var(--bg);
      border: none;
      border-radius: 5px;
      font-size: 13px;
      cursor: pointer;
      font-family: var(--font-sans);
    }
    .settings-btn:hover { opacity: 0.85; }
    .settings-btn-secondary {
      padding: 6px 14px;
      background: var(--surface);
      color: var(--text-muted);
      border: 1px solid var(--border);
      border-radius: 5px;
      font-size: 12px;
      cursor: pointer;
      font-family: var(--font-sans);
    }
    .settings-btn-secondary:hover { border-color: var(--text-ghost); color: var(--text); }
    .settings-btn-danger {
      padding: 6px 14px;
      background: none;
      color: var(--text-ghost);
      border: 1px solid var(--border);
      border-radius: 5px;
      font-size: 12px;
      cursor: pointer;
      font-family: var(--font-sans);
    }
    .settings-btn-danger:hover { border-color: #b91c1c; color: #b91c1c; }

    /* Remote source cards */
    .remote-source-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 14px;
      margin-bottom: 10px;
    }
    .remote-source-fields {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 10px;
      margin-bottom: 10px;
    }
    .remote-source-field { display: flex; flex-direction: column; gap: 4px; }
    .remote-source-field-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-faint);
    }
    .remote-source-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 12px;
    }
    .remote-source-toggle {
      font-size: 12px;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
    }
    .connection-status { font-size: 12px; }
    .connection-ok { color: #16a34a; }
    .connection-error { color: #b91c1c; font-size: 12px; }

    /* Sync status */
    .sync-status-panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 12px 14px;
      font-size: 12px;
      color: var(--text-muted);
    }
    .sync-status-spinner {
      color: var(--text-faint);
      font-style: italic;
    }
    .sync-results {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 6px;
    }
    .sync-result-ok { color: #16a34a; }
    .sync-result-error { color: #b91c1c; }
    .sync-stats {
      font-size: 12px;
      color: var(--text-faint);
      margin-top: 4px;
    }
    .sync-stats:first-child { margin-top: 0; }
    .entry-card-pending {
      opacity: 0.6;
      cursor: default;
    }
    @keyframes pulse-fade {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 0.3; }
    }
    .entry-card-pending { animation: pulse-fade 2s ease-in-out infinite; }

    /* Full-width content (calendar) */
    .full-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* Calendar toolbar */
    .calendar-toolbar {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 8px 20px;
      border-bottom: 1px solid var(--border);
      background: var(--bg);
      flex-shrink: 0;
    }
    .calendar-period {
      font-weight: 600;
      font-family: var(--font-serif);
      font-size: 15px;
      min-width: 0;
    }
    .calendar-arrows {
      display: flex;
      gap: 2px;
    }
    .calendar-arrows a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 5px;
      color: var(--text-faint);
      text-decoration: none;
      font-size: 14px;
    }
    .calendar-arrows a:hover {
      color: var(--text);
      background: var(--surface);
    }
    .calendar-mode-toggle { display: flex; gap: 0; }
    .calendar-mode-toggle a {
      padding: 3px 10px;
      font-size: 12px;
      border: 1px solid var(--border);
      color: var(--text-faint);
      text-decoration: none;
    }
    .calendar-mode-toggle a:first-child { border-radius: 4px 0 0 4px; }
    .calendar-mode-toggle a:last-child { border-radius: 0 4px 4px 0; border-left: none; }
    .calendar-mode-toggle a.active {
      background: var(--text);
      color: var(--bg);
      border-color: var(--text);
    }

    /* Gantt grid */
    .gantt-wrap {
      flex: 1;
      overflow: auto;
    }
    .gantt-grid {
      display: grid;
      gap: 1px 0;
      min-width: 100%;
    }
    .gantt-header {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-ghost);
      padding: 8px 4px;
      text-align: center;
      text-decoration: none;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      border-right: 1px solid var(--border-subtle);
      position: sticky;
      top: 0;
      z-index: 1;
    }
    .gantt-header:hover { color: var(--text-muted); }
    .gantt-header:last-child { border-right: none; }
    .gantt-header-today { color: var(--text); font-weight: 700; }
    .gantt-corner {
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      border-right: 1px solid var(--border);
      position: sticky;
      top: 0;
      left: 0;
      z-index: 2;
    }
    .gantt-label {
      font-size: 12px;
      color: var(--text-muted);
      text-decoration: none;
      padding: 6px 12px;
      background: var(--surface);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: flex;
      align-items: center;
      gap: 6px;
      border-right: 1px solid var(--border);
      position: sticky;
      left: 0;
      z-index: 1;
    }
    .gantt-label:hover { color: var(--text); }
    .gantt-label-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .gantt-cell {
      background: var(--bg);
      padding: 4px 0;
      min-height: 34px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .gantt-bar {
      display: block;
      height: 100%;
      min-height: 26px;
      border-radius: 0;
      opacity: 0.8;
      text-decoration: none;
    }
    .gantt-bar:hover { opacity: 1; }
    .gantt-bar-single { border-radius: 4px; margin: 0 3px; }
    .gantt-bar-start { border-radius: 4px 0 0 4px; margin-left: 3px; }
    .gantt-bar-end { border-radius: 0 4px 4px 0; margin-right: 3px; }
    .gantt-bar-mid { border-radius: 0; }

    /* Misc */
    .page-title {
      font-size: 18px;
      font-weight: 700;
      color: var(--text);
      font-family: var(--font-serif);
      margin-bottom: 20px;
    }
    .empty-state {
      color: var(--text-ghost);
      font-size: 14px;
      padding: 40px 20px;
      text-align: center;
    }
    code {
      background: var(--surface);
      padding: 2px 5px;
      border-radius: 3px;
      font-size: 0.9em;
    }
    a { color: var(--text-muted); }
    a:hover { color: var(--text); }
  </style>
</head>
<body>
  <div class="top-bar">
    <a href="/" class="logo">Engineering Notebook</a>
    <nav>
      <a href="/"${journalActive ? ' class="active"' : ""}>Journal</a>
      <a href="/projects"${projectsActive ? ' class="active"' : ""}>Projects</a>
      <a href="/calendar"${calendarActive ? ' class="active"' : ""}>Calendar</a>
    </nav>
    <div class="spacer"></div>
    <form action="/search" method="get" style="display:flex;">
      <input class="search-field" type="text" name="q" placeholder="Search...">
    </form>
    <button class="theme-toggle" onclick="cycleTheme()" title="Toggle theme"></button>
    <button class="raw-toggle" onclick="toggleRaw()" title="Toggle raw transcript (Alt+R)">&lt;/&gt;</button>
    <button class="fullscreen-toggle" onclick="toggleFullscreen()" title="Fullscreen transcript (Alt+F)">&#x26F6;</button>
    <button class="expand-all-toggle" onclick="toggleExpandAll()" title="Expand/Collapse all (Alt+E)">&#x2195;</button>
    <a href="/settings" class="settings-link" title="Settings">&#9881;</a>
  </div>
  ${bodyHtml}
  <script>
  document.querySelector('.entry-card.selected')?.scrollIntoView({block:'center'});
  document.querySelectorAll('.index-item').forEach(function(item) {
    item.addEventListener('click', function() {
      document.querySelectorAll('.index-item.selected').forEach(function(el) {
        el.classList.remove('selected');
      });
      item.classList.add('selected');
    });
  });
  </script>
  <script>
  (function() {
    var themes = ['light', 'cursor'];
    var labels = { light: '\u2600', cursor: '\u263D' };
    function applyTheme(t) {
      if (t === 'light') document.documentElement.removeAttribute('data-theme');
      else document.documentElement.setAttribute('data-theme', t);
      localStorage.setItem('notebook-theme', t);
      var btn = document.querySelector('.theme-toggle');
      if (btn) btn.textContent = labels[t];
    }
    window.cycleTheme = function() {
      var current = localStorage.getItem('notebook-theme') || 'light';
      var next = themes[(themes.indexOf(current) + 1) % themes.length];
      applyTheme(next);
    };
    applyTheme(localStorage.getItem('notebook-theme') || 'light');
  })();
  document.addEventListener('keydown', function(e) {
    if (e.altKey && (e.key === 'r' || e.key === 'R')) {
      e.preventDefault();
      window.toggleRaw();
    }
    if (e.altKey && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      window.toggleFullscreen();
    }
    if (e.altKey && (e.key === 'e' || e.key === 'E')) {
      e.preventDefault();
      window.toggleExpandAll();
    }
  });
  window.toggleMsg = function(btn) {
    if (!btn) return;
    var body = btn.previousElementSibling;
    var collapsed = body.classList.toggle('msg-collapsed');
    btn.textContent = collapsed ? 'Show more' : 'Show less';
    if (!collapsed) return;
    btn.closest('.msg').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  document.addEventListener('dblclick', function(e) {
    var msg = e.target.closest('.msg');
    if (!msg) return;
    var btn = msg.querySelector('.msg-expand');
    if (btn) {
      e.preventDefault();
      window.getSelection().removeAllRanges();
      window.toggleMsg(btn);
    }
  });
  window.toggleExpandAll = function() {
    var collapsed = document.querySelectorAll('.msg-collapsible.msg-collapsed');
    var btn = document.querySelector('.expand-all-toggle');
    if (collapsed.length > 0) {
      collapsed.forEach(function(el) { el.classList.remove('msg-collapsed'); });
      document.querySelectorAll('.msg-expand').forEach(function(b) { b.textContent = 'Show less'; });
      if (btn) btn.classList.add('active');
    } else {
      document.querySelectorAll('.msg-collapsible').forEach(function(el) { el.classList.add('msg-collapsed'); });
      document.querySelectorAll('.msg-expand').forEach(function(b) { b.textContent = 'Show more'; });
      if (btn) btn.classList.remove('active');
    }
  };
  window.toggleFullscreen = function() {
    var panels = document.querySelector('.panels');
    var btn = document.querySelector('.fullscreen-toggle');
    if (!panels) return;
    var isFull = panels.classList.toggle('panels-fullscreen');
    if (btn) btn.classList.toggle('active', isFull);
  };
  window.toggleRaw = function() {
    var detail = document.getElementById('panel-detail') || document.body;
    var btn = document.querySelector('.raw-toggle');
    var isRaw = detail.classList.toggle('transcript-raw');
    if (btn) {
      btn.textContent = isRaw ? '</>' : '</>';
      btn.classList.toggle('active', isRaw);
    }
  };
  </script>
</body>
</html>`;
}
