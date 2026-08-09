# LPG Plant ERP — Technical Specification

**Document type:** Technical Specification & Data Model (for the development team)
**Companion documents:**
- *LPG Plant ERP — Functional Specification* (business rules, referenced here as **BR-xxx-nn**)
- *Generic Desktop Application Architecture Specification* (referenced here as **the architecture spec**, by section number)

**Target of this document:** implementation of the LPG Plant ERP on the generic architecture, delivered as flavoured iterations, beginning with a **Windows desktop demo build seeded with realistic sample data** for client look-and-feel review.

---

## 1. Purpose and scope

This document tells the development team *how* to build what the Functional Specification describes. It covers deployment flavours, project structure, storage architecture, the complete data model, the document posting engine, the calculation engine, the bridge API surface, the frontend view inventory, the sample data generator, and the phased build plan.

It does **not** restate business rules. Where behaviour is required, it cites the rule number from the Functional Specification. Section 17 maps every business rule to the code that enforces it.

**Document map.** §2–3 deployment flavours and architectural conformance · §4–6 structure, storage, data model · §7–8 posting and calculation engines · §9 bridge API · §10 frontend · §11 sample data · §12–15 print, security, testing, performance · §16 phased build plan · §17 rule traceability · §18 open decisions · **§19 F1 distribution package** · **§20 native shell context bar** · **§21 data-entry design standard** · **§22 web-mode parity discipline** · §23 revised open decisions.

---

## 2. Deployment flavours

Three flavours are produced from one codebase, in this order. Each is a shippable artefact.

| # | Flavour | Purpose | Mode | Users | Storage | Status of data |
|---|---|---|---|---|---|---|
| **F1** | **Demo build** | Client look-and-feel review; requirement validation before real development | Shell (WebView2) | Single, role-switchable | JSON files | Generated sample data, resettable |
| **F2** | **Plant build** | Live single-plant operation at the plant | Shell (WebView2) | Single machine, logged-in role | SQLite | Real |
| **F3** | **Networked build** | Multiple counters, head office access, MD on mobile | Web (ASP.NET Core + browser) | Multi-user, authenticated | SQLite or SQL Server | Real |

The architecture spec's dual-mode design (§17) makes F3 a transport and hosting change, not a rewrite — provided the rules in §3 below are observed from day one.

**F1 is the immediate deliverable.** Everything in this document is written so that F1 can be built quickly without creating rework for F2 and F3.

### 2.1 What F1 deliberately fakes

State these to the client up front so the demo is not mistaken for a working plant system:

| Faked in F1 | Why | Becomes real in |
|---|---|---|
| Data is generated on first launch, not entered | The client must see full dashboards, ledgers and closing reports on day one, anchored to today's date (§19.3) | F2 |
| Identity typed into the shell bar dialog, no password | Lets the client type their own staff names and see the MD view and the operator view in one sitting (§20.3) | F2 (local login), F3 (login screen + cookie) |
| No day-lock enforcement | Demo data spans closed days; locking them would prevent exploration | F2 |
| Print produces on-screen preview only | Real stationery formats need client's letterhead and paper size | F2 |
| Single plant, single currency, no tax | Pending open questions in the Functional Specification §F.2 | F2 |
| Backup/restore stubbed | Not meaningful against generated data | F2 |

Everything else in F1 is real: real calculations, real posting logic, real ledger arithmetic, real reports rendered from real aggregation code. **The demo must not contain hardcoded screenshot numbers.** If the client changes a rate and re-runs a day, the figures must move correctly, because that is what tells you whether the business rules are right.

---

## 3. Conformance to the generic architecture, and deliberate deviations

### 3.1 Adopted unchanged

| Architecture spec section | Adopted |
|---|---|
| §2 One frontend, two deployment modes | Yes — F1/F2 shell, F3 web, same SPA |
| §3 Technology stack | Yes — .NET 8 + WebView2, Svelte 5 + TypeScript + Vite + Tailwind |
| §5 Shell host patterns | Yes — entry point, startup gauntlet, main window, loading overlay |
| §6 Bridge protocol and adapter pattern | Yes, with the permission-aware router from §18.5 adopted from the start |
| §7 Service layer conventions | Yes — plain classes, constructor-injected paths, atomic writes, events |
| §9 Frontend shell (router, modules, shortcuts, theme) | Yes |
| §10 Design system, CSS custom property tokens | Yes |
| §13 Build and deployment, publish script, zero-install ZIP | Yes |
| §14 Testing strategy | Yes, with heavier emphasis on posting-engine tests |
| §15.5 Keyboard-first | Yes — critical for weighbridge and billing counters |
| §18 Multi-user, UserContext, permission-checked router | Structure adopted in F1; enforcement activated in F2/F3 |

### 3.2 Deliberate deviations

These are the points where an ERP's needs differ from the note-taking application the architecture spec was distilled from. Each deviation is deliberate and must be understood before coding.

#### D1 — Storage: repository abstraction, JSON for F1, SQLite from F2

*Architecture spec §7.1 / §8.5: one JSON file per entity in a flat `Data/items/` folder.*

That model is right for a few thousand independent notes. It is wrong for an ERP that must compute running ledger balances, aggregate a day across five document types, and guarantee that an invoice's stock effect and ledger effect commit together. Loading every file to total a month's sales does not survive contact with two years of data.

**Deviation:** persistence sits behind an `IRepository` interface. `JsonRepository` (F1) and `SqliteRepository` (F2 onward) implement it. Services depend on the interface only.

This mirrors the architecture spec's own strongest idea — the bridge adapter (§6.5) confines transport coupling to one file. We confine persistence coupling to one layer for the same reason and with the same benefit.

```csharp
public interface IRepository
{
    T? Get<T>(string id) where T : EntityBase;
    IReadOnlyList<T> Query<T>(QueryFilter filter) where T : EntityBase;
    void Save<T>(T entity) where T : EntityBase;
    void SaveBatch(IEnumerable<EntityBase> entities);   // one atomic unit
    IUnitOfWork BeginUnitOfWork();                       // see D2
    long NextSequence(string sequenceKey, DateOnly forDate);
}
```

`JsonRepository` implements `SaveBatch` as write-all-temp-then-move-all, and `IUnitOfWork` as an in-memory staging buffer flushed on commit. It is not crash-proof under power loss; that is acceptable for a demo and is precisely why F2 moves to SQLite.

#### D2 — Posting is transactional and explicit, not auto-save

*Architecture spec §15.7: no Save buttons, every field change writes immediately.*

Auto-save is correct for a draft document and dangerous for a posted one. A half-entered invoice must never reduce cylinder stock. The rule that an invoice's stock effect and ledger effect can never move independently (**BR-SAL-10**, **BR-PUR-12**) requires a transaction boundary that auto-save cannot express.

**Deviation — two-tier save semantics:**

- **Draft state:** auto-save applies exactly as the architecture spec describes. The operator can walk away from a half-filled GRN and it survives. Drafts have no ledger or stock effect whatsoever.
- **Posting:** an explicit, deliberate user action (`F9` / **Post** button). Posting runs validation, generates all side effects, and commits them in a single unit of work. Partial posting is impossible.

The UI must make the state obvious: draft documents carry a visible amber DRAFT badge; posted documents are read-only with a POSTED badge and a Cancel action.

#### D3 — Append-only posting entities

Ledger balances, stock balances and cash/bank balances are never stored as editable numbers (**BR-LED-06**, **BR-INV-03**). They are computed by folding an append-only stream of posting rows (§6.5). Corrections happen by posting a reversing document (**BR-AUD-03**), never by editing history.

This makes the audit trail structural rather than a bolt-on log.

#### D4 — Search is lookup, not full-text prose

*Architecture spec §7.3: inverted index over title and body with prose tokenisation.*

There is no prose in this application. Operators search by invoice number, GRN number, vehicle number, distributor name, driver name, CNIC and gate pass number. The command palette concept is retained and valuable, but the index is built over identifier fields with exact and prefix matching, plus fuzzy matching on party names only.

#### D5 — The base entity is document-shaped

The architecture spec's `ItemBase` (§8.1) carries `Title`, `Body` (Markdown), `Favorite` and `Attachments`, which suit notes. Our base carries document number, document date, status and posting metadata. `Body`, `Tags` and `Links` are dropped; `Attachments` is retained (weighbridge slips, deposit slips, bills). See §6.1.

#### D6 — Printing is a first-class service

The architecture spec has no print story. This application cannot ship without one: gate passes and invoices are printed at the counter while the vehicle waits. A `PrintService` and print-specific CSS are required from F2, previewed in F1. See §12.

#### D7 — Permission-aware router from day one

The architecture spec introduces the `UserContext`-carrying router as a later phase (§18). Retrofitting it across a large ERP method surface is expensive. We adopt the §18.5 signature — `Func<JsonElement, UserContext, object?>` with a `requiredPermission` — from the first bridge method registered. In F1 the context is a switchable demo user with all permissions; the plumbing is already correct.
#### D8 — Global context lives in the native shell, not the page

The current user, role, plant and business date are rendered by the **shell**, in a fixed native strip outside the WebView2 control, not by the SPA. Clicking it opens a native dialog to change name and role; confirming reloads the WebView. Design in §20. In web mode identity comes from a login screen and a server-set session cookie, and the same strip is rendered in HTML by the SPA behind a capability flag — identical layout to the user, identical source of truth (`session.init`) in the code.

#### D9 — Frontend is written for web mode from the first line

F3 must be reachable by changing only the backend (§22). That is not achievable by intention alone — it requires latency discipline, concurrency tokens, capability flags and a continuously exercised browser harness, all adopted during F1. §22 makes these binding.

---

## 4. Solution structure

Following the architecture spec §4, with LPG-specific services.

