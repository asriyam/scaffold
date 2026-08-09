# Generic Desktop Application Architecture Specification

A reusable blueprint for building keyboard-driven applications using a native shell host with an embedded HTML/CSS/JS frontend — with the flexibility to also deploy the same frontend as a standalone web application served by a web server. This specification captures proven architecture patterns, technology choices, and implementation conventions from a production application. It is designed to be paired with a separate **requirements document** describing your specific application's domain, data model, and features.

The architecture supports **two deployment modes** from a single frontend codebase:

1. **Shell mode** — offline-first Windows desktop app (.NET 8 + WebView2), zero-install, single-user
2. **Web mode** — the same frontend deployed to a web server (ASP.NET Core / Node.js), accessed via browser, supporting multi-user with roles and authentication

---

## 1. How to Use This Spec

### For AI-assisted development (Claude, Cursor, etc.)

Provide **two documents** to the AI:

1. **This spec** (architecture, patterns, conventions)
2. **Your requirements** (what the app does, its data model, views, and features)

Prompt example:

> Build a desktop application following the architecture in the attached spec. The application requirements are described in the second document. Generate the implementation plan first, then implement phase by phase.

### What goes in your requirements document

Your requirements doc should define (this spec handles *how*; your doc handles *what*):

- **Application name and purpose** — one-paragraph summary
- **Data model** — entity types, fields, relationships, families/kinds
- **Views/tabs** — what the user sees, what each view does
- **Overlays/popups** — modal surfaces (search, capture, settings, etc.)
- **Keyboard shortcuts** — global and per-view hotkeys
- **Domain-specific services** — any backend logic beyond CRUD (e.g., reminders, scheduling, calculations)
- **Non-functional requirements** — any overrides to the defaults in this spec (e.g., "must support macOS" or "needs network access for API X")
- **Deployment mode** — shell-only (offline desktop), web-only (browser-based), or dual (both). If web mode, specify authentication method (SSO, API key, etc.)
- **User model** — single-user (default for shell mode) or multi-user with roles. If multi-user, define the roles, their permissions, and how user identity is provided (external IdP, header injection, JWT, etc.)

### Placeholder convention

Throughout this spec, `{{PLACEHOLDER}}` marks values you replace with your application-specific choices. Example: `{{APP_NAME}}` becomes `InventoryTracker` or `MeetingDashboard`.

---

## 2. Architecture Overview

### The Pattern: One Frontend, Two Deployment Modes

The application is built as an **HTML/CSS/JS single-page application** with all backend logic behind a uniform **bridge API**. The frontend neither knows nor cares whether it is running inside a WebView2 shell or a browser — it calls the same methods either way.

**Shell mode** — the SPA runs inside a native Windows host:

```
+----------------------------------------------+
|  Windows Shell (.NET 8, WebView2)            |
|  +----------------------------------------+  |
|  |  HTML/JS Frontend (local files)        |  |
|  |  - SPA, no server, no internet         |  |
|  |  - Calls bridge via WebView postMessage |  |
|  +----------------------------------------+  |
|  Host services (C#):                         |
|  Storage . Search . Settings . Backup .      |
|  {{DOMAIN_SERVICES}}                         |
+----------------------------------------------+
```

**Web mode** — the same SPA runs in a browser, served by a web server:

```
+--------------------+         +-----------------------------+
|  Browser           |  HTTP/  |  Web Server                 |
|  +---------------+ |  WS     |  (ASP.NET Core / Node.js)   |
|  | Same SPA      |<-------->|  Same services, exposed as   |
|  | Same bridge   | |         |  REST + WebSocket endpoints  |
|  +---------------+ |         |  Auth · Roles · Multi-user   |
+--------------------+         +-----------------------------+
```

The key insight: **all WebView2 coupling is confined to one file (`bridge.ts`)**. A bridge adapter pattern (see §6.5) swaps the transport without changing any view code.

### Why this pattern

| Concern | Solution |
|---|---|
| **Modern UI** | Full HTML/CSS/JS — use any web framework, iterate with browser DevTools |
| **Native reliability** | File I/O, hotkeys, notifications, tray icon handled by the shell (shell mode) |
| **Offline / private** | No server, no network calls; data stays on disk (shell mode) |
| **Portable** | ZIP distribution, zero-install, no admin rights (shell mode) |
| **Web deployable** | Same frontend, served by any web server (web mode) |
| **Multi-user ready** | User context + roles injected by the backend; frontend adapts via permissions (web mode) |
| **Small footprint** | WebView2 ships with Windows; only the app's own assets are bundled |
| **Extensible** | Plugin pages are just more HTML loaded into the same shell or served by the web server |

### Separation of concerns

| Layer | Responsibility | Shell mode | Web mode |
|---|---|---|---|
| **Backend** | Data operations, business logic, auth | .NET 8 services in-process | ASP.NET Core / Node.js server |
| **Bridge** | Typed JSON RPC between frontend and backend | `PostWebMessageAsJson` | HTTP `POST` + WebSocket |
| **Frontend** | UI rendering, navigation, user interaction | Svelte 5 + TypeScript + Tailwind CSS | Same |
| **Storage** | Data persistence | JSON files on disk | JSON files, SQLite, or database |

The frontend **never** touches the file system or database directly. Every data operation goes through the bridge.

### Cross-platform alternatives

This spec is Windows-primary for shell mode. If cross-platform shell is needed:

| Alternative | Trade-offs |
|---|---|
| **Tauri (Rust + WebView)** | Cross-platform, smaller binary (~5-10 MB), but Rust backend instead of C# |
| **Electron (Node.js + Chromium)** | Cross-platform, huge ecosystem, but 150+ MB binary, ships entire Chromium |
| **.NET MAUI BlazorWebView** | Cross-platform .NET, but less mature WebView integration |

The frontend code (Svelte SPA) is fully portable across all alternatives and across deployment modes. Only the shell host, bridge adapter, and server backend change.

---

## 3. Technology Stack

### Shell Host

| Component | Technology | Version | Rationale |
|---|---|---|---|
| Runtime | .NET 8 | `net8.0-windows` | LTS, self-contained publish, no prerequisite for users |
| UI framework | WinForms | built-in | Minimal overhead; the WebView2 control is the entire UI |
| WebView | `Microsoft.Web.WebView2` | `1.0.4078+` | Evergreen runtime ships with Windows 10/11 |
| Logging | `Serilog.Sinks.File` | `7.0.0` | Rolling file logs |
| Encryption | `System.Security.Cryptography.ProtectedData` | `8.0.0` | DPAPI for sensitive values |
| JSON | `System.Text.Json` | built-in | CamelCase naming policy, case-insensitive deserialization |
| Testing | `xUnit` | latest | Shell service unit tests |

### Frontend

| Component | Technology | Version | Rationale |
|---|---|---|---|
| Framework | Svelte 5 | `^5.x` | Compiles to vanilla JS, no virtual DOM, small bundle, fast startup |
| Language | TypeScript | `~6.x` | Type safety for bridge calls and data models |
| Build tool | Vite | `^8.x` | Fast dev server with HMR, optimized production builds |
| CSS | Tailwind CSS | `^3.x` | Utility-first, dark mode built-in, small purged output |
| PostCSS | autoprefixer | `^10.x` | Browser compatibility |
| Testing | Vitest | latest | Frontend unit tests |
| E2E | Playwright | latest | End-to-end testing |

### JSON serializer configuration (shared across all services)

```csharp
private static readonly JsonSerializerOptions JsonOptions = new()
{
    PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    PropertyNameCaseInsensitive = true
};
```

This ensures C# `PascalCase` properties serialize as `camelCase` for the JavaScript frontend, and deserialization accepts either casing.

---

## 4. Project Structure

