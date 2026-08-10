# LPG Plant ERP — F1 Demo Build Implementation Plan

Implementation plan for the F1 (Demo) build of the LPG Plant ERP system — a zero-install Windows desktop application built on .NET 9 + WebView2 + Svelte 5, delivering a fully-functional client demo with 30 days of simulated plant data.

> **Document status:** Updated to reflect actual built state after 6 development phases (as of 2026-08-10).
> Divergences from the original design intent are marked **[IMPL NOTE]**.

---

## Background

Three spec documents govern this project:
- **`generic-architecture-spec.md`** — reusable architecture blueprint (WebView2 shell + Svelte SPA, bridge pattern, dual shell/web deployment)
- **`lpg-erp-functional-spec.md`** — business rules for an LPG storage, filling & distribution plant (GRN/bowser receiving, cylinder filling, distributor sales, ledgers, daily closing)
- **`lpg-erp-technical-spec.md`** — LPG-specific implementation detail on top of the generic architecture, including 9 deliberate deviations (repository abstraction, two-tier save, append-only postings, etc.)

**F1 is the immediate deliverable.** It is one ZIP file the client can run on any Windows machine with no installation, to review look-and-feel and validate business rules before real development commits to F2 (plant build, SQLite) and F3 (multi-user web build).

---

## What F1 Deliberately Fakes

| Feature | F1 treatment |
|---|---|
| Data entry | Generated on first launch via `DemoDataService` — not real-time entry |
| Authentication | Free-text name typed into native shell bar dialog; no password |
| Day-lock enforcement | Disabled (`#if !DEMO` guard in `PostingEngine`) — lets client explore closed days |
| Printing | On-screen preview only; no stationery |
| Tax, multi-plant, multi-currency | Not included (pending client decisions) |
| Backup/restore | Stubbed (`backup.now`, `backup.restore` bridge stubs return `{ok:true}`) |
| Export (PDF/Excel) | Stubbed (`export.file` returns empty base64) |
| Attachments | Stubbed (`attachments.upload` returns random GUID) |

**Everything else is real:** real posting engine, real calculations, real ledger arithmetic, real reports. Changing a rate must make the figures move correctly.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Shell host | **.NET 9** (`net9.0-windows`), WinForms, `Microsoft.Web.WebView2 1.0.4129.50` |
| Logging | `Serilog.Sinks.File 7.0.0` |
| JSON | `System.Text.Json` (built-in, camelCase policy) |
| Testing (backend) | `xUnit` |
| Frontend framework | Svelte 5 (`^5.x`) + TypeScript (`~6.x`) |
| Build tool | Vite (`^8.x`) |
| CSS | Tailwind CSS (`^3.x`) + PostCSS/autoprefixer |
| Testing (frontend) | Vitest + Playwright |

> **[IMPL NOTE]** Original plan stated .NET 8. The project targets .NET 9 (`net9.0-windows`).

---

## Solution Structure