```
LpgErp/
├── App/
│   ├── Shared/                              # All logic; referenced by Shell and Server
│   │   ├── LpgErp.Shared.csproj
│   │   ├── BridgeProtocol.cs
│   │   ├── BridgeRouter.cs                  # permission-aware (arch spec §18.5)
│   │   ├── UserContext.cs
│   │   ├── Models/
│   │   │   ├── EntityBase.cs
│   │   │   ├── Masters/                     # Customer, Supplier, Tank, CylinderSize,
│   │   │   │                                # RateCard, BankAccount, ExpenseCategory, PlantUser
│   │   │   ├── Documents/                   # Grn, Invoice, Receipt, SupplierPayment,
│   │   │   │                                # ExpenseVoucher, FillingBatch, TankLog,
│   │   │   │                                # StockAdjustment, CashDeposit, CashHandover,
│   │   │   │                                # DailyClosing
│   │   │   ├── Postings/                    # LedgerEntry, StockMovement, CashBankEntry,
│   │   │   │                                # TankMovement
│   │   │   ├── EntityFactory.cs             # kind-based deserialisation (arch spec §8.3)
│   │   │   └── QueryFilter.cs
│   │   ├── Persistence/
│   │   │   ├── IRepository.cs
│   │   │   ├── IUnitOfWork.cs
│   │   │   ├── JsonRepository.cs            # F1
│   │   │   ├── SqliteRepository.cs          # F2
│   │   │   └── SequenceService.cs           # document numbering
│   │   ├── Services/
│   │   │   ├── SettingsService.cs
│   │   │   ├── LookupService.cs             # replaces SearchService (D4)
│   │   │   ├── BackupService.cs
│   │   │   ├── MasterDataService.cs
│   │   │   ├── RateService.cs               # effective-dated rate resolution (BR-MST-03)
│   │   │   ├── PostingEngine.cs             # ★ the core: validate → generate → commit
│   │   │   ├── PurchaseService.cs           # GRN, supplier payments
│   │   │   ├── TankService.cs               # tank logs, gauge conversion, reconciliation
│   │   │   ├── FillingService.cs            # filling batches
│   │   │   ├── SalesService.cs              # gate pass, invoice, empties
│   │   │   ├── ReceiptService.cs            # collections, allocation (BR-LED-03)
│   │   │   ├── ExpenseService.cs
│   │   │   ├── CashBankService.cs           # deposits, handovers, positions
│   │   │   ├── LedgerService.cs             # balances, ageing, statements
│   │   │   ├── InventoryService.cs          # stock balances, movement register
│   │   │   ├── ClosingService.cs            # daily closing compilation and lock
│   │   │   ├── RateAnalyticsService.cs      # weighted averages, domestic cylinder rate
│   │   │   ├── ReportService.cs             # all report generation
│   │   │   ├── ExportService.cs             # PDF/Excel
│   │   │   ├── PrintService.cs              # print payload preparation (D6)
│   │   │   └── DemoDataService.cs           # F1 sample data generator (§11)
│   │   └── Calc/
│   │       ├── GaugeConversion.cs           # rotogauge % → kg
│   │       ├── CostingCalculator.cs         # weighted average cost
│   │       ├── InvoiceCalculator.cs
│   │       └── VarianceCalculator.cs
│   │
│   ├── Shell/                               # F1, F2 — WebView2 host
│   │   ├── LpgErp.Shell.csproj
│   │   ├── Program.cs
│   │   ├── MainWindow.cs
│   │   ├── MainWindow.Designer.cs
│   │   ├── StartupChecker.cs
│   │   ├── LoadingOverlay.cs
│   │   └── BridgeRegistration.cs            # all bridge method registrations
│   │
│   ├── Server/                              # F3 — ASP.NET Core host
│   │   ├── LpgErp.Server.csproj
│   │   ├── Program.cs
│   │   ├── BridgeController.cs
│   │   ├── EventBroadcaster.cs
│   │   └── AuthMiddleware.cs
│   │
│   ├── Shared.Tests/
│   │   ├── PostingEngineTests.cs            # ★ heaviest test surface
│   │   ├── InvoiceCalculatorTests.cs
│   │   ├── CostingCalculatorTests.cs
│   │   ├── GaugeConversionTests.cs
│   │   ├── ClosingServiceTests.cs
│   │   ├── LedgerServiceTests.cs
│   │   └── DemoDataConsistencyTests.cs      # generated data must balance (§11.4)
│   │
│   └── Web/                                 # Svelte SPA
│       └── src/
│           ├── shell/                       # bridge, session, router, modules,
│           │                                # shortcuts, theme, urls, format
│           ├── components/
│           ├── overlays/
│           └── views/                       # one folder per view (§10)
│
├── specs/
├── LpgErp.sln
├── publish.ps1
└── README.txt
```

### 4.1 Runtime data folders

```
Data/
├── db/                  # lpgerp.db (F2+)
├── items/               # entity JSON (F1 only), subfoldered by kind
├── meta/                # settings.json, sequences.json
├── attachments/         # weighbridge slips, deposit slips, bills, by document id
├── demo/                # generator seed and profile (F1 only)
└── backups/
Logs/
WebView2Data/
```

---

## 5. Storage architecture

### 5.1 F1 — JsonRepository

Entities are stored one file per record, but **subfoldered by kind** rather than in one flat folder, because query patterns are kind-scoped:

```
Data/items/
├── customer/      cust-{id}.json
├── supplier/      supp-{id}.json
├── tank/          tank-{id}.json
├── grn/           grn-{id}.json
├── invoice/       inv-{id}.json
├── receipt/       rcpt-{id}.json
├── ledgerEntry/   led-{yyyyMM}-{id}.json
├── stockMovement/ stk-{yyyyMM}-{id}.json
└── ...
```

Posting entities are additionally **partitioned by month** in the filename so that a month-scoped query need not deserialise years of history.

An in-memory cache with `ReaderWriterLockSlim` follows the architecture spec §7.1. Warm-up loads masters and the current plus previous month of postings; older partitions load on demand.

### 5.2 F2 — SqliteRepository

One SQLite file, WAL mode, with tables matching the entity model in §6. `IUnitOfWork` maps to a real SQLite transaction, which is the point of the exercise. Indexes at minimum on: document number, document date, party id, kind + status, and `(partyId, docDate)` for ledger folding.

Migration from F1 to F2 is a one-time import command that reads the JSON tree and writes the database, retained as a developer tool and as the go-live data-load path for opening balances (**BR-MST-08**).

### 5.3 Numbering

`SequenceService` issues document numbers with a configurable pattern per document type — for example `INV-{YY}{MM}-{0000}`, `GRN-{YY}{MM}-{000}`. Numbers are issued **at posting, not at draft creation**, so abandoned drafts do not consume numbers and the posted series has no gaps. Gapless issue is guaranteed by taking the sequence inside the posting unit of work.

---

## 6. Data model

### 6.1 Base entity (deviation D5)

```csharp
public abstract class EntityBase
{
    public string Id { get; set; } = string.Empty;         // GUID
    public string Family { get; set; } = string.Empty;     // master | document | posting
    public string Kind { get; set; } = string.Empty;       // invoice, grn, tankLog, ...
    public DateTimeOffset Created { get; set; }
    public DateTimeOffset Updated { get; set; }
    public string? CreatedBy { get; set; }
    public string? UpdatedBy { get; set; }
    public bool Archived { get; set; }
}

public abstract class DocumentBase : EntityBase
{
    public string DocNo { get; set; } = string.Empty;      // issued at posting
    public DateOnly DocDate { get; set; }
    public TimeOnly DocTime { get; set; }
    public DocStatus Status { get; set; } = DocStatus.Draft;
    public string? PostedBy { get; set; }
    public DateTimeOffset? PostedAt { get; set; }
    public string? ApprovedBy { get; set; }
    public DateTimeOffset? ApprovedAt { get; set; }
    public string? CancelledBy { get; set; }
    public DateTimeOffset? CancelledAt { get; set; }
    public string? CancelReason { get; set; }
    public string? ReversesDocId { get; set; }             // set on reversal documents
    public string? Remarks { get; set; }
    public List<string> Attachments { get; set; } = new();
}

public enum DocStatus { Draft, Posted, Approved, Cancelled }
```

### 6.2 Family and kind map (`EntityFactory`)

| Family | Kinds |
|---|---|
| `master` | `customer`, `supplier`, `tank`, `cylinderSize`, `rateCard`, `bankAccount`, `expenseCategory`, `plantUser`, `vehicle`, `transporter` |
| `document` | `gatePass`, `grn`, `supplierPayment`, `fillingBatch`, `tankLog`, `invoice`, `receipt`, `expenseVoucher`, `cashDeposit`, `cashHandover`, `stockAdjustment`, `dailyClosing` |
| `posting` | `ledgerEntry`, `stockMovement`, `tankMovement`, `cashBankEntry` |

### 6.3 Master entities

**Customer (distributor)**
`code`, `name`, `contactPerson`, `mobile`, `cnic`, `address`, `salesOfficer`, `creditLimit`, `creditDays`, `openingBalance`, `openingBalanceDate`, `openingCylinderHolding[]` (size → qty), `priceGroup`, `isActive`, `blockOnLimitBreach` (bool)

**Supplier**
`code`, `name`, `contactPerson`, `mobile`, `ntn`, `address`, `paymentTerms`, `openingBalance`, `openingBalanceDate`, `isActive`

**Tank**
`tankNo`, `name`, `capacityKg`, `safeFillPercent` (default 85), `gaugeTableId`, `isActive`, `openingStockKg`, `openingStockDate`, `varianceTolerancePercent`

**CylinderSize**
`sizeCode` (`6`, `11.8`, `15`, `45.4`, custom), `nominalWeightKg`, `displayName`, `isDomestic` (bool — the 11.8 kg flag drives **BR-RAT-02**), `sortOrder`, `isActive`

**RateCard** — effective-dated (**BR-MST-03**)
`effectiveFrom` (date + time), `effectiveTo` (null = current), `priceGroup`, `status` (draft/approved), `approvedBy`, and lines:
- `refillRates[]`: `sizeCode`, `rateBasis` (`perKg` | `perCylinder`), `rate`
- `newCylinderPrices[]`: `sizeCode`, `price`
- `valvePrice`, `accessoryPrices[]`
- `defaultLoadingUnloadingRate`

`RateService.Resolve(date, time, priceGroup)` returns the card in force. Invoice lines store the resolved rate **and** the `rateCardId` used, so an invoice is reproducible and is never repriced.

**BankAccount**
`bankName`, `branch`, `accountTitle`, `accountNumber`, `accountType`, `openingBalance`, `openingBalanceDate`, `isActive`

**ExpenseCategory**
`name`, `parentId` (one level of grouping), `isCapital` (bool), `requiresApprovalAbove` (amount), `isActive`

**PlantUser**
`username`, `displayName`, `role`, `permissions[]`, `assignedBankAccounts[]`, `isActive`

### 6.4 Transaction documents

**GatePass** — `vehicleNo`, `driverName`, `driverCnic`, `driverMobile`, `customerId`, `inTime`, `outTime`, `invoiceId` (null until billed), `status` (`open` | `billed` | `exited` | `cancelled`)

**Grn** (bowser receiving)
- Header: `supplierId`, `purchaseOrderNo`, `bowserNo`, `driverName`, `driverCnic`, `driverMobile`, `transporterId`, `arrivalTime`, `challanQtyKg`
- Weighbridge: `firstWeightKg`, `firstWeightAt`, `firstSlipRef`, `secondWeightKg`, `secondWeightAt`, `secondSlipRef`, `netReceivedKg` *(derived, **BR-PUR-02**)*
- Decanting lines: `tankId`, `quantityKg`, `levelBeforePercent`, `levelAfterPercent`
- Cost: `rateBasis`, `ratePerKg`, `gasValue`, `freight`, `weighbridgeCharges`, `otherCharges`, `discount`, `netLandedCost`, `landedRatePerKg` *(derived, **BR-PUR-07**)*
- Shortage: `shortageKg`, `shortageValue`, `claimStatus` *(**BR-PUR-04**)*