```
{{APP_NAME}}/
+-- App/
|   +-- Shared/                         # Shared library (services, models, bridge router)
|   |   +-- {{APP_NAME}}.Shared.csproj
|   |   +-- BridgeProtocol.cs           # BridgeRequest / BridgeResponse DTOs
|   |   +-- BridgeRouter.cs             # Method dispatch dictionary
|   |   +-- UserContext.cs              # User identity + role + permissions
|   |   +-- Models/
|   |   |   +-- {{BASE_ENTITY}}.cs      # Abstract base entity
|   |   |   +-- {{ENTITY_TYPES}}.cs     # Concrete entity types
|   |   |   +-- ItemFactory.cs          # Kind-based deserialization factory
|   |   |   +-- QueryFilter.cs          # Filtering DTO
|   |   |   +-- Settings.cs             # App settings model
|   |   |   +-- PluginManifest.cs       # Plugin manifest model
|   |   |   +-- Plugin.cs               # Runtime plugin model
|   |   +-- Services/
|   |       +-- StorageService.cs       # CRUD, atomic writes, cache, file watcher
|   |       +-- SettingsService.cs      # Read/write settings.json
|   |       +-- SearchService.cs        # In-memory full-text index
|   |       +-- BackupService.cs        # ZIP backup/restore
|   |       +-- ExportImportService.cs  # Markdown/JSON export, import
|   |       +-- PluginRegistry.cs       # Plugin discovery, validation, permissions
|   |       +-- {{DOMAIN_SERVICES}}.cs  # App-specific services
|   |
|   +-- Shell/                          # .NET 8 host (shell mode)
|   |   +-- {{APP_NAME}}.Shell.csproj   # References Shared.csproj
|   |   +-- Program.cs                  # Entry point, logging, startup checks
|   |   +-- MainWindow.cs               # WebView2 setup, service init, bridge registration
|   |   +-- MainWindow.Designer.cs      # WinForms designer (WebView2 control, Dock=Fill)
|   |   +-- StartupChecker.cs           # Ordered startup validation gauntlet
|   |   +-- StartupResult.cs            # Success/failure DTO
|   |   +-- LoadingOverlay.cs           # Native splash while WebView2 initializes
|   |
|   +-- Server/                         # Web server backend (web mode, optional)
|   |   +-- {{APP_NAME}}.Server.csproj  # References Shared.csproj
|   |   +-- Program.cs                  # Kestrel setup, middleware, auth, static files
|   |   +-- BridgeController.cs         # POST /api/bridge → BridgeRouter.Handle()
|   |   +-- EventBroadcaster.cs         # WebSocket /api/events for push notifications
|   |   +-- AuthMiddleware.cs           # JWT / Cookie / Header-based authentication
|   |
|   +-- Shared.Tests/                   # xUnit test project (tests shared services)
|   |   +-- {{APP_NAME}}.Shared.Tests.csproj
|   |   +-- StorageServiceTests.cs
|   |   +-- SearchServiceTests.cs
|   |   +-- ...
|   |
|   +-- Web/                            # Svelte/Vite frontend
|   |   +-- package.json
|   |   +-- vite.config.ts
|   |   +-- tailwind.config.js
|   |   +-- svelte.config.js
|   |   +-- tsconfig.json
|   |   +-- index.html
|   |   +-- src/
|   |   |   +-- main.ts                 # Svelte mount + theme init
|   |   |   +-- App.svelte              # Root component (NavBar + router + overlays + toast)
|   |   |   +-- app.css                 # Tailwind directives + base styles
|   |   |   +-- shell/                  # App infrastructure
|   |   |   |   +-- bridge.ts           # Bridge adapter (auto-detects shell vs. web)
|   |   |   |   +-- session.ts          # User context store (userId, role, permissions)
|   |   |   |   +-- urls.ts             # URL resolver (virtual hosts vs. web paths)
|   |   |   |   +-- router.ts           # Hash-based navigation, overlay state
|   |   |   |   +-- modules.ts          # Module/manifest registry, plugin loading
|   |   |   |   +-- shortcuts.ts        # Global keyboard shortcut listener
|   |   |   |   +-- theme.ts            # Theme application (light/dark/custom)
|   |   |   +-- components/             # Shared UI components
|   |   |   |   +-- NavBar.svelte       # Tab navigation + toolbar buttons
|   |   |   |   +-- {{COMPONENTS}}.svelte
|   |   |   +-- overlays/               # Modal overlay surfaces
|   |   |   |   +-- SearchOverlay.svelte
|   |   |   |   +-- {{OVERLAYS}}.svelte
|   |   |   +-- views/                  # Page modules (one folder per view)
|   |   |   |   +-- {{VIEW_NAME}}/
|   |   |   |   |   +-- {{View}}.svelte
|   |   |   |   |   +-- manifest.json
|   |   |   |   +-- plugin/
|   |   |   |       +-- PluginView.svelte  # Generic iframe host for plugins
|   |   |   +-- styles/
|   |   |       +-- tokens.css          # CSS custom property design tokens
|   |   +-- dist/                       # Vite build output (gitignored)
|   |
|   +-- Plugins/                        # Bundled plugins (optional)
|
+-- specs/                              # Specifications and plans
+-- {{APP_NAME}}.sln                    # Solution file (Shared + Shell + Server + Tests)
+-- publish.ps1                         # One-click build + ZIP script (shell mode)
+-- README.txt                          # Quick start guide (ships in ZIP)
+-- .editorconfig
+-- .gitignore
```

### Runtime data folders (created automatically on first launch)

```
Data/                       # User data (beside the EXE, relocatable via settings)
+-- items/                  # Entity JSON files
+-- meta/                   # settings.json, tags.json, plugins.json
+-- attachments/            # File attachments by entity ID
+-- Plugins/                # Installed plugins (copied from bundled on first run)
+-- backups/                # Auto and manual backup ZIPs
Logs/                       # Rolling log files
WebView2Data/               # WebView2 browser profile cache
```

---

## 5. Shell Host Patterns

### 5.1 Entry Point (`Program.cs`)

The entry point follows this sequence:

1. Parse command-line args (e.g., `--debug` flag)
2. Initialize WinForms (`ApplicationConfiguration.Initialize()`)
3. Initialize logging (Serilog rolling file to `Logs/`)
4. Run startup checks (`StartupChecker.Run()`) — fail with native `MessageBox`, never with the HTML UI
5. If checks pass, create and run `MainWindow`
6. On exit, release single-instance mutex and flush logs

Key details:
- `[STAThread]` is required for WinForms
- `Main` returns `int` exit codes (0 = success, distinct codes per failure)
- Logging fallback: if the primary log folder is unwritable, fall back to `%TEMP%\{{APP_NAME}}\Logs`

### 5.2 Startup Checks (`StartupChecker.cs`)

An ordered gauntlet of checks that runs **before** the WebView2 window opens. Every failure shows a native `MessageBox` (not the HTML UI, which may not be loadable) with a plain-language explanation and suggested fix.

| # | Check | On Failure |
|---|---|---|
| 1 | **Single instance** — `Mutex` with app-specific name | Activate existing window via named `EventWaitHandle`, exit silently |
| 2 | **WebView2 runtime** — `CoreWebView2Environment.GetAvailableBrowserVersionString()` | Offer to open download page, exit |
| 3 | **Data folder** — `Directory.CreateDirectory(DataPath)` | Explain path, suggest moving to user-owned folder, exit |
| 4 | **Write permission** — write+read+delete a probe file in `Data/` | Offer one-click fallback to `%LOCALAPPDATA%\{{APP_NAME}}\Data`, or exit |
| 5 | **Data integrity** — parse `settings.json`, create subdirectories | Offer to reset corrupt settings, or exit |
| 6 | **Disk space** — `DriveInfo.AvailableFreeSpace` >= 50 MB | Warn and exit |

The `DataPath` is a static property on `StartupChecker` — all services reference it for their file paths.

### 5.3 Main Window (`MainWindow.cs`)

The main window is a `Form` with a single `WebView2` control docked to fill. Key responsibilities:

**Constructor sequence:**
1. Set window title, size (1280x800), center on screen
2. Instantiate all services (StorageService, SettingsService, SearchService, etc.)
3. Wire up service events (storage changes, reminders, save failures)
4. Warm up storage cache (background thread)
5. Create system tray icon with context menu
6. Register all bridge methods (`RegisterBridgeMethods()`)
7. Show loading overlay (native `Panel`) while WebView2 initializes

**OnLoad sequence:**
1. Register global hotkey(s) via P/Invoke `RegisterHotKey`
2. Initialize WebView2 asynchronously

**WebView2 initialization:**
1. Locate the `Web/dist/` folder (walk up directory tree to find it)
2. Create `CoreWebView2Environment` with user data folder
3. Set up virtual host mappings:
   - `https://companion/` -> `Web/dist/` (app UI)
   - `https://attachments/` -> `Data/attachments/` (file attachments)
   - `https://plugins/` -> `Data/Plugins/` (plugin assets)
4. Add `WebResourceRequested` filter for plugin HTML injection
5. Add `WebMessageReceived` handler for bridge calls
6. Navigate to `https://companion/index.html`
7. On navigation complete, slide out loading overlay and show WebView

**Bridge message handling (`OnWebMessageReceived`):**
1. Deserialize JSON to `BridgeRequest`
2. Check plugin permissions if the message has a `Source` from plugin origin
3. Route to registered handler via `BridgeRouter.Handle(request)`
4. Serialize `BridgeResponse` and post back via `PostWebMessageAsJson`
5. Catch all exceptions, return error response, never crash

**System tray behavior:**
- Close button minimizes to tray (cancel `FormClosing`, set `WindowState.Minimized`)
- Tray icon double-click restores window
- Context menu: "Show" and "Exit" options
- "Exit" sets `_allowExit = true` and calls `Application.Exit()`

**Global hotkey handling:**
- Override `WndProc` to catch `WM_HOTKEY` messages
- If app is minimized/background: show a lightweight native capture popup
- If app is focused: trigger the capture overlay in the WebView via `ExecuteScriptAsync`

### 5.4 Loading Overlay (`LoadingOverlay.cs`)

A custom `Panel` control shown while WebView2 initializes (typically 1-3 seconds). Features:
- Respects system dark/light mode (reads `HKCU\...\AppsUseLightTheme` registry key)
- Shows a greeting ("Hi {username}!")
- Loads and scrolls through recent items from disk as a preview
- Slides out (height collapse animation) when WebView2 navigation completes
- Removes itself from the form after animation

This prevents the user from seeing a blank window during WebView2 startup.

### 5.5 Designer File (`MainWindow.Designer.cs`)

Minimal WinForms designer code:
- One `WebView2` control with `Dock = DockStyle.Fill`
- No other controls (the entire UI is rendered by the web frontend)

---

## 6. Bridge Protocol

### 6.1 Protocol DTOs (`BridgeProtocol.cs`)

```csharp
public class BridgeRequest
{
    public string Method { get; set; } = string.Empty;  // e.g., "items.save"
    public JsonElement Params { get; set; }              // arbitrary JSON payload
    public long Id { get; set; }                         // correlates request/response
    public string? Source { get; set; }                   // origin URI (for plugin permission checks)
}

public class BridgeResponse
{
    public long Id { get; set; }
    public object? Result { get; set; }   // success payload (serialized to JSON)
    public string? Error { get; set; }    // error message (null on success)
}
```

### 6.2 Router (`BridgeRouter.cs`)

A simple dictionary-based method dispatcher:

```csharp
public class BridgeRouter
{
    private readonly Dictionary<string, Func<JsonElement, object?>> _handlers = new();

    public void Register(string method, Func<JsonElement, object?> handler)
        => _handlers[method] = handler;

    public BridgeResponse Handle(BridgeRequest request)
    {
        if (!_handlers.TryGetValue(request.Method, out var handler))
            return new BridgeResponse { Id = request.Id, Error = $"Unknown method: {request.Method}" };
        try
        {
            return new BridgeResponse { Id = request.Id, Result = handler(request.Params) };
        }
        catch (Exception ex)
        {
            return new BridgeResponse { Id = request.Id, Error = ex.Message };
        }
    }
}
```

### 6.3 Method Registration Pattern

Bridge methods are registered in `MainWindow.RegisterBridgeMethods()`. Convention: `namespace.verb` naming.

```csharp
// Simple getter
_bridge.Register("items.get", p =>
{
    var id = p.GetProperty("id").GetString()!;
    return _storage.Get(id);
});

// Save with factory deserialization
_bridge.Register("items.save", p =>
{
    var item = ItemFactory.FromJson(p.GetRawText(), JsonOptions);
    _storage.Save(item);
    return new { id = item.Id };
});

// Query with filter DTO
_bridge.Register("items.query", p =>
{
    var filter = JsonSerializer.Deserialize<QueryFilter>(p.GetRawText(), JsonOptions);
    return _storage.Query(filter ?? new QueryFilter());
});

// Native dialog integration
_bridge.Register("export.all", _ =>
{
    using var dialog = new SaveFileDialog { Filter = "JSON files|*.json", Title = "Export" };
    if (dialog.ShowDialog() == DialogResult.OK)
    {
        File.WriteAllText(dialog.FileName, _exportService.ExportJson());
        return new { path = dialog.FileName, success = true };
    }
    return new { path = (string?)null, success = false };
});
```

### 6.4 Standard Bridge Methods

Every application built on this architecture should expose these base methods:

| Method | Params | Returns | Purpose |
|---|---|---|---|
| `ping` | any | `{ message: "pong" }` | Bridge health check |
| `session.init` | none | `UserContext` | Returns current user identity, role, and permissions (§18) |
| `items.save` | entity JSON | `{ id }` | Create or update |
| `items.get` | `{ id }` | entity or null | Read by ID |
| `items.delete` | `{ id }` | `{ success }` | Delete by ID |
| `items.query` | `QueryFilter` | entity array | Filtered list |
| `items.bulk` | `{ ids, patch }` | `{ updated }` | Bulk update |
| `search.query` | `{ text }` | search results | Full-text search |
| `tags.list` | none | tag array | All tags with counts |
| `settings.get` | none | settings object | Read app settings |
| `settings.set` | settings object | `{ success }` | Write app settings |
| `backup.now` | none | backup result | Create backup |
| `backup.restore` | none | restore result | Restore from ZIP (shows native dialog) |
| `export.all` | none | `{ path, success }` | Export data (shows native dialog) |
| `plugins.list` | none | plugin array | List installed plugins |
| `attachments.upload` | `{ itemId, data }` | `{ url, filename }` | Save base64 image |

Add domain-specific methods as `{{DOMAIN}}.verb` (e.g., `reminders.list`, `timeline.query`).

### 6.5 Frontend Bridge Client (`bridge.ts`) — Adapter Pattern

The bridge client is the **single point of coupling** between the frontend and the backend. All 58+ call sites across all views route through one `host.invoke()` function. The adapter pattern makes the transport layer swappable without changing any view code.

#### Bridge Adapter interface

```typescript
interface BridgeAdapter {
  invoke(method: string, params: unknown, source?: string): Promise<unknown>;
  onEvent(callback: (event: string, payload: unknown) => void): void;
  readonly mode: 'shell' | 'web';
}
```

#### Auto-detection and adapter selection

```typescript
function createAdapter(): BridgeAdapter {
  if (window.chrome?.webview) return new WebViewAdapter();
  return new HttpAdapter();
}

const adapter = createAdapter();
export const host = { invoke: adapter.invoke.bind(adapter) };
export const deploymentMode = adapter.mode;
```

At module load time, `bridge.ts` checks if the WebView2 API is available. If yes, it uses the shell transport. If no (running in a regular browser), it falls back to HTTP/WebSocket.

#### WebViewAdapter (shell mode)

Uses `chrome.webview.postMessage` for RPC and `chrome.webview.addEventListener('message', ...)` for responses and events. This is the original transport.

```typescript
class WebViewAdapter implements BridgeAdapter {
  readonly mode = 'shell' as const;
  invoke(method: string, params: unknown = {}, source?: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      window.chrome!.webview!.postMessage({ method, params, id, source });
      setTimeout(() => {
        if (pending.has(id)) { pending.delete(id); reject(new Error(`Timed out: ${method}`)); }
      }, 10_000);
    });
  }
  onEvent(callback) { /* listen for chrome.webview 'message' events with event field */ }
}
```

#### HttpAdapter (web mode)

Uses `fetch()` for RPC and a WebSocket for server-pushed events.

```typescript
class HttpAdapter implements BridgeAdapter {
  readonly mode = 'web' as const;
  private ws: WebSocket | null = null;
  private eventCallbacks: Array<(event: string, payload: unknown) => void> = [];

  async invoke(method: string, params: unknown = {}, source?: string): Promise<unknown> {
    const response = await fetch('/api/bridge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method, params, source }),
      credentials: 'include',  // sends auth cookies
    });
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    return data.result;
  }

  onEvent(callback) {
    this.eventCallbacks.push(callback);
    if (!this.ws) this.connectWebSocket();
  }

  private connectWebSocket() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${location.host}/api/events`);
    this.ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.event) this.eventCallbacks.forEach(cb => cb(data.event, data.payload));
    };
    this.ws.onclose = () => setTimeout(() => this.connectWebSocket(), 3000);  // auto-reconnect
  }
}
```

#### What this means for view code

View components call `host.invoke('items.query', { family: 'actionable' })` exactly as before. They never import or reference `WebViewAdapter` or `HttpAdapter`. The transport is invisible.

Key details:
- Uses a monotonically increasing `id` to correlate requests/responses (shell mode)
- 10-second timeout prevents hung promises (shell mode); HTTP timeout for web mode
- Supports **server-initiated events**: in shell mode, responses with an `event` field (no matching `id`) are broadcast to Svelte stores and plugin iframes; in web mode, events arrive via WebSocket
- Plugin iframes proxy bridge calls through `window.postMessage`; the main frame forwards them via `host.invoke` with the plugin's origin as `source`

### 6.6 Event Broadcasting Pattern

The shell can push events to the frontend (e.g., data changes, reminder notifications):

```csharp
// Shell side: push event via WebView
private async void OnStorageChanged()
{
    await webView.CoreWebView2.PostWebMessageAsJson(
        JsonSerializer.Serialize(new { @event = "data:changed" }, JsonOptions));
}
```

```typescript
// Frontend side: bridge.ts listener handles events
if (data.event) {
    // Update Svelte stores, broadcast to plugins
    if (data.event === 'toast' && data.payload)
        toastMessage.set(data.payload);
    broadcastToPlugins({ companion: true, event: data.event, payload: data.payload });
    return;
}
```

---

## 7. Service Layer Patterns

All services are plain C# classes (no DI container). They are instantiated in the `MainWindow` constructor and wired to bridge methods. Common conventions:

- Accept `dataPath` and `JsonSerializerOptions` in the constructor
- Create necessary subdirectories in the constructor
- Use atomic writes (temp file + `File.Move`) for all file mutations
- Raise events for cross-service communication (e.g., `StorageService.Changed`)

### 7.1 Storage Service

The central data persistence service. Pattern:

- **In-memory cache**: `Dictionary<string, (TEntity Item, string FilePath, DateTimeOffset LastWrite)>` protected by `ReaderWriterLockSlim`
- **Lazy loading**: cache populated on first access from all `*.json` files in `Data/items/`
- **Warm-up**: `WarmUp()` triggers cache loading on a background thread at startup
- **Atomic writes**: write to `.tmp-{guid}.json`, then `File.Move(temp, target, overwrite: true)`
- **File watcher**: `FileSystemWatcher` on the items folder detects external changes and reloads affected items
- **Retry on failure**: failed writes tracked in a `_dirtyIds` set, retried every 30 seconds
- **Suppression**: `SuppressNotifications` flag for bulk operations (prevents N change events)
- **File naming**: prefix by family — e.g., `ac-{id}.json` for actionables, `rf-{id}.json` for reference

Key methods: `Save(item)`, `Get(id)`, `Delete(id)`, `ListAll()`, `Query(filter)`, `Reload()`

### 7.2 Settings Service

Simple single-file JSON settings:

- Reads/writes `Data/meta/settings.json`
- Single cached instance, invalidated on `Reload()`
- Provides defaults for missing values
- Atomic write pattern

### 7.3 Search Service

In-memory inverted index for full-text search:

- **Build**: on startup and on every storage change, tokenize all entities into a `Dictionary<token, HashSet<entityId>>`
- **Tokenize**: split on whitespace, strip punctuation, lowercase, split camelCase
- **Score**: field-weighted scoring (title matches > body matches > tag matches)
- **Commands**: in addition to data search, support command palette entries (e.g., "new task", "backup now", "toggle dark mode")
- **Prefix operators**: `#tag`, `@person`, `>kind`, `due:today` for structured filtering
- **Performance target**: < 100ms for 10,000 items

### 7.4 Backup Service