```
LpgErp/
├── App/
│   ├── Shared/                    # All business logic — services, models, bridge router
│   │   ├── LpgErp.Shared.csproj
│   │   ├── BridgeProtocol.cs      # BridgeRequest / BridgeResponse DTOs
│   │   ├── BridgeRouter.cs        # Permission-aware dispatch (Func<JsonElement, UserContext, object?>)
│   │   ├── UserContext.cs         # User identity + role + permissions
│   │   ├── RolePermissions.cs     # Role → permission set mapping
│   │   ├── Models/
│   │   │   ├── EntityBase.cs / DocumentBase.cs / DocStatus.cs / QueryFilter.cs
│   │   │   ├── EntityFactory.cs   # Kind-string → concrete type deserialisation
│   │   │   ├── Masters/           # BankAccount, Customer, CylinderSize, ExpenseCategory,
│   │   │   │                      # PlantUser, RateCard, Supplier, Tank, Transporter, Vehicle
│   │   │   ├── Documents/         # CashDeposit, CashHandover, DailyClosing, ExpenseVoucher,
│   │   │   │                      # FillingBatch, GatePass, Grn, Invoice, Receipt,
│   │   │   │                      # StockAdjustment, SupplierPayment, TankLog
│   │   │   └── Postings/          # CashBankEntry, LedgerEntry, StockMovement, TankMovement
│   │   ├── Persistence/
│   │   │   ├── IRepository.cs     # Get<T>, Query<T>, Save<T>, SaveBatch, BeginUnitOfWork, NextSequence
│   │   │   ├── IUnitOfWork.cs
│   │   │   ├── JsonRepository.cs  # F1: one JSON file per record, kind-subfoldered, month-partitioned postings
│   │   │   └── SequenceService.cs # DocNo sequence per kind per month
│   │   ├── Services/
│   │   │   ├── PostingEngine.cs         # ★ pre-compute → validate → generate → balance-guard → commit in one UoW
│   │   │   ├── BalanceGuard.cs          # Post-effect balance assertions (no negative stock/cash)
│   │   │   ├── DemoBalanceGuard.cs      # Relaxed balance guard for demo mode
│   │   │   ├── BalanceGuardResult.cs    # IsValid, Errors, Warnings
│   │   │   ├── ValidationResult.cs      # IsValid, Errors, Warnings
│   │   │   ├── PostResult.cs            # Success, DocNo, Errors, Warnings
│   │   │   ├── EffectSet.cs             # Container: LedgerEntries, StockMovements, TankMovements, CashBankEntries, DocumentUpdates
│   │   │   ├── DayLockedException.cs    # Thrown by PostingEngine when posting to a locked day (F2+)
│   │   │   ├── DashboardService.cs      # BuildSnapshot(asOf?)
│   │   │   ├── TankService.cs           # Status(asOf?), Reconciliation(asOf?)
│   │   │   ├── CashBankService.cs       # Position(asOf?), Consolidated(asOf?)
│   │   │   ├── LedgerService.cs         # Statement(partyId, from, to), Ageing(asOf?)
│   │   │   ├── InventoryService.cs      # Balances(asOf?), MovementRegister(filter)
│   │   │   ├── ClosingService.cs        # Preflight(date), Compile(date, user), Approve
│   │   │   ├── MasterDataService.cs     # Demo data seeding helpers; live queries via BridgeRegistration
│   │   │   ├── RateService.cs           # Effective-dated rate resolution (BR-MST-03)
│   │   │   ├── ReportService.cs         # Run(reportId, params) → 7 report types
│   │   │   ├── PrintService.cs          # BuildPrintPayload(doc, repo) — static
│   │   │   ├── SettingsService.cs       # Get/Set JSON-backed settings
│   │   │   ├── DemoDataService.cs       # F1 ONLY — 30-day simulation seeded deterministically
│   │   │   ├── Validators/              # One IDocumentValidator per document kind (13 total)
│   │   │   │   ├── IDocumentValidator.cs
│   │   │   │   ├── InvoiceValidator.cs
│   │   │   │   ├── GrnValidator.cs
│   │   │   │   ├── ReceiptValidator.cs
│   │   │   │   ├── FillingBatchValidator.cs
│   │   │   │   ├── TankLogValidator.cs
│   │   │   │   ├── GatePassValidator.cs
│   │   │   │   ├── ExpenseVoucherValidator.cs
│   │   │   │   ├── CashDepositValidator.cs
│   │   │   │   ├── CashHandoverValidator.cs
│   │   │   │   ├── SupplierPaymentValidator.cs
│   │   │   │   ├── StockAdjustmentValidator.cs
│   │   │   │   └── DailyClosingValidator.cs
│   │   │   └── Generators/              # One IEffectGenerator per document kind (12 concrete + interface)
│   │   │       ├── IEffectGenerator.cs
│   │   │       ├── InvoiceGenerator.cs
│   │   │       ├── GrnGenerator.cs
│   │   │       ├── FillingBatchGenerator.cs
│   │   │       ├── TankLogGenerator.cs
│   │   │       ├── GatePassGenerator.cs
│   │   │       ├── ReceiptGenerator.cs
│   │   │       ├── ExpenseVoucherGenerator.cs
│   │   │       ├── CashDepositGenerator.cs
│   │   │       ├── CashHandoverGenerator.cs
│   │   │       ├── SupplierPaymentGenerator.cs
│   │   │       ├── StockAdjustmentGenerator.cs
│   │   │       └── DailyClosingGenerator.cs
│   │   └── Calc/
│   │       ├── Money.cs                  # Decimal rounding helpers (2dp / 3dp)
│   │       ├── GaugeConversion.cs        # Rotogauge % → kg (linear approximation in F1)
│   │       ├── CostingCalculator.cs      # Weighted average cost (BR-PUR-08)
│   │       ├── InvoiceCalculator.cs      # Invoice line totals (BR-SAL-07)
│   │       ├── VarianceCalculator.cs     # Tank variance (BR-TNK-04)
│   │       └── RateAnalyticsService.cs   # Weighted average rate, domestic cylinder analytics
│   │
│   ├── Shell/                            # F1/F2 — WebView2 host
│   │   ├── LpgErp.Shell.csproj
│   │   ├── Program.cs
│   │   ├── MainWindow.cs                 # TableLayoutPanel: context bar (28px) + WebView2 (fill)
│   │   ├── MainWindow.Designer.cs
│   │   ├── BridgeLogger.cs               # Structured bridge call logging
│   │   └── BridgeRegistration.cs         # All 43 bridge route registrations + private helpers
│   │
│   ├── DataSeedTool/                     # Standalone CLI tool to re-seed demo data
│   │   └── DataSeedTool.csproj
│   │
│   ├── Server/                           # F3 stub (not built in F1)
│   │   └── LpgErp.Server.csproj
│   │
│   ├── Shared.Tests/
│   │   ├── BridgeRouterTests.cs
│   │   ├── JsonRepositoryTests.cs
│   │   ├── UserContextTests.cs
│   │   ├── Calc/
│   │   │   ├── CostingCalculatorTests.cs
│   │   │   ├── GaugeConversionTests.cs
│   │   │   ├── InvoiceCalculatorTests.cs
│   │   │   ├── MoneyTests.cs
│   │   │   ├── RateAnalyticsServiceTests.cs
│   │   │   └── VarianceCalculatorTests.cs
│   │   └── Posting/
│   │       ├── BalanceGuardTests.cs
│   │       ├── DemoDataConsistencyTests.cs  # Generated data must balance
│   │       ├── GeneratorTests.cs
│   │       ├── PostingEngineTests.cs        # Heaviest test surface
│   │       ├── PostingLoopIntegrationTests.cs
│   │       ├── PostingTestBase.cs
│   │       └── ValidatorTests.cs
│   │
│   └── Web/                              # Svelte SPA
│       └── src/
│           ├── shell/                    # bridge.ts, format.ts, helpContent.ts
│           ├── components/               # Badge, Card, ContextBar, DataTable, HelpModal,
│           │                             # KpiTile, LineGrid, PartyPicker, PostBar, TankGauge
│           ├── overlays/                 # LoginView, PrintPreview, DemoControls
│           └── views/
│               ├── dashboard/            # DashboardView.svelte
│               ├── sales/                # SalesView.svelte
│               ├── purchase/             # PurchaseView.svelte
│               ├── plant/                # PlantView.svelte
│               ├── inventory/            # InventoryView.svelte
│               ├── accounts/             # AccountsView.svelte
│               ├── closing/              # ClosingView.svelte
│               ├── reports/              # ReportsView.svelte
│               └── masters/              # MastersView.svelte  ⚠️ STUB ONLY
│
├── docs/
│   ├── f1-demo-implementation-plan.md   # This file
│   ├── generic-architecture-spec.md
│   ├── lpg-erp-functional-spec.md
│   ├── lpg-erp-technical-spec.md
│   └── ui-test-walkthrough.md
├── Demo-Guide.md
├── LpgErp.sln
└── publish.ps1
```

