# Personal Effectiveness Companion — Product Specification v2.0

A lightweight, offline-first Windows desktop app that acts as an IT professional's operational memory. It is not a project manager, note app, or knowledge base — it is a single searchable place that answers: *What should I do today? What am I waiting for? What did I note about that server? What did we decide in that meeting?*

**Core qualities:** fast, offline, private, JSON-file based, keyboard-first, easy to back up.

---

## 1. What Changed from v1

v1 defined nine tabs and seven entity types. v2 consolidates them around two insights:

1. **Most entities were variations of two things** — *things I must act on* and *things I look up*. So the model collapses to two item families: **Actionables** and **Reference**.
2. **Search and capture are behaviors, not destinations.** They become global overlays (keyboard-summoned from anywhere), not tabs.

| v1 (9 tabs) | v2 (4 views + 2 overlays) |
|---|---|
| Dashboard | **Today** view |
| Tasks, Follow Ups, Meetings | **Actionables** view (one list, three kinds) |
| Notes, Configurations, Links (+ Contacts) | **Reference** view (one library, four kinds) |
| Timeline (+ Daily Journal) | **Timeline** view (journal is built in) |
| Search | Global **Search overlay** (`Ctrl+K`) |
| Quick Capture widget | Global **Capture overlay** (`Ctrl+Shift+Space`) |

---

## 2. Architecture Overview: Shell + HTML UI

The app is a **native Windows shell hosting an HTML/CSS/JS interface** so it looks and behaves like a modern web application while remaining fully offline.

```
┌────────────────────────────────────────────┐
│  Windows Shell (.NET 8, WebView2)          │
│  ┌──────────────────────────────────────┐  │
│  │  HTML/JS Frontend (local files)      │  │
│  │  - SPA, no server, no internet       │  │
│  │  - Talks to shell via JS bridge      │  │
│  └──────────────────────────────────────┘  │
│  Host services (C#):                       │
│  Storage · Search index · Reminders ·      │
│  Backup · Global hotkeys · Tray/toasts     │
└────────────────────────────────────────────┘
```

**Recommended stack**

* **Shell:** .NET 8 + **WebView2** (Evergreen runtime, ships with Windows 10/11). Published **self-contained, single-file** so recipients need no .NET installation (see §9). Alternative: Tauri (Rust) or Electron if cross-platform ever matters; WebView2 keeps the footprint smallest for Windows-only.
* **Frontend:** Plain HTML/CSS/TypeScript or a light framework (Preact/Svelte/Vue). Served from local disk (`app://` virtual host), no dev server in production. The UI is a thin **shell + router** that loads *page modules* — the four built-in views are themselves page modules, which is what makes plugin pages possible later (§10).
* **Bridge:** `WebView2.CoreWebView2.AddHostObjectToScript` or JSON message passing (`PostWebMessageAsJson`). Frontend calls `host.invoke("saveItem", payload)`; shell replies with JSON.
* **Storage / Search / Reminders / Backup:** implemented in C# on the host side (details in §8–9). The frontend never touches the file system directly.
* **Global hotkeys & tray:** registered by the shell; `Ctrl+Shift+Space` opens the Capture overlay even when the app is minimized.

This split gives web-app look-and-feel, native reliability (file I/O, hotkeys, notifications), and a UI that can be iterated with ordinary web tooling.

---

## 3. Unified Data Model

### 3.1 One base entity

Every item shares:

```json
{
  "id": "uuid",
  "family": "actionable | reference",
  "kind": "task | followup | meeting | note | config | link | contact",
  "title": "",
  "body": "markdown",
  "tags": [],
  "links": ["id", "id"],
  "people": ["name or contact-id"],
  "created": "ISO-8601",
  "updated": "ISO-8601",
  "favorite": false,
  "archived": false
}
```

### 3.2 Actionables (family = things requiring action)

Extends the base with:

```json
{
  "status": "open | in-progress | waiting | blocked | done | cancelled",
  "priority": "critical | high | medium | low",
  "due": "date | null",
  "waitingOn": "person/team | null",
  "remindAt": "datetime | null",
  "parent": "id | null"
}
```

Three kinds, one list:

* **Task** — a work item. The default kind.
* **Follow-up** — a task whose essence is *a person + a date* ("Ask John about VPN, Friday"). Same fields; `waitingOn` and `due` are primary.
* **Meeting** — a time-anchored actionable. Adds `participants`, `discussion`, `decisions`, `risks`, `openQuestions`. Action items typed inside a meeting become **child actionables** (`parent` = meeting id) automatically — this replaces the v1 "auto-generate follow-ups" feature and keeps everything in one queue.

Because all three share one schema, the Actionables view can filter, group, sort, and remind uniformly. "Waiting For" is simply `status = waiting`, not a separate concept.

### 3.3 Reference (family = things you look up)

Four kinds, one library:

* **Note** — Markdown body. Troubleshooting, decisions, learnings, ideas.
* **Config** — structured IT detail. Adds `environment`, `application`, `category`, and a free-form key/value `details` map (server names, IPs, ports, URLs). Values can be flagged `sensitive` — masked in UI, optionally encrypted at rest, excluded from plain-text export.
* **Link** — bookmark. Adds `url`, `lastUsed`. Grouped by tags (project/customer/technology) rather than a separate category system.
* **Contact** — person/team. Adds `company`, `role`, `channels`. Referenced by `people[]` and `waitingOn` everywhere else.

### 3.4 Relationships

`links[]` is a flat list of item ids — any item can reference any other (task ↔ meeting ↔ config ↔ link ↔ note). The UI renders a "Connected" panel on every item showing linked items grouped by kind, with one-click reverse navigation. Typing `[[` in any body field opens an inline picker to link an item (wiki-style).

### 3.5 Storage layout

```
Data/
  items/
    ac-<id>.json        (actionables)
    rf-<id>.json        (reference items)
  journal/
    2026-05-21.json     (auto-generated daily pages, see §7)
  meta/
    tags.json
    settings.json
  attachments/
    <id>/<filename>
```

One folder for all items (the `family`/`kind` fields discriminate) keeps storage, backup, indexing, and Git-friendliness trivial. Files are written atomically (temp file + rename).

---

## 4. Navigation: Four Views, Two Overlays

```
┌──────────────────────────────────────────────┐
│  ● Today   ● Actionables   ● Reference   ● Timeline      🔍 ⌘K │
└──────────────────────────────────────────────┘
```

### 4.1 Today (landing view)

One screen that answers "what should I focus on?":

* **Now** — top 5 open actionables by priority/due date.
* **Waiting For** — actionables with `status = waiting`, grouped by `waitingOn`.
* **Due** — Overdue · Today · Tomorrow · This week (tasks, follow-ups, and meetings together — one deadline list, not three).
* **Recent** — everything created/updated in the last 7 days, with a 24h / 3d / 7d / 30d range switch.
* **Pinned** — favorites.
* **Reminders badge** — count of fired/pending reminders (also shown as Windows toast + tray badge).

### 4.2 Actionables

The unified work queue.

* Default view: open items sorted by priority + due date.
* **Kind filter chips:** All · Tasks · Follow-ups · Meetings.
* **Grouping:** by status, due date, person (`waitingOn`), or tag.
* Meetings expand inline to show discussion/decisions and their child action items.
* Bulk actions: complete, reschedule, archive.
* Completed/cancelled items auto-move to an Archive filter (still searchable, still on Timeline).

### 4.3 Reference

The lookup library.

* **Kind filter chips:** All · Notes · Configs · Links · Contacts.
* Configs render `details` as a copy-friendly key/value table; sensitive values masked with click-to-reveal.
* Links open in the default browser; `lastUsed` updates automatically.
* Markdown editor with live preview for notes.

### 4.4 Timeline

Unified chronological journal — the app's memory.

* Every create/update/complete event across all items, grouped by day.
* Each day header expands into that day's **journal page** (§7).
* Filters: by kind, tag, or person. Jump-to-date.

### 4.5 Search overlay — `Ctrl+K`

Modal command palette over any view.

* Searches titles, bodies, URLs, tags, people, config values (server names, IPs, app names).
* Results grouped by kind; arrow keys + Enter to open.
* Prefix operators: `#tag`, `@person`, `>kind`, `due:` for instant narrowing.
* Also executes commands: "new task", "backup now", "toggle dark mode".

