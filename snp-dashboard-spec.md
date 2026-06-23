# Spec: Unified SnP Offer-Content Dashboard

| | |
|---|---|
| **Status** | Draft for implementation |
| **Spec ID** | SNP-DASH-001 |
| **Version** | 1.0 |
| **Primary audience** | Content authors |
| **Last updated** | 2026-06-23 |
| **Implements** | Pattern A (application-side two-phase join), no enrich pipeline |

---

## 1. Intent

Provide content authors a single dashboard that lists `snpoffercontent` records (the records they create and edit) enriched with attributes from the parent `offer` index, with search, cross-index filtering, and counts that are unambiguous and correct.

The unit of the dashboard is **one `snpoffercontent` record per row** ("content-centric"). All counts, pagination, and selection are defined in terms of this unit unless explicitly stated otherwise.

---

## 2. Background & problem statement

`offer` (parent) and `snpoffercontent` (child) live in separate Elasticsearch indices. They are joined on a **SKU / part number**, not an offer id:

```
snpoffercontent.Key  ==  offer.DynamicProperties.CMXContext.PrimaryPartId
```

The relationship is many-to-many on the SKU:

- One SKU → **many offers** (each region / market / segment / edition is a separate `offer` document).
- One SKU → **many content records** (one `snpoffercontent` per locale, carried in `Container`).

The legacy dashboard rendered the cartesian product of both fan-outs (content × offer), producing duplicate rows and a total count that measured join rows rather than entities. This spec eliminates that by fixing the row unit to the content record and by defining three distinct, separately-labelled counts.

Elasticsearch performs **no cross-index join**; this spec defines an application-side two-phase join.

---

## 3. Goals / Non-goals

### Goals
- G1. List `snpoffercontent` records, one per row, enriched with parent offer attributes.
- G2. Search by content key **or** offer number.
- G3. Filter by content-side facet (Profile) and offer-side facets (CMX Category, Offer Type, Config Type).
- G4. Present three correct, separately-labelled counts (content records, offers with content, offers missing content).
- G5. Optionally surface offers that have no content yet, as actionable "create" rows.
- G6. Provide a data-access layer that emits real Elasticsearch DSL behind a swappable transport, so the same code runs against a mock and against production.

### Non-goals
- N1. No enrich/denormalized "dashboard" index in this iteration (explicitly deferred — see §13).
- N2. No editing/authoring flow is specified here (the dashboard links out to it).
- N3. No `offer`-centric view; the offer is a secondary, derived attribute.
- N4. No removal of the `terms` SKU ceiling (accepted as a constraint — see §6, C3).

---

## 4. Domain model & glossary

| Term | Definition |
|---|---|
| **SKU** | Part number; the join key. `content.Key` and `offer…PrimaryPartId`. |
| **Content record** | One `snpoffercontent` document = one (SKU, locale) pair. The row unit. |
| **Offer** | One `offer` document = one commercial offer for a SKU. Identified by `offerId`. |
| **Profile** | The content locale, from `Container` (e.g. `en/us`). |
| **Offers with content** | Offers whose SKU has ≥ 1 matching content record under the active filters. |
| **Offers missing content** | Offers that match the offer-side filters but whose SKU has no matching content. |
| **Phase 1** | Query against the `offer` index to resolve matching SKUs + per-SKU metadata. |
| **Phase 2** | Query against the `snpoffercontent` index, inner-joined on the Phase-1 SKU set. |

Cardinality summary:
```
offer  N───────1  SKU  1───────N  snpoffercontent
       (offerId)      (Key / PrimaryPartId)     (Container = locale)
```

---

## 5. Field mappings (authoritative)

### 5.1 `snpoffercontent` — index `cmxstdsnpoffercontent_draft_v0`

