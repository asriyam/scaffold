# LPG Plant ERP — Functional Specification

**Document type:** Business / Functional Specification (for client review)
**Subject:** LPG Storage, Filling & Distribution Plant — Enterprise Resource Planning System
**Status:** Draft for client review
**Companion document:** Technical Specification & Data Model (separate document, for the development team)

---

## How to read this document

This document describes **what the system will do in the language of the plant** — the way work actually happens at the gate, the weighbridge, the decanting point, the filling shed, the cash counter and the closing table. It does not list database fields or screens; those are in the companion technical document.

It is organised as:

- **Part A — Context:** the business, the people, the vocabulary.
- **Part B — Usage scenarios:** a walk through a normal working day, step by step, plus the exceptions.
- **Part C — Data flow:** how gas, cylinders, valves, documents and money move through the system.
- **Part D — Business rules:** the numbered rules the system will enforce. **These are the items to approve or correct.**
- **Part E — Reports, roles and controls.**
- **Part F — Assumptions and open questions.** Items requiring a decision before development starts.

Every rule carries a reference number (for example **BR-SAL-07**). Please mark agreement, change or rejection against these numbers.

---

# PART A — BUSINESS CONTEXT

## A.1 What the plant does

The plant operates three connected businesses under one roof:

1. **Bulk LPG procurement and storage.** LPG arrives by road tanker (bowser) from suppliers, is weighed in, decanted into storage bullets, and weighed out. The difference is the gas received.
2. **Cylinder filling.** Bulk LPG from the storage tanks is filled into cylinders of standard domestic and commercial sizes, using empty cylinders returned by distributors or newly purchased cylinders.
3. **Distribution sales.** Distributors arrive at the plant with vehicles, return empties, take filled cylinders, buy new cylinders, valves and accessories, pay loading and unloading charges, and settle in cash, bank transfer, cheque or credit.

Around these sit the money: supplier payables, distributor receivables, cash in hand at the plant, company bank accounts, and plant operating expenses.

The system must tie all of this together so that **every kilogram of LPG and every rupee is traceable from the supplier's bowser to the distributor's vehicle and into the bank.**

## A.2 Terminology used in this document

| Term | Meaning as used here |
|---|---|
| **Bowser** | Road tanker delivering bulk LPG to the plant |
| **GRN** | Goods Receipt Note — the document raised when a bowser is received |
| **Weighbridge / kanta** | Scale used to weigh the bowser in and out; produces the weight slip |
| **First weight** | Weight of the loaded bowser on arrival (gross) |
| **Second weight** | Weight of the bowser after decanting (tare) |
| **Net LPG received** | First weight minus second weight |
| **Decanting** | Transferring LPG from the bowser into a storage tank |
| **Storage tank / bullet** | Pressurised bulk LPG vessel at the plant, numbered Tank 1, Tank 2 etc. |
| **Rotogauge** | Float-type gauge showing liquid level in a tank as a percentage |
| **Safe fill limit** | Maximum permitted filling level of a tank (commonly 85% of capacity) |
| **Filling shed / carousel** | Area where bulk LPG is filled into cylinders |
| **Refill** | Sale of gas only — the distributor's own empty cylinder is returned and a filled one is issued |
| **New cylinder sale** | Sale of the physical cylinder itself (with gas), not just gas |
| **Domestic cylinder** | The 11.8 kg cylinder; the industry's standard reference size |
| **Commercial cylinder** | The 45.4 kg cylinder |
| **Valve** | Cylinder valve, sold separately and also fitted during filling |
| **Gate pass** | Document authorising a loaded vehicle to leave the plant |
| **Distributor** | Trade customer buying at the plant for onward distribution |
| **Loading & unloading charges** | Labour/handling amount collected at the plant, over and above goods value |
| **Outstanding / recovery** | Unpaid distributor balance, and money collected against it later |
| **Cylinder holding** | Cylinders lying with a distributor — refills issued against empties not yet returned |
| **Daily closing** | End-of-day operational and financial cut-off and sign-off |
| **Weighted average selling rate** | Total LPG sales value divided by total LPG kilograms sold in the day |

## A.3 Who uses the system

| Role | Where they sit | What they do in the system |
|---|---|---|
| **Data Entry Operator** | Gate / weighbridge / filling shed | Records gate passes, weights, tank readings, filling batches. Cannot see money. |
| **Cashier** | Cash counter | Receives payments, records deposits, hands over cash, keeps the cash book. |
| **Plant Supervisor** | Plant floor | Approves daily operational entries, explains stock variances, verifies filling and tank logs. |
| **Accounts Officer** | Accounts office | Maintains ledgers, expenses, bank and cash records; prepares financial reports. |
| **Plant Manager** | Plant | Full operational authority; approves daily closing; approves rate overrides and adjustments. |
| **Managing Director / CEO** | Head office / mobile | Full visibility. Dashboards, all reports, system configuration, user management. |

---

# PART B — USAGE SCENARIOS