### 4.6 Capture overlay — `Ctrl+Shift+Space` (global)

The most important feature. Works even when the app is minimized.

* Small popup, single textbox. Type, Enter, gone — under 5 seconds.
* Saved as an **Inbox actionable** (kind = task, tag = `inbox`) by default.
* Light inline parsing (optional, never required): `!high` sets priority, `@John` sets person, `#azure` tags, `fri`/`tomorrow` sets due date, a URL makes it a Link instead.
* Today view shows an Inbox chip when uncategorized captures exist — triage later, capture now.

---

## 5. Tags

* Every item supports tags; `tags.json` tracks usage counts for autocomplete.
* Clicking a tag anywhere opens a filtered cross-kind result page (actionables + reference + timeline).
* Tags replace v1's separate link categories and grouping schemes — one mechanism everywhere.

---

## 6. Reminders

* Any actionable can set `remindAt`.
* Host-side scheduler checks every minute; fires Windows toast notifications and updates the tray/Today badge.
* Snooze (1h / tomorrow / next week) from the toast.
* Overdue reminders surface at the top of Today until resolved.

---

## 7. Daily Journal (automatic)

Each day gets an auto-generated page assembled from Timeline data — no manual upkeep:

* Meetings held, actionables completed/created, reference items added or changed.
* One optional free-text field: **"Notes for tomorrow"** (the only manual part).
* Accessible from Timeline day headers; exportable as Markdown.

This replaces v1's separate Daily Journal feature with a derived view plus one input.

---

## 8. Host Services (C#)

| Service | Responsibility |
|---|---|
| **Storage** | Atomic JSON read/write, file watching, schema validation, migrations. |
| **Search** | In-memory full-text index built at startup, incrementally updated on save. Serves the `Ctrl+K` overlay. |
| **Reminder** | Minute-tick scheduler, Windows toasts, tray badge. |
| **Backup** | Timestamped ZIP of `Data/` — manual command + optional daily auto-backup, configurable retention. |
| **Import/Export** | Export any item/selection/journal to Markdown; import plain text and OneNote exports. |
| **Plugin Registry** | Discovers, validates, and serves page modules from `Plugins/` at startup (§10). |
| **Bridge** | Versioned JSON RPC between WebView2 frontend and the services above — this is the same API surface exposed to plugin pages. |

Frontend folder layout:

```
App/
├── Shell/            (.NET host, WebView2 window, services, bridge)
├── Web/              (HTML UI)
│   ├── shell/        (nav, router, page-module loader)
│   ├── views/        (today, actionables, reference, timeline — built as page modules)
│   ├── overlays/     (search, capture)
│   ├── components/   (item card, connected panel, markdown editor, tag chips)
│   └── styles/       (design tokens shared with plugin pages)
├── Plugins/          (empty in v1; drop-in page modules later, §10)
└── Data/             (user data, relocatable via settings)
```

---

## 9. Packaging, Distribution & Startup Checks

### 9.1 Single-ZIP portable distribution

The app ships as **one ZIP file**. The recipient unzips it into any folder and double-clicks the exe — no installer, no admin rights, no registry writes, no prerequisites to install.

* **Publish mode:** .NET 8 *self-contained, single-file* publish for `win-x64` (optionally `win-arm64`). The .NET runtime is embedded in the exe, so it runs on a clean Windows 10/11 machine.
* **ZIP layout:**

```
PersonalCompanion/
  PersonalCompanion.exe      (self-contained, ~70–90 MB)
  Web/                       (HTML UI assets; may be embedded in the exe instead)
  Data/                      (created automatically on first run)
  Logs/                      (created automatically on first run)
  README.txt                 (2-minute quick start)
```

* **Truly portable:** all state lives beside the exe by default — `Data/`, `Logs/`, `settings.json`. Copy the folder = full backup; move it to a USB stick and it still works. The data path can be redirected in `settings.json` (e.g., to a Documents subfolder) for users who unzip into a read-only location.
* **WebView2 dependency:** the Evergreen WebView2 runtime is preinstalled on all current Windows 10/11 builds. The startup check below verifies it; if absent, the app shows the official download link (or ship the fixed-version runtime in the ZIP for fully offline machines, at ~150 MB extra).