**SupplierPayment** — `supplierId`, `grnId` (nullable, for on-account payments), `method` (`bankTransfer` | `cash` | `directDeposit` | `onlineTransfer` | `cheque` | `driverPartPayment` | `advanceAdjustment`), `bankAccountId`, `amount`, `referenceNo`, `chequeNo`, `chequeDate`, `remarks`

**TankLog** — `tankId`, `logDate`, `slot` (`opening` | `closing` | `spot`), `rotogaugePercent`, `liquidLevelPercent`, `pressureBar`, `temperatureC`, `vapourPressure`, `operatorName`, `derivedQtyKg` *(computed, §8.1)*, `systemQtyKg`, `varianceKg`, `variancePercent`, `varianceExplanation`, `varianceApprovedBy`

**FillingBatch** — `tankId`, `sizeCode`, `cylindersFilled`, `valvesFitted`, `nominalGasKg` *(derived)*, `actualGasDrawnKg`, `fillingLossKg` *(derived)*, `lossPercent`, `lossExplanation`, `shift`, `supervisorName`

**Invoice** — the central document
- Header: `gatePassId`, `customerId`, `vehicleNo`, `driverName`, `salesOfficer`, `rateCardId`
- `emptiesReturned[]`: `sizeCode`, `qtyGood`, `qtyDamaged`
- `refillLines[]`: `sizeCode`, `qty`, `rateBasis`, `rate`, `gasKg` *(derived)*, `amount`, `rateOverridden` (bool), `overrideReason`, `overrideBy`
- `newCylinderLines[]`: `sizeCode`, `qty`, `price`, `amount`
- `valveLines[]`: `qty`, `price`, `amount`
- `otherLines[]`: `itemName`, `qty`, `price`, `amount`
- `loadingUnloadingAmount` *(single combined field, **BR-SAL-06**)*
- Totals: `refillTotal`, `newCylinderTotal`, `valveTotal`, `otherTotal`, `grossTotal`, `discount`, `netInvoice`
- Snapshot at posting: `previousOutstanding`, `recoveredAgainstPrevious`, `totalOutstandingAfter`, `cylinderHoldingAfter[]`
- Payment split: `cashAmount`, `bankAmount` + `bankAccountId`, `chequeAmount` + `chequeNo`/`chequeDate`, `onlineAmount`, `creditAmount` *(derived)*
- `creditLimitOverrideBy`, `creditLimitOverrideReason`

**Receipt** — `customerId`, `method`, `bankAccountId`, `amount`, `referenceNo`, `chequeNo`, `chequeDate`, `chequeStatus`, `allocations[]`: `invoiceId`, `amount` *(**BR-LED-03**)*

**ExpenseVoucher** — `categoryId`, `vendorName`, `description`, `billNo`, `amount`, `dueDate`, `reportedBy`, `verifiedBy`, `approvedBy`, `paymentStatus` (`unpaid`|`partial`|`paid`), `payments[]`: `date`, `method`, `bankAccountId`, `amount`, `reference`

**CashDeposit** — `bankAccountId`, `amount`, `slipRef`, `depositedBy`, `depositedAt`

**CashHandover** — `amount`, `handedOverBy`, `receivedBy`, `purpose` (`headOffice` | `shiftChange` | `management`), `approvedBy` *(**BR-CSH-04**)*

**StockAdjustment** — `itemType` (`filledCylinder`|`emptyCylinder`|`newCylinder`|`valve`|`accessory`|`lpg`), `sizeCode`, `qtyDelta`, `reasonCode`, `reasonText`, `approvedBy`

**DailyClosing** — see §6.6

### 6.5 Posting entities (append-only, D3)

Generated only by `PostingEngine`. Never created by a user, never edited, never deleted.

```csharp
public class LedgerEntry : EntityBase           // customer, supplier, expense-vendor
{
    public string PartyType { get; set; }       // customer | supplier | expenseVendor
    public string PartyId { get; set; }
    public DateOnly EntryDate { get; set; }
    public string SourceDocId { get; set; }
    public string SourceDocKind { get; set; }
    public string SourceDocNo { get; set; }
    public string Narration { get; set; }
    public decimal Debit { get; set; }
    public decimal Credit { get; set; }
    public bool IsReversal { get; set; }
}

public class StockMovement : EntityBase
{
    public string ItemType { get; set; }        // filledCylinder | emptyCylinder |
                                                // newCylinder | valve | accessory
    public string? SizeCode { get; set; }
    public DateOnly MovementDate { get; set; }
    public string SourceDocId { get; set; }
    public string SourceDocKind { get; set; }
    public string Reason { get; set; }          // purchase | filling | sale | return |
                                                // damage | adjustment | reversal
    public decimal QtyIn { get; set; }
    public decimal QtyOut { get; set; }
    public string? CustomerId { get; set; }     // for cylinder holding tracking
}

public class TankMovement : EntityBase
{
    public string TankId { get; set; }
    public DateOnly MovementDate { get; set; }
    public string SourceDocId { get; set; }
    public string Reason { get; set; }          // decant | filling | variance | adjustment
    public decimal QtyInKg { get; set; }
    public decimal QtyOutKg { get; set; }
    public decimal LandedRatePerKg { get; set; }   // for weighted average costing
}

public class CashBankEntry : EntityBase
{
    public string AccountType { get; set; }     // cash | bank
    public string? BankAccountId { get; set; }
    public DateOnly EntryDate { get; set; }
    public string SourceDocId { get; set; }
    public string SourceDocKind { get; set; }
    public string Narration { get; set; }
    public decimal DebitIn { get; set; }        // money in
    public decimal CreditOut { get; set; }      // money out
}
```

**Balance derivation.** Any balance is a fold over these streams, always filtered by date:

- Customer outstanding = opening + Σ(debit − credit) for `partyId`
- Cylinder holding = Σ(refills issued − empties returned) per `customerId`, per size
- Filled stock of size S = opening + Σ(qtyIn − qtyOut) where itemType = filledCylinder
- Tank stock = opening + Σ(qtyInKg − qtyOutKg)
- Cash in hand = opening + Σ(debitIn − creditOut) where accountType = cash

For F1, folding is done in memory. For F2, `SqliteRepository` maintains a **balance snapshot table keyed by (entity, date)** written at daily closing, so folds start from the last closed day rather than from inception. The snapshot is a cache, never a source of truth, and is rebuildable by replaying postings — this must be an available maintenance command.

### 6.6 DailyClosing entity

The closing is itself a document, storing the compiled snapshot so that a reprint months later shows exactly what was approved and signed.

Header: `closingDate`, `status`, `operatorName`, `supervisorName`, `managerName`, `closedAt`, `approvedAt`, `remarks`

Sections stored as computed values at approval time:
- `plantActivity`: `openingLpgKg`, `receivedKg`, `filledKg`, `soldKg`, `closingLpgKg`, `bowserCount`, `invoiceCount`, `customerCount`
- `revenue`: `gasSales`, `refillSales`, `newCylinderSales`, `valveSales`, `otherSales`, `loadingUnloading`, `grandTotal`
- `collections`: `cash`, `bankTransfer`, `online`, `cheque`, `directDeposit`, `creditSales`, `recovery`, `total`
- `bankDeposits[]`, `cashPosition{}`, `creditSummary{}`, `purchaseSummary{}`, `expenseSummary{}`
- `closingInventory`: per tank, per cylinder size, per pool, valves, accessories
- `rateAnalytics`: `weightedAvgSellingRatePerKg`, `domesticCylinderRate`, `highestDomesticRate`, `lowestDomesticRate`, `weightedAvgPurchaseRatePerKg`, `grossMarginPerKg`, `grossProfit`
- `tankVariances[]`: per tank, physical, system, variance, explanation

Once `status = Approved`, the day is locked (**BR-CLS-06**): `PostingEngine` rejects any posting whose `docDate` falls on or before the last approved closing date.

---

## 7. The posting engine

`PostingEngine` is the heart of the application. Every business rule about atomicity, stock movement and ledger integrity is enforced here, in one place, so that no view and no bridge method can bypass it.

### 7.1 Document lifecycle

```
        create              post                 approve
 ─────► Draft ──────────► Posted ──────────────► Approved
          │                  │                        │
          │ discard          │ cancel                 │ cancel (privileged)
          ▼                  ▼                        ▼
       (deleted)         Cancelled ◄──────────────────┘
                              │
                              └──► reversal postings generated
```

- **Draft** — auto-saved (D2), no side effects, may be freely edited or discarded. Not numbered.
- **Posted** — validated, numbered, side effects committed. Read-only. May be cancelled.
- **Approved** — supervisor/manager sign-off where the rule requires it. Cancellation now needs elevated permission.
- **Cancelled** — the document remains visible; reversing postings neutralise its effects (**BR-AUD-02**, **BR-AUD-03**, **BR-SAL-12**).

### 7.2 Posting sequence

```csharp
public PostResult Post(DocumentBase doc, UserContext user)
{
    // 1. Guard: day lock
    if (doc.DocDate <= _closing.LastApprovedDate)
        throw new DayLockedException(doc.DocDate);      // BR-CLS-06

    // 2. Validate: document-specific rules
    var validation = _validators[doc.Kind].Validate(doc);
    if (!validation.IsValid) return PostResult.Failed(validation.Errors);

    // 3. Generate: all side effects, nothing written yet
    var effects = _generators[doc.Kind].Generate(doc, user);

    // 4. Guard: no negative balances after applying effects
    _balanceGuard.Assert(effects);   // BR-TNK-07, BR-SAL-13, BR-CSH-02

    // 5. Commit: single unit of work
    using var uow = _repo.BeginUnitOfWork();
    doc.DocNo   = _sequences.Next(doc.Kind, doc.DocDate, uow);
    doc.Status  = DocStatus.Posted;
    doc.PostedBy = user.UserId;
    doc.PostedAt = DateTimeOffset.Now;
    uow.Save(doc);
    uow.SaveAll(effects.LedgerEntries);
    uow.SaveAll(effects.StockMovements);
    uow.SaveAll(effects.TankMovements);
    uow.SaveAll(effects.CashBankEntries);
    uow.Commit();

    // 6. Notify
    _events.Raise("data:changed", new { kind = doc.Kind, id = doc.Id });
    return PostResult.Ok(doc.DocNo);
}
```

Steps 3, 4 and 5 are the contract: effects are computed completely before anything is written, checked as a set, then written as a set. **This is the mechanism that satisfies BR-SAL-10 and BR-PUR-12.**

### 7.3 Effect generators

Each document kind has a generator declaring exactly what it produces. This table is the specification for the generators and should be implemented literally.