These describe a normal working day at the plant and the exceptions that arise. Each scenario notes the rules that govern it.

## B.1 Scenario — Start of day

The Plant Supervisor opens the day in the system. The system automatically carries forward the previous day's closing figures as today's opening: LPG in each tank, filled cylinders by size, empty cylinders by size, new cylinders, valves, cash in hand, and every bank balance. **No opening figure can be typed in by hand.** *(BR-INV-04, BR-CSH-06)*

The Data Entry Operator records the morning tank readings for every tank — rotogauge percentage, liquid level, pressure and temperature — before any receipt or sale is entered. *(BR-TNK-01)*

## B.2 Scenario — A bowser arrives with bulk LPG

1. The bowser reaches the gate. The operator raises a **GRN** and records the arrival: date and time, supplier, purchase order if any, bowser number, driver name, CNIC and mobile, and transport company.
2. The loaded bowser goes on the weighbridge. The operator records the **first weight** with its date and time and attaches or references the weighbridge slip.
3. The operator selects the **receiving tank**. The system checks that the tank has enough room below its safe fill limit and refuses the selection if it does not. *(BR-PUR-05)*
4. Decanting takes place. If the load is split across more than one tank, the operator records the quantity into each tank separately, and the total must equal the net received. *(BR-PUR-06)*
5. The empty bowser is weighed again. The system computes **net LPG received = first weight − second weight** and will not accept a second weight higher than the first. *(BR-PUR-02, BR-PUR-03)*
6. The system compares net received against the supplier's challan quantity. If short beyond tolerance, the shortage is flagged for a supplier claim. *(BR-PUR-04)*
7. The operator enters the **cost of the load**: LPG rate, freight, weighbridge charges, other charges and any discount. The system computes the net landed cost and the landed rate per kilogram. *(BR-PUR-07)*
8. On approval, the system simultaneously:
   - increases the stock of the selected tank(s);
   - recalculates the **weighted average cost of LPG** held at the plant; *(BR-PUR-08)*
   - credits the supplier's ledger with the amount payable;
   - makes the gas available for filling and sale.

**Payment against the bowser** may be made at the same time or later, in any combination: bank transfer, direct deposit into the supplier's account, cash, online transfer, cheque, part payment handed to the driver, or against a previously paid advance. Each payment records its date, method, amount, bank, reference and remarks, and reduces the supplier's outstanding balance. *(BR-PUR-09, BR-PUR-10)*

## B.3 Scenario — Filling cylinders

The filling shed draws bulk LPG from a nominated tank and fills empty cylinders.

The operator records a **filling batch**: the tank used, the cylinder size, the number of cylinders filled, and the number of valves fitted. The system then:

- reduces LPG in that tank by the gas filled plus recorded filling loss;
- reduces empty cylinder stock of that size;
- increases filled cylinder stock of that size;
- reduces valve stock by the valves fitted. *(BR-FIL-01 to BR-FIL-05)*

The system will not allow filling more cylinders than there are empties available, nor drawing more gas than the tank holds. Filling loss beyond the agreed tolerance requires the Supervisor's explanation. *(BR-FIL-03, BR-FIL-06)*

## B.4 Scenario — A distributor buys at the plant

This is the plant's highest-volume transaction and the most important screen in the system.

1. **Vehicle arrives.** The operator records the vehicle number, driver name and the distributor, and issues a **gate pass number**.
2. **Empties returned.** The distributor's returned empty cylinders are counted by size and recorded. Empty stock increases. Damaged or rejected cylinders are recorded separately and do not enter saleable stock. *(BR-SAL-02, BR-INV-06)*
3. **Distributor selected.** The system immediately displays the distributor's **previous outstanding balance** and cylinder holding position on screen, before anything is sold. *(BR-SAL-03)*
4. **Goods entered.** In one document the operator can record:
   - **refill cylinders** by size — 6 kg, 11.8 kg, 15 kg, 45.4 kg or any user-defined size;
   - **new cylinder sales** by the same sizes;
   - **valve sales**;
   - **accessories and other plant items**;
   - **loading & unloading charges collected at the plant** — a single combined amount. *(BR-SAL-06)*
5. **Rates applied automatically.** Rates come from the **rate master**, which holds the current gas refill rate for each size and the current price of each new cylinder and valve. The operator does not type rates. Where a rate must be overridden for a particular distributor, only an authorised user may do so and a reason is recorded on the invoice. *(BR-MST-02, BR-SAL-04)*
6. **Bill calculated.** The system totals refill value, new cylinder value, valve value, other items and loading & unloading, applies any discount, and produces the **net invoice**.
7. **Previous balance shown on the bill.** The invoice prints the previous outstanding, the amount received against it today, the current invoice amount and the total outstanding after this sale. This continues on every invoice until the balance is cleared. *(BR-SAL-03, BR-LED-02)*
8. **Payment recorded.** Cash, bank transfer, cheque, online transfer, or credit — in any combination on the same invoice. Any unpaid portion becomes credit and adds to the distributor's outstanding. *(BR-SAL-08)*
9. **Credit limit checked.** If the sale takes the distributor past their approved credit limit, the system warns and requires authorisation to proceed. *(BR-SAL-09)*
10. **Stock and ledgers update.** Filled cylinder stock, new cylinder stock and valve stock reduce; the customer ledger is charged; cash or the relevant bank account is credited with what was received.
11. **Vehicle leaves** against the gate pass, which is now linked to a specific invoice. A loaded vehicle cannot leave against an unbilled gate pass. *(BR-SAL-11)*