- **Manual backup**: ZIP the entire `Data/` folder with timestamp filename
- **Auto-backup**: optional scheduled daily backup (configurable time)
- **Retention**: configurable days; auto-prune old backups
- **Restore**: extract ZIP over `Data/`, reload all services
- **Full backup**: includes `Plugins/` folder (normal backup excludes it)

### 7.5 Tags/Metadata Services

- Scan all entities, build `tag -> count` mapping
- Persist to `Data/meta/tags.json` for fast loading
- Rebuild on every storage change
- Support autocomplete in the frontend

### 7.6 Plugin Registry

See Section 12 (Plugin Architecture) for full details.

---

## 8. Data Model Pattern

### 8.1 Base Entity

All entities inherit from an abstract base class:

```csharp
[JsonDerivedType(typeof(ConcreteTypeA))]
[JsonDerivedType(typeof(ConcreteTypeB))]
// ... one attribute per concrete type
public abstract class ItemBase
{
    public string Id { get; set; } = string.Empty;
    public string Family { get; set; } = string.Empty;    // e.g., "actionable", "reference"
    public string Kind { get; set; } = string.Empty;      // e.g., "task", "note", "config"
    public string Title { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;       // Markdown
    public List<string> Tags { get; set; } = new();
    public List<string> Links { get; set; } = new();        // IDs of linked entities
    public DateTimeOffset Created { get; set; }
    public DateTimeOffset Updated { get; set; }
    public bool Favorite { get; set; }
    public bool Archived { get; set; }
    public List<string> Attachments { get; set; } = new();  // filenames
}
```

### 8.2 Family/Kind Discriminator

Entities are organized into **families** (broad categories) and **kinds** (specific types within a family). This enables uniform filtering, sorting, and display while supporting type-specific fields.

Design your domain model by asking:
1. What are the 2-3 broad families of entities? (e.g., "actionable" vs. "reference")
2. What kinds exist within each family? (e.g., task, followup, meeting under actionable)
3. What fields does each kind add beyond the base?

### 8.3 Item Factory

A factory class handles kind-based deserialization from JSON:

```csharp
public static class ItemFactory
{
    private static readonly Dictionary<string, (Type Type, string Family)> KindMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["{{KIND_A}}"] = (typeof({{TypeA}}), "{{FAMILY_1}}"),
        ["{{KIND_B}}"] = (typeof({{TypeB}}), "{{FAMILY_1}}"),
        ["{{KIND_C}}"] = (typeof({{TypeC}}), "{{FAMILY_2}}"),
        // ...
    };

    public static ItemBase FromJson(string json, JsonSerializerOptions options)
    {
        using var doc = JsonDocument.Parse(json);
        var kind = doc.RootElement.GetProperty("kind").GetString()!;
        var info = KindMap[kind];
        var item = (ItemBase)JsonSerializer.Deserialize(json, info.Type, options)!;
        item.Kind = kind;
        item.Family = info.Family;
        return item;
    }
}
```

This pattern lets the frontend send a flat JSON object with a `kind` field, and the shell deserializes it into the correct C# type with all type-specific fields.

### 8.4 Query Filter

A DTO for filtering entity lists:

```csharp
public class QueryFilter
{
    public string? Family { get; set; }
    public string? Kind { get; set; }
    public string? Tag { get; set; }
    public string? Status { get; set; }
    public bool? Archived { get; set; }
    public bool? Favorite { get; set; }
    // ... add domain-specific filter fields
}
```

### 8.5 Storage Layout

```
Data/items/
  {{FAMILY_PREFIX}}-{uuid}.json     # one file per entity
  # e.g., ac-a1b2c3d4.json (actionable), rf-e5f6g7h8.json (reference)
```

One flat folder for all entities. The `family` and `kind` fields inside the JSON discriminate. This keeps storage, backup, indexing, and version-control trivial.

### 8.6 Relationships

Entities reference each other via the `Links` list (flat list of entity IDs). Any entity can link to any other. The frontend renders a "Connected" panel showing linked entities grouped by kind. Typing `[[` in any body field opens an inline picker to create a link (wiki-style).

---

## 9. Frontend Shell

### 9.1 Entry Point (`main.ts`)

```typescript
import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { applyTheme } from './shell/theme';

applyTheme('system');
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme('system'));

mount(App, { target: document.getElementById('app')! });
```

### 9.2 Root Component (`App.svelte`)

The root component assembles the app shell:

```svelte
<div class="flex h-screen flex-col bg-[var(--app-bg)]">
  <NavBar />
  <main class="flex-1 overflow-auto">
    {#key $currentModule.manifest.id}
      <svelte:component this={$currentModule.component} />
    {/key}
  </main>
</div>

<!-- Overlays rendered conditionally -->
{#if $overlay === 'search'}<SearchOverlay />{/if}
{#if $overlay === '{{OVERLAY_NAME}}'}<{{OverlayComponent}} />{/if}

<!-- Toast notification -->
{#if toast}
  <div class="fixed bottom-4 left-1/2 z-50 ...">
    <span>{toast.message}</span>
  </div>
{/if}
```

Key patterns:
- `{#key}` block forces component re-mount on navigation (clean state)
- Overlays are conditionally rendered based on the `overlay` store
- Toast notifications auto-dismiss with a shrinking progress bar

### 9.3 Router (`router.ts`)

Hash-based navigation with Svelte stores:

```typescript
export const currentModule = writable<Module>(defaultModule);
export const overlay = writable<OverlayName | null>(null);
export const dataVersion = writable<number>(0); // increment to trigger reactive refreshes

export function navigate(hash: string) {
    window.location.hash = hash;
    currentModule.set(findModuleByHash(hash) ?? defaultModule);
}

export function openOverlay(name: OverlayName) { overlay.set(name); }
export function closeOverlay() { overlay.set(null); }
export function signalDataChanged() { dataVersion.update(v => v + 1); }
```

The `dataVersion` counter is a lightweight reactive signal — views subscribe to it and refresh their data when it increments, without polling.

### 9.4 Module System (`modules.ts`)

Every view (including built-in ones) is a **module** with a manifest:

```typescript
export interface ModuleManifest {
    id: string;           // e.g., "core.actionables" or "com.example.dashboard"
    name: string;         // display name in nav tab
    entry: string;        // unused for built-in (component reference), used for plugins
    nav: {
        placement: 'main' | 'plugin';
        order: number;
        icon?: string;
    };
}

export interface Module {
    manifest: ModuleManifest;
    component: Component;  // Svelte component
}
```

Built-in modules are statically imported; plugin modules use the generic `PluginView` component (iframe host). Modules are sorted by `nav.order` for display.

**View manifest.json example:**
```json
{
    "id": "core.{{VIEW_NAME}}",
    "name": "{{Display Name}}",
    "entry": "{{view_name}}/index.html",
    "nav": { "placement": "main", "order": 20, "icon": "{{icon_name}}" }
}
```

### 9.5 Shortcuts (`shortcuts.ts`)

Global keyboard shortcut handler:

- `Ctrl+K` / `Cmd+K` — open search overlay
- `?` (when not typing) — open cheat sheet / help overlay
- `Escape` — close any open overlay
- `Alt+1` through `Alt+9` — navigate to tab by position

Shortcuts are registered via a single `window.addEventListener('keydown', ...)` and check `isTypingTarget()` (INPUT, TEXTAREA, contentEditable) to avoid intercepting user typing.

### 9.6 Theme (`theme.ts`)

Three-mode theme system:

1. **Light** — default CSS custom properties
2. **Dark** — `.dark` class on `<html>`, overrides all CSS custom properties
3. **Custom/Colorful** — additional theme with fully customized color palette

Theme resolution: `system` setting reads `prefers-color-scheme` media query. Manual selection stores the preference via `settings.set` bridge call.

---

## 10. Design System

### 10.1 CSS Custom Properties (`tokens.css`)

Define all colors, spacing, and typography as CSS custom properties with a `--{{PREFIX}}-` namespace:

```css
@layer base {
    :root {
        --app-bg: #ffffff;
        --app-surface: #f9fafb;
        --app-text: #111827;
        --app-muted: #6b7280;
        --app-accent: #2563eb;
        --app-border: #e5e7eb;
        --app-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        --app-danger: #dc2626;
        --app-warning: #d97706;
        --app-success: #059669;
        --app-radius: 0.5rem;
        --app-font-sans: system-ui, -apple-system, 'Segoe UI', sans-serif;
        --app-font-mono: ui-monospace, SFMono-Regular, Consolas, monospace;
    }

    .dark {
        --app-bg: #111827;
        --app-surface: #1f2937;
        --app-text: #f9fafb;
        --app-muted: #9ca3af;
        --app-accent: #60a5fa;
        --app-border: #374151;
        --app-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.4);
        --app-danger: #f87171;
        --app-warning: #fbbf24;
        --app-success: #34d399;
    }
}
```

### 10.2 Tailwind Configuration

```javascript
export default {
    darkMode: 'class',
    content: ['./index.html', './src/**/*.{svelte,js,ts,jsx,tsx}'],
    theme: { extend: {} },
    plugins: [],
};
```

Dark mode is toggled by adding/removing the `.dark` class on `<html>`, not by the `media` strategy. This allows manual theme override independent of system preference.

### 10.3 Base Styles (`app.css`)

```css
@import './styles/tokens.css';
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
    body {
        background-color: var(--app-bg);
        color: var(--app-text);
        font-family: var(--app-font-sans);
        margin: 0;
        min-height: 100vh;
    }
    button {
        transition: transform 100ms ease, box-shadow 100ms ease;
    }
    button:active {
        transform: scale(0.96);
    }
}
```

### 10.4 Design Token Usage in Components

Always reference tokens via `var(--app-*)`, never hardcoded colors:

```svelte
<div class="rounded-md border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text)]">
    ...
</div>
```

This ensures plugins and custom themes work correctly.

---

## 11. UI Component Patterns

### 11.1 NavBar

The navigation bar is a fixed-height flex container with three sections:

```
+------------------------------------------------------------------+
|  Tab1  Tab2  Tab3  [... Search bar ...]  [Action] [?] [Settings] |
+------------------------------------------------------------------+
```

- **Left**: Tab buttons generated from `$modules` store, active tab has accent color + bottom indicator
- **Center**: Always-visible search bar (button that opens search overlay, shows `Ctrl+K` hint)
- **Right**: Domain-specific action button (e.g., "Today's Actionables" in green), help button, settings gear

Active tab indicator: an absolutely positioned `<div>` whose `left` and `width` are calculated by measuring the active tab button's bounding rect.

### 11.2 Overlay Pattern

Overlays are modal surfaces that appear over the current view. Pattern:

```svelte
<script lang="ts">
    import { closeOverlay } from '../shell/router';
    // Load data via host.invoke on mount
</script>

<!-- Backdrop -->
<div class="fixed inset-0 z-40 bg-black/50" onclick={closeOverlay}></div>

<!-- Panel -->
<div class="fixed inset-x-0 top-0 z-50 mx-auto mt-16 max-w-2xl rounded-lg bg-[var(--app-surface)] shadow-xl">
    <!-- Content -->
    <input type="text" placeholder="Search..." autofocus />
    <!-- Results -->
</div>
```

Key conventions:
- Click backdrop to close
- `Escape` key to close (handled by global shortcuts)
- Auto-focus the primary input on mount
- Fetch data on mount, not on every keystroke (debounce search)

### 11.3 View Pattern

Each view is a Svelte component in its own folder under `views/`. Pattern:

```svelte
<script lang="ts">
    import { onMount } from 'svelte';
    import { host } from '../../shell/bridge';
    import { dataVersion, navigate } from '../../shell/router';

    let items: any[] = [];

    async function loadData() {
        items = (await host.invoke('items.query', { family: '{{FAMILY}}' })) as any[];
    }

    onMount(loadData);
    $: $dataVersion, loadData(); // reactive reload on data changes
</script>
```

Key conventions:
- Load data on mount and whenever `$dataVersion` changes
- Use `host.invoke` for all data operations
- Navigate with `navigate('#/...')` for hash changes
- Auto-save on field change (no explicit save buttons)
- Show detail panels inline (side panel or expanded row), not in separate routes

### 11.4 Common Components

| Component | Purpose |
|---|---|
| **NavBar** | Tab navigation + toolbar buttons |
| **FilterChips** | Horizontal chip bar for filtering by kind/status/category |
| **TagChips** | Inline tag display; click to navigate to browse view filtered by tag |
| **ConnectedPanel** | Show linked entities grouped by kind |
| **ConfirmDialog** | Modal confirmation for destructive actions |
| **MarkdownPreview** | Render Markdown body as formatted HTML |
| **WikiTextarea** | Textarea with `[[` link picker and `Ctrl+V` image paste |
| **BulkToolbar** | Actions bar for multi-selected items |

---

## 12. Plugin Architecture

### 12.1 Overview

The application is plugin-ready from day one. Built-in views use the same module/manifest contract as plugins, ensuring the plugin path is exercised constantly.

A "plugin" is a folder of web assets (HTML/CSS/JS) that the app discovers, validates, and mounts as a new page in an iframe.

### 12.2 Plugin Manifest (`manifest.json`)

```json
{
    "id": "com.example.{{PLUGIN_NAME}}",
    "name": "{{Plugin Display Name}}",
    "version": "1.0.0",
    "apiVersion": "1",
    "entry": "index.html",
    "icon": "icon.svg",
    "nav": { "placement": "main", "order": 50 },
    "permissions": ["items:read", "items:write", "search", "notify"],
    "settings": [
        { "key": "apiUrl", "label": "API URL", "type": "text", "description": "...", "default": "" }
    ]
}
```

### 12.3 Discovery & Loading

1. At startup, `PluginRegistry` scans `Data/Plugins/*/manifest.json`
2. Each manifest is validated: required fields, unique ID, compatible `apiVersion`, entry file exists
3. Valid+enabled plugins are sent to the frontend via `plugins.list` bridge method
4. The module system adds them as tabs with the generic `PluginView` component
5. Invalid plugins are **skipped, never fatal** — logged and shown in settings with the error

### 12.4 Isolation

- Each plugin loads in a **sandboxed iframe**: `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"`
- Plugins cannot touch the core UI's DOM or other plugins
- Plugin HTML pages are served via the `https://plugins/{id}/` virtual host
- The shell injects the design tokens stylesheet and a companion.js bridge script into every plugin HTML page via `WebResourceRequested`

### 12.5 Permission Model

The manifest declares required permissions. The bridge checks these before executing any method from a plugin origin:

| Permission | Grants |
|---|---|
| `items:read` | `items.get`, `items.query` |
| `items:write` | `items.save`, `items.delete`, `items.bulk` |
| `search` | `search.query` |
| `notify` | `ui.toast` |
| *(none needed)* | `settings.get`, `ui.navigate`, `plugins.getSettings` |

Denied methods return an error response, not silent failure.

### 12.6 Plugin Bridge Communication

Plugin iframes communicate via `window.postMessage`:

```
Plugin iframe  --postMessage-->  Main frame bridge.ts  --host.invoke-->  Shell
       <--postMessage--                    <--WebMessage--
```

The main frame's `bridge.ts` listens for `message` events from plugin origins, proxies them through `host.invoke` with the plugin's origin as `source`, and posts the result back.

### 12.7 Bundled Plugins

Plugins can ship alongside the app in an `App/Plugins/` directory. On first run, the shell copies them to `Data/Plugins/` (never overwrites existing). MSBuild targets in the `.csproj` copy bundled plugins to the build output.

---

## 13. Build & Deployment

### 13.1 Frontend Build (`package.json`)

```json
{
    "scripts": {
        "dev": "vite",
        "build": "vite build",
        "preview": "vite preview",
        "check": "svelte-check --tsconfig ./tsconfig.app.json && tsc -p tsconfig.node.json"
    }
}
```

`npm run build` outputs to `App/Web/dist/`.

### 13.2 Shell Build (`.csproj`)

Key properties:

```xml
<PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net8.0-windows</TargetFramework>
    <UseWindowsForms>true</UseWindowsForms>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
</PropertyGroup>

<PropertyGroup Condition="'$(Configuration)' == 'Release'">
    <PublishSingleFile>true</PublishSingleFile>
    <SelfContained>true</SelfContained>
    <RuntimeIdentifier>win-x64</RuntimeIdentifier>
    <IncludeNativeLibrariesForSelfExtract>true</IncludeNativeLibrariesForSelfExtract>
</PropertyGroup>
```

MSBuild targets copy `Web/dist/` and `Plugins/` to the build output directory on every build and publish.

### 13.3 Version Numbering

Auto-incrementing build number via MSBuild target that reads/writes a `version.build` file:

```xml
<Version>1.0.0.$(NextBuildNumber)</Version>
```

### 13.4 Publish Script (`publish.ps1`)

One-click build + package:

1. `npm ci && npm run build` in `App/Web/`
2. `dotnet publish` with self-contained single-file for `win-x64`
3. Assemble EXE + `Web/dist/` + `README.txt` into `dist/`
4. Create `{{APP_NAME}}.zip`

### 13.5 Distribution ZIP Layout

```
{{APP_NAME}}.zip
+-- {{APP_NAME}}.exe           # Self-contained (~150 MB)
+-- Web/
|   +-- dist/
|       +-- index.html
|       +-- companion.js       # Plugin bridge script
|       +-- styles/tokens.css  # Design tokens for plugins
|       +-- assets/            # Vite-hashed JS/CSS bundles
+-- README.txt
```

### 13.6 Zero-Install Deployment

- Unzip to any user-writable folder
- Double-click the EXE
- No admin rights, no installer, no registry, no prerequisites
- `Data/` and `Logs/` created automatically on first run
- To move: copy the entire folder
- To uninstall: delete the folder
- To update: replace the EXE and `Web/` folder (data preserved)

---

## 14. Testing Strategy

### 14.1 Shell Unit Tests (xUnit)

Test all services independently:

```csharp
public class StorageServiceTests
{
    [Fact]
    public void Save_And_Get_RoundTrips()
    {
        var svc = new StorageService(tempDir, jsonOptions);
        var item = ItemFactory.CreateDefault("task", "Test");
        svc.Save(item);
        var loaded = svc.Get(item.Id);
        Assert.Equal("Test", loaded!.Title);
    }
}
```

Key test scenarios per service:
- **StorageService**: CRUD, atomicity (concurrent writes), corruption handling, query filtering, file watcher
- **SearchService**: tokenization, scoring, prefix operators, command matching
- **BackupService**: create, restore, retention pruning
- **PluginRegistry**: manifest validation, permission checking, duplicate ID detection

### 14.2 Frontend Unit Tests (Vitest)

Test Svelte components and utility functions. Focus on:
- Bridge client behavior (timeout, error handling)
- Router navigation logic
- Module discovery and sorting
- Theme application

### 14.3 End-to-End Tests (Playwright)

Test complete workflows through the actual application:
- Create an item via capture, find it via search
- Navigate between tabs
- Backup and restore
- Plugin loading and bridge calls

---

## 15. Non-Functional Requirements

### 15.1 Performance