| UI / model field | ES path | Notes |
|---|---|---|
| `key` | `Key.keyword` | join key (SKU) |
| `profile` | `Container.keyword` | array; first element is the locale |
| `shortDesc` | `DynamicProperties.ShortDesc` | |
| `longDesc` | `DynamicProperties.LongDesc` | |
| `publishStatus` | `PublishStatus` | **derived** for display — see DR-4 |

### 5.2 `offer` — index `cmxstdoffer_draft_v0`

| UI / model field | ES path | Notes |
|---|---|---|
| `offerNumber` | `DynamicProperties.offerId.keyword` | **lowercase `offerId`** — see DR-1 |
| `primaryPartId` (SKU) | `DynamicProperties.CMXContext.PrimaryPartId.keyword` | join key |
| `cmxCategory` | `DynamicProperties.CMXContext.CMXCategoryLookup.Id.keyword` (filter) / `…Name.keyword` (display) | |
| `offerType` | `DynamicProperties.CMXContext.ProductType.keyword` | values: `SnP`, `Solution`, `Subscription`, `Service` |
| `configType` | `DynamicProperties.CMXContext.scope.keyword` | values: `ConfigurableOffer`, `StandaloneOffer` — see DR-2 |

### 5.3 Data-reality decisions (DR) — MUST be honored

- **DR-1.** `offerId` is lowercase in the document. Implementations MUST use `DynamicProperties.offerId.keyword`; `OfferId` will silently match nothing.
- **DR-2.** The "Config Type" facet maps to **`scope`** (`ConfigurableOffer` / `StandaloneOffer`), matching the existing left-rail labels — **not** the `ConfigType` field (`ConfigurableSNP`). `ProductType`, `scope`, and `ConfigType` are three distinct attributes and MUST NOT be conflated.
- **DR-3.** Locale format differs between sides: content stores `en/ie` (slash); facet UIs elsewhere use `en-us` (dash). The system MUST normalize to one canonical form so stored value == facet value. This spec uses the stored slash form as canonical.
- **DR-4.** `publishStatus` is derived for display: `(PublishStatus && PublishStatus !== 'None') ? PublishStatus : 'Draft'`. It is sourced from `snpoffercontent`, never from the offer's own publish status.
- **DR-5.** `CMXContext` is an array. If mapped as ES `nested`, all offer-side `term`/`terms`/aggregations MUST be wrapped in `nested` queries on path `DynamicProperties.CMXContext`; if mapped as `object`, dot paths apply directly. The mapping MUST be confirmed via `GET {offer-index}/_mapping` before implementation; the query spec in §10 assumes `object`.

---

## 6. Constraints & key decisions

- **C1 (row unit).** A row is exactly one `snpoffercontent` record. Offer fan-out is collapsed into a single Offers cell.
- **C2 (Pattern A).** Joining is application-side, two-phase: offer index drives SKU resolution; content index is the paged result set.
- **C3 (terms ceiling, accepted).** Phase 2 receives SKUs via a `terms` clause sourced from a Phase-1 `terms` agg sized at 10,000. SKU sets larger than that are out of scope for this iteration.
- **C4 (no enrich).** No denormalized index, no ingest enrichment.
- **C5 (security).** The browser MUST NOT call Elasticsearch directly. All `_search` calls route through a backend proxy that injects auth and forwards the request body.

---

## 7. Functional requirements

Requirements use "shall". Each is testable; acceptance scenarios are in §12.

### 7.1 Search

- **FR-S1.** The search control shall accept a free-text token and a "Search by" mode of `auto` | `key` | `offer`.
- **FR-S2.** When mode is `offer` or `auto`, the system shall resolve the token against `offer.offerId` and collect the matching SKU(s) (`PrimaryPartId`).
- **FR-S3.** When mode is `key` or `auto`, the system shall treat the token itself as a candidate SKU.
- **FR-S4.** The resolved SKU set shall constrain Phase 1 (additional `terms` filter on `PrimaryPartId`).
- **FR-S5.** Search shall combine with active facet filters (logical AND).
- **FR-S6.** An empty token shall be treated as "no search" (search does not constrain results).