| Document | Ledger entries | Stock movements | Tank movements | Cash/bank entries |
|---|---|---|---|---|
| **GRN** | Credit supplier: net landed cost | — | In: decanted qty per tank, at landed rate | — |
| **SupplierPayment** | Debit supplier: amount | — | — | Out: cash or bank |
| **FillingBatch** | — | Out: empty (size); In: filled (size); Out: valves fitted | Out: nominal gas + loss | — |
| **Invoice** | Debit customer: net invoice | In: empties returned (good); In: damaged→damage pool; Out: filled (refill qty); Out: new cylinders; Out: valves; Out: accessories; holding delta per customer | — | In: cash / bank / online / cheque portions |
| **Receipt** | Credit customer: amount | — | — | In: cash or bank |
| **ExpenseVoucher** (post) | Credit vendor: amount | — | — | — |
| **ExpenseVoucher** (payment) | Debit vendor: amount paid | — | — | Out: cash or bank |
| **CashDeposit** | — | — | — | Out: cash; In: bank |
| **CashHandover** | — | — | — | Out: cash |
| **StockAdjustment** | — | In or Out per delta | In or Out if LPG | — |
| **TankLog** (closing, variance accepted) | — | — | In or Out: variance qty, reason `variance` | — |
| **Invoice cancellation** | Mirror-image reversal entries | Mirror-image reversal | — | Mirror-image reversal |

Cancellation never deletes the original rows. It appends rows with the sign inverted and `IsReversal = true`, referencing `ReversesDocId`.

### 7.4 Validators

Each kind has a validator implementing its Functional-Specification rules. The important ones:

**GrnValidator** — second weight < first weight (**BR-PUR-03**); Σ decant lines = net received (**BR-PUR-06**); each target tank has room below safe fill (**BR-PUR-05**); supplier active; rate > 0; shortage within tolerance or claim flagged (**BR-PUR-04**).

**InvoiceValidator** — gate pass exists and unbilled (**BR-SAL-01**, **BR-SAL-11**); customer active; every line has a resolved rate; overrides carry authoriser and reason (**BR-SAL-04**); payment split ≤ net invoice + recovery; credit limit checked (**BR-SAL-09**); requested filled/new/valve stock available (**BR-SAL-13**).

**FillingBatchValidator** — empties of that size available (**BR-FIL-03**); tank holds gas required; loss within tolerance or explained (**BR-FIL-06**).

**TankLogValidator** — all mandatory readings present; variance within tolerance, or explanation and approver present (**BR-TNK-06**).

**ReceiptValidator** — allocations sum to amount; no allocation exceeds the invoice's open balance.

### 7.5 The balance guard

A single component that answers: "if these effects were applied, would any balance go negative?" It folds current balances, applies the pending effects, and rejects the whole posting if any of these goes below zero: tank stock (**BR-TNK-07**), any cylinder or valve pool (**BR-SAL-13**), cash in hand (**BR-CSH-02**).

Bank balances are permitted to go negative (overdraft) and only warn.

### 7.6 Day locking

`ClosingService.LastApprovedDate` is consulted by every post. When a closing is approved, the date advances. A reopen command exists but requires MD-level permission, records who reopened and why, and reverts the closing to draft status.

---

## 8. Calculation engine

All calculations live in `Calc/` as pure static functions with no I/O, which makes them exhaustively unit-testable — the primary defence against the client discovering an arithmetic error in a review meeting.

### 8.1 Gauge conversion (`GaugeConversion`)

```
qtyKg = f(rotogaugePercent, tank.capacityKg, temperatureC, productDensity)
```

Implementation: a per-tank gauge table maps rotogauge percentage to volume in litres (supplied by the tank manufacturer; interpolated linearly between table points). Volume is converted to mass using density corrected for temperature:

```
density(T) = density15 - β × (T - 15)
qtyKg      = volumeLitres × density(T)
```

Where `density15` and the expansion coefficient β are configurable per product. **Open technical decision O-3** — the gauge table source must be confirmed with the client (Functional Spec question F.2-10). Until then, F1 uses a linear approximation of percentage against capacity, clearly flagged in the code as provisional.

### 8.2 Weighted average cost (`CostingCalculator`) — **BR-PUR-08**

```
newWacPerKg = (existingQtyKg × existingWacPerKg + receivedQtyKg × landedRatePerKg)
              ÷ (existingQtyKg + receivedQtyKg)
```

Applied plant-wide across all tanks, not per tank, since gas is fungible once decanted. Recomputed inside the GRN posting unit of work and stored on the `TankMovement` row so historical cost is reconstructible.

### 8.3 Invoice calculation (`InvoiceCalculator`) — **BR-SAL-07**

```
refillLineAmount = rateBasis == perKg
                 ? qty × nominalWeightKg(size) × ratePerKg
                 : qty × ratePerCylinder

gasKgOnLine      = qty × nominalWeightKg(size)

grossTotal = Σ refillLineAmounts + Σ newCylinderAmounts + Σ valveAmounts
           + Σ otherAmounts + loadingUnloadingAmount
netInvoice = grossTotal − discount
creditAmount = netInvoice + recoveredAgainstPrevious
             − (cash + bank + cheque + online)
```

`rateBasis` is carried per line so both models coexist and the client's answer to Functional Spec question F.2-1 is a configuration choice rather than a code change. This is the single most valuable piece of insurance in the calculation layer.

### 8.4 Rate analytics (`RateAnalyticsService`) — **BR-RAT-01 to 04**

```
totalGasKgSold    = Σ gasKgOnLine over all posted, non-cancelled invoices of the day
totalGasValue     = Σ refillLineAmounts        (gas value only — excludes cylinder,
                                                valve, accessory, loading/unloading)
weightedAvgRate   = totalGasValue ÷ totalGasKgSold
domesticCylRate   = weightedAvgRate × 11.8
highestDomestic   = max(line ratePerKg) × 11.8
lowestDomestic    = min(line ratePerKg) × 11.8

weightedAvgPurchaseRate = Σ(landedCost) ÷ Σ(netReceivedKg)   over the day's GRNs
grossMarginPerKg        = weightedAvgRate − wacPerKg
grossProfit             = grossMarginPerKg × totalGasKgSold
```

Note the exclusion in `totalGasValue`: mixing cylinder or handling revenue into the numerator would inflate the headline domestic rate and would be visibly wrong to anyone in the trade. Guard this with a test.

Where a refill line uses `perCylinder` basis, its implied per-kg rate is `amount ÷ (qty × nominalWeightKg)` for the purposes of this calculation.

### 8.5 Variance (`VarianceCalculator`) — **BR-TNK-04**

```
systemQtyKg   = openingKg + Σ decantedIn − Σ filledOut
varianceKg    = physicalQtyKg − systemQtyKg
variancePct   = |varianceKg| ÷ max(systemQtyKg, 1) × 100
withinTolerance = variancePct ≤ tank.varianceTolerancePercent
```

### 8.6 Rounding policy

All money is `decimal`, rounded half-away-from-zero to 2 decimal places at line level, then totalled — never totalled at full precision and rounded once, which would make a printed invoice fail to foot. All quantities are `decimal` to 3 places for kilograms and whole numbers for cylinders and valves. A single `Money.Round()` helper is used everywhere; direct use of `Math.Round` in business code is prohibited and should be caught in review.

---

## 9. Bridge API

Registered in `Shell/BridgeRegistration.cs` (F1/F2) and reused verbatim by `Server/BridgeController.cs` (F3). Naming follows the architecture spec convention `namespace.verb`. Every registration declares its required permission (D7).

### 9.1 Platform methods (architecture spec §6.4)

`ping` · `session.init` · `session.switchRole` *(F1 demo only)* · `settings.get` · `settings.set` · `backup.now` · `backup.restore` · `export.file` · `attachments.upload` · `lookup.query`

### 9.2 Master data

| Method | Permission | Purpose |
|---|---|---|
| `masters.list` | `masters:read` | List by kind with filter |
| `masters.get` | `masters:read` | Single record |
| `masters.save` | `masters:write` | Create or update |
| `masters.deactivate` | `masters:write` | Soft-disable (masters are never deleted) |
| `rates.current` | `masters:read` | Resolve rate card for date/time/group |
| `rates.save` | `rates:write` | New effective-dated card |
| `rates.history` | `masters:read` | Rate change audit |

### 9.3 Documents — uniform verb set

Every document kind exposes the same five verbs, which keeps the frontend generic:

| Method | Permission | Purpose |
|---|---|---|
| `doc.draft` | `{kind}:write` | Create or update a draft (auto-saved) |
| `doc.discard` | `{kind}:write` | Delete a draft (drafts only) |
| `doc.post` | `{kind}:post` | Validate, generate effects, commit |
| `doc.approve` | `{kind}:approve` | Sign-off where required |
| `doc.cancel` | `{kind}:cancel` | Cancel with reason; generate reversals |
| `doc.get` / `doc.query` | `{kind}:read` | Retrieve |

`params` carries `{ kind, payload }`. The router dispatches to the right validator and generator by `kind`. This means adding a document type later requires a validator, a generator and a view — no new bridge surface.

### 9.4 Domain queries

| Method | Permission | Returns |
|---|---|---|
| `sales.customerSnapshot` | `sales:read` | Outstanding, cylinder holding, credit headroom, last 5 invoices — called when a distributor is selected (**BR-SAL-03**) |
| `sales.openGatePasses` | `sales:read` | Unbilled gate passes |
| `purchase.supplierSnapshot` | `purchase:read` | Outstanding, advances, recent GRNs |
| `inventory.balances` | `inventory:read` | All pools by size, as at date |
| `inventory.movementRegister` | `inventory:read` | Movement rows for item and range |
| `tanks.status` | `tanks:read` | Live tank levels, readings, capacity |
| `tanks.reconciliation` | `tanks:read` | Variance per tank for a date |
| `ledger.statement` | `ledger:read` | Party statement with running balance |
| `ledger.ageing` | `ledger:read` | Outstanding by ageing bucket |
| `cashbank.position` | `finance:read` | Cash and per-account bank position for a date |
| `cashbank.consolidated` | `finance:read` | Consolidated company position (**BR-CSH-07**) |
| `expenses.outstanding` | `finance:read` | Outstanding expense register |
| `closing.preflight` | `closing:run` | Which preconditions are unmet (**BR-CLS-01**) |
| `closing.compile` | `closing:run` | Build the closing snapshot |
| `closing.approve` | `closing:approve` | Approve and lock the day |
| `closing.reopen` | `closing:reopen` | Privileged unlock with reason |
| `rates.daily` | `reports:read` | Domestic cylinder rate and margin analytics |
| `dashboard.snapshot` | `dashboard:read` | Everything the dashboard needs in one call |
| `reports.run` | `reports:read` | `{ reportId, params }` → tabular result |
| `print.payload` | `print` | Render-ready data for a document print |

**One call per screen.** `dashboard.snapshot` deliberately returns the entire dashboard in one round trip rather than fifteen calls — the dashboard refreshes on a timer and on `data:changed`, and chattiness there is the most likely source of perceived sluggishness.

### 9.5 Demo-only methods (F1)

`demo.reseed` (regenerate with a new seed) · `demo.setProfile` (busy day / slow day / month-end) · `demo.jumpToDate` · `session.switchRole`. All are registered behind a compile-time `DEMO` symbol so they cannot ship in F2.

### 9.6 Events pushed to the frontend

`data:changed` · `tank:alert` · `stock:low` · `credit:breach` · `closing:ready` · `toast`

---

## 10. Frontend

### 10.1 View inventory