| Metric | Target |
|---|---|
| **Startup** | < 2 seconds with 10,000 items |
| **Search** | < 100ms for full-text query over 10,000 items |
| **Save** | < 50ms for single entity save |
| **Navigation** | < 100ms for view switch |
| **Memory** | < 200 MB with 10,000 items loaded |

### 15.2 Offline-First (Shell Mode) / Server-Dependent (Web Mode)

- **Shell mode**: Zero network calls; WebView2 navigation restricted to local virtual hosts; all data stored locally in the `Data/` folder
- **Web mode**: Frontend requires server connectivity; data stored server-side; SPA can be cached via service worker for partial offline capability
- No telemetry, analytics, or phone-home behavior in either mode

### 15.3 Privacy

- **Shell mode**: Data stays in one relocatable folder; optional encryption for sensitive values (DPAPI); backups are plain ZIPs the user controls; no cloud sync
- **Web mode**: Data stays on the server; access controlled by authentication and role-based permissions (§18); HTTPS required for production; no data sent to third parties

### 15.4 Reliability

- **Atomic writes** — temp file + rename prevents corruption
- **Retry on failure** — dirty items tracked and retried every 30 seconds
- **Never crash on I/O errors** — degrade to read-only with visible warning
- **Rolling log files** — daily rotation, easy to diagnose issues

### 15.5 Keyboard-First

- Every view and action reachable without a mouse
- `Ctrl+K` for search/command palette from anywhere
- `Alt+1` through `Alt+N` for tab navigation
- `?` for keyboard shortcut cheat sheet
- `Escape` to close overlays and cancel actions

### 15.6 Security

- Never log or expose secrets/keys
- Sensitive configuration values encrypted at rest (DPAPI in shell mode; server-side secrets management in web mode)
- Plugin permissions enforced at the bridge level
- Plugin iframes sandboxed
- **Shell mode**: no external network access
- **Web mode**: authentication required; role-based access control at the bridge level (§18); HTTPS enforced; CORS and CSP headers configured

### 15.7 Auto-Save

- No explicit "Save" buttons anywhere in the UI
- Every field change triggers an immediate save via the bridge
- Unsaved items tracked in memory if disk write fails

---

## 16. Phased Implementation Template

### Phase 0 — Project Scaffolding & Skeleton Shell

**Goal:** Runnable app that opens a WebView2 window showing "Hello World" from local HTML, with the build pipeline in place.

**Tasks:**
- Create .NET 8 WinForms project with WebView2
- Scaffold frontend (Vite + Svelte + TypeScript + Tailwind)
- Set up virtual host mapping
- Implement bridge protocol and round-trip test
- Implement startup checks
- Configure logging
- Set up project structure

**Deliverable:** Window opens, renders local HTML, bridge round-trips a test message.

### Phase 1 — Data Model & Storage Service

**Goal:** Full CRUD for all entity types, persisted as JSON files.

**Tasks:**
- Define data model classes (base entity + concrete types)
- Implement `ItemFactory`
- Implement `StorageService` with atomic writes, cache, file watcher
- Implement `SettingsService`
- Implement metadata services (tags, etc.)
- Expose bridge methods for CRUD
- Write unit tests

**Deliverable:** All entity types can be created, read, updated, deleted through the bridge.

### Phase 2 — Frontend Shell & Navigation

**Goal:** SPA navigation with page-module architecture, nav bar, and empty view placeholders.

**Tasks:**
- Implement router and module system
- Build NavBar component
- Create view manifests
- Implement design tokens and theming
- Build shared components (stubs)
- Set up keyboard shortcuts

**Deliverable:** App shows nav bar, routes between views, respects dark/light mode.

### Phase 3 — Core Views

**Goal:** Build out all application-specific views with full functionality.

**Tasks:**
- Implement each view as specified in your requirements document
- Build domain-specific components
- Wire up all bridge methods
- Implement inline editing, filtering, grouping, sorting
- Auto-save on every change

**Deliverable:** All views functional with real data.

### Phase 4 — Search & Command Palette

**Goal:** Full-text search with command palette overlay.

**Tasks:**
- Implement `SearchService` with inverted index
- Build search overlay with keyboard navigation
- Support prefix operators and command execution
- Index all entity fields

**Deliverable:** `Ctrl+K` opens search, finds any data, executes commands.

### Phase 5 — Domain-Specific Services

**Goal:** Implement any application-specific backend services.

**Tasks per your requirements:**
- Reminders/notifications
- Data processing/calculations
- Integrations (if any)
- Scheduled tasks

**Deliverable:** All domain services operational.

### Phase 6 — Data Safety & Operations

**Goal:** Backup, restore, import/export.

**Tasks:**
- Implement `BackupService`
- Implement `ExportImportService`
- Add native file dialogs for save/open
- Test backup/restore cycle

**Deliverable:** Users can backup, restore, export, and import data.

### Phase 7 — Plugin Infrastructure

**Goal:** Plugin discovery, loading, and sandboxed execution.

**Tasks:**
- Implement `PluginRegistry`
- Build `PluginView` iframe host
- Implement permission checking
- Create companion.js bridge script for plugins
- Inject design tokens into plugin HTML
- Build plugin settings UI

**Deliverable:** Drop a plugin folder into `Plugins/`, restart, see it as a new tab.

### Phase 8 — Polish & Packaging

**Goal:** Production-ready distributable (shell mode).

**Tasks:**
- Loading overlay during startup
- System tray with context menu
- Global hotkey for capture/quick action
- Error handling audit (disk full, folder locked, etc.)
- Performance testing with 10,000 items
- Publish script
- README / quick start guide

**Deliverable:** A distributable ZIP that runs on any Windows 10/11 machine.

### Phase 9 — Web Server Mode (if required)

**Goal:** Deploy the same frontend as a standalone web application.

**Tasks:**
- Implement bridge adapter pattern in `bridge.ts` (auto-detect shell vs. web)
- Build web server backend (ASP.NET Core or Node.js):
  - Single `POST /api/bridge` endpoint reusing the same `BridgeRouter`
  - WebSocket `/api/events` for server-push events
  - Static file serving for `Web/dist/`
  - File upload endpoint for attachments
- Replace native-dialog bridge methods with web equivalents:
  - `export.*` / `backup.now` → return file bytes, frontend triggers download via Blob URL
  - `import.*` / `backup.restore` → frontend shows `<input type="file">`, sends file content
  - `link.open` → frontend does `window.open(url, '_blank')`
  - `attachments.upload` → multipart `POST /api/attachments/{itemId}`
- Configure CORS, CSP headers, and session management
- Plugin serving: static route `/plugins/{id}/` with token injection middleware
- Test full round-trip in browser

**Deliverable:** `npm run build` produces deployable frontend; server starts with `dotnet run` or `node server.js`; app is fully functional in any modern browser.

### Phase 10 — Multi-User & Roles (if required)

**Goal:** Support multiple users with role-based access control.