### 7.2 Filtering

- **FR-F1.** The system shall provide facets: Profile (content-side), CMX Category, Offer Type, Config Type (offer-side).
- **FR-F2.** Multiple selections within one facet shall combine with OR; different facets shall combine with AND.
- **FR-F3.** Offer-side facets (Category, Offer Type, Config Type) shall constrain Phase 1.
- **FR-F4.** The Profile facet shall constrain Phase 2.
- **FR-F5.** The UI shall render an active-filter chip per selected value and per active search token; removing a chip shall clear that single constraint.
- **FR-F6.** A "Clear all filters" action shall reset all facets and the search token.
- **FR-F7.** Each facet group shall show a badge with its count of selected values when > 0.

### 7.3 Listing & display

- **FR-L1.** Each content row shall display: key, profile, short description, long description, Offers cell, CMX category, offer type, config type, publish status.
- **FR-L2.** The Offers cell shall display the first offer number and, when the SKU has more than one offer, a `+N` affordance that reveals the full list.
- **FR-L3.** Description columns shall truncate with ellipsis and expose the full text on hover/title.
- **FR-L4.** Publish status shall be rendered per DR-4.

### 7.4 Counts

- **FR-C1.** The system shall display three separately-labelled counts: **Content records**, **Offers with content**, **Offers missing content**, computed per §11.
- **FR-C2.** "Content records" shall be exact (`track_total_hits: true`).
- **FR-C3.** Counts shall reflect the currently active search + filters.

### 7.5 Missing content