> **[IMPL NOTE]** The plan originally listed several service classes that are not present as separate files. Their functionality is inlined in `BridgeRegistration.cs` private static methods or handled entirely by the `PostingEngine` pipeline:
> - `PurchaseService.cs` — not present; GRN/payment queries in `BridgeRegistration`
> - `FillingService.cs` — not present; handled by `PostingEngine` + `FillingBatchGenerator`
> - `SalesService.cs` — not present; `CustomerSnapshot` and `OpenGatePasses` in `BridgeRegistration`
> - `ReceiptService.cs` — not present; receipts post directly through `PostingEngine`
> - `ExpenseService.cs` — not present; `OutstandingExpenses()` in `BridgeRegistration`
> - `SqliteRepository.cs` — not present (planned for F2, not stubbed in F1)
> - `LookupService.cs` — not a separate file; lookup logic is in `BridgeRegistration`
> - `BackupService.cs` — not a separate file; backup bridge stubs are inline no-ops
> - `ExportService.cs` — not a separate file; export bridge stub is an inline no-op
> - `LoadingOverlay.cs`, `StartupChecker.cs` — not confirmed present; startup logic may be in `Program.cs`
> - `DataSeedTool/` — **added** (not in original plan); standalone CLI to re-seed demo data

---

## Key Architecture Decisions (as built)