**Tasks:**
- Implement authentication middleware (JWT, OIDC, or API key — per requirements)
- Add `session.init` bridge method returning `{ user, role, permissions }`
- Implement `UserContext` in bridge — inject user identity into every handler
- Add `CreatedBy` / `OwnedBy` fields to base entity; storage filters by ownership
- Build frontend `session` store; wire NavBar user display and role-based UI guards
- Implement permission middleware: check role permissions before bridge method execution
- For shell mode: inject user context from OS identity or config file
- Write tests for permission boundaries (role A cannot access role B's data)

**Deliverable:** Multiple users can use the app simultaneously; each sees only their permitted data; role-based feature visibility works in both deployment modes.

---

## 17. Dual Deployment: Shell Mode & Web Server Mode

### 17.1 The Decoupling Principle

The frontend is transport-agnostic. It communicates with the backend exclusively through `host.invoke(method, params)` — a single function exported from `bridge.ts`. By implementing the bridge adapter pattern (§6.5), the same compiled frontend artifact (`Web/dist/`) works in both:

- **Shell mode**: served from local files by WebView2, bridge uses `PostWebMessageAsJson`
- **Web mode**: served by a web server, bridge uses `fetch()` + WebSocket

No view component, overlay, or shared component needs to change. The adapter is selected automatically at startup based on whether `window.chrome?.webview` exists.

### 17.2 Coupling Inventory and Abstraction Strategy

The following table maps every coupling point between the frontend and the native shell, and how each is handled in web mode:

| Coupling point | Files affected | Shell mode | Web mode |
|---|---|---|---|
| **Bridge RPC transport** | `bridge.ts` only | `chrome.webview.postMessage` | `fetch('POST /api/bridge')` |
| **Server-push events** | `bridge.ts` only | `chrome.webview` message listener | WebSocket `/api/events` |
| **Virtual host: `https://companion/`** | None in frontend | WebView2 mapping → `Web/dist/` | Web server serves static files at `/` |
| **Virtual host: `https://attachments/`** | `MarkdownPreview.svelte` | WebView2 mapping → `Data/attachments/` | Web server serves at `/attachments/` |
| **Virtual host: `https://plugins/`** | `bridge.ts`, `PluginView.svelte` | WebView2 mapping → `Data/Plugins/` | Web server serves at `/plugins/` |
| **Shell-injected global** | `router.ts` | `window.__showCaptureOverlay` set by frontend, called by shell via `ExecuteScriptAsync` | Not needed (no shell to trigger it); keyboard shortcut in-browser is sufficient |
| **Native file dialogs** | `Settings.svelte` (5 methods) | Shell shows `SaveFileDialog` / `OpenFileDialog` | Frontend uses `<input type="file">` for open, Blob download for save |
| **Global hotkeys** | Shell P/Invoke | `RegisterHotKey` for Ctrl+Shift+G | Browser shortcuts only (no global OS-level hotkey) |
| **System tray** | Shell `NotifyIcon` | Minimize to tray, balloon tips | Not applicable; use browser `Notification` API or in-app toast |
| **Loading overlay** | Shell `LoadingOverlay.cs` | Native GDI+ panel | CSS/HTML loading screen (optional) |
| **`link.open`** | `Reference.svelte` | Shell calls `Process.Start(url)` | Frontend calls `window.open(url, '_blank')` |
| **`attachments.upload`** | `WikiTextarea.svelte` | Bridge sends base64, shell writes to disk | HTTP `POST /api/attachments/{id}` with multipart form data |

### 17.3 Web Server Backend Architecture

The web server backend reuses the same service classes and the same `BridgeRouter` — it just exposes them over HTTP instead of WebView2 messages.

#### Option A: ASP.NET Core (recommended if shell is already .NET)

```
App/
+-- Shell/                   # Existing .NET host (shell mode)
+-- Server/                  # NEW: ASP.NET Core project (web mode)
|   +-- {{APP_NAME}}.Server.csproj
|   +-- Program.cs           # Kestrel setup, middleware, auth
|   +-- BridgeController.cs  # POST /api/bridge → BridgeRouter.Handle()
|   +-- EventsHub.cs         # WebSocket endpoint for push events
+-- Shared/                  # NEW: Shared library
|   +-- {{APP_NAME}}.Shared.csproj
|   +-- Services/            # StorageService, SearchService, etc. (moved from Shell)
|   +-- Models/              # ItemBase, Settings, etc. (moved from Shell)
|   +-- BridgeRouter.cs      # (moved from Shell)
+-- Web/                     # Frontend (unchanged)
```

The **Shared** project contains all services, models, and the bridge router — code that is identical between shell and server. Both `Shell.csproj` and `Server.csproj` reference `Shared.csproj`.

#### Bridge Controller (single HTTP endpoint)

```csharp
[ApiController]
[Route("api")]
public class BridgeController : ControllerBase
{
    private readonly BridgeRouter _bridge;

    [HttpPost("bridge")]
    public IActionResult Handle([FromBody] BridgeRequest request)
    {
        // Inject user context from auth middleware (see §18)
        request.Source = HttpContext.User.Identity?.Name;
        var response = _bridge.Handle(request);
        return Ok(response);
    }
}
```

Every bridge method works exactly as before — the `BridgeRouter` doesn't know or care that the request came from HTTP instead of WebView2.

#### WebSocket Events Endpoint

```csharp
app.MapGet("/api/events", async (HttpContext context, CancellationToken ct) =>
{
    if (!context.WebSockets.IsWebSocketRequest) { context.Response.StatusCode = 400; return; }
    var ws = await context.WebSockets.AcceptWebSocketAsync();
    var userId = context.User.Identity?.Name;
    eventBroadcaster.AddClient(userId, ws);
    // Keep alive until client disconnects
    await eventBroadcaster.WaitForClose(ws, ct);
});
```

When `StorageService.Changed` fires, the server broadcasts `{ event: "item:changed" }` to all connected WebSocket clients (optionally filtered by user).

#### Static File Serving

```csharp
app.UseStaticFiles();                                    // serves Web/dist/ at /
app.UseStaticFiles(new StaticFileOptions {               // serves attachments
    FileProvider = new PhysicalFileProvider(attachmentsPath),
    RequestPath = "/attachments"
});
app.UseStaticFiles(new StaticFileOptions {               // serves plugins
    FileProvider = new PhysicalFileProvider(pluginsPath),
    RequestPath = "/plugins"
});
```

#### Option B: Node.js / Express (if no .NET)

The same pattern applies: a single `POST /api/bridge` endpoint dispatches to handler functions, a WebSocket endpoint pushes events, and `express.static()` serves files. The services would be re-implemented in TypeScript/JavaScript.

### 17.4 Native-Dialog Bridge Methods in Web Mode

Eight bridge methods in shell mode use native Win32 file dialogs. In web mode, the same method names must work but with different I/O strategies:

| Method | Shell mode | Web mode |
|---|---|---|
| `export.all` | `SaveFileDialog` → write to user-chosen path | Return JSON as response; frontend creates Blob URL and triggers download via `<a download>` |
| `export.item` | `SaveFileDialog` → write .md | Same — return markdown string, frontend downloads |
| `export.selection` | `SaveFileDialog` → write .md | Same |
| `export.journal` | `SaveFileDialog` → write .md | Same |
| `backup.now` | Write ZIP to backup folder | Return ZIP bytes (base64 or stream), frontend downloads |
| `backup.restore` | `OpenFileDialog` → read ZIP | Frontend shows `<input type="file" accept=".zip">`, reads file, sends to `POST /api/bridge` with `backup.restore` + base64 payload |
| `import.json` | `OpenFileDialog` → read JSON | Same pattern — frontend reads file, sends content |
| `import.text` | `OpenFileDialog` → read text | Same |

The frontend can detect `deploymentMode` from the bridge adapter and show the appropriate UI:

```svelte
<script>
  import { deploymentMode } from '../shell/bridge';
</script>

{#if deploymentMode === 'web'}
  <input type="file" accept=".json" on:change={handleFileUpload} />
{:else}
  <button on:click={() => host.invoke('import.json')}>Import JSON</button>
{/if}
```

### 17.5 URL Mapping

Virtual host URLs used in the frontend need to resolve correctly in both modes:

| Virtual host URL (shell mode) | Web server URL (web mode) | Resolution |
|---|---|---|
| `https://companion/index.html` | `/index.html` | Handled by static file middleware; no frontend change needed |
| `https://attachments/{itemId}/{file}` | `/attachments/{itemId}/{file}` | Frontend uses a helper: `getAttachmentUrl(itemId, file)` that returns the correct base URL per mode |
| `https://plugins/{id}/{entry}` | `/plugins/{id}/{entry}` | Same helper pattern; `PluginView.svelte` uses `getPluginUrl(id, entry)` |

Add a URL resolver utility:

```typescript
// shell/urls.ts
import { deploymentMode } from './bridge';

export function attachmentUrl(itemId: string, filename: string): string {
  const base = deploymentMode === 'shell' ? 'https://attachments' : '/attachments';
  return `${base}/${itemId}/${filename}`;
}

export function pluginUrl(pluginId: string, entry: string): string {
  const base = deploymentMode === 'shell' ? 'https://plugins' : '/plugins';
  return `${base}/${pluginId}/${entry}`;
}
```

### 17.6 Feature Availability by Mode

Some features only make sense in one mode:

| Feature | Shell mode | Web mode | Notes |
|---|---|---|---|
| Global hotkey (OS-level) | Yes | No | Browser security prevents global OS hotkeys |
| System tray icon | Yes | No | Browser `Notification` API is the alternative |
| Minimize to tray | Yes | No | Standard browser tab behavior instead |
| Native file dialogs | Yes | No | HTML file inputs + Blob downloads instead |
| In-browser shortcuts | Yes | Yes | `Ctrl+K`, `?`, `Alt+1-N` work in both |
| Auto-save | Yes | Yes | Same behavior |
| Plugins (iframe) | Yes | Yes | Same sandbox model |
| Offline usage | Yes | Partial | Service worker can cache the SPA; data requires server |

The frontend can use `deploymentMode` to conditionally hide shell-only features (e.g., don't show "Global Hotkey" in settings when running in web mode).

---

## 18. Multi-User Support

### 18.1 Design Principle

The base architecture is single-user (one person's data, no auth). Multi-user support is added as a **layer on top** — it never removes single-user capability. Shell mode defaults to single-user (the OS user); web mode enables multi-user when authentication is configured.

User identity and roles flow **from the backend to the frontend**, never the reverse. The frontend never makes authentication decisions — it renders what the backend tells it to.

### 18.2 User Context Model

```typescript
// Shared type used by both frontend and backend
interface UserContext {
  userId: string;            // unique user identifier
  displayName: string;       // "Jane Smith"
  email?: string;            // "jane@example.com"
  role: string;              // "admin" | "editor" | "viewer" | {{CUSTOM_ROLES}}
  permissions: string[];     // ["items:read", "items:write", "admin:settings", ...]
  preferences?: Record<string, unknown>;  // user-specific settings (theme, default view, etc.)
}
```

```csharp
// C# equivalent
public class UserContext
{
    public string UserId { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string Role { get; set; } = "viewer";
    public List<string> Permissions { get; set; } = new();
    public Dictionary<string, object>? Preferences { get; set; }
}
```

### 18.3 Session Initialization

A new bridge method `session.init` returns the current user's context. The frontend calls this once on startup:

```typescript
// shell/session.ts
import { writable } from 'svelte/store';
import { host } from './bridge';

export const session = writable<UserContext | null>(null);

export async function initSession(): Promise<void> {
  const ctx = (await host.invoke('session.init')) as UserContext;
  session.set(ctx);
}
```

Called from `main.ts` before mounting the app:

```typescript
await initSession();
mount(App, { target: document.getElementById('app')! });
```

### 18.4 How User Identity is Provided

User identity originates from the **outer environment** — the backend receives it and passes it through.

#### Shell mode (single-user default)

The shell constructs a `UserContext` from the OS user identity:

```csharp
_bridge.Register("session.init", _ => new UserContext
{
    UserId = Environment.UserName,
    DisplayName = Environment.UserName,
    Role = "admin",  // single-user = full access
    Permissions = AllPermissions,
});
```

For enterprise shell deployments where identity comes from Active Directory or a config file:

```csharp
_bridge.Register("session.init", _ =>
{
    var identity = LoadIdentityFromConfig();  // reads from settings or AD
    return new UserContext
    {
        UserId = identity.SamAccountName,
        DisplayName = identity.DisplayName,
        Email = identity.Email,
        Role = identity.Role,    // mapped from AD group membership
        Permissions = ResolvePermissions(identity.Role),
    };
});
```

#### Web mode (multi-user)

The web server extracts user identity from the authentication middleware and injects it into the bridge handler:

```csharp
_bridge.Register("session.init", (p, userContext) => userContext);
```

The `userContext` is populated by auth middleware before the bridge call is dispatched (see §18.6).

### 18.5 Role & Permission Model

Roles are coarse labels; permissions are fine-grained capabilities. Define your roles and their permission sets in your requirements document.

#### Example role matrix

| Permission | `admin` | `editor` | `viewer` |
|---|---|---|---|
| `items:read` | Yes | Yes | Yes |
| `items:write` | Yes | Yes | No |
| `items:delete` | Yes | Yes | No |
| `items:bulk` | Yes | Yes | No |
| `search` | Yes | Yes | Yes |
| `backup:create` | Yes | No | No |
| `backup:restore` | Yes | No | No |
| `import` | Yes | Yes | No |
| `export` | Yes | Yes | Yes |
| `settings:read` | Yes | Yes | Yes |
| `settings:write` | Yes | No | No |
| `plugins:manage` | Yes | No | No |
| `admin:users` | Yes | No | No |

#### Backend permission checking

The `BridgeRouter` is extended with a permission check before dispatching:

```csharp
public class BridgeRouter
{
    private readonly Dictionary<string, (Func<JsonElement, UserContext, object?> Handler, string? Permission)> _handlers = new();

    public void Register(string method, Func<JsonElement, UserContext, object?> handler, string? requiredPermission = null)
        => _handlers[method] = (handler, requiredPermission);

    public BridgeResponse Handle(BridgeRequest request, UserContext user)
    {
        if (!_handlers.TryGetValue(request.Method, out var entry))
            return new BridgeResponse { Id = request.Id, Error = $"Unknown method: {request.Method}" };

        if (entry.Permission != null && !user.Permissions.Contains(entry.Permission))
            return new BridgeResponse { Id = request.Id, Error = $"Permission denied: requires '{entry.Permission}'" };

        try
        {
            return new BridgeResponse { Id = request.Id, Result = entry.Handler(request.Params, user) };
        }
        catch (Exception ex)
        {
            return new BridgeResponse { Id = request.Id, Error = ex.Message };
        }
    }
}
```

Registration with permissions:

```csharp
_bridge.Register("items.query", (p, user) =>
{
    var filter = JsonSerializer.Deserialize<QueryFilter>(p.GetRawText(), JsonOptions);
    filter ??= new QueryFilter();
    filter.UserId = user.UserId;  // scope to current user's data
    return _storage.Query(filter);
}, requiredPermission: "items:read");

_bridge.Register("items.save", (p, user) =>
{
    var item = ItemFactory.FromJson(p.GetRawText(), JsonOptions);
    item.OwnedBy ??= user.UserId;  // default owner is creator
    if (item.OwnedBy != user.UserId && !user.Permissions.Contains("admin:users"))
        throw new UnauthorizedAccessException("Cannot modify another user's item");
    _storage.Save(item);
    return new { id = item.Id };
}, requiredPermission: "items:write");
```

### 18.6 Authentication Middleware (Web Mode)

The web server authenticates requests before they reach the bridge. The authentication method is specified in your requirements document.

#### Option A: JWT Bearer tokens (API / SPA)

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => { /* configure issuer, audience, signing key */ });
```

The SPA receives a JWT from your identity provider (OIDC flow) and sends it with every `fetch()` via the `Authorization` header. The `HttpAdapter` adds:

```typescript
headers: { 'Authorization': `Bearer ${getToken()}` }
```

#### Option B: Cookie-based session (traditional web)

```csharp
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie()
    .AddOpenIdConnect(options => { /* configure OIDC provider */ });
```

The SPA uses `credentials: 'include'` on fetch calls (already in the `HttpAdapter`).

#### Option C: Reverse proxy header injection (enterprise / intranet)

A reverse proxy (IIS, nginx, Azure AD App Proxy) authenticates the user and injects headers:

```
X-Forwarded-User: jane@example.com
X-Forwarded-Roles: editor
```

The web server reads these headers and constructs the `UserContext`:

```csharp
app.Use(async (context, next) =>
{
    var userId = context.Request.Headers["X-Forwarded-User"].FirstOrDefault();
    var roles = context.Request.Headers["X-Forwarded-Roles"].FirstOrDefault();
    if (!string.IsNullOrEmpty(userId))
    {
        context.Items["UserContext"] = new UserContext
        {
            UserId = userId,
            Role = roles ?? "viewer",
            Permissions = ResolvePermissions(roles ?? "viewer"),
        };
    }
    await next();
});
```

This is the simplest option for intranet deployments where the proxy handles authentication.

### 18.7 Data Ownership and Scoping

In multi-user mode, every entity gets ownership metadata:

```csharp
public abstract class ItemBase
{
    // ... existing fields ...
    public string? CreatedBy { get; set; }   // userId of the creator
    public string? OwnedBy { get; set; }     // userId of the current owner
}
```

`StorageService.Query()` is extended with user-scoping:

```csharp
public List<ItemBase> Query(QueryFilter filter)
{
    var results = ListAll();

    // User-scoping: non-admin users see only their own items
    if (!string.IsNullOrEmpty(filter.UserId))
        results = results.Where(i => i.OwnedBy == filter.UserId || i.OwnedBy == null).ToList();

    // ... existing filter logic ...
}
```

**Shared data**: items with `OwnedBy = null` are visible to all users (e.g., shared reference documents). Admins can set items as shared by clearing the `OwnedBy` field.

For file-based storage (shell mode or simple web server), each user's items are still in the same `Data/items/` folder, discriminated by the `OwnedBy` field. For database-backed storage, this becomes a simple `WHERE` clause.

### 18.8 Frontend Role-Based UI

The `session` store drives conditional rendering throughout the frontend:

```svelte
<script>
  import { session } from '../shell/session';

  function hasPermission(perm: string): boolean {
    return $session?.permissions.includes(perm) ?? false;
  }
</script>

<!-- Only show delete button if user has write permission -->
{#if hasPermission('items:delete')}
  <button on:click={deleteItem}>Delete</button>
{/if}

<!-- Admin-only settings -->
{#if $session?.role === 'admin'}
  <AdminPanel />
{/if}

<!-- User display in NavBar -->
<span class="text-sm text-[var(--app-muted)]">{$session?.displayName}</span>
```

A utility component simplifies permission checks:

```svelte
<!-- components/Guarded.svelte -->
<script lang="ts">
  import { session } from '../shell/session';
  export let permission: string;
  export let fallback: string = '';
</script>

{#if $session?.permissions.includes(permission)}
  <slot />
{:else if fallback}
  <span class="text-xs text-[var(--app-muted)]">{fallback}</span>
{/if}
```

Usage:

```svelte
<Guarded permission="items:write">
  <button on:click={saveItem}>Save</button>
</Guarded>
```

### 18.9 Multi-User in Shell Mode

Even in shell mode, the user context pattern works. Default: the OS user gets `role: "admin"` with all permissions. But for enterprise desktop deployments:

- A `users.json` config file can define local users and roles
- Active Directory group membership can be mapped to roles at startup
- The shell can read environment variables or registry keys set by group policy

The key point: **the frontend code is identical regardless of how user identity is provided.** It always calls `session.init` and renders based on what comes back.

### 18.10 Permission Inheritance for Plugins

Plugin permissions (§12.5) are intersected with user permissions. A plugin that requires `items:write` but is used by a `viewer` (who lacks `items:write`) will have its write calls denied:

```csharp
public bool IsMethodAllowed(string sourceUri, string method, UserContext user)
{
    var pluginPermission = GetPermissionForMethod(method);
    if (pluginPermission == null) return false;
    if (pluginPermission == string.Empty) return true;

    // Plugin must have declared the permission in manifest
    var plugin = GetPluginFromUri(sourceUri);
    if (plugin == null || !plugin.Permissions.Contains(pluginPermission)) return false;

    // AND the user must have the permission
    return user.Permissions.Contains(pluginPermission);
}
```

---

## Appendix A: Vite Configuration

```typescript
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
    plugins: [svelte()],
});
```

## Appendix B: TypeScript Configuration

Use the `@tsconfig/svelte` base configuration with separate configs for app and node:

```json
// tsconfig.json
{
    "files": [],
    "references": [
        { "path": "./tsconfig.app.json" },
        { "path": "./tsconfig.node.json" }
    ]
}
```

## Appendix C: Solution File Structure

```
{{APP_NAME}}.sln
  +-- App/Shared/{{APP_NAME}}.Shared.csproj         # Services, models, bridge router
  +-- App/Shell/{{APP_NAME}}.Shell.csproj            # → references Shared (shell mode)
  +-- App/Server/{{APP_NAME}}.Server.csproj          # → references Shared (web mode, optional)
  +-- App/Shared.Tests/{{APP_NAME}}.Shared.Tests.csproj
```

The frontend (Web/) is not part of the .NET solution — it's built separately by npm/Vite and its output is copied into the shell's build output by MSBuild targets (shell mode) or served by the web server (web mode).

## Appendix D: .gitignore Essentials

```
# .NET
bin/
obj/
*.user

# Frontend
App/Web/node_modules/
App/Web/dist/

# Runtime
Data/
Logs/
WebView2Data/
*.zip

# Build artifacts
dist/
publish/
version.build
```