Modules, in nav order, per the architecture spec §9.4 manifest pattern.

| Order | Module id | Tab | Purpose |
|---|---|---|---|
| 10 | `core.dashboard` | Dashboard | Live KPIs, alerts, tank gauges, domestic cylinder rate |
| 20 | `core.sales` | Sales | Gate pass → invoice counter screen |
| 30 | `core.purchase` | Purchase | GRN / bowser receiving, supplier payments |
| 40 | `core.plant` | Plant | Tank logs, filling batches, reconciliation |
| 50 | `core.inventory` | Inventory | Cylinder, valve and accessory stock; movement register |
| 60 | `core.accounts` | Accounts | Ledgers, receipts, expenses, cash and bank |
| 70 | `core.closing` | Closing | Daily closing workspace and sign-off |
| 80 | `core.reports` | Reports | Report gallery with filters and export |
| 90 | `core.masters` | Masters | All master data, rate cards |

Overlays: `lookup` (Ctrl+K), `customerSnapshot`, `ratePicker`, `printPreview`, `help`, `settings`, `demoControls` (F1).

### 10.2 The sales counter screen

This screen is the one the client will judge the software by, because it is the one their staff will use fifty times a day with a vehicle waiting outside. Design constraints:

- **Single screen, no wizard.** Gate pass, empties, goods, payment and outstanding are all visible at once on a 1366×768 display without scrolling.
- **Keyboard only, numeric-keypad friendly.** Tab order follows the physical workflow. Quantities are entered on the number pad without reaching for the mouse.
- **The outstanding panel is always visible** on the right, updating live as lines are entered — this is **BR-SAL-03** made visual, and it is the feature the client asked for most insistently.
- **Rates are shown but not editable** unless the override permission is held; then override reveals a reason field, and the line is flagged in a distinct colour.
- **Post is F9** and requires the document to be valid; validation errors appear inline against the offending line, never as a modal.

### 10.3 Keyboard map

| Key | Action |
|---|---|
| `Ctrl+K` | Lookup / command palette |
| `Alt+1` … `Alt+9` | Jump to module |
| `F2` | New document in the current module |
| `F4` | Customer / supplier lookup in the active field |
| `F9` | Post the current document |
| `F10` | Print current document |
| `Ctrl+S` | Force draft save (drafts auto-save anyway) |
| `Esc` | Close overlay / cancel field edit |
| `?` | Shortcut cheat sheet |
| `+` / `Enter` on a grid row | Add next line |

### 10.4 Formatting utilities (`shell/format.ts`)

Centralised, because inconsistent number rendering across screens reads as sloppiness to a finance-minded client:

- `money(value)` — thousands grouping, 2 decimals, `Rs.` prefix; grouping style configurable (international vs lakh/crore) — **open technical decision O-5**
- `qtyKg(value)` — 3 decimals with `kg` suffix
- `cylinders(value)` — whole number with size label
- `date(value)` / `dateTime(value)` — `dd-MMM-yyyy` default, configurable
- Negative money renders in the danger token colour with parentheses

### 10.5 Component additions beyond the architecture spec

| Component | Purpose |
|---|---|
| `LineGrid.svelte` | Keyboard-navigable editable grid for invoice and GRN lines |
| `PartyPicker.svelte` | Type-ahead distributor/supplier picker showing outstanding inline |
| `OutstandingPanel.svelte` | Live customer position beside the invoice |
| `TankGauge.svelte` | SVG tank visual with level, pressure, temperature and alert state |
| `PostBar.svelte` | Draft/Posted/Cancelled status badge plus Post/Cancel/Print actions |
| `KpiTile.svelte` | Dashboard metric with trend and alert threshold |
| `ReportFrame.svelte` | Standard report chrome: filters, run, export, print |
| `SignOffPanel.svelte` | Closing sign-off with named roles |

### 10.6 Design tokens

Extend the architecture spec §10.1 token set with domain-semantic tokens so status colouring is consistent everywhere:

```css
--doc-draft: #d97706;      /* amber  */
--doc-posted: #059669;     /* green  */
--doc-cancelled: #6b7280;  /* grey   */
--alert-critical: #dc2626;
--alert-warning: #d97706;
--tank-fill: #2563eb;
--tank-safe-line: #dc2626;
```

---

## 11. Sample data generator (F1)

The demo lives or dies on this. Random rows produce a system that looks plausible for three seconds and then falls apart when the client checks whether the tank balance ties to the sales. Generated data must be **simulated, not sampled**.

### 11.1 Approach

`DemoDataService` runs a deterministic simulation, seeded so the same seed always produces the same plant history:

1. Create masters: 5 tanks, 4 cylinder sizes, 18 distributors, 4 suppliers, 3 bank accounts, 23 expense categories, 6 users, one rate card per week for the period.
2. For each simulated day, in order:
   - post 0–3 GRNs with realistic bowser weights (18–22 MT loads) and a small challan shortage sometimes;
   - post filling batches drawing from tanks against the day's expected demand, with 0.1–0.4% filling loss;
   - post 8–25 invoices across distributors with a realistic size mix, a rate that drifts day to day, occasional discounts and rate overrides, mixed payment splits and some pure credit;
   - post receipts against old invoices for a subset of distributors;
   - post 3–8 expenses across categories, some unpaid;
   - post a cash deposit and a handover;
   - post opening and closing tank logs with a small variance;
   - compile and approve the daily closing.
3. Leave the final 1–2 days open and partially entered, so the client can see draft documents, an unbilled gate pass and an unapproved closing.

Because every record is created through the **real `PostingEngine`**, the generated history is internally consistent by construction. Nothing is written directly to the repository.

### 11.2 Realism parameters

| Parameter | Value |
|---|---|
| Period | 90 days ending today |
| Working days | Mon–Sat; reduced Sunday activity |
| Daily LPG throughput | 15–45 MT |
| Rate drift | Random walk, ±2% daily, seasonal upward trend |
| Distributor mix | Pareto — 4 large distributors take ~60% of volume |
| Payment behaviour | Per-distributor profile: prompt / average / slow payer |
| Cylinder size mix | 11.8 kg dominant (~70%), 45.4 kg (~20%), 15 kg and 6 kg the remainder |
| Empties return rate | 92–100%, creating realistic cylinder holding balances |

### 11.3 Demo controls overlay

A hidden panel (`Ctrl+Shift+D`) for use during the client meeting: reseed, jump to a date, switch role, toggle an alert condition (make a tank breach high level, push a distributor over credit limit), and reset to pristine. This lets the presenter demonstrate the alert behaviour on demand rather than hoping the generated data contains an example.

### 11.4 Consistency tests

`DemoDataConsistencyTests` must assert, over the generated dataset:

- LPG mass balance ties per day and cumulatively;
- every cylinder pool balance is non-negative on every day;
- Σ customer ledger closing balances = Σ invoices − Σ receipts + opening;
- cash in hand is non-negative on every day and equals opening + receipts − deposits − expenses − handovers;
- each daily closing's stored revenue total equals the sum of its day's posted invoices;
- weighted average selling rate recomputed from invoices equals the stored value.

If these fail, the demo is not ready to show. A client who finds an imbalance stops evaluating the design and starts doubting the developer.

---

## 12. Printing and export

### 12.1 Print (D6)

Print in shell mode uses WebView2's print support against a dedicated print stylesheet. `print.payload` returns render-ready data; a hidden print route renders it with `@media print` rules at fixed paper size.

Documents requiring print: gate pass, invoice, GRN, receipt voucher, expense voucher, deposit slip, daily closing sheet, party statement, and every report.

Invoice printing must support the client's stationery. Until formats are confirmed (**open decision O-6**), F1 renders a clean A5 invoice and A4 closing sheet as a starting point for discussion — showing a printed layout is itself a useful review prompt.

### 12.2 Export

`ExportService` produces PDF (via the print pipeline) and Excel (ClosedXML) for every report (**BR-CLS-07**). In shell mode a native `SaveFileDialog` is used; in web mode the bytes are returned and downloaded via Blob URL, exactly as the architecture spec §17.4 prescribes. Writing the export layer against a mode-agnostic interface now avoids reworking eight methods later.

---

## 13. Security and roles

F1 registers all methods with permissions and ships a `UserContext` whose permission set is switchable from the demo menu — so role-based UI hiding (architecture spec §18.8, `Guarded.svelte`) is demonstrable to the client immediately. F2 adds local login with hashed passwords and real permission enforcement. F3 adds the authentication middleware per architecture spec §18.6, most likely Option C (reverse-proxy header injection) for a plant intranet, or cookie sessions for a hosted deployment.

Permission strings follow `{domain}:{action}`: `sales:read`, `sales:write`, `sales:post`, `sales:cancel`, `sales:rateOverride`, `sales:creditOverride`, `purchase:*`, `tanks:*`, `inventory:*`, `finance:*`, `closing:run`, `closing:approve`, `closing:reopen`, `masters:*`, `rates:write`, `reports:read`, `admin:users`.

The role-to-permission mapping implements the matrix in Functional Specification §E.2 and lives in one file, `RolePermissions.cs`, as data rather than logic.

**BR-AUD-04** (entry and approval cannot be the same person) is enforced in `PostingEngine.Approve`, not in the UI.

---

## 14. Testing

| Layer | Tool | Focus |
|---|---|---|
| Calculations | xUnit | Every formula in §8, including boundary and rounding cases. Table-driven. |
| Posting engine | xUnit | Each generator's effect set; atomicity under validator failure; balance guard rejections; cancellation symmetry (post then cancel must return every balance to its prior value — this single property test catches most reversal bugs) |
| Closing | xUnit | Preflight conditions, snapshot arithmetic, day lock enforcement |
| Repository | xUnit | Round-trip, unit-of-work rollback, sequence gaplessness under concurrent calls |
| Demo data | xUnit | §11.4 consistency assertions |
| Frontend units | Vitest | Bridge client, router, formatters, invoice line arithmetic mirrored client-side |
| End to end | Playwright | Gate pass → invoice → post → print; GRN → decant → filling → sale mass balance; closing run and lock |

Minimum bar before showing F1 to the client: all calculation tests, all posting engine tests, and all demo consistency tests green.

---

## 15. Performance targets

Revised from architecture spec §15.1 for ERP data volumes (assume 3 years ≈ 250,000 postings).

| Metric | Target |
|---|---|
| Cold start to dashboard | < 3 s |
| Sales counter screen ready | < 500 ms |
| Customer snapshot on selection | < 200 ms |
| Invoice post commit | < 300 ms |
| Dashboard snapshot refresh | < 500 ms |
| Daily closing compile | < 3 s |
| Monthly report over 12 months | < 5 s |
| Lookup by document number | < 100 ms |
| Memory, 3 years of data | < 400 MB |

The balance-snapshot design in §6.5 exists to hold these targets; without it, folds from inception degrade linearly with plant age.

---

## 16. Phased build plan

Each phase produces something runnable. Phases P0–P6 constitute the F1 demo deliverable.