### D1 — Repository abstraction: JSON for F1
`IRepository` interface with `JsonRepository` implementation. Persistence coupling confined to one layer. `SqliteRepository` (F2) will implement the same interface — no service changes needed to switch.

### D2 — Two-tier save: Draft / Posted
- **Draft:** auto-save-style via `doc.draft` bridge call. No ledger or stock effect.
- **Post:** explicit user action (`F9` / Post button). `PostingEngine` runs the full pipeline atomically.

### D3 — Append-only posting rows
Ledger, stock, tank, and cash/bank balances are computed by summing rows. Corrections post a reversing document — history is never edited.

### D4 — `ComputeInvoiceTotals` pre-step (implemented addition)
The `PostDocument` bridge handler calls `ComputeInvoiceTotals(inv)` before `engine.Post()` for invoices. This derives `NetInvoice`, `GrossTotal`, and `CreditAmount` from the `RefillLines.Amount` values supplied by the frontend, so `InvoiceValidator`'s payment-split check has a correct `NetInvoice` to compare against.

> **[IMPL NOTE]** This pre-compute step was not in the original spec. It is needed because the frontend sends pre-calculated line amounts but does not send `NetInvoice` — and `InvoiceCalculator.Calculate` needs `NominalWeightKg` from the CylinderSize master, which would require an extra repo lookup. Summing line amounts already present is equivalent and simpler.

### D5 — Day-lock disabled in F1
The `PostingEngine` wraps the day-lock check in `#if !DEMO`. Demo data spans closed days; blocking them would prevent exploration.

---

## Posting Engine Contract

```
PostingEngine.Post(doc, user):
  0. Pre-compute [Invoice only]: ComputeInvoiceTotals(inv) → sets NetInvoice, GrossTotal, CreditAmount
  1. Guard: day lock (disabled in F1 via #if !DEMO)
  2. Validate: document-specific IDocumentValidator.Validate(doc, repo)
  3. Generate: IEffectGenerator.Generate(doc, user, repo) → EffectSet (nothing written yet)
  4. Guard: BalanceGuard.Assert(effects) → no negative tank/cylinder/cash balance after effects
  5. Assign DocNo: repo.NextSequence(kind, docDate) → "{yyyyMM}-{seq:D5}"
  6. Commit: single unit of work — doc + all effects atomically
  7. Notify: data:changed event to frontend
```

### Effect generators per document kind

