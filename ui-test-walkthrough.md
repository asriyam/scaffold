# LPG Plant ERP — UI Test Walkthrough

**Estimated time:** 5 minutes  
**Purpose:** Validate the full daily business flow end-to-end using seeded demo data.

---

## Before You Begin

The app ships with 30 days of pre-seeded demo data and today's date as the business date.
Use the **gear icon (⚙)** at the top-right to switch roles between steps.

**Demo master data reference:**

| Entity | Values available |
|---|---|
| Customers | Distributor 01 – Distributor 20 (codes CUST01–CUST20) |
| Suppliers | LPG Supplier 1 – LPG Supplier 5 |
| Tanks | TK-001 Main Storage Tank · TK-002 Auxiliary Storage Tank |
| Cylinder sizes | 6 kg Domestic · 11.8 kg Domestic · 45.4 kg Commercial |
| Rate (per kg) | 11.8 kg → Rs. 145/kg (Group A) · Rs. 141/kg (B) · Rs. 137/kg (C) |
| Bank accounts | National Bank – Plant Current Account |

---

## Step 1 — Gate Pass (Plant Manager, ~45 sec)

> The day starts when a customer's vehicle arrives at the gate.

1. Role: **Plant Manager** (default on launch).
2. Click **Plant** (Alt+4) in the top menu.
3. Click the **Gate Pass** tab.
4. Fill in the form:
   - **Customer:** type `Distributor 01` and select it.
   - **Vehicle No:** `KHI-1234`
   - **Driver Name:** `Ali Hassan`
5. Click **Post (F9)**.
6. **Expected:** A green confirmation banner appears — `Gate Pass 202608-XXXXX issued — vehicle KHI-1234 admitted.` The pass appears in the today's list with status **open**.

---

## Step 2 — Sales Invoice (Data Entry Operator, ~90 sec)

> The sales counter links the gate pass to an invoice.

1. Click **⚙** → switch to **Data Entry Operator**.
2. Click **Sales** (Alt+2).
3. **Customer (F4):** type `Distributor 01`, select it.
   - The *Customer Account* card on the right shows their outstanding balance and last invoices.
4. **Gate Pass:** select `KHI-1234` from the dropdown — it shows the gate pass just created.
5. **Refill Lines → + Add line:**
   - Size: `11.8kg`
   - Qty: `20`
   - Rate: `145` *(auto-fills from rate card; edit only if testing override)*
   - Amount auto-computes: Rs. 2,900
6. **Payment Split:**
   - Cash: `2000`
   - Bank Transfer: select **National Bank – Plant Current Account** → Amount: `900`
   - Cheque, Online: leave at 0.
   - *Credit on account* shows Rs. 0.00 — fully paid.
7. Click **Post (F9)**.
8. **Expected:** `Invoice 202608-XXXXX posted successfully.`  
   A **Print** button appears — click it to preview the invoice.

---

## Step 3 — Purchase / GRN (Data Entry Operator, ~45 sec)

> A bowser arrives with an LPG delivery from the supplier.

1. Stay as **Data Entry Operator**.
2. Click **Purchase** (Alt+3).
3. The **GRN** tab is open by default. Fill in:
   - **Supplier:** type `LPG Supplier 1`, select it.
   - **Bowser No:** `B-001`
   - **Driver:** `Bashir Ahmed`
   - **First weight (kg):** `15200`
   - **Second weight (kg):** `3200`
   - *Net weight* auto-shows: **12,000 kg**
   - **Tank:** `TK-001 Main Storage Tank`
   - **Rate (Rs./kg):** `110`
   - *Cost* auto-shows: Rs. 1,320,000
4. Click **Post (F9)**.
5. **Expected:** `GRN 202608-XXXXX posted.`

---

## Step 4 — Tank Dip Log (Plant Supervisor, ~30 sec)

> The plant operator records the closing tank reading at end of day.

1. Click **⚙** → switch to **Plant Supervisor**.
2. Click **Plant** (Alt+4) → **Tank Log** tab.
3. Fill in:
   - **Tank:** `TK-001 Main Storage Tank`
   - **Slot:** `Closing`
   - **Rotogauge %:** `68`
   - **Liquid Level %:** `65`
   - **Pressure (bar):** `5.2`
   - **Temperature (°C):** `28`
   - *Computed kg* auto-shows (approximate level estimate).
4. Click **Post (F9)**.
5. **Expected:** no error.

---

## Step 5 — Filling Batch (Plant Supervisor, ~30 sec)

> Record cylinders filled from the main tank during the day.

1. Stay as **Plant Supervisor** → **Plant** → **Filling Batch** tab.
2. Fill in:
   - **Tank:** `TK-001 Main Storage Tank`
   - **Size:** `11.8kg`
   - **Cylinders:** `500`
   - **Valves:** `12`
   - **Nominal gas kg:** `5900` *(500 × 11.8)*
   - **Actual drawn kg:** `5940`
   - *Loss* auto-shows: 40 kg (0.68%)
3. Click **Post (F9)**.
4. **Expected:** no error.

---

## Step 6 — Daily Closing (Accounts Officer, ~60 sec)

> End-of-day reconciliation — three clicks: Check → Compile → Approve.

1. Click **⚙** → switch to **Accounts Officer**.
2. Click **Closing** (Alt+7).
3. The date is pre-filled with today. Click **Check**.
   - **Expected:** preflight checklist appears. Green ticks = all clear.  
     *(If any item is red, go back and complete the missing entry.)*
4. Click **Compile**.
   - **Expected:** a summary card appears showing sales total, purchase total, tank closing stock, and cash position.
5. Click **Approve**.
   - **Expected:** the closing is locked.
6. Click **Print** to preview the Daily Closing Report.

---

## Step 7 — Reports (Plant Manager, ~30 sec)

> Management reviews the day's activity.

1. Click **⚙** → switch to **Plant Manager**.
2. Click **Dashboard** (Alt+1) — verify today's KPI tiles updated (sales, purchases, tank level).
3. Click **Reports** (Alt+8).
4. Select **Sales Register** → click **Run**.
   - **Expected:** a table shows the invoice posted in Step 2 with customer, cylinder size, qty, rate, and amount.
5. Select **Daily Closing** → click **Run**.
   - **Expected:** closing summary for today.

---

## Quick Sanity Checklist

| # | What to verify | Where |
|---|---|---|
| 1 | Gate Pass appears in Sales dropdown | Sales → Gate Pass field |
| 2 | Outstanding balance updated after invoice | Sales → pick Distributor 01 again |
| 3 | Tank stock reduced after filling batch | Plant → Status tab |
| 4 | GRN appears in Purchase Register | Reports → purchaseRegister |
| 5 | Closing locks the day (can't re-compile) | Closing → try Compile again |

---

## Role Permissions Summary

| Role | Can do |
|---|---|
| Data Entry Operator | Gate Pass, Sales, Purchase, Inventory |
| Plant Supervisor | Above + Tank Log, Filling Batch, post sales/purchase |
| Accounts Officer | Above + Daily Closing compile & approve |
| Plant Manager | Everything including Masters and rate changes |