### 9.2 Startup self-check sequence

Before the UI window opens, the shell runs an ordered gauntlet of checks. Any failure shows a **native Windows message box** (not the HTML UI, which may not be loadable yet) with a plain-language explanation and a suggested fix, writes the detail to the log, and exits with a distinct exit code. The app never starts in a half-working state.

| # | Check | On failure |
|---|---|---|
| 1 | **Single instance** — is the app already running? | Activate the existing window and exit silently. |
| 2 | **WebView2 runtime present** and minimum version met. | "This app needs the Microsoft WebView2 runtime, which is missing on this PC." + clickable download link. Exit. |
| 3 | **Data folder** — exists or can be created at the configured path. | "The Data folder could not be created at `<path>`. `<OS error>`. Unzip the application to a folder you own (e.g., Documents or Desktop) and try again." Exit. |
| 4 | **Write permission** — create, write, flush, and delete a probe file inside `Data/`. | "The application cannot save files to `<path>` (access denied). This can happen when running from Program Files, a read-only drive, or a restricted network share." + offer **one-click fallback**: relocate data to `%LOCALAPPDATA%\PersonalCompanion\Data` and continue, or exit. |
| 5 | **Read permission + integrity** — read `settings.json` and a sample of item files; validate JSON. | Corrupt `settings.json`: offer *Restore defaults* / *Restore from last backup* / *Exit*. Unreadable data folder: explain and exit. |
| 6 | **Disk space** — configurable minimum (default 50 MB) free on the data drive. | "Less than 50 MB of free space remains on drive `<X:>`. Free up space and restart — saving cannot be guaranteed." Exit (or continue read-only if the user chooses). |
| 7 | **Log folder writable.** | Non-fatal: fall back to `%TEMP%` and note it in the first log line. |

All failure dialogs follow one template: **what failed → why it likely failed → what the user can do**, never a raw stack trace (full detail goes to the log file referenced in the dialog).

### 9.3 Runtime I/O guard

Permissions can change *after* a successful start (drive removed, folder locked by backup software, disk fills up). Every save goes through the atomic-write path with retry; on persistent failure the app:

1. Keeps the unsaved item safely in memory and marks it "unsaved" in the UI.
2. Shows a non-blocking toast: "Couldn't save to disk — retrying. Check that the Data folder is still accessible."
3. If failures continue, opens the same diagnostic dialog as startup check #4 with the relocation option.

Data is never silently lost, and the app never crashes on I/O errors — it degrades to read-only with a visible banner until writing succeeds again.

---

## 10. Extensibility: Pluggable HTML Pages

v1 ships **zero plugins but a plugin-ready architecture**. Because the UI is already HTML loaded in a shell, a "plugin" is simply a folder of web assets that the app discovers and mounts as a new page. The goal: in the future, adding a page to the app means *dropping a folder into `Plugins/` and restarting* — no rebuild of the shell or core UI.

### 10.1 Page-module contract (used by core views too)

Every page in the app — including the four built-in views — conforms to one contract:

```
<module>/
  manifest.json      (identity + registration)
  index.html         (entry page)
  *.js / *.css / assets
```

```json
{
  "id": "com.example.capacity-planner",
  "name": "Capacity Planner",
  "version": "1.0.0",
  "apiVersion": "1",
  "entry": "index.html",
  "icon": "icon.svg",
  "nav": { "placement": "main", "order": 50 },
  "permissions": ["items:read", "items:write", "search", "notify"]
}
```

Building the core views on the same contract is the guarantee that the plugin path actually works — it is exercised every day, not a dormant code path discovered to be broken two years later.

### 10.2 Discovery & loading

1. At startup, the Plugin Registry scans `Plugins/*/manifest.json`.
2. Each manifest is validated: schema, unique `id`, compatible `apiVersion`, entry file exists.
3. Valid modules are registered with the router; their nav entries appear automatically in the top navigation (or an "More" overflow menu, per `nav.placement`).
4. Pages load **lazily** — a plugin costs nothing until its tab is opened.
5. Invalid or incompatible plugins are **skipped, never fatal**: the app starts normally, logs the reason, and shows a dismissible notice ("Plugin 'X' was disabled: manifest invalid"). This extends the graceful-failure philosophy of §9 — a bad plugin must never take down the app. A settings page lists discovered plugins with enable/disable toggles.