| Phase | Goal | Deliverable |
|---|---|---|
| **P0** | Scaffolding | Solution, WebView2 shell, Svelte SPA, bridge round-trip, startup checks, logging, tokens, nav shell. *Architecture spec Phase 0.* |
| **P1** | Model and persistence | `EntityBase` hierarchy, `EntityFactory`, `IRepository` + `JsonRepository`, `SequenceService`, `QueryFilter`, unit tests |
| **P2** | Calculation engine and browser harness | All of §8 as pure functions, fully unit-tested, no UI; plus the stub HTTP bridge and `dev:web` harness (§22.5) and the latency injector, both running from this point on |
| **P3** | Posting engine | `PostingEngine`, validators, generators, balance guard, day lock; tested headlessly with no screens at all |
| **P4** | Demo data generator | 90 days of simulated history through the real engine; consistency tests green |
| **P5** | Read-only views | Dashboard, tank status, inventory, ledgers, reports, closing report — everything the client *looks at* |
| **P6** | Entry screens and packaging | Sales counter, GRN, filling, tank log, receipts, expenses — everything the client *does*, in draft and post modes, built to the §21 data-entry standard; native identity bar and switch dialog (§20); print preview; demo controls; **distribution ZIP per §19** |
| — | **▶ F1 DEMO REVIEW WITH CLIENT** | Collect feedback; resolve Functional Spec open questions; re-baseline |
| **P7** | SQLite repository | `SqliteRepository`, migration tool, balance snapshots, performance validation |
| **P8** | Real print and export | Client stationery formats, PDF and Excel for all reports |
| **P9** | Masters, rates, opening balances | Full master maintenance, rate card workflow, go-live data load |
| **P10** | Local auth and roles | Login, hashed credentials, real permission enforcement, audit log viewer |
| **P11** | Backup, restore, hardening | Backup service, error handling audit, performance at volume, packaging |
| — | **▶ F2 PLANT BUILD** | Pilot at the plant |
| **P12** | Server mode | ASP.NET Core host, HTTP/WebSocket adapter, native-dialog replacements |
| **P13** | Multi-user | Authentication, user-scoped data, concurrent posting, session management |
| — | **▶ F3 NETWORKED BUILD** | Multiple counters and head office |

**Why P2 and P3 come before any entry screen.** The calculation and posting layers are where the client's business actually lives, and they are the most expensive things to get wrong. Building them headless and test-driven means the review meeting discusses whether the *rules* are right, not whether a button is misaligned — and it means P6's screens are thin.

---

## 17. Business rule traceability

Every rule in the Functional Specification maps to a specific enforcement point. This table is the checklist for code review and for demonstrating compliance to the client.

| Rule group | Enforced in |
|---|---|
| **BR-MST-01, 04** | Master data as records, not enums — `MasterDataService` |
| **BR-MST-02, 03** | `RateService.Resolve()`; invoice stores `rateCardId` and resolved rate |
| **BR-MST-05, 06, 07** | Master entity definitions §6.3 |
| **BR-MST-08** | Migration/opening-balance load tool (P9); masters locked after verification |
| **BR-PUR-02, 03, 04, 05, 06** | `GrnValidator` |
| **BR-PUR-07** | `InvoiceCalculator` / GRN cost block §6.4 |
| **BR-PUR-08** | `CostingCalculator`, invoked inside GRN posting |
| **BR-PUR-09, 10** | `SupplierPayment` generator; advance handling in `LedgerService` |
| **BR-PUR-11** | `DocStatus` state machine §7.1 |
| **BR-PUR-12** | `PostingEngine` unit of work §7.2 |
| **BR-TNK-01** | `closing.preflight` precondition |
| **BR-TNK-02** | `GaugeConversion` |
| **BR-TNK-03, 04, 05, 06** | `VarianceCalculator`, `TankLogValidator`, variance `TankMovement` |
| **BR-TNK-07** | Balance guard §7.5 |
| **BR-TNK-08** | `tank:alert` event, threshold config |
| **BR-TNK-09** | `TankLog` records never deleted |
| **BR-FIL-01 … 06** | `FillingBatchValidator`, filling generator |
| **BR-SAL-01, 11** | `GatePass` status machine, `InvoiceValidator` |
| **BR-SAL-02** | Invoice `emptiesReturned`; holding delta `StockMovement` rows |
| **BR-SAL-03** | `sales.customerSnapshot`; `OutstandingPanel.svelte`; invoice stores snapshot at posting |
| **BR-SAL-04** | `InvoiceValidator` + `sales:rateOverride` permission |
| **BR-SAL-05, 06, 07** | `InvoiceCalculator` |
| **BR-SAL-08** | Payment split fields; `creditAmount` derived |
| **BR-SAL-09** | `InvoiceValidator` + `sales:creditOverride` permission |
| **BR-SAL-10** | `PostingEngine` unit of work |
| **BR-SAL-12** | `doc.cancel` + reversal generator |
| **BR-SAL-13** | Balance guard |
| **BR-INV-01 … 09** | `StockMovement` stream; `InventoryService`; `StockAdjustment` document |
| **BR-LED-01 … 06** | `LedgerEntry` stream; `LedgerService`; FIFO allocation in `ReceiptService` |
| **BR-CSH-01 … 08** | `CashBankEntry` stream; `CashBankService`; balance guard; closing preflight |
| **BR-EXP-01 … 07** | `ExpenseVoucher` model and generator; `expenses.outstanding` |
| **BR-RAT-01 … 04** | `RateAnalyticsService` |
| **BR-CLS-01 … 08** | `ClosingService`, `closing.preflight`, day lock in `PostingEngine` |
| **BR-AUD-01** | `EntityBase` audit fields + append-only postings + change log |
| **BR-AUD-02, 03** | No delete path exists in `IRepository` for posted documents |
| **BR-AUD-04** | `PostingEngine.Approve` |
| **BR-AUD-05** | `SourceDocId` on every posting row |
| **BR-AUD-06** | Permission-aware router |

---

## 18. Open technical decisions

Distinct from the *business* open questions in Functional Specification §F.2. These are ours to decide, though some depend on the client's answers.

| # | Decision | Notes | Needed by |
|---|---|---|---|
| **O-1** | Confirm SQLite for F2 | SQL Server LocalDB or PostgreSQL are alternatives if the client's IT has a standard. SQLite is recommended: zero admin, single file, trivial backup, and adequate for one plant. | P7 |
| **O-2** | Rate basis default for F1 | Depends on Functional Spec F.2-1. Model supports both; F1 must ship with a default. Recommend `perKg` as the demo default and ask the question directly in the review. | P2 |
| **O-3** | Gauge conversion table source | Manufacturer table per tank, or a computed approximation. F1 uses linear approximation flagged as provisional. | P2 |
| **O-4** | Tax architecture | If sales tax is required (F.2-3), it affects invoice lines, ledger postings and reports. Decide before P6 or the invoice model will need surgery. | P6 |
| **O-5** | Number formatting convention | International grouping (1,234,567) versus subcontinental (12,34,567). Trivial to implement, jarring to get wrong in front of the client. | P5 |
| **O-6** | Print stationery | Paper size, pre-printed forms, copies (original/duplicate/triplicate), signature blocks. | P8 |
| **O-7** | Offline resilience in F3 | If the counter must keep billing during a network outage (F.2-20), F3 needs local queueing and conflict resolution — a substantial addition. If not, F3 is straightforward. **This is the single highest-impact open item.** | P12 |
| **O-8** | Concurrent posting in F3 | Document numbering and stock guards need row-level locking or optimistic concurrency once multiple counters post simultaneously. | P13 |
| **O-9** | Attachment volume | Photographed weighbridge slips at 2 MB × 3 per day × 3 years ≈ 6 GB. Decide storage location and whether to compress on upload. | P8 |
| **O-10** | Backup destination | Local folder only, or network share / removable drive / cloud. Affects `BackupService` and the client's disaster recovery story. | P11 |

---


---

## 19. F1 distribution package

**Requirement:** one ZIP file, sent to the client, that runs the complete application with sample data on any Windows machine with no installation and no assistance.

### 19.1 Package contents

```
LpgErp-Demo-v1.0.0.zip
├── LpgPlantERP.exe                 # self-contained single-file, win-x64 (~150 MB)
├── Web/dist/                       # SPA build output
│   ├── index.html
│   ├── styles/tokens.css
│   └── assets/
├── Setup/
│   └── MicrosoftEdgeWebview2Setup.exe   # evergreen bootstrapper, offline fallback
├── START-HERE.txt                  # 6 lines: unblock, unzip, double-click
├── Demo-Guide.pdf                  # guided scenarios for the client (§19.5)
└── version.txt
```

`Data/`, `Logs/` and `WebView2Data/` are **not** shipped — they are created on first launch (§19.3).

### 19.2 Build and packaging

`publish.ps1` extends the architecture spec §13.4 script:

1. `npm ci && npm run build` in `App/Web/`
2. `dotnet publish App/Shell -c Release -r win-x64` with `PublishSingleFile`, `SelfContained`, `IncludeNativeLibrariesForSelfExtract`
3. Compile with the `DEMO` symbol defined — this is what enables `DemoDataService`, the demo bridge methods (§9.5) and the role switcher, and what excludes them from every non-demo build
4. Copy `Web/dist/`, `Setup/`, docs
5. Stamp `version.txt` with version, build number, git commit and build date
6. ZIP

The `DEMO` compile symbol matters: it guarantees the demo scaffolding physically cannot reach a plant build, rather than relying on a runtime flag someone forgets to switch.

### 19.3 First-launch behaviour

The sample data is **generated on first launch, not shipped pre-baked.** This is deliberate:

- Data anchored to the machine's current date means the demo is always "today" — the dashboard shows live-looking figures whether the client opens the ZIP the day it arrives or three weeks later. Pre-baked data goes stale and immediately looks like a mock-up.
- Generation runs through the real posting engine (§11.1), so the shipped artefact proves the engine works on the client's machine, not only on the developer's.

Sequence:

1. Startup gauntlet runs (architecture spec §5.2) — single instance, WebView2 runtime, data folder, write permission, disk space.
2. `Data/` absent → the native loading overlay switches to a determinate progress bar: *"Preparing demonstration data — simulating 90 days of plant operation."*
3. `DemoDataService` runs the simulation (target under 20 seconds; if it exceeds 40, reduce the period rather than let the client watch a bar).
4. Consistency assertions (§11.4) run in Release too, and on failure the app still starts but shows a visible banner rather than silently presenting wrong numbers.
5. Subsequent launches find `Data/` and start in under 3 seconds.

A **Reset demonstration data** command in the shell menu deletes `Data/` and re-runs generation with a new seed — the recovery path when a client has clicked the application into a strange state mid-meeting.

### 19.4 Windows friction to handle before sending

These are the reasons a demo ZIP fails on someone else's machine. Handle all of them or expect a support call during the review.