## B.5 Scenario — A distributor pays against an old balance

A distributor may come only to pay, or may pay an old balance while also buying. The cashier records a **receipt** against the distributor, in cash, bank, cheque or online transfer. The system applies the recovery to the oldest outstanding invoices first unless the cashier allocates it against specific invoices. The customer ledger, the day's collection figures and the cash or bank balance all update. *(BR-LED-03, BR-LED-04)*

## B.6 Scenario — Recording a plant expense

Expenses arise all day: kitchen and pantry, plant maintenance, generator diesel, vehicle fuel and repairs, cargo and transportation, electricity, water, telephone and internet, salaries and daily wages, management salaries and allowances, entertainment, travel, office and stationery, security, cleaning, bank charges, government fees, insurance, and miscellaneous items.

For each expense the system records what it was for, which category, which vendor, the amount, **who reported it, who verified it and who approved it**. *(BR-EXP-02)*

An expense may be **paid, partly paid, or unpaid**. A paid expense immediately reduces cash in hand or the bank account used. An unpaid expense stays in the **outstanding expenses register** with its due date until settled, so that at month end nothing is missed. *(BR-EXP-03, BR-EXP-05)*

## B.7 Scenario — Cash deposit and handover

During or at the end of the day the cashier deposits collected cash into a company bank account. The deposit records the bank, account title, account number, amount, slip or transaction reference, and date and time. Cash in hand reduces; that bank account increases. *(BR-CSH-03)*

When cash is handed over — to the head office, to a manager, or to the next shift — the system records **the name of the person handing over and the name of the person receiving**, with date, time and approval. *(BR-CSH-04)*

Cash in hand can never go below zero. *(BR-CSH-02)*

## B.8 Scenario — Evening tank reading and reconciliation

At the end of the day the operator records closing tank readings. For each tank the system compares:

- **physical quantity**, derived from the rotogauge reading, tank capacity, temperature and product density; against
- **system quantity**, being opening stock plus LPG decanted in, minus gas filled out.

The difference is the **variance** for the day, reported as gain or loss. Within tolerance it is accepted and posted to the LPG gain/loss account. Beyond tolerance the Supervisor must record an explanation, and the day cannot be closed until it is explained and approved. *(BR-TNK-04, BR-TNK-05, BR-TNK-06)*

## B.9 Scenario — Daily closing

The Plant Supervisor runs the **daily closing**. The system will not permit closing until every precondition is met: all tank logs recorded, all invoices approved, all gate passes billed, physical cash counted and agreeing with the system, and every stock variance explained. *(BR-CLS-01)*

The closing produces the **Daily Closing Report**, on one page, showing:

- **Plant activity** — opening LPG stock, LPG received, LPG filled, LPG sold, closing LPG stock, bowsers received, invoices issued, distributors served.
- **Revenue by stream, shown separately** — LPG gas sales, refill cylinder sales, new cylinder sales, valve sales, accessories and other sales, **total loading & unloading collected at the plant (one line)**, and grand total daily revenue. *(BR-CLS-03)*
- **Collections** — cash, bank transfers, online transfers, cheques, direct deposits, credit sales, and recovery of previous outstanding.
- **Bank deposits** — account-wise, with references.
- **Cash position** — opening cash, received, deposited, expenses paid in cash, cash handed over, closing cash at plant, with the names of the persons handing over and receiving.
- **Credit summary** — today's credit sales, recoveries, and total distributor outstanding.
- **Purchase summary** — LPG purchased, purchase value, supplier payments, supplier outstanding.
- **Expense summary** — incurred today, paid today, outstanding.
- **Closing inventory** — LPG tank by tank, filled cylinders, empty cylinders, new cylinders, valves, accessories.
- **Daily rate** — see B.10.
- **Sign-off** — Plant Operator, Plant Supervisor, Plant Manager, closing time, remarks, approval status. *(BR-CLS-05)*

Once the Plant Manager approves the closing, **the day is locked**. Nothing in that day can be edited afterwards; corrections are made only by dated reversal entries in an open day, with the original entry preserved. *(BR-CLS-06, BR-AUD-03)*

## B.10 Scenario — The day's rate

Gas is sold to different distributors at different rates during the same day. Management needs one reference number for the day, expressed the way the trade expresses it.

The system calculates the **weighted average LPG selling rate** — total LPG sales value divided by total LPG kilograms sold — not a simple average of the rates charged. *(BR-RAT-01)*