- **FR-M1.** The system shall provide an "Include offers without content" toggle, default **off**.
- **FR-M2.** When off, only content records appear; contentless offers are excluded from the listing (but still counted in "Offers missing content").
- **FR-M3.** When on, the listing shall append one placeholder row **per contentless offer** (so the listing's missing-row count equals "Offers missing content").
- **FR-M4.** A placeholder row shall be visually distinct, identify the SKU and the single offer number, and present a "Create" action.

### 7.6 Pagination

- **FR-P1.** The listing shall be paginated with a configurable page size (default 25).
- **FR-P2.** Within a page, content rows shall precede placeholder rows.
- **FR-P3.** `totalRows` shall equal `contentRecords + (includeMissing ? offersMissing : 0)`.
- **FR-P4.** Page navigation shall expose current page, total pages, and prev/next with correct disabled states at boundaries.

---

## 8. Interface contract — Data-access layer

The UI depends only on this contract. Implementations MAY back it with the mock or live transport.

### 8.1 `DataAccess.fetchView(state) → Promise<ViewModel>`

**`state` (request):**
```ts
interface DashboardState {
  filters: {
    offerType: Set<string>;   // ProductType values
    scope:     Set<string>;   // scope values (the "Config Type" facet)
    profile:   Set<string>;   // Container values (canonical slash form)
    category:  Set<string>;   // CMXCategoryLookup.Id values
  };
  search: { text: string; by: 'auto' | 'key' | 'offer' };
  includeMissing: boolean;
  page: number;        // 1-based
  pageSize: number;
}
```

**`ViewModel` (response):**
```ts
interface ViewModel {
  rows: Row[];                 // already paged: content rows then (optional) missing rows
  counts: {
    contentRecords: number;    // exact
    offersWithContent: number;
    offersMissing: number;
  };
  totalRows: number;           // contentRecords + missing rows when includeMissing
  offset: number;              // (page-1)*pageSize
  page: number;
  pageSize: number;
}

type Row = ContentRow | MissingRow;

interface ContentRow {
  kind: 'content';
  key: string;            // SKU
  profile: string;        // locale
  short: string; long: string;
  status: string;         // derived publish status
  offers: string[];       // all offer numbers sharing this SKU (capped, see C3 / EC-2)
  catName: string; offerType: string; scope: string;
}

interface MissingRow {
  kind: 'missing';
  key: string;            // SKU
  offerId: string;        // the single contentless offer
  catName: string; offerType: string; scope: string;
}
```

### 8.2 `DataAccess.facets() → Promise<Facets>`
```ts
interface Facets {
  offerTypes: string[];
  scopes: string[];
  profiles: string[];
  cats: [id: string, name: string][];
}
```
Live implementations MAY source these from a config route or from `terms` aggregations on each facet field.

### 8.3 Transport
```ts
// config-driven; 'mock' = in-memory fake ES, 'live' = POST to backend proxy
DataAccess.config = { mode: 'mock' | 'live', endpoint: string };
// live request: POST `${endpoint}/${index}/_search` with the ES body as JSON
```
The query builders and response parsers are identical across modes. Going live = set `config.mode='live'`, set `config.endpoint`, and remove the mock backend.

---

## 9. Data-access algorithm (`fetchView`)

```
offset = (page - 1) * pageSize

1. searchSkus = resolveSearch(search)              // null when no token
2. p1 = parsePhase1( esSearch(OFFER_INDEX, buildPhase1(filters, searchSkus)) )
   skuSet = set(p1.skus[].sku)
3. if skuSet is empty:
      contentTotal = 0; skusWithContent = ∅; contentRows = []
   else:
      p2 = parsePhase2( esSearch(CONTENT_INDEX, buildPhase2(skuSet, filters, offset, pageSize)) )
      contentTotal     = p2.total
      skusWithContent  = p2.skusWithContent
      contentRows      = p2.hits enriched with p1 attrs (catName, offerType, scope, offers)
4. offersWithContent = Σ p1.skus[ sku ∈ skusWithContent ].offerCount
   offersMissing     = p1.totalOffers - offersWithContent
5. if includeMissing:
      missingAll = for each p1.sku with sku ∉ skusWithContent,
                     emit one MissingRow per offerId in that sku.offers
   else missingAll = []
6. take = pageSize - contentRows.length
   missingPage = take > 0
       ? missingAll.slice( max(0, offset - contentTotal), … + take )
       : []
7. return {
     rows: [...contentRows, ...missingPage],
     counts: { contentRecords: contentTotal, offersWithContent, offersMissing },
     totalRows: contentTotal + missingAll.length,
     offset, page, pageSize
   }
```

---

## 10. Elasticsearch query specifications

### 10.1 Resolve offer → SKU (only when `by ∈ {offer, auto}` and token present)
```jsonc
POST {OFFER_INDEX}/_search
{
  "size": 0,
  "query": { "bool": { "filter": [ { "term": { "DynamicProperties.offerId.keyword": "<token>" } } ] } },
  "aggs": { "skus": { "terms": { "field": "DynamicProperties.CMXContext.PrimaryPartId.keyword", "size": 50 } } }
}
```

### 10.2 Phase 1 — offer index
```jsonc
POST {OFFER_INDEX}/_search
{
  "size": 0,
  "query": { "bool": { "filter": [
    // include only those that are active:
    { "terms": { "DynamicProperties.CMXContext.CMXCategoryLookup.Id.keyword": ["<categoryId>", …] } },
    { "terms": { "DynamicProperties.CMXContext.ProductType.keyword":          ["<offerType>", …] } },
    { "terms": { "DynamicProperties.CMXContext.scope.keyword":                ["<scope>", …] } },
    { "terms": { "DynamicProperties.CMXContext.PrimaryPartId.keyword":        ["<sku from search>", …] } }
  ] } },
  "aggs": {
    "total_offers": { "cardinality": { "field": "DynamicProperties.offerId.keyword", "precision_threshold": 40000 } },
    "skus": {
      "terms": { "field": "DynamicProperties.CMXContext.PrimaryPartId.keyword", "size": 10000 },
      "aggs": {
        "attrs":  { "top_hits": { "size": 1, "_source": { "includes": [
                      "DynamicProperties.CMXContext.CMXCategoryLookup.Name",
                      "DynamicProperties.CMXContext.ProductType",
                      "DynamicProperties.CMXContext.scope" ] } } },
        "offers": { "terms": { "field": "DynamicProperties.offerId.keyword", "size": 100 } }
      }
    }
  }
}
```
Parse → `skus[] = { sku, offerCount: bucket.doc_count, offers: offers.buckets[].key, catName/offerType/scope from attrs }`, `totalOffers = total_offers.value`.

### 10.3 Phase 2 — content index
```jsonc
POST {CONTENT_INDEX}/_search
{
  "track_total_hits": true,
  "from": <offset>, "size": <pageSize>,
  "query": { "bool": { "filter": [
    { "terms": { "Key.keyword": ["<sku>", …] } },           // from Phase 1
    { "terms": { "Container.keyword": ["<profile>", …] } }   // only when Profile facet active
  ] } },
  "sort": [ { "Key.keyword": "asc" }, { "_id": "asc" } ],
  "aggs": {
    "skus_with_content": { "terms": { "field": "Key.keyword",       "size": 10000 } },
    "by_profile":        { "terms": { "field": "Container.keyword", "size": 100 } }
  }
}
```
Parse → `hits[]` from `hits.hits[]._source`, `total = hits.total.value`, `skusWithContent = set(skus_with_content.buckets[].key)`.

### 10.4 `nested` variant (only if DR-5 confirms `nested`)
Wrap each offer-side clause and aggregation in `{ "nested": { "path": "DynamicProperties.CMXContext", "query": … } }` / a `nested` aggregation on the same path.

---

## 11. Count specification

Let `S_match` = SKUs returned by Phase 1; `S_content` = `skusWithContent` from Phase 2; `offerCount(sku)` = Phase-1 `doc_count` for that SKU.

| Count | Formula | Exactness |
|---|---|---|
| Content records | `hits.total.value` (Phase 2, `track_total_hits:true`) | Exact |
| Offers with content | `Σ over sku ∈ (S_match ∩ S_content) of offerCount(sku)` | Exact at the accepted scale |
| Offers missing content | `total_offers.value − OffersWithContent` | Exact when `cardinality` is exact; see §12 EC-5 |

Invariant **INV-1**: when `includeMissing` is true, the number of `MissingRow`s across all pages MUST equal "Offers missing content" (each missing offer is one row).

Invariant **INV-2**: `Content records` counts content documents; `Offers with content` / `Offers missing content` count offer documents. The three are different units and MUST be labelled distinctly in the UI.

---

## 12. Acceptance criteria & test fixtures

### 12.1 Canonical fixture
The mock dataset below is the canonical fixture; backend integration tests SHOULD reproduce its expected outputs.

SKUs → (category, offerType, scope):
```
7C3010 (monitor, SnP, ConfigurableOffer)   4TY139 (monitor, SnP, ConfigurableOffer)
F4MC8T (monitor, SnP, ConfigurableOffer)   8RD220 (dock, Solution, StandaloneOffer)
5KB910 (keyboard, Service, StandaloneOffer) 3WS400 (warranty, Subscription, StandaloneOffer)
9XK221 (monitor, SnP, StandaloneOffer)      ← offers exist, NO content
```
Offers per SKU: 7C3010×3, 4TY139×1, F4MC8T×11, 8RD220×2, 5KB910×1, 3WS400×3, 9XK221×2  (23 offers).
Content per SKU (locales): 7C3010×5, 4TY139×3, F4MC8T×3, 8RD220×2, 5KB910×1, 3WS400×4, 9XK221×0  (18 records).

### 12.2 Expected outputs (verified)

| Scenario | content | offersWith | missing | totalRows (incl. missing) |
|---|---|---|---|---|
| AC-1 No filters | 18 | 21 | 2 | 20 |
| AC-2 Category = Monitor | 11 | 15 | 2 | 13 |
| AC-3 Monitor + Profile = en/us | 1 | 3 | 14 | 15 |
| AC-4 Search offer `842306801` | 5 | 3 | 0 | 5 |
| AC-5 Search key `F4MC8T` | 3 | 11 | 0 | 3 |
| AC-6 Standalone (scope) | 7 | 6 | 2 | 9 |

### 12.3 Behavioral acceptance (Given/When/Then)

- **AC-7 (fan-out collapse).** Given a SKU with 11 offers and 1 matching content record, when listed, then exactly **one** content row appears and its Offers cell shows the first offer plus `+10`.
- **AC-8 (missing reconciliation, INV-1).** Given AC-3 with the toggle on, when paged through, then exactly **14** placeholder rows appear in total and the "Offers missing content" card reads **14**.
- **AC-9 (pagination order, FR-P2).** Given AC-1 with toggle on and pageSize 10, when viewing page 1 then page 2, then page 1 is 10 content rows and page 2 is 8 content rows followed by 2 placeholder rows.
- **AC-10 (default excludes missing).** Given the toggle off, when any filter yields contentless offers, then no placeholder rows appear but "Offers missing content" still reflects them.
- **AC-11 (empty state).** Given filters that match zero content records, when rendered, then an empty state explains the situation and, if `offersMissing > 0`, prompts enabling the toggle.
- **AC-12 (chip clear).** Given two active facet values, when one chip is removed, then only that constraint clears and results re-query.
- **AC-13 (security, C5).** Given `config.mode='live'`, when a search runs, then requests target the backend proxy endpoint and never an Elasticsearch URL directly.

---

## 13. Out of scope / future work

- **FUT-1.** Denormalized "dashboard" index via enrich processor (single-query counts, native facet counts, removal of the terms ceiling).
- **FUT-2.** Per-page offer hydration: replace the Phase-1 `offers` sub-agg (capped at 100) with a `terms` query on only the current page's SKUs, lifting EC-2.
- **FUT-3.** Locale normalization layer (`profile_norm`) per DR-3 if other surfaces require the dash form.
- **FUT-4.** Sidebar facet **value counts** (content-record counts per facet value).

---

## 14. Edge cases & error handling

- **EC-1 (orphan content).** A content record whose SKU has no offer will not appear (Pattern A is offer-anchored). Flag for data QA; full handling is FUT.
- **EC-2 (offer cap).** The Phase-1 `offers` sub-agg caps at 100 per SKU; a SKU with > 100 offers truncates the Offers cell and the per-offer missing rows for that SKU. Accepted under C3; lifted by FUT-2.
- **EC-3 (deep paging).** Beyond `index.max_result_window` (default 10,000), Phase 2 MUST use `search_after` on the `[Key.keyword, _id]` sort rather than `from`. `_id` MUST be the real content document id.
- **EC-4 (terms ceiling).** If a Phase-1 SKU set would exceed 10,000, the system is out of spec (C3); surface a "narrow your filters" message rather than a partial result.
- **EC-5 (approximate counts at scale).** If `cardinality` becomes approximate (very large offer sets), "Content records" remains exact; "Offers with content / missing" MAY be approximate and MUST then be rendered with a `~` prefix and a tooltip indicating approximation.
- **EC-6 (transport failure).** A failed `_search` MUST surface a non-blocking error state and leave prior results intact; it MUST NOT render zero counts as if authoritative.
- **EC-7 (stale async).** Rapid filter changes MUST not let an earlier in-flight `fetchView` overwrite a later one (guard with a request token/sequence).

---

## 15. Open questions

- OQ-1. Confirm `CMXContext` mapping (`object` vs `nested`) per DR-5.
- OQ-2. Confirm the exact derivation rule for `publishStatus` (version-based vs field-based) per DR-4.
- OQ-3. Confirm canonical locale form (slash vs dash) per DR-3 across all consuming surfaces.
- OQ-4. Confirm whether orphan content (EC-1) must be visible in this iteration.