| Kind | Effects Generated |
|---|---|
| `gatePass` | None (marker only — sets `gatePassStatus = "open"`) |
| `grn` | TankMovement(In per decant line), LedgerEntry(Credit supplier), CashBankEntry if direct payment |
| `supplierPayment` | LedgerEntry(Debit supplier), CashBankEntry(Credit cash/bank) |
| `fillingBatch` | TankMovement(Out drawn kg), StockMovement(Out: emptyCylinder), StockMovement(In: filledCylinder) |
| `tankLog` | TankMovement(variance snapshot only — no qty flow to the balance) |
| `invoice` | LedgerEntry(Debit customer), StockMovements(Out: filledCylinder/newCylinder/valve; In: emptyCylinder returns), CashBankEntries(cash/bank split), GatePass document updated → `"billed"` |
| `receipt` | LedgerEntry(Credit customer), CashBankEntry(Debit cash/bank) |
| `expenseVoucher` | CashBankEntry(Credit cash/bank) |
| `cashDeposit` | CashBankEntry(Debit bank, Credit cash) |
| `cashHandover` | CashBankEntry(Credit cash) |
| `stockAdjustment` | StockMovement(delta In or Out) |
| `dailyClosing` | No financial effects (marker document; all effects already posted) |

All generators implement `GenerateReversal()` for cancellation (mirror-image sign flip, append-only — never deletes).

---

## Validator Behaviours (as built)

| Kind | Hard errors | Warnings (post succeeds) |
|---|---|---|
| `invoice` | Gate pass not found / already billed; customer inactive; rate = 0 on any line; rate override without auth+reason; payment split > net+recovery; credit limit exceeded without override | **Filled/new/valve stock short** |
| `grn` | Second weight ≥ first weight; decant total ≠ net received; supplier inactive; rate = 0; shortage > 1% tolerance without claim flag | **Projected tank level > safe fill** |
| `receipt` | Allocations provided AND total > receipt amount; per-allocation amount > open invoice balance | None |
| `fillingBatch` | Empty cylinder stock insufficient; tank gas insufficient; loss % > 1.5% without explanation | None |
| `tankLog` | No readings provided; variance > tolerance without explanation + approver | None |
| `gatePass` | VehicleNo blank; customer inactive | None |
| `expenseVoucher` | Amount = 0; category inactive; above approval threshold without verifier name | None |
| `supplierPayment` | Amount = 0; supplier inactive; bank account required if method = bank/cheque/online | None |
| `cashDeposit` | Amount = 0; bank account inactive | None |
| `cashHandover` | Amount = 0; purpose blank; receivedBy blank | None |
| `stockAdjustment` | QtyDelta = 0; reason blank; cylinder kinds need sizeCode | None |
| `dailyClosing` | Always `Ok()` — pre-screened by `Preflight()` | None |

> **[IMPL NOTE]** Original spec had filled-cylinder and safe-fill checks as hard errors. Downgraded to warnings because:
> - **Stock:** demo data balances fills against sales each day, leaving zero opening stock for a new session. Blocking sales on zero stock would make the demo unusable.
> - **Safe fill:** demo tank is already at ~60% from 30 days of seeded GRNs; a 12,000 kg test GRN would exceed the threshold. The physical check is the operator's responsibility; the system advises but does not block.

> **[IMPL NOTE]** `ReceiptValidator` originally required `allocations.sum == receipt.amount`. Changed to allow fully-unallocated (on-account) receipts, because `AccountsView.svelte` always sends `allocations: []` — there is no UI for invoice allocation in F1.

---

## Closing Service — Preflight

`Preflight(date, repo)` checks:

1. **Closing tank log** — required for each active tank that had at least one `TankMovement` on `date`. Idle tanks (no GRN received, no filling drawn) are skipped.
2. **Draft invoices** — any invoice for `date` still in `Draft` status is flagged.
3. **Tank variance** — for each closing log posted, variance % > `tank.VarianceTolerancePercent` is flagged.

> **[IMPL NOTE]** Original spec required closing logs for ALL active tanks. Changed to only tanks with activity because the two-tank demo has only TK-001 active most days; requiring a log for TK-002 (Auxiliary, idle) blocked the closing step in the walkthrough.