| Issue | Mitigation |
|---|---|
| **SmartScreen blocks an unsigned EXE** | `START-HERE.txt` gives the exact steps: right-click the ZIP → Properties → **Unblock** → then extract. Unblocking the ZIP before extraction clears Mark-of-the-Web from every extracted file at once. Longer term, a code-signing certificate removes this entirely and is worth buying before F2. |
| **Extraction into a read-only or synced location** | Startup check 4 offers one-click relocation to `%LOCALAPPDATA%\LpgPlantERP\Data`. Note in START-HERE that OneDrive-synced Desktop folders can lock files — recommend `C:\LpgErpDemo`. |
| **WebView2 runtime missing** (older Windows 10) | Startup check 2 detects it and offers to run the bundled bootstrapper from `Setup/` — works offline, unlike the download link the architecture spec suggests. |
| **Corporate antivirus quarantines a single-file self-extracting EXE** | Known behaviour with `PublishSingleFile`. If it occurs, ship the non-single-file publish folder instead — same ZIP layout, more files, no self-extraction. Keep this variant buildable via a `publish.ps1 -NoSingleFile` switch. |
| **Long path names** | Keep the internal folder depth shallow; do not nest the ZIP root in a versioned folder. |
| **Display scaling / small laptop screens** | The app must be usable at 1366×768 and at 150% scaling. Test both before sending; the sales counter screen (§10.2) is where this breaks first. |

### 19.5 Demo Guide

A short PDF in the ZIP, and a matching in-app overlay (`Ctrl+Shift+G`), giving the client a route through the application rather than leaving them to wander. Each entry states what to open, what to look at and what to judge:

1. **Dashboard** — is this the information you want on one screen when you arrive in the morning?
2. **Sales counter** — bill a distributor: gate pass, empties, refills, payment split. Watch the outstanding panel update.
3. **Outstanding on the invoice** — print preview shows previous balance carried forward.
4. **Bowser receiving** — record a GRN with two weights and decant into a tank; see the tank level and supplier balance move.
5. **Tank log and reconciliation** — enter an evening reading and see the variance calculated.
6. **Daily closing** — run a closing; check the revenue split, the cash handover block and the domestic cylinder rate.
7. **Role switching** — switch to Data Entry Operator in the top bar and observe which figures disappear.
8. **Reports** — open the ledger and daily closing report; export to Excel.

Each guide entry in the overlay carries a **Take me there** link that navigates and, where useful, pre-fills a draft so the client is not typing during the meeting.

---

## 20. Native shell identity bar (D8)

**Requirement:** the current user name and role are rendered by the shell application outside the WebView. Clicking the bar opens a native dialog where the name can be typed and the role chosen; confirming refreshes the WebView. In F3 the same context is established by a login screen and held in a cookie.

### 20.1 Why outside the WebView

- It cannot be spoofed, obscured or broken by anything the page does, so the role indicator is trustworthy.
- It survives frontend failure. If the SPA throws during boot, the operator still sees who they are signed in as and can change identity or exit.
- It keeps the demo's role switcher out of production frontend code entirely — there is no switcher component to compile out later.
- It frees vertical space in the SPA; the tab bar does not also have to carry identity chrome.

### 20.2 Layout

A fixed 28 px strip docked above the WebView2 control. **No auto-hide** — it is always visible, costs almost nothing in vertical space, and avoids the WebView2 input-capture problem described in §20.6.

```
┌────────────────────────────────────────────────────────────────────┐
│ LPG PLANT ERP   Main Plant   09-Aug-2026        ● DEMO             │ ← native
│                          👤 Ahmed Raza · Plant Manager  ⚙          │   28 px
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│                    WebView2  (Dock = Fill)                         │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

`MainWindow` hosts a `TableLayoutPanel` with the identity bar docked top (fixed height) and `WebView2` filling the remainder. No animation, no timers, no pointer tracking.

The bar carries: application name, plant name, current business date, environment badge (DEMO / PLANT), and — as the clickable region — the user name and role. In F1 the gear also offers **Reset demonstration data**.

The whole name-and-role region is one clickable control: cursor changes to a hand on hover, the region highlights, and it carries a tooltip reading *"Click to change user or role"*. It is also reachable from the keyboard with `Ctrl+Shift+U`, which opens the same dialog.

### 20.3 The identity dialog

Clicking the bar opens a small modal WinForms dialog owned by the main window:

```
┌─ Switch User ───────────────────────────────┐
│                                             │
│  Name   [ Ahmed Raza                     ]  │
│                                             │
│  Role   [ Plant Manager               ▾ ]   │
│         ┌───────────────────────────────┐   │
│         │ Data Entry Operator           │   │
│         │ Cashier                       │   │
│         │ Plant Supervisor              │   │
│         │ Accounts Officer              │   │
│         │ Plant Manager                 │   │
│         │ Managing Director / CEO       │   │
│         └───────────────────────────────┘   │
│                                             │
│  Permissions granted by this role:          │
│  ┌─────────────────────────────────────┐    │
│  │ Sales: enter, post, approve         │    │
│  │ Purchase: enter, post, approve      │    │
│  │ Cash & bank balances: visible       │    │
│  │ Daily closing: approve              │    │
│  └─────────────────────────────────────┘    │
│                                             │
│              [ Cancel ]  [ Switch ]         │
└─────────────────────────────────────────────┘
```

Details:

- **Name is free text** in F1 — the client can type their own name, or their staff's, which makes the demo feel like theirs rather than a canned account. In F2 it becomes a lookup against real `PlantUser` records.
- **Role is a dropdown** bound to `RolePermissions.cs` — the same source that drives enforcement, so the list can never drift from reality.
- **The permission summary updates live** as the role changes. This is worth building: it is the clearest way to show the client what each role can and cannot do, and it turns the dialog itself into part of the demo.
- Dialog is keyboard-complete: focus starts in the name field, `Enter` confirms, `Esc` cancels.
- Name is remembered per role, so switching back and forth does not require retyping.

### 20.4 What happens on confirm

```
Dialog OK
   │
   ├─► SessionService.SetIdentity(name, role)        [Shared project]
   │        · rebuilds UserContext from RolePermissions.cs
   │        · writes an audit entry recording both the previous and new identity
   │        · persists to Data/meta/session.json so the choice survives restart
   │
   ├─► Identity bar repaints
   │
   └─► webView.CoreWebView2.Reload()
            │
            └─► SPA boots, calls session.init, receives the new UserContext
```

**A full WebView reload is the correct choice here, not an event push.** It is one line instead of an event contract, and it guarantees no view is left holding data fetched under the previous role — which is precisely the failure mode a partial refresh invites when a user drops from Plant Manager to Data Entry Operator and a cached financial figure stays on screen.

The reload is lossless because drafts auto-save (D2). Any in-progress document is on disk before the dialog opens. On reboot the SPA returns to the same module via the persisted route, so the operator lands where they left off.

Consequence for the frontend: **`session.init` is the only identity path that ever needs to exist.** There is no `session:changed` event, no session mutation handler, and no partial-refresh logic to test. This is a genuine simplification over the earlier design.

### 20.5 F3 — login screen and cookie

In web mode the identity bar has no native host, and identity is established before the application loads.

```
Browser → GET /                     → SPA loads
        → session.init              → 401 / { authenticated: false }
        → SPA renders LoginView     → POST /api/login { username, password }
        → server validates, issues  → Set-Cookie: lpgerp.session=…
                                       HttpOnly; Secure; SameSite=Strict
        → SPA reloads               → session.init returns full UserContext