### 10.3 Isolation & the Plugin API

* Each plugin page loads in its **own sandboxed iframe** on the local virtual host (e.g., `app://plugins/<id>/index.html`). Plugins cannot touch the core UI's DOM or another plugin's.
* **No direct file or network access.** The WebView2 environment already blocks external navigation; plugins reach data *only* through the same versioned JSON bridge the core views use:

```js
const api = window.companion;           // injected by the shell
await api.items.query({ kind: "task", status: "open" });
await api.items.save(item);
await api.search("prod db");
api.events.on("item:changed", refresh);
api.ui.navigate("item", id);
api.ui.toast("Saved");
```

* The manifest's `permissions` list is enforced at the bridge: a plugin without `items:write` gets a rejected promise, not silent success. v1 keeps the model coarse (read, write, search, notify); it can grow finer later.
* **`apiVersion` is the stability contract.** The bridge API is versioned from day one; breaking changes bump the version and the registry refuses (or shims) older plugins with a clear message rather than letting them misbehave.
* Shared **design tokens** (CSS variables for colors, spacing, typography, dark mode) are exposed on a stable stylesheet URL so plugin pages automatically match the app's look, including theme switches.

### 10.4 What this costs v1 (deliberately small)

Only three things are genuinely built in v1, all of which v1 needs anyway:

1. The router/loader that mounts page modules from manifests (core views use it).
2. The versioned bridge API with permission checks (core views use it).
3. The registry scan of an (empty) `Plugins/` folder + the disabled-plugin notice path.

Everything else — a plugin marketplace, hot reload, custom item kinds, dashboard widgets — remains future scope (§13). Custom **item kinds** in particular stay out of v1: pluggable *pages over existing data* is cheap; pluggable *data schemas* touches storage, search, and timeline and deserves its own design later.

### 10.5 Distribution & safety notes

* Installing a plugin = unzip into `Plugins/` (consistent with the app's own zero-install philosophy). Removing = delete the folder.
* Plugins run with the user's file permissions via the bridge only; still, the README and settings page should state plainly that plugins are code and should come from trusted sources.
* Plugin folders are excluded from data backups by default (they're software, not data) but included in a "full backup" option.

---

## 11. Non-Functional Requirements

* **Startup** < 2 s with 10,000 items; search results < 100 ms.
* **Offline only** — no network calls; WebView2 navigation restricted to the local virtual host.
* **Privacy** — data stays in one relocatable folder; optional encryption for sensitive config values; backups are plain ZIPs the user controls.
* **Keyboard-first** — every view and action reachable without a mouse; shortcut cheat-sheet on `?`.
* **Auto-save** everywhere; no explicit save buttons.
* **Dark mode** + system theme detection.
* **Crash-safe** — atomic writes; rolling local log files.
* **Zero-install** — runs from any user-writable folder without admin rights; leaves no registry or system footprint (uninstall = delete the folder).

---

## 12. Nice-to-Have (post-v1 polish)

* Drag-and-drop attachments onto any item.
* Pinned notes on Today.
* Configurable Today layout (show/hide/reorder sections).
* JSON validation and repair tool.
* Optional code-signing of the exe to reduce SmartScreen warnings when sharing the ZIP.

## 13. Future (v2+)

* AI-assisted meeting/note summarization and action-item extraction.
* Natural-language search ("production server notes from last month").
* Morning briefing generated on first launch of the day.
* Optional Outlook/Teams meeting import.
* Richer plugin capabilities on the §10 foundation: custom item kinds, dashboard widgets on Today, finer-grained permissions, hot reload for plugin development.

---

## 14. Guiding Principle

The application is a **personal operational cockpit**: two item families (act on / look up), four views, two keystrokes (`Ctrl+K` to find anything, `Ctrl+Shift+Space` to capture anything), and one interconnected offline data folder. Every design decision should reduce the cognitive load of day-to-day IT work — capture in seconds, reconnect context in one click, and always know what matters right now.