Preflight issues are advisory — the **Compile** button is not disabled by preflight failures. Issues are shown in the UI for the user to decide whether to proceed.

---

## Bridge API (all 43 registered routes)

| Route | Permission | Description |
|---|---|---|
| `ping` | — | Health check |
| `debug.log` | — | Writes message to Serilog |
| `session.init` | — | Returns `UserContext` (no auth in F1) |
| `session.switchRole` | — | Sets active role (F1 stub) |
| `dashboard.snapshot` | — | `DashboardService.BuildSnapshot(asOf?)` |
| `tanks.status` | `tanks:read` | `TankService.Status(asOf?)` |
| `tanks.reconciliation` | `tanks:read` | `TankService.Reconciliation(asOf?)` |
| `inventory.balances` | `inventory:read` | `InventoryService.Balances(asOf?)` |
| `inventory.movementRegister` | `inventory:read` | Filtered `StockMovement` query |
| `ledger.statement` | `ledger:read` | `LedgerService.Statement(partyId, from?, to?)` |
| `ledger.ageing` | `ledger:read` | `LedgerService.Ageing(asOf?)` |
| `cashbank.position` | `finance:read` | `CashBankService.Position(asOf?)` |
| `cashbank.consolidated` | `finance:read` | `CashBankService.Consolidated(asOf?)` |
| `expenses.outstanding` | `finance:read` | Unpaid expense vouchers |
| `closing.preflight` | `closing:run` | `ClosingService.Preflight(date, repo)` |
| `closing.compile` | `closing:run` | `ClosingService.Compile(date, user, repo)` |
| `closing.approve` | `closing:approve` | Sets closing `Status=Approved` |
| `rates.daily` | `reports:read` | Daily rate analytics |
| `rates.current` | `reports:read` | Current rate card |
| `rates.save` | `rates:write` | Saves `RateCard` entity |
| `rates.history` | `reports:read` | Rate card change history |
| `reports.run` | `reports:read` | `ReportService.Run(reportId, params)` |
| `masters.list` | `masters:read` | List masters by kind (kind matched via `ToLowerInvariant()`) |
| `masters.get` | `masters:read` | Single master by id+kind |
| `masters.save` | `masters:write` | Upsert master entity |
| `masters.deactivate` | `masters:write` | Sets `IsActive=false` |
| `sales.customerSnapshot` | `sales:read` | Outstanding balance + last 5 invoices |
| `sales.openGatePasses` | `sales:read` | Unlinked posted gate passes with `status="open"` |
| `doc.draft` | — | Save document as `Draft` |
| `doc.discard` | — | Archive and cancel a draft |
| `doc.post` | — | Pre-compute (Invoice) → `PostingEngine.Post()` |
| `doc.approve` | — | Set `Status=Approved` |
| `doc.cancel` | — | `PostingEngine.Cancel()` |
| `doc.get` | — | Single document by id+kind |
| `doc.query` | — | List documents by kind + date range |
| `print.payload` | `reports:read` | `PrintService.BuildPrintPayload(doc, repo)` |
| `lookup.query` | — | Search Customer, Supplier, BankAccount, Tank, CylinderSize, ExpenseCategory |
| `settings.get` | — | Read settings.json |
| `settings.set` | `admin:users` | Write settings.json |
| `backup.now` | `admin:users` | **Stub** |
| `backup.restore` | `admin:users` | **Stub** |
| `export.file` | `reports:read` | **Stub** (returns empty base64) |
| `attachments.upload` | — | **Stub** (returns random GUID) |
| `demo.reseed` | `admin:users` | Triggers `DemoDataService` re-seed |
| `demo.setProfile` | `admin:users` | Saves demo profile setting |
| `demo.jumpToDate` | `admin:users` | Saves demo jump date |

> **[IMPL NOTE]** `doc.*` routes are registered with empty permission string (`""`). Role-level access control for document kinds is enforced in the frontend (module visibility, button visibility) rather than at the bridge layer in F1. This will be hardened in F2.