It then converts this into the **Daily Domestic Cylinder Rate**, the industry's standard reference:

> **Daily Domestic Cylinder Rate = Weighted Average LPG Selling Rate × 11.8**

The Daily Closing Report and the management dashboard display the average, the highest and the lowest domestic cylinder rate of the day, alongside the **weighted average purchase rate** and the resulting **gross margin per kilogram** and **gross profit on LPG for the day**. *(BR-RAT-02, BR-RAT-03, BR-RAT-04)*

## B.11 Scenario — Management looks at the plant from outside

The Managing Director opens the dashboard on a phone or laptop and sees, live: LPG available in each tank with rotogauge, pressure and temperature; today's purchases, sales and collections; cash position and every bank balance; distributor and supplier outstandings; filled, empty and new cylinder inventory; valve inventory; today's expenses; the domestic cylinder rate; and any alerts — low stock, high pressure, tank level, credit limit breaches, stock variance and overdue payments.

## B.12 Exception scenarios

| Situation | How the system handles it |
|---|---|
| **Wrong invoice issued** | The invoice is **cancelled**, never deleted. Cancellation reverses stock, ledger and collection entries, requires a reason and authorisation, and remains visible in the audit trail. *(BR-AUD-03)* |
| **Bowser short weight** | Shortage against supplier challan is recorded and flagged for claim; the supplier ledger is charged only for gas actually received unless management directs otherwise. *(BR-PUR-04)* |
| **Rate changes during the day** | The rate master is updated with an effective date and time. Invoices already raised keep the rate at which they were raised and are never repriced. *(BR-MST-03)* |
| **Damaged cylinder or valve** | Moved to the damaged register, removed from saleable stock, with reason and approval. *(BR-INV-06)* |
| **Stock count differs from system** | A stock adjustment is recorded with reason and approval; it never silently overwrites the balance. *(BR-INV-07)* |
| **Distributor returns fewer empties than refills taken** | The difference increases the distributor's **cylinder holding balance**, tracked per size on the customer ledger. *(BR-SAL-02, BR-LED-05)* |
| **Payment made to a driver on account** | Recorded as a partial payment against that bowser's GRN and against the supplier's ledger. *(BR-PUR-09)* |
| **Entry needed for a closed day** | Not permitted. A reversal or adjustment entry is made in the current open day, referencing the original. *(BR-CLS-06)* |

---

# PART C — DATA FLOW

## C.1 The LPG mass balance

This is the spine of the system. Every kilogram must be accounted for at each stage.

```
Supplier
   |
   v
Bowser arrives  -->  First weight
   |
   v
Decanting into Tank n  -->  Second weight  -->  Net LPG received
   |
   v
TANK STOCK  (opening + received - issued = closing)
   |                                    ^
   |                                    |
   v                          reconciled against rotogauge
Filling batch                           |
   |                                    |
   v                                    |
FILLED CYLINDER STOCK  <-- empty cylinders in
   |
   v
Sale to distributor  -->  Gate pass  -->  Vehicle leaves
   |
   v
Empty cylinders returned  -->  EMPTY CYLINDER STOCK  --> back to filling
```

Losses and gains are recognised at two points only: **decanting variance** (received versus challan) and **tank variance** (physical versus system). Both are reported daily and require explanation beyond tolerance.

## C.2 The cylinder and valve circulation

```
New cylinders purchased ----> NEW CYLINDER STOCK ----> sold to distributor
                                                            |
Empty from distributor ----> EMPTY STOCK ----> filling ----> FILLED STOCK ----> sold
                                   ^                                              |
                                   |______________ returned next visit ___________|

Valves purchased ----> VALVE STOCK ----+---> sold to distributor
                                       +---> fitted during filling
                                       +---> damaged / scrapped
```

Each of these five stock pools — filled, empty, new, valves, accessories — carries the same daily structure: **opening + received − issued/sold − damaged ± adjustment = closing**, and closing becomes tomorrow's opening automatically.

## C.3 The money flow

```
                 SALES INVOICE
                       |
        +--------------+---------------+
        |              |               |
      Cash          Bank/Online      Credit
        |              |               |
        v              v               v
   CASH IN HAND   BANK ACCOUNTS   CUSTOMER LEDGER
        |              ^               |
        | deposit      |               | recovery
        +------------->+<--------------+
        |              |
        | expenses     | supplier payments, expense payments
        v              v
   EXPENSE LEDGER   SUPPLIER LEDGER
        |              |
        +------+-------+
               v
      DAILY CLOSING & BANK POSITION
               |
               v
     CONSOLIDATED COMPANY POSITION
   (cash + bank - payables + receivables)
```

## C.4 The document chain