```

- The **cookie is set by the server, never by the SPA.** `HttpOnly` means JavaScript cannot read it, which is the point — a token the frontend can read is a token an XSS can steal. The `HttpAdapter` already sends `credentials: 'include'` (architecture spec §6.5), so nothing in the bridge changes.
- **`LoginView.svelte` is part of the SPA and ships in F1's `dist/`** even though the shell never routes to it — the parity contract in §22.1 forbids a separate web build. It is exercised continuously through the browser harness (§22.5) against stub authentication, so it is proven code long before F3.
- **`ContextBar.svelte`** renders the same 28 px strip in HTML when `capabilities.nativeContextBar === false`, showing name, role and a **Sign out** action in place of the switcher. Same layout, same information, same position.
- Session expiry: the server returns 401 on any bridge call with a stale cookie; the adapter catches it in one place and routes to the login view, preserving the current hash so the user returns to the same screen after signing in.
- Role changes in F3 are sign out and sign in — the same reload semantics as F1, arrived at by a different route.

### 20.6 Design note: why not auto-hide

An earlier draft of this specification proposed a bar that collapsed after a few seconds and reappeared on pointer proximity. It was dropped, and the reason is worth recording so it is not reintroduced.

WebView2 consumes all mouse input over its surface. The hosting `Form` receives no `MouseMove` events while the pointer is over the browser control, so the natural `MouseEnter`/`MouseLeave` implementation silently never fires. Working around this requires either polling `Cursor.Position` on a timer, or a low-level mouse hook — the latter being routinely flagged by endpoint security software, which is exactly the antivirus friction §19.4 exists to avoid.

The cost of the workaround exceeded the benefit. Twenty-eight fixed pixels is not a meaningful loss of working area, and a bar that is always visible is more discoverable than one the user has to find.

## 21. Data-entry design standard

**Requirement:** screens optimised for data entry, with the most frequently updated fields first and the remainder tucked behind accordions or tabs.

This section is binding on every entry screen. It exists because the plant's staff will use these screens hundreds of times a day, and because a client evaluating the demo judges usability before they judge correctness.

### 21.1 Field tiering

Every field on every document belongs to exactly one tier, decided once and recorded in the view's spec.

| Tier | Definition | Placement |
|---|---|---|
| **T1 — Every time** | Changes on essentially every document | Always visible, above the fold, in the primary entry flow |
| **T2 — Sometimes** | Changes on perhaps one document in five | Collapsed accordion, opened with one key |
| **T3 — Rarely** | Exceptions, corrections, references, attachments | Secondary tab or overlay |

Rules:

1. **T1 must fit on one screen at 1366×768 with no scrolling.** If it does not, the tiering is wrong — re-tier, do not shrink the font.
2. **No required field may sit in a collapsed section** unless it has a valid default. If it is required and has no default, it is T1 by definition.
3. **A collapsed section shows a one-line summary of its contents**, so nothing meaningful is invisible: `▸ Charges — freight Rs. 12,000 · other Rs. 2,500`. Empty sections summarise as `▸ Charges — none`.
4. **A collapsed section auto-expands and highlights when it contains a validation error.** An error the user cannot see is worse than no validation.
5. **Accordion for related detail on the same document; tabs for parallel bodies of content; overlay for lookups and pickers.** Do not use tabs to hide steps in a single flow — that turns a form into a wizard, which slows an experienced operator down.

### 21.2 Tiering by document

This is the specification for the entry screens; implement it as written and revise it only from client feedback.

**Sales invoice** *(the highest-traffic screen)*
- **T1:** distributor · vehicle number · empties returned by size · refill lines (size, quantity) · loading & unloading amount · payment split (cash / bank / cheque / credit) — with the live outstanding panel beside it
- **T2 — "Cylinders, valves & other items":** new cylinder lines · valve lines · accessories · discount
- **T2 — "Vehicle & dispatch":** driver name · driver CNIC · driver mobile · loading supervisor · loading time · dispatch time
- **T3 — tab:** rate details and overrides · remarks · attachments · gate pass history

**GRN / bowser receiving**
- **T1:** supplier · bowser number · first weight · second weight · net received (derived, read-only) · receiving tank · quantity decanted · rate per kg
- **T2 — "Charges & discount":** freight · weighbridge · other charges · discount · net landed cost (derived)
- **T2 — "Driver & transport":** driver name · CNIC · mobile · transporter · purchase order number
- **T2 — "Payment":** payment lines against this GRN
- **T3 — tab:** weighbridge slip attachments · challan quantity and shortage claim · remarks

**Filling batch**
- **T1:** tank · cylinder size · cylinders filled · valves fitted
- **T2:** actual gas drawn · filling loss (derived) · loss explanation · shift · supervisor

**Tank log**
- **T1:** tank · rotogauge % · pressure · temperature *(one compact row per tank, all tanks on one screen — this is a repetitive keypad task and must not require navigation between tanks)*
- **T2:** liquid level · vapour pressure · operator name
- **T3:** derived quantity, system quantity, variance and explanation — shown as a computed strip, editable only for the explanation

**Expense voucher**
- **T1:** category · amount · description · payment status · payment method
- **T2:** vendor · bill number · due date · reported by · verified by
- **T3:** attachments · partial payment history

**Receipt**
- **T1:** distributor · amount · method · bank account
- **T2:** allocation across invoices (defaults to oldest-first; expanded only to override) · cheque number and date · reference

### 21.3 Interaction rules

| Rule | Detail |
|---|---|
| **Keyboard completes everything** | No entry screen requires the mouse. Verified in Playwright by driving the sales counter to a posted invoice with keys only. |
| **`Enter` and `Tab` both advance** | Operators trained on other software expect `Enter`. In grids, `Enter` on the last cell adds a row. |
| **Numeric keypad friendly** | Quantity, weight and amount fields accept the keypad decimal in either separator form and never require `Shift`. |
| **Auto-advance on fixed-length fields** | CNIC and account numbers move on when full. |
| **Sticky defaults** | The last-used supplier, tank, bank account and expense category pre-fill the next document of the same kind, per user, per day. This removes roughly a third of the keystrokes on a repetitive day. |
| **Derived fields are visibly read-only** | Net received, line amounts, net invoice, variance — rendered on a tinted surface with no focus stop, so the eye learns which numbers the system owns. |
| **Inline validation, never modal** | Errors appear against the field or line, in the danger token colour, on blur — not on every keystroke, which makes half-typed numbers flash red. |
| **Post is deliberate** | `F9` or an explicit button (D2). Never `Enter` from the last field, which is how a half-entered document gets posted by muscle memory. |
| **Nothing is lost** | Drafts auto-save; navigating away and returning restores the in-progress document. |

### 21.4 Density tokens

Added to the token set in §10.6. These make density adjustable in one place if the client asks for larger text on the plant floor:

```css
--field-height: 30px;
--field-font: 13px;
--grid-row-height: 28px;
--label-font: 11px;
--section-gap: 12px;
--field-gap: 8px;
--panel-pad: 12px;
```

Labels sit above inputs in a compact two-line stack, which scans faster than left-aligned labels in a dense multi-column form and reflows correctly at 150% scaling. Grid line items use inline column headers, not per-cell labels.

### 21.5 Screen-level layout

The sales counter and GRN screens use a fixed three-region layout:

```
┌──────────────────────────┬───────────────────┐
│  T1 entry region         │  Context panel    │
│  (never scrolls)         │  outstanding,     │
├──────────────────────────┤  holding, stock,  │
│  Line grid (scrolls)     │  credit headroom  │
├──────────────────────────┤  (never scrolls)  │
│  T2 accordions (collapsed)│                  │
├──────────────────────────┴───────────────────┤
│  Totals strip + PostBar (always visible)     │
└──────────────────────────────────────────────┘
```

The totals strip and the context panel never scroll out of view. The operator can always see what the customer owes and what the bill comes to.

---

## 22. Web-mode parity discipline (D9)

**Requirement:** F3 is a pure web application against a real database, retaining the same UI, with changes confined to the backend.

Achieving this is not a matter of care at the end. Four classes of assumption creep into a shell-only frontend and each is expensive to remove later. This section makes the countermeasures binding during F1.

### 22.1 The parity contract

**The `Web/dist/` artefact built for F1 and the one deployed in F3 are byte-identical.** Nothing is rebuilt, re-flagged or forked. If a change is needed for web mode, it belongs in `bridge.ts`, `urls.ts`, or behind a capability flag — nowhere else.

CI enforcement: a build step greps the frontend source for `chrome.webview` outside `shell/bridge.ts`, and for hardcoded `https://companion/`, `https://attachments/` or `https://plugins/` outside `shell/urls.ts`. Either match fails the build.

### 22.2 Latency discipline

In shell mode a bridge call is an in-process method call — microseconds. In web mode it is an HTTP round trip over a plant LAN or, for the MD on mobile, over cellular. A frontend written against zero latency feels broken at 150 ms.

Binding rules:

1. **One call per screen.** A view fetches everything it needs in a single bridge call returning a composed payload (as `dashboard.snapshot` already does, §9.4). Not one call per panel.
2. **No call per keystroke.** Type-ahead pickers debounce at 250 ms and cache the result set for the session.
3. **No call per row.** Grids receive their data with the parent document.
4. **Draft auto-save is debounced** to 800 ms after the last change, not fired per field.
5. **Every view renders a skeleton state**, because in web mode data arrives after paint. A view that assumes data is present at mount will flash empty.
6. **Optimistic UI only where reversal is harmless** — never for posting.

**Enforcement mechanism — the latency injector.** `bridge.ts` reads a dev-only setting `simulatedLatencyMs`, defaulting to **120 ms in development builds** and 0 in release. Developers therefore build every screen while feeling web-mode latency. This single measure catches more parity defects than any amount of review, because a chatty screen becomes obviously unpleasant to its own author on the day it is written.

### 22.3 Capability flags

Mode differences are expressed as named capabilities, never as `if (deploymentMode === 'shell')` scattered through views. The adapter exposes:

```typescript
interface Capabilities {
  nativeContextBar: boolean;   // shell renders identity strip (§20)
  nativeFileDialog: boolean;   // SaveFileDialog vs <input type="file"> / Blob download
  nativePrint: boolean;        // WebView2 print vs window.print()
  globalHotkey: boolean;       // OS-level hotkey registration
  offlineCapable: boolean;     // local data, no server dependency
  multiUser: boolean;          // concurrent editors possible
}
```

Views consult capabilities; they never consult the deployment mode. Adding a fourth flavour later then requires no view changes.

### 22.4 Concurrency, adopted now

F1 is single-user, which hides every stale-data problem. F3 has two counters posting invoices against the same stock at the same time. Retrofitting concurrency control across every save path is expensive; adding it now costs almost nothing.

Adopted from P1:

- Every `EntityBase` carries `RowVersion` (incrementing integer, or SQLite `rowid`-based token in F2).
- `doc.draft` and `masters.save` send the version they loaded. A mismatch returns a typed `ConflictError`, not a generic failure.
- The frontend handles `ConflictError` in one place, in the save helper, showing "This record was changed by {user}. Reload?" — written once in F1, correct in F3.
- Stock and balance guards (§7.5) run **inside** the posting transaction, never before it. In F1 this is invisible; in F3 it is the difference between correct and oversold.
- Document numbering takes its sequence inside the unit of work (§5.3) — already specified, and the reason is concurrency.

### 22.5 The browser harness

From **P2 onward**, the SPA runs continuously in a browser against a stub HTTP bridge, alongside the shell build:

```
npm run dev:web     # Vite dev server + stub server implementing POST /api/bridge
                    # backed by the same JsonRepository via a thin ASP.NET Core host
```

The stub is roughly fifty lines: it is the F3 `BridgeController` (§17.3 of the architecture spec) pointed at the F1 repository. Building it in P2 rather than P12 means:

- The `HttpAdapter` is exercised from the first week rather than written blind at the end.
- `LoginView.svelte` and `ContextBar.svelte` (§20.5) have somewhere to live and be tested against stub authentication.
- WebSocket event handling, reconnection and refetch-on-reconnect are proven early.
- Any developer who accidentally couples a view to the shell discovers it the same day.

**Definition of done for every frontend task, from P2 to the end of the project: it works in the shell and in the browser harness.** A task that works in only one is not finished.

### 22.6 What actually changes in F3

With the above observed, F3 is confined to:

| Component | Change |
|---|---|
| `Web/` | **None.** Same artefact. |
| `Shared/` | `SqliteRepository` → `SqlServerRepository` / `PostgresRepository`, or SQLite retained on the server. Services unchanged. |
| `Server/` | New host: Kestrel, `BridgeController`, `EventBroadcaster`, `AuthMiddleware` |
| `Shell/` | Unchanged; continues to ship as F2 for plant-floor offline use |
| Auth | `session.init` fed by middleware instead of `SessionService` defaults |
| File I/O | Native dialogs replaced per capability flags |
| Deployment | IIS or Kestrel behind a reverse proxy; HTTPS; backup moves to the database's own strategy |

The frontend team's involvement in F3 should be limited to testing.

---

## 23. Revised open technical decisions

Extending §18 with items arising from sections 19–22.

| # | Decision | Notes | Needed by |
|---|---|---|---|
| **O-11** | Code-signing certificate | Removes SmartScreen friction (§19.4) and antivirus false positives. Worth purchasing before F2 pilot; optional for F1 if START-HERE instructions are clear. | F2 |
| **O-12** | Demo period length | 90 days keeps generation under 20 s. If the client wants year-on-year comparison in the demo, extend to 400 days and pre-generate in the background after first paint. | P4 |
| **O-13** | Identity bar contents | Confirm what belongs in the always-visible 28 px strip beyond name and role: plant name, business date, shift, pending-approval count, connection state. Cheap to add now, disruptive to relayout later. | P6 |
| **O-14** | F3 database engine | SQLite on the server is adequate for a single plant with a handful of concurrent counters. SQL Server or PostgreSQL become necessary for multi-plant or reporting-heavy use. Decide before P12; `IRepository` keeps the cost low either way. | P12 |
| **O-16** | F3 authentication source | Local user table with hashed passwords is the default and matches the F2 login. If the client's IT wants Active Directory or an existing intranet SSO, the login screen becomes a redirect and the cookie is issued after the identity provider returns. Decide before P13; `session.init` insulates the frontend either way. | P13 |
| **O-15** | Simulated latency default | 120 ms is a plant-LAN estimate. If the MD will use the system over cellular, developers should build against 300 ms instead. | P2 |

---

*End of Technical Specification. Sections 7 and 8 must be correct before anything else is worth building; sections 19 to 22 determine whether the demo lands and whether F3 costs weeks or months.*