> **[IMPL NOTE]** `masters.list` uses `kind.ToLowerInvariant()` switch matching. Frontend callers may pass mixed-case kind strings (e.g., `"cylinderSize"`, `"bankAccount"`) — C# lowercases before the switch, so all match.

---

## Frontend Views

| Module | File | Status | Tabs / Features |
|---|---|---|---|
| Dashboard | `DashboardView.svelte` | ✅ Full | KPI tiles, tank gauges (TankGauge), stock summary, cash/bank position, overdue distributors, alerts |
| Sales | `SalesView.svelte` | ✅ Full | Customer picker (PartyPicker), gate pass selector (open passes for customer), vehicle auto-fill, refill lines (LineGrid), payment split, print support |
| Purchase | `PurchaseView.svelte` | ✅ Full | Tabs: GRN (weights, decant tank), Supplier Payment |
| Plant | `PlantView.svelte` | ✅ Full | Tabs: Status (TankGauge), Gate Pass (issue + register), Tank Log (labeled fields), Filling Batch (labeled fields) |
| Inventory | `InventoryView.svelte` | ✅ Full | Balance table, movement register with date filters |
| Accounts | `AccountsView.svelte` | ✅ Full | Tabs: Receipt (on-account, no allocation UI), Expense, Ledger (statement + ageing), Cash & Bank |
| Closing | `ClosingView.svelte` | ✅ Full | Preflight checklist, Compile, Approve, Print |
| Reports | `ReportsView.svelte` | ✅ Full | 7 report types: salesRegister, purchaseRegister, stockMovement, distributorStatement, tankReconciliation, dailyClosing, rateAnalytics |
| Masters | `MastersView.svelte` | ⚠️ **Stub** | Placeholder text only — no CRUD UI implemented |

> **[IMPL NOTE]** `MastersView.svelte` is a 4-line stub. Master data management (create/edit customers, suppliers, tanks, rate cards) is not implemented in F1. Masters are managed via `DataSeedTool` or direct JSON file editing.

---

## Frontend Components

| Component | File | Key props / behaviour |
|---|---|---|
| Card | `Card.svelte` | White surface container |
| Badge | `Badge.svelte` | `text`, `type` (success/warning/danger/info) |
| KpiTile | `KpiTile.svelte` | `label`, `value` — dashboard metric |
| DataTable | `DataTable.svelte` | `columns: {key, label}[]`, `rows: any[]` |
| LineGrid | `LineGrid.svelte` | Keyboard-navigable editable grid for invoice lines |
| PartyPicker | `PartyPicker.svelte` | Live-search typeahead; F4 trigger; calls `lookup.query` |
| TankGauge | `TankGauge.svelte` | SVG tank visual; `name`, `percent`, `currentKg`, `capacityKg`, `safeFillKg` |
| PostBar | `PostBar.svelte` | Fixed bottom bar: Draft / Post (F9) / Cancel; displays `errors[]` (red), `warnings[]` (amber), `success` (green) |
| ContextBar | `ContextBar.svelte` | Top context bar: plant name, business date, user + role, sign-out |
| HelpModal | `HelpModal.svelte` | F1 / `?` key help overlay; `pageId` prop for context-sensitive content |

> **[IMPL NOTE]** `PostBar` originally accepted only `errors[]`. Updated to also accept `warnings[]` (amber advisory list, post succeeded) and `success` (green confirmation string). All post functions in all views now clear the form and show a success message on `res.ok === true`.

---

## Overlays

| File | Description |
|---|---|
| `LoginView.svelte` | Full-page login; calls `session.init`; sets session if `authenticated !== false` |
| `PrintPreview.svelte` | Print overlay for invoice, GRN, daily closing; `window.print()` |
| `DemoControls.svelte` | `Ctrl+Shift+G` toggle; demo guide, profile selection (busy/slow/month-end), reseed, jump-to-date |

---

## Frontend Shell Files