| Event | Document raised | Links to |
|---|---|---|
| Bowser received | GRN | Supplier, weighbridge slips, tank, purchase payment |
| Payment to supplier | Payment voucher | GRN, bank account or cash |
| Cylinders filled | Filling batch note | Tank, empty stock, filled stock, valve stock |
| Distributor sale | Gate pass → Invoice | Customer, stock, receipt, customer ledger |
| Payment received | Receipt voucher | Invoice(s), cash or bank |
| Expense | Expense voucher | Category, vendor, cash or bank |
| Cash to bank | Deposit slip entry | Cash, bank account |
| End of day | Daily Closing Report | Everything above |

Every document carries a unique number, cannot be deleted, and is traceable in both directions — from the closing report back to the individual weighbridge slip, and from a weighbridge slip forward to the day it was reported in.

---

# PART D — BUSINESS RULES

These are the rules the system will enforce. **Please review and confirm, amend or reject each one by its reference number.**

## D.1 Master data (BR-MST)

| # | Rule |
|---|---|
| BR-MST-01 | Cylinder sizes 6 kg, 11.8 kg, 15 kg and 45.4 kg are standard. The plant may define additional sizes at any time without software changes. |
| BR-MST-02 | All selling prices are held in a single **rate master**: gas refill rate per size, new cylinder price per size, valve price, and accessory prices. Operators never type a rate on an invoice. |
| BR-MST-03 | Rate master changes are **effective-dated**. An invoice binds the rate in force at the moment it is raised. Changing the master never reprices an invoice already issued. |
| BR-MST-04 | Storage tanks are defined by the plant with capacity and safe fill limit. Tanks may be added without software changes. |
| BR-MST-05 | Each distributor is defined with an opening balance, a credit limit and an opening cylinder holding position. |
| BR-MST-06 | Each supplier is defined with an opening balance and payment terms. |
| BR-MST-07 | The company may hold an unlimited number of bank accounts, each with bank name, branch, account title, account number and type. |
| BR-MST-08 | Opening balances for all ledgers, stock and banks are entered once at go-live, verified, and then locked against editing. |

## D.2 Bulk LPG purchase and bowser receiving (BR-PUR)

| # | Rule |
|---|---|
| BR-PUR-01 | Every bowser is received against a unique GRN number generated by the system. |
| BR-PUR-02 | **Net LPG received = first weight − second weight.** Calculated by the system; not editable by hand. |
| BR-PUR-03 | The second weight must be less than the first weight. The system rejects any other combination. |
| BR-PUR-04 | Net received is compared to the supplier's challan quantity. A shortage beyond the agreed tolerance is flagged as a claim and reported. |
| BR-PUR-05 | A tank may be selected only if the quantity to be decanted fits below its safe fill limit. |
| BR-PUR-06 | Where a load is split across tanks, the sum decanted into all tanks must equal the net received. |
| BR-PUR-07 | **Net landed cost = (rate × quantity) + freight + weighbridge charges + other charges − discount.** The landed rate per kg is derived from this. |
| BR-PUR-08 | On every receipt the system recalculates the **weighted average cost of LPG in stock**, used for valuation and margin reporting. |
| BR-PUR-09 | Payment against a bowser may be made in any number of instalments and by any combination of methods, including part payment to the driver and adjustment of an earlier advance. |
| BR-PUR-10 | Total paid can never exceed the net landed cost without being recorded as an advance against future purchases. |
| BR-PUR-11 | Once a GRN is approved it cannot be edited. Corrections are made by reversal only. |
| BR-PUR-12 | Approval of a GRN simultaneously increases tank stock and the supplier's payable. The two can never move independently. |

## D.3 Storage tanks and monitoring (BR-TNK)

| # | Rule |
|---|---|
| BR-TNK-01 | Tank readings — rotogauge, liquid level, pressure and temperature — are recorded for every tank at the start and end of each working day. Missing readings block daily closing. |
| BR-TNK-02 | Physical quantity in a tank is derived from the rotogauge reading, tank capacity, product density and temperature correction. |
| BR-TNK-03 | For each tank each day: **closing = opening + received − issued.** |
| BR-TNK-04 | The system reports the daily **variance = physical quantity − system quantity** for each tank, as a gain or a loss. |
| BR-TNK-05 | Variance within the agreed tolerance is accepted automatically and posted to the LPG gain/loss account. |
| BR-TNK-06 | Variance beyond tolerance requires a recorded explanation and Supervisor approval before the day can be closed, and raises an alert to management. |
| BR-TNK-07 | Tank stock can never go below zero. Any transaction that would do so is rejected. |
| BR-TNK-08 | Alerts are raised for high tank level, low tank level, high pressure and abnormal temperature. |
| BR-TNK-09 | The complete history of daily readings is retained permanently for trend reporting. |

## D.4 Cylinder filling (BR-FIL)

| # | Rule |
|---|---|
| BR-FIL-01 | Filling is recorded as a batch against a nominated tank, a cylinder size, a quantity of cylinders and the valves fitted. |
| BR-FIL-02 | Gas consumed by a batch = (cylinders filled × nominal size) + recorded filling loss. |
| BR-FIL-03 | A batch cannot fill more cylinders than the available empty stock of that size, nor draw more gas than the tank holds. |
| BR-FIL-04 | Each approved batch reduces tank stock and empty cylinder stock, and increases filled cylinder stock, in a single action. |
| BR-FIL-05 | Valves fitted during filling reduce valve stock. |
| BR-FIL-06 | Filling loss beyond the agreed tolerance requires Supervisor explanation. |

## D.5 Sales and billing (BR-SAL)

| # | Rule |
|---|---|
| BR-SAL-01 | Every vehicle entering to load is issued a gate pass; every invoice is linked to exactly one gate pass. |
| BR-SAL-02 | Empty cylinders returned by the distributor are counted by size and recorded on the same transaction. Empties returned increase empty stock; a shortfall against refills issued increases the distributor's cylinder holding balance. |
| BR-SAL-03 | On selecting a distributor, the system displays their previous outstanding balance and cylinder holding **before** any goods are entered, and prints the outstanding on the invoice until it is cleared. |
| BR-SAL-04 | Rates default from the rate master. Any override requires an authorised user and a recorded reason, both shown on the invoice and in the audit trail. |
| BR-SAL-05 | One invoice may contain refill cylinders, new cylinder sales, valve sales, accessories and loading & unloading charges together. |
| BR-SAL-06 | **Loading & unloading is recorded as one combined amount collected at the plant.** It is a separate revenue line, shown apart from gas, cylinder and valve sales, and included in grand total revenue. |
| BR-SAL-07 | **Net invoice = refill value + new cylinder value + valve value + other items + loading & unloading − discount.** |
| BR-SAL-08 | Payment against an invoice may be split across cash, bank transfer, online transfer and cheque; any unpaid balance becomes credit and increases the distributor's outstanding. |
| BR-SAL-09 | A sale that would take a distributor beyond their approved credit limit requires authorisation before it can be saved. |
| BR-SAL-10 | Approval of an invoice reduces stock and charges the customer ledger in a single action; the two can never move independently. |
| BR-SAL-11 | A loaded vehicle cannot be released against a gate pass that has no approved invoice. |
| BR-SAL-12 | Invoices are never deleted. An incorrect invoice is cancelled with a reason and authorisation, reversing all stock, ledger and collection effects while remaining on record. |
| BR-SAL-13 | Filled cylinder, new cylinder and valve stock can never go below zero. |

## D.6 Inventory (BR-INV)

| # | Rule |
|---|---|
| BR-INV-01 | Separate stock is maintained for filled cylinders, empty cylinders, new cylinders, valves and accessories — each by size where applicable. |
| BR-INV-02 | For every item each day: **closing = opening + receipts − issues/sales − damages ± adjustments.** |
| BR-INV-03 | Every purchase, filling batch, sale, return and adjustment updates stock automatically at the moment of approval. No stock figure is ever typed directly. |
| BR-INV-04 | Closing stock automatically becomes the next day's opening stock. Opening figures cannot be edited. |
| BR-INV-05 | A complete stock movement register is maintained per item showing opening, receipts, issues, returns, adjustments, damages and closing. |
| BR-INV-06 | Damaged or rejected cylinders and valves are moved to a damaged register with reason and approval, and are excluded from saleable stock. |
| BR-INV-07 | Physical stock counts are reconciled against system stock; differences are posted as approved adjustments with reasons, never as silent overwrites. |
| BR-INV-08 | Low stock alerts are raised against thresholds set per item. |
| BR-INV-09 | Inventory is valued at weighted average cost for LPG and at purchase cost for cylinders, valves and accessories. |

## D.7 Customer and supplier ledgers (BR-LED)

| # | Rule |
|---|---|
| BR-LED-01 | Each distributor and each supplier has a continuous ledger showing every transaction with a running balance. |
| BR-LED-02 | The customer outstanding shown on an invoice, on the ledger, on the dashboard and on the daily closing report is always the same figure drawn from one source. |
| BR-LED-03 | Receipts are applied to the oldest outstanding invoice first, unless the cashier allocates them against specific invoices. |
| BR-LED-04 | Advances received from a distributor and advances paid to a supplier are held as credit balances and adjusted against future transactions. |
| BR-LED-05 | The distributor's cylinder holding position is maintained per size alongside the money balance. |
| BR-LED-06 | Ledger balances are derived from transactions only. No balance can be edited directly. |

## D.8 Cash and bank (BR-CSH)

| # | Rule |
|---|---|
| BR-CSH-01 | Every receipt and every payment is posted to exactly one of: cash in hand, or one named bank account. |
| BR-CSH-02 | Cash in hand can never go below zero. |
| BR-CSH-03 | A bank deposit reduces cash and increases the named bank account in a single entry, with slip or transaction reference. |
| BR-CSH-04 | Cash handover records the name of the person handing over, the name of the person receiving, date, time and approval. |
| BR-CSH-05 | For each bank account daily: **closing = opening + total credits − total debits.** |
| BR-CSH-06 | Each account's closing balance becomes its next day's opening balance automatically. |
| BR-CSH-07 | The system maintains a **consolidated company position**: total cash in hand, total across all bank accounts, total customer receivables, total supplier and expense payables, and net available funds. |
| BR-CSH-08 | Physical cash counted at closing must agree with system cash; a difference must be explained before the day can be closed. |