| File | Description |
|---|---|
| `bridge.ts` | `bridgeCall(method, params)` — type-safe wrapper over `window.chrome.webview.postMessage` |
| `format.ts` | `money()`, `qtyKg()`, `date()`, `pct()` formatters |
| `helpContent.ts` | Module-keyed help text for all 9 modules (shown in HelpModal on F1 / `?`) |

> **[IMPL NOTE]** `helpContent.ts` and `HelpModal.svelte` were not in the original plan. Added to provide contextual help for the demo walkthrough.

---

## Date Handling

All views and components use `new Date().toLocaleDateString('en-CA')` to produce `YYYY-MM-DD` dates in the **local timezone**. The original implementation used `toISOString().split('T')[0]` which produced UTC dates — at midnight in IST (+5:30), this would return yesterday's date, breaking gate pass filtering and document `docDate` fields.

> **[IMPL NOTE]** This was a systematic bug affecting all 7 views. Fixed globally.

---

## Role Permissions

| Role | Permissions |
|---|---|
| **Data Entry Operator** | `dashboard:read`, `sales:read/write`, `purchase:read/write`, `tanks:read/write`, `inventory:read`, `masters:read` |
| **Cashier** | `dashboard:read`, `sales:read/write`, `finance:read/write`, `reports:read` |
| **Plant Supervisor** | `dashboard:read`, `sales:read/write/post`, `purchase:read/write/post`, `tanks:read/write/post`, `inventory:read/write`, `masters:read`, `closing:run` |
| **Accounts Officer** | `dashboard:read`, `sales:read/post/cancel`, `purchase:read/post/cancel`, `finance:read/write`, `reports:read`, `closing:run/approve` |
| **Plant Manager** | `dashboard:*`, `sales:*`, `purchase:*`, `tanks:*`, `inventory:*`, `finance:*`, `closing:*`, `masters:*`, `rates:write`, `reports:read`, `admin:users` |
| **Managing Director / CEO** | `*` (all) |

> **[IMPL NOTE]** `Plant Supervisor` originally lacked `masters:read`. Added because `PlantView.svelte` loads tanks, cylinder sizes, and customer names via `masters.list` — without `masters:read` the Status tab and all Tank Log / Filling Batch dropdowns were empty.

> **[IMPL NOTE]** `ledger:read` is not granted to any named role. `LedgerService` routes are accessible only to roles with wildcard permissions (Plant Manager, MD/CEO). For F2, Accounts Officer should receive `ledger:read`.

---

## Demo Data

`DemoDataService` generates **30 days** of simulated plant activity on first launch, deterministically seeded. Data is anchored to today's date (day 30 = today, day 1 = 29 days ago). Each day includes:

- Daily closings (locked for past days, open for today)
- GRN bowser receipts
- Filling batches (11.8 kg domestic cylinders primarily)
- Sales invoices (20 seeded distributors, varying quantities)
- Receipts (partial payments, on-account)
- Tank dip logs (opening + closing per active tank)

Opening stock is seeded via `openingStockKg` on `Tank` entities. Cylinder opening stock is implied by the net fill-vs-sell balance across the 30-day window.

> **[IMPL NOTE]** Original plan stated 90 days. Built as 30 days. At the end of the 30-day period, filled cylinder stock is approximately zero (fills balance sales), which is by design — the demo walkthrough starts a new day by filling first, then selling.

---

## Known Stubs / Deferred to F2

| Item | Status |
|---|---|
| `MastersView.svelte` | Stub — no CRUD UI |
| `SqliteRepository` | Not present; designed for F2 |
| Backup / restore | Bridge stubs only |
| PDF / Excel export | Bridge stub only |
| Attachment upload | Bridge stub only |
| Receipt invoice allocation UI | Not implemented — receipts are on-account only in F1 |
| `ledger:read` permission for Accounts Officer | Missing — fix in F2 |
| `doc.*` bridge permission enforcement | Frontend-only in F1; bridge-level enforcement in F2 |
| Urdu interface / print headers | Not implemented |
| `lib/Counter.svelte` | Svelte scaffold remnant — unused, safe to delete |