## D.9 Expenses (BR-EXP)

| # | Rule |
|---|---|
| BR-EXP-01 | Every expense is recorded against a voucher number and an expense category; categories are user-definable. |
| BR-EXP-02 | Each expense records who reported it, who verified it and who approved it. |
| BR-EXP-03 | An expense may be paid, partly paid or unpaid. Payment reduces cash or the named bank account immediately. |
| BR-EXP-04 | Expenses above a defined amount require approval at a higher level before payment. |
| BR-EXP-05 | Unpaid and partly paid expenses remain in the outstanding expenses register with due dates until fully settled, and raise overdue alerts. |
| BR-EXP-06 | The daily closing shows expenses incurred today, expenses paid today, and total outstanding expenses. |
| BR-EXP-07 | Month-end reconciliation reports all outstanding expenses by category and by vendor. |

## D.10 The day's rate (BR-RAT)

| # | Rule |
|---|---|
| BR-RAT-01 | **Weighted Average LPG Selling Rate = total LPG sales value ÷ total LPG kilograms sold**, across all invoices of the day. A simple average of rates is not used. |
| BR-RAT-02 | **Daily Domestic Cylinder Rate = Weighted Average LPG Selling Rate × 11.8.** This is the headline rate shown to management. |
| BR-RAT-03 | The highest and lowest domestic cylinder rate of the day are also shown, derived from individual invoice rates. |
| BR-RAT-04 | The weighted average purchase rate, gross margin per kilogram and total gross profit on LPG for the day are calculated and shown alongside. |

## D.11 Daily closing (BR-CLS)

| # | Rule |
|---|---|
| BR-CLS-01 | The day cannot be closed until: all tank readings are recorded; all gate passes are billed; all invoices are approved; physical cash agrees with system cash; and every stock variance is explained. |
| BR-CLS-02 | Closing is automatic in calculation and manual only in approval — the system compiles the figures, people confirm them. |
| BR-CLS-03 | Revenue is reported separately for LPG gas, refill cylinders, new cylinders, valves, accessories and loading & unloading collected at the plant, and then totalled. |
| BR-CLS-04 | Collections are reported by method: cash, bank transfer, online transfer, cheque, direct deposit, credit, and recovery of previous outstanding. |
| BR-CLS-05 | The closing carries sign-off by the Plant Operator, Plant Supervisor and Plant Manager, with closing time, remarks and approval status. |
| BR-CLS-06 | Once approved, the day is locked. No entry in a closed day can be altered; corrections are made by reversal in the current open day. |
| BR-CLS-07 | The Daily Closing Report is printable as a single closing sheet and exportable to PDF and Excel. |
| BR-CLS-08 | A monthly closing consolidates the approved daily closings and cannot run until every day in the month is closed. |

## D.12 Audit and control (BR-AUD)

| # | Rule |
|---|---|
| BR-AUD-01 | Every creation, edit, approval, cancellation, login and logout is logged with user, date, time, machine or IP address, previous value and new value. |
| BR-AUD-02 | **No transaction is ever permanently deleted.** |
| BR-AUD-03 | Corrections are made by cancellation or reversal with reason and authorisation; the original record and the correction both remain visible. |
| BR-AUD-04 | The person who enters a transaction cannot be the sole approver of it. |
| BR-AUD-05 | Every figure on every report can be traced back to the source documents that produced it. |
| BR-AUD-06 | Users see only what their role permits; financial balances are hidden from operational roles. |

---

# PART E — REPORTS, ROLES AND CONTROLS

## E.1 Reports

**Operational**
Daily sales · daily purchase · bowser receiving · tank log · tank-wise inventory · rotogauge history · pressure and temperature trend · tank reconciliation and variance · filling production · cylinder inventory (filled, empty, new) · valve inventory · damaged cylinder and valve · stock movement register · low stock alert · daily gate pass · loading and dispatch.

**Sales and receivables**
Distributor-wise sales · cylinder-wise sales · customer ledger · outstanding customers with ageing · credit sales · recovery · cylinder holding by distributor · rate override log.

**Purchase and payables**
Supplier-wise purchase · bowser-wise purchase · supplier ledger · outstanding suppliers · payment register · purchase shortage and claims.

**Financial**
Cash book · bank book · bank position by account · cash position · consolidated cash and bank position · receipts and payments · expense report by category, vendor and department · outstanding expenses · daily closing · monthly closing · profit summary.

**Management**
Executive dashboard · daily executive summary · monthly performance · daily domestic cylinder rate history · margin analysis · tank utilisation · sales analysis · purchase analysis · collection analysis · expense analysis · profitability analysis.

All reports are printable and exportable to PDF and Excel, with date-range, plant, distributor, supplier and category filters.

## E.2 Role permissions

| Function | Data Entry Operator | Cashier | Plant Supervisor | Accounts Officer | Plant Manager | MD / CEO |
|---|---|---|---|---|---|---|
| Gate pass, weights, tank log, filling | Enter | — | Approve | View | Approve | Full |
| Sales invoice | Enter | Enter | Approve | View | Approve | Full |
| Receipts and payments | — | Enter | View | Enter | Approve | Full |
| Cash in hand and bank balances | Hidden | Own cash + assigned banks | Hidden | Full | Full | Full |
| Purchase / GRN | Enter | — | Approve | View | Approve | Full |
| Expenses | Enter | Enter (cash) | Verify | Enter and pay | Approve | Full |
| Rate master | — | — | — | Propose | Approve | Full |
| Ledgers | — | View own receipts | — | Full | Full | Full |
| Financial reports | — | Limited | Operational only | Full | Full | Full |
| Daily closing | Enter | Cash confirm | Run and verify | View | Approve | Full |
| Stock adjustment | Propose | — | Verify | — | Approve | Full |
| User management, configuration | — | — | — | — | — | Full |

## E.3 Security, backup and technical expectations

Web-based, accessible from computers, tablets and mobile phones over a secure network. Multi-user with secure login, session timeout and password policy. Automatic daily backup with manual and optional cloud backup, data encryption and a disaster recovery procedure. Built to support additional plants or branches in future. Fast search and filtering throughout. Barcode and QR support, SMS and email notification, and accounting-software integration are planned as later enhancements.

---

# PART F — ASSUMPTIONS AND OPEN QUESTIONS

## F.1 Assumptions made in this draft

1. The plant operates as a single location; multi-plant support is designed for but not deployed initially.
2. LPG is measured and traded in kilograms; tonnes are a display convenience only.
3. All amounts are in Pakistani Rupees, one currency only.
4. Cylinder filling happens at the plant; the system does not track individual cylinders by serial number in this phase.
5. The plant's financial year and month-end coincide with the calendar.

## F.2 Open questions for discussion with the client

**Pricing and billing**

1. **How is a refill priced?** Two possibilities give different invoices: (a) gas rate per kilogram × the cylinder's nominal weight, or (b) a flat rate per cylinder for each size. Which does the plant use, and does it differ between domestic and commercial sizes?
2. **Are rates distributor-specific?** Does each distributor have their own agreed rate or slab, or is there one plant rate per day with occasional overrides?
3. **Sales tax / GST** — no tax treatment appears in the requirements so far. Do invoices need sales tax, withholding tax, or an FBR-compliant invoice format? This affects invoice design and reporting.
4. **Loading & unloading** — is this a fixed amount per vehicle, per cylinder, or negotiated per trip?

**Cylinders and deposits**

5. **Cylinder deposit / security.** When a distributor holds our cylinders, is a refundable security taken? If so it is a separate liability and must appear on the ledger. Confirm whether this applies.
6. **Cylinder holding limits.** Should the system block or warn when a distributor's unreturned cylinder count exceeds an agreed limit?
7. **Individual cylinder tracking.** Is serial-number or barcode tracking of cylinders wanted later? It changes how the data is stored from day one.
8. **Testing and requalification** of cylinders — should the system track due dates for cylinder testing?

**Gas measurement**

9. **Tolerance levels.** What percentage variance is acceptable for (a) bowser shortage against challan, (b) daily tank reconciliation, (c) filling loss? These drive the alerts.
10. **Rotogauge conversion.** Should the system hold a conversion table per tank (percentage to kilograms with temperature and density correction), and who supplies it?
11. **Purchase costing.** Confirm weighted average costing for LPG. Should freight and weighbridge charges be included in the cost of gas, or treated as separate expense heads?

**Financial**

12. **Credit limits.** Should exceeding a limit block the sale or only warn and require authorisation?
13. **Cheque handling.** Are cheques recognised on receipt or only on clearance? This affects the day's collection figures.
14. **Salaries.** Should payroll be processed inside this system, or only recorded as an expense head?
15. **Profit reporting.** Is a full profit and loss statement required, or is the gross margin on LPG and the expense summary sufficient at this stage?

**Operational**

16. **Shift working.** Does the plant run more than one shift, and should closing be per shift as well as per day?
17. **Working day cut-off.** At what time does the plant's day close, and how are late sales after cut-off treated?
18. **Approval authority limits.** Above what amounts should expenses, discounts, rate overrides and adjustments require Plant Manager or MD approval?
19. **Go-live data.** Who will provide opening balances for distributors, suppliers, stock, tanks, cash and banks, and by when?
20. **Offline working.** If the internet or network fails, must the plant still be able to weigh, bill and load? This significantly affects the technical design and cost.

---

*End of Functional Specification. The companion Technical Specification & Data Model document covers entities, attributes, relationships, calculations, screen inventory and integration design for the development team.*
