# Assembler API — Specification v0.1

**Status:** DRAFT — For Review  
**Date:** May 2026  
**Version:** 0.1

---

## Table of Contents

1. [Purpose and Scope](#1-purpose-and-scope)
2. [Architecture Overview](#2-architecture-overview)
3. [Core Concepts](#3-core-concepts)
4. [GraphQL Schema](#4-graphql-schema)
5. [Adapter Layer](#5-adapter-layer)
6. [Level Profiles and Resolver Logic](#6-level-profiles-and-resolver-logic)
7. [Sample Requests and Responses](#7-sample-requests-and-responses)
8. [Error Handling](#8-error-handling)
9. [Extension Points](#9-extension-points)
10. [Open Questions](#10-open-questions)
11. [Glossary](#11-glossary)

---

## 1. Purpose and Scope

This document specifies the Assembler API — a GraphQL-based aggregation and normalization layer that sits between domain-specific Core APIs and the UI rendering layer. It covers the conceptual model, data elements, GraphQL schema, adapter contract, resolver logic, and request/response behaviour.

The Assembler is intentionally UI-agnostic. It exposes a stable, normalized component vocabulary that any UI framework can consume without knowledge of the underlying Core APIs.

### 1.1 Goals

- Provide a single GraphQL endpoint for all page-level data needs.
- Normalize wildly different Core API response shapes into a common component vocabulary.
- Support any level of the product taxonomy (Category, ProductLine, Platform, Offer, Parts) from the same endpoint.
- Separate static content (resolved at page load) from dynamic content (resolved on user interaction).
- Hide all Core API identities and contracts from the UI layer.
- Enable new Core APIs to be added without changing the GraphQL schema or resolver orchestration logic.

### 1.2 Out of Scope

- Authentication and authorization — handled upstream.
- UI component rendering logic — owned by the UI layer.
- Author-time UI Orchestration Tool — a separate system that consumes this spec.
- Type-safety of the `metadata` JSON blob — deferred to a future revision.

---

## 2. Architecture Overview

The Assembler sits in a three-layer stack:

| Layer | Role | Knows About |
|---|---|---|
| UI Layer | Renders components. Fires GraphQL queries. Manages user interaction state. | Assembler schema only |
| Assembler Layer | Aggregates Core APIs. Normalizes responses. Exposes unified GraphQL endpoint. | Core API contracts |
| Core API Layer | Business logic. Data access. Domain-specific response shapes. | Own data sources only |

Two interaction modes are supported:

| Mode | Trigger | Assembler Behaviour |
|---|---|---|
| Initial page load | UI requests a page by TaxonomyContext | Fans out to static adapters in parallel; returns fully resolved static components plus dynamic component shells. |
| Dynamic resolution | User interacts — filter, sort, paginate | UI fires `componentData()` with `queryKey` + `variables`; Assembler calls the appropriate adapter and returns resolved items. |

> **Note:** The UI layer is completely unaware of which Core APIs exist. It only ever calls two GraphQL queries: `page()` and `componentData()`.

---

## 3. Core Concepts

### 3.1 TaxonomyContext

Every Assembler request is anchored by a `TaxonomyContext` — an input object that identifies where in the product hierarchy the page lives. This drives which adapters are activated and which data is fetched.

| Field | Description |
|---|---|
| `country` | ISO 3166-1 alpha-2 country code. e.g. `"us"`, `"gb"`, `"de"`. |
| `language` | ISO 639-1 language code. e.g. `"en"`, `"de"`, `"fr"`. |
| `level` | `TaxonomyLevel` enum. One of: `CATEGORY` \| `PRODUCT_LINE` \| `PLATFORM` \| `OFFER` \| `PARTS`. |
| `categoryId` | Identifier of the current node at the given level. e.g. `"laptops"`, `"xps"`, `"intel-evo"`. |
| `ancestorIds` | Ordered list of node identifiers from root down to (but not including) the current node. e.g. `["laptops", "xps"]` for a PLATFORM request. Empty array at CATEGORY level. |

> **Note:** `ancestorIds` threads the full taxonomy path into every adapter call, enabling Core APIs to scope their responses without the Assembler needing to understand that scoping logic.

### 3.2 TaxonomyLevel

The `TaxonomyLevel` enum defines the five supported levels of the product hierarchy:

| Level | Example `categoryId` | Typical Page Type |
|---|---|---|
| `CATEGORY` | `laptops` | Top-level product category listing |
| `PRODUCT_LINE` | `xps` | Brand or line-level listing within a category |
| `PLATFORM` | `intel-evo` | Platform or technology filter within a product line |
| `OFFER` | `xps-16-9500` | Specific product offer or configuration page |
| `PARTS` | `xps-16-parts` | Parts and accessories listing for an offer |

### 3.3 Component Vocabulary

All data returned by the Assembler uses a normalized, UI-agnostic component vocabulary. Every component — regardless of origin — implements the `Component` interface:

| Field | Description |
|---|---|
| `id` | Unique identifier for this component within the page. e.g. `"hero-banner"`, `"facet-panel"`. |
| `componentType` | String token that tells the UI which component to render. e.g. `"Banner"`, `"FacetPanel"`, `"ProductStack"`, `"Breadcrumb"`. |
| `title` | Primary display label. Nullable. |
| `description` | Supporting text or subtitle. Nullable. |
| `image` | An `ImageAsset` object containing `url`, `altText`, `width`, `height`. Nullable. |
| `link` | A `LinkTarget` object containing `href`, `label`, `target`. Nullable. |
| `items` | Array of `ListItem` objects. Used for collections — tabs, refiners, products, breadcrumb nodes. `null` on `DynamicComponent` shells before resolution. |

### 3.4 ListItem

The atomic unit within any component's `items` array. Carries the same normalized vocabulary as `Component`, plus a `badge` field and a `metadata` escape hatch:

| Field | Description |
|---|---|
| `id` | Unique identifier within the parent component's `items` array. |
| `title` | Display label for this item. |
| `description` | Supporting text. For a product: formatted key specs string. e.g. `"Intel Core Ultra 7 · 16 GB · 512 GB SSD"`. |
| `image` | `ImageAsset`. For a product: the primary product image. |
| `link` | `LinkTarget`. `href` to the detail page or refinement URL. |
| `badge` | Optional short badge string. e.g. `"Hot Deal"`, `"New"`. Nullable. |
| `metadata` | Opaque JSON blob for component-type-specific fields that do not fit the common vocabulary. For products: pricing, rating, reviewCount. For refiners: displayType, refinements array with value/label/count. |

> **Note:** The `metadata` field is intentionally untyped (`JSON` scalar) in v0.1. The UI and adapter share an informal contract per `componentType`. Typed metadata is deferred to a future revision.

### 3.5 StaticComponent vs DynamicComponent

The `Component` interface is implemented by two concrete types that differ in resolution timing:

| Aspect | StaticComponent | DynamicComponent |
|---|---|---|
| Resolution | Fully resolved on initial page load | Shell returned on load; items resolved by second query |
| `items` field | Populated array | `null` on initial load |
| Extra fields | None beyond `Component` interface | `queryKey`, `queryVariables`, `sortOptions`, `pagination` |
| Core API call | Always made at page load | Not made until client fires `componentData()` |
| Examples | Breadcrumb, Banner, FacetPanel | ProductStack, RecommendationStrip, PartsListing |

> **Note:** A `DynamicComponent` shell carries enough for the UI to render a loading skeleton immediately, then fire the second query to hydrate `items`. The `queryVariables` field provides a ready-made starting point.

---

## 4. GraphQL Schema

### 4.1 Scalars and Enums

```graphql
scalar JSON

enum TaxonomyLevel {
  CATEGORY
  PRODUCT_LINE
  PLATFORM
  OFFER
  PARTS
}
```

### 4.2 Input Types

```graphql
input TaxonomyContext {
  country:     String!
  language:    String!
  level:       TaxonomyLevel!
  categoryId:  String!
  ancestorIds: [String!]
}
```

### 4.3 Leaf Types

```graphql
type ImageAsset {
  url:     String!
  altText: String
  width:   Int
  height:  Int
}

type LinkTarget {
  href:   String!
  label:  String
  target: String   # "_blank" | "_self"
}

type SortOption {
  value: String!
  label: String!
}

type PaginationHint {
  totalCount:  Int!
  pageSize:    Int!
  currentPage: Int!
}

type ListItem {
  id:          String!
  title:       String
  description: String
  image:       ImageAsset
  link:        LinkTarget
  badge:       String
  metadata:    JSON
}
```

### 4.4 Component Interface and Concrete Types

```graphql
interface Component {
  id:            String!
  componentType: String!
  title:         String
  description:   String
  image:         ImageAsset
  link:          LinkTarget
  items:         [ListItem]
}

# Fully resolved on initial page load
type StaticComponent implements Component {
  id:            String!
  componentType: String!
  title:         String
  description:   String
  image:         ImageAsset
  link:          LinkTarget
  items:         [ListItem]
  metadata:      JSON
}

# Shell on initial load; client fires componentData() to hydrate items
type DynamicComponent implements Component {
  id:             String!
  componentType:  String!
  title:          String
  description:    String
  image:          ImageAsset
  link:           LinkTarget
  items:          [ListItem]     # null on first load
  queryKey:       String!        # key into server-side adapter registry
  queryVariables: JSON!          # seed variables for client
  sortOptions:    [SortOption]
  pagination:     PaginationHint
}
```

### 4.5 Page Type and Root Queries

```graphql
type AssemblerPage {
  pageId:     String!
  level:      TaxonomyLevel!
  components: [Component]!
}

type Query {

  # Initial page load.
  # Returns static components fully resolved +
  # dynamic component shells (items: null).
  page(
    context: TaxonomyContext!
  ): AssemblerPage

  # Second query, fired by client on user interaction.
  # Returns a resolved DynamicComponent with items populated.
  componentData(
    context:   TaxonomyContext!
    queryKey:  String!
    variables: JSON!
  ): DynamicComponent

}
```

---

## 5. Adapter Layer

### 5.1 Purpose

Each Core API is wrapped by a dedicated Adapter class. Adapters are the only place in the Assembler that know about a Core API's request format, response shape, and field names. All transformation from Core API vocabulary to normalized `Component` vocabulary happens inside the adapter's `transform()` method.

This insulates the GraphQL resolver layer from Core API changes. If a Core API changes its response shape, only the corresponding adapter changes.

### 5.2 BaseAdapter Contract

Every adapter extends `BaseAdapter` and must implement two abstract methods:

```typescript
abstract class BaseAdapter<TRequest, TRawResponse> {

  // Calls the Core API and returns the raw response.
  abstract fetch(req: TRequest): Promise<TRawResponse>

  // Transforms raw response into ComponentPayload(s).
  // Most adapters return a single ComponentPayload.
  // Adapters that produce multiple components
  // (e.g. CategoryContentAdapter yields Breadcrumb + Banner)
  // return ComponentPayload[].
  abstract transform(
    raw: TRawResponse,
    req: TRequest
  ): ComponentPayload | ComponentPayload[]

  // Convenience: fetch then transform in one call.
  async resolve(req: TRequest): Promise<ComponentPayload | ComponentPayload[]> {
    const raw = await this.fetch(req)
    return this.transform(raw, req)
  }

}
```

### 5.3 ComponentPayload Type

The internal type that adapters produce, mapping directly to the GraphQL `Component` interface:

```typescript
interface ComponentPayload {
  id:            string
  componentType: string
  title?:        string
  description?:  string
  image?:        ImageAsset
  link?:         LinkTarget
  items?:        ListItem[]
  metadata?:     Record<string, unknown>
  // DynamicComponent-only fields:
  queryKey?:       string
  queryVariables?: Record<string, unknown>
  sortOptions?:    SortOption[]
  pagination?:     PaginationHint
}
```

### 5.4 Adapter Registry

Adapters are registered in a central map keyed by `queryKey` string. The resolver uses this map for both static fan-out at page load and dynamic resolution on `componentData()` queries.

| `queryKey` | Adapter Class | Core API Endpoint |
|---|---|---|
| `CategoryContent` | `CategoryContentAdapter` | `GET /api/v1/category/content` |
| `ProductLineContent` | `ProductLineContentAdapter` | `GET /api/v1/productline/content` |
| `PlatformContent` | `PlatformContentAdapter` | `GET /api/v1/platform/content` |
| `OfferContent` | `OfferContentAdapter` | `GET /api/v1/offer/content` |
| `PartsContent` | `PartsContentAdapter` | `GET /api/v1/parts/content` |
| `AnavRefiners` | `AnavAdapter` | `GET /api/v1/navigation/refiners` |
| `ProductListing` | `ProductContentAdapter` | `POST /api/v1/products/listing` |
| `OfferVariants` | `OfferVariantsAdapter` | `GET /api/v1/offer/variants` |
| `PartsListing` | `PartsListingAdapter` | `GET /api/v1/parts/listing` |

> **Note:** Adding a new Core API requires only: (1) writing a new adapter class and (2) adding one entry to this registry. No changes to the schema, resolver, or `LevelProfile` are required.

### 5.5 Transformation Rules

Each adapter follows these rules when mapping Core API fields to the `Component`/`ListItem` vocabulary:

| Core API Concept | Maps To | Notes |
|---|---|---|
| Page heading or name | `Component.title` | |
| Subheading or description | `Component.description` | |
| Primary image | `Component.image` | Use largest available resolution URL |
| Primary CTA or URL | `Component.link` | |
| Child entities (tabs, refiners, products) | `Component.items[]` | Each child becomes one `ListItem` |
| Item name or label | `ListItem.title` | |
| Item key specs or summary | `ListItem.description` | Adapter formats as readable string |
| Item image | `ListItem.image` | |
| Item URL | `ListItem.link` | |
| Item badge or tag | `ListItem.badge` | First badge only; extras go in `metadata` |
| Pricing, rating, refiner counts, etc. | `ListItem.metadata` | JSON blob; untyped in v0.1 |

---

## 6. Level Profiles and Resolver Logic

### 6.1 LevelProfile

Each `TaxonomyLevel` maps to a `LevelProfile` — a configuration record declaring which adapters run statically at page load and which `queryKey` drives the dynamic listing component.

| Level | Static Adapters | Dynamic `queryKey` |
|---|---|---|
| `CATEGORY` | `CategoryContentAdapter`, `AnavAdapter` | `ProductListing` |
| `PRODUCT_LINE` | `ProductLineContentAdapter`, `AnavAdapter` | `ProductListing` |
| `PLATFORM` | `PlatformContentAdapter`, `AnavAdapter` | `ProductListing` |
| `OFFER` | `OfferContentAdapter` | `OfferVariants` |
| `PARTS` | `PartsContentAdapter` | `PartsListing` |

> **Note:** `AnavAdapter` is shared across `CATEGORY`, `PRODUCT_LINE`, and `PLATFORM`. The ANAV Core API uses `ancestorIds` to narrow returned refiners automatically — that narrowing logic lives in the Core API, not in the adapter.

### 6.2 page() Resolver — Algorithm

The `page()` resolver follows this sequence on every initial page load request:

1. Extract `TaxonomyContext` from the query input (`country`, `language`, `level`, `categoryId`, `ancestorIds`).
2. Look up the `LevelProfile` for the given `level`. Throw `UNKNOWN_LEVEL` error if no profile is registered.
3. Fan out to all static adapters in the profile concurrently via `Promise.all`, passing the full `TaxonomyContext` to each.
4. Flatten results — adapters returning arrays (e.g. `CategoryContentAdapter` yields Breadcrumb + Banner) are spread into the components list.
5. Construct the `DynamicComponent` shell locally with no Core API call. Populate `queryKey` from the profile's `dynamicQueryKey`; seed `queryVariables` with the full `TaxonomyContext` plus an empty `filters` object.
6. Return `AssemblerPage` with `pageId`, `level`, and the flat array of static components followed by the dynamic shell.

### 6.3 componentData() Resolver — Algorithm

The `componentData()` resolver handles all second-query (dynamic) requests:

1. Extract `TaxonomyContext`, `queryKey`, and `variables` from the query input.
2. Look up the adapter in the registry by `queryKey`. Throw `UNKNOWN_QUERY_KEY` error if not found.
3. Merge `country` and `language` from `TaxonomyContext` into `variables` — context values are always authoritative.
4. Call `adapter.resolve()` with the merged request object.
5. Return the resolved `DynamicComponent` with `items` populated.

> **Note:** `country` and `language` are always taken from `TaxonomyContext` and override any values in the client-supplied `variables`. This prevents locale drift between the initial page load and subsequent filter queries.

---

## 7. Sample Requests and Responses

### 7.1 Initial Load — CATEGORY level

#### Request

```graphql
query GetPage($ctx: TaxonomyContext!) {
  page(context: $ctx) {
    pageId level
    components {
      id componentType title description
      image { url altText }
      link  { href label }
      items {
        id title description badge
        image { url altText }
        link  { href }
        metadata
      }
      ... on DynamicComponent {
        queryKey queryVariables
        sortOptions { value label }
        pagination { totalCount pageSize currentPage }
      }
    }
  }
}
```

```json
{
  "ctx": {
    "country":     "us",
    "language":    "en",
    "level":       "CATEGORY",
    "categoryId":  "laptops",
    "ancestorIds": []
  }
}
```

#### Response (abbreviated)

```json
{
  "data": {
    "page": {
      "pageId": "us-en-CATEGORY-laptops",
      "level":  "CATEGORY",
      "components": [
        {
          "id": "breadcrumb",
          "componentType": "Breadcrumb",
          "items": [
            { "id": "home",    "title": "Home",            "link": { "href": "/" } },
            { "id": "laptops", "title": "Laptop Computers", "link": { "href": "/shop/laptops" } }
          ]
        },
        {
          "id": "hero-banner",
          "componentType": "Banner",
          "title": "Laptop Computers",
          "description": "Shop our best laptops and notebooks.",
          "image": { "url": "https://i.dell.com/is/image/DellContent/laptop-banner.jpg" },
          "link": { "href": "/shop/laptops", "label": "Explore Portfolio" },
          "items": [
            { "id": "tab-all",    "title": "All Laptops", "link": { "href": "/scr/laptops" } },
            { "id": "tab-gaming", "title": "Gaming",      "link": { "href": "/scr/laptops/gaming" } }
          ]
        },
        {
          "id": "facet-panel",
          "componentType": "FacetPanel",
          "title": "Filter Results",
          "items": [
            {
              "id": "product-line",
              "title": "Product Line",
              "metadata": {
                "displayType": "checkbox",
                "refinements": [
                  { "value": "xps",       "label": "XPS",    "count": 6  },
                  { "value": "dell-plus", "label": "Dell +", "count": 14 }
                ]
              }
            }
          ]
        },
        {
          "id": "product-stack",
          "componentType": "ProductStack",
          "title": "Laptops",
          "items": null,
          "queryKey": "ProductListing",
          "queryVariables": {
            "country": "us", "language": "en",
            "categoryId": "laptops", "ancestorIds": [],
            "level": "CATEGORY", "filters": {}
          },
          "sortOptions": [
            { "value": "rating_desc", "label": "Top Rated"     },
            { "value": "price_asc",   "label": "Lowest Price"  },
            { "value": "price_desc",  "label": "Highest Price" }
          ],
          "pagination": { "totalCount": 0, "pageSize": 12, "currentPage": 1 }
        }
      ]
    }
  }
}
```

---

### 7.2 Dynamic Query — User Applies Filters

#### Request

```graphql
query GetComponentData($ctx: TaxonomyContext!, $queryKey: String!, $variables: JSON!) {
  componentData(context: $ctx, queryKey: $queryKey, variables: $variables) {
    id componentType title
    items {
      id title description badge
      image { url altText }
      link  { href }
      metadata
    }
    pagination { totalCount pageSize currentPage }
  }
}
```

```json
{
  "ctx": {
    "country": "us", "language": "en",
    "level": "CATEGORY", "categoryId": "laptops", "ancestorIds": []
  },
  "queryKey": "ProductListing",
  "variables": {
    "categoryId": "laptops",
    "ancestorIds": [],
    "level": "CATEGORY",
    "filters": {
      "product-line": ["xps"],
      "screen-size":  ["16"],
      "memory":       ["16gb"]
    },
    "sort": "rating_desc",
    "page": 1
  }
}
```

#### Response (abbreviated)

```json
{
  "data": {
    "componentData": {
      "id": "product-stack",
      "componentType": "ProductStack",
      "title": "Laptops",
      "items": [
        {
          "id":          "xps-da16260-laptop",
          "title":       "XPS 16 Laptop",
          "description": "Intel Core Ultra 7 · 16 GB · 512 GB SSD",
          "image":       { "url": "https://i.dell.com/is/image/DellContent/xps16.jpg" },
          "link":        { "href": "/en-us/shop/dell-laptops/xps/spd/xps-da16260" },
          "badge":       "Hot Deal",
          "metadata": {
            "originalPrice": 1399.99,
            "salePrice":     1149.99,
            "currency":      "USD",
            "discountLabel": "Save $250",
            "rating":        4.2,
            "reviewCount":   121
          }
        }
      ],
      "pagination": { "totalCount": 4, "pageSize": 12, "currentPage": 1 }
    }
  }
}
```

---

### 7.3 Initial Load — PLATFORM level

#### Request variables (query identical to 7.1)

```json
{
  "ctx": {
    "country":     "us",
    "language":    "en",
    "level":       "PLATFORM",
    "categoryId":  "intel-evo",
    "ancestorIds": ["laptops", "xps"]
  }
}
```

**Assembler behaviour:**

- Activates `PLATFORM` `LevelProfile`
- Static adapters: `PlatformContentAdapter`, `AnavAdapter`
- Dynamic `queryKey`: `"ProductListing"`
- `AnavAdapter` passes `ancestorIds: ["laptops", "xps"]` to the ANAV Core API, which returns only facets relevant to XPS / Intel Evo
- `DynamicComponent` shell `queryVariables` includes `ancestorIds` so product results are correctly scoped when the client fires the second query

---

## 8. Error Handling

| Error Condition | Behaviour |
|---|---|
| Unknown `TaxonomyLevel` in `page()` | Resolver throws `AssemblerError` code `UNKNOWN_LEVEL`. GraphQL `errors` array populated. |
| Unknown `queryKey` in `componentData()` | Resolver throws `AssemblerError` code `UNKNOWN_QUERY_KEY`. |
| Core API returns non-2xx | Adapter wraps as `CoreApiError` with upstream status. Resolver catches; failed component omitted from `components[]`. Remaining components still returned. |
| Core API timeout | Adapter throws `CoreApiTimeoutError`. Same partial-page behaviour as above. |
| Transform produces missing required field | Adapter throws `AdapterTransformError` with field name. Component omitted from `components[]`. |
| `ancestorIds` missing for non-root level | Resolver logs warning and proceeds. Adapters requiring `ancestorIds` for scoping may return unscoped results. |

> **Note:** The Assembler follows a best-effort partial response strategy: if one static adapter fails, remaining components are still returned. Failed components are omitted silently for end users; error details are captured in logs.

---

## 9. Extension Points

### 9.1 Adding a New Core API

1. Create a new adapter class extending `BaseAdapter<TRequest, TRawResponse>`.
2. Implement `fetch()` to call the Core API.
3. Implement `transform()` to map the response to `ComponentPayload`.
4. Register the adapter in the adapter registry with a new `queryKey`.
5. Add the adapter to the appropriate `LevelProfile.staticAdapters` if it provides static content, or set it as `LevelProfile.dynamicQueryKey` if it drives dynamic listing.

> **Note:** No changes to the GraphQL schema, resolver algorithms, or existing adapters are required.

### 9.2 Adding a New Taxonomy Level

1. Add the new value to the `TaxonomyLevel` enum in the GraphQL schema.
2. Write any required content adapter(s) for the new level.
3. Add a new `LevelProfile` entry to the level registry.

> **Note:** The `page()` and `componentData()` resolver algorithms require no changes.

### 9.3 Adding a New Component Type

`componentType` values are open strings. Adding a new type requires no schema change. The adapter that produces the component sets the `componentType` string; the UI Orchestration Tool registers the new type for use in page composition.

### 9.4 Future: Typed metadata

The `metadata` JSON scalar is a known area of loose typing. Future options include:

- **GraphQL union types** — each `componentType` maps to a concrete metadata type.
- **Component-specific schema fragments** — `metadata` as a typed inline fragment per `componentType`.
- **A separate schema registry** — the Orchestration Tool uses it to validate metadata at author time.

_Deferred to a future spec revision. The JSON blob approach is sufficient for the prototype._

---

## 10. Open Questions

| ID | Question | Impact |
|---|---|---|
| OQ-1 | Should `totalCount` be pre-fetched at page load so the UI can show "65 results" before the second query? Requires a lightweight count-only call to `ProductContent` in `page()`. | UX quality vs. page load time |
| OQ-2 | Should `LevelProfile` support multiple dynamic component shells per page? e.g. `ProductStack` + `RecommendationStrip` both dynamic on the same page. | Schema and resolver complexity |
| OQ-3 | How should partial Core API failures be handled in the dynamic path (`componentData`)? Currently only static partial failure is specified. | Error resilience |
| OQ-4 | Should `componentType` be an enum in the schema, or remain an open string? Enum gives type safety; open strings allow new types without a schema deploy. | Schema rigidity vs. extensibility |
| OQ-5 | Caching strategy: static components (Breadcrumb, Banner) are CDN-cacheable; dynamic components must not be cached. Should the Assembler set `Cache-Control` headers per resolution type? | Performance |

---

## 11. Glossary

| Term / Field | Definition |
|---|---|
| Adapter | A class wrapping a single Core API. Owns `fetch()` and `transform()`. Produces `ComponentPayload` objects in the normalized vocabulary. |
| Adapter Registry | Server-side map from `queryKey` string to `Adapter` instance. Used for both static fan-out and dynamic resolution. |
| `ancestorIds` | Ordered array of node identifiers from the taxonomy root to (but not including) the current node. |
| `AssemblerPage` | Root GraphQL type returned by `page()`. Contains `pageId`, `level`, and `components[]`. |
| `Component` | GraphQL interface implemented by `StaticComponent` and `DynamicComponent`. Defines the normalized vocabulary. |
| `componentData()` | Second GraphQL query, fired by the client to resolve a `DynamicComponent`'s `items` on user interaction. |
| `componentType` | String token telling the UI which visual component to render. e.g. `"Banner"`, `"FacetPanel"`, `"ProductStack"`. |
| `ComponentPayload` | Internal TypeScript type produced by adapter `transform()` methods. |
| Core API | A domain-specific backend API with its own request format and response shape. Hidden from the UI by the Assembler. |
| `DynamicComponent` | A `Component` whose `items` are `null` on initial page load. Client fires `componentData()` to hydrate. |
| `LevelProfile` | Configuration record mapping a `TaxonomyLevel` to its static adapters and dynamic `queryKey`. |
| `ListItem` | Atomic unit within `Component.items`. Carries `title`, `description`, `image`, `link`, `badge`, and `metadata`. |
| `metadata` | Opaque JSON blob within `Component` and `ListItem` for fields not covered by the shared vocabulary. |
| `page()` | Initial GraphQL query. Returns static components resolved + dynamic shells. |
| `queryKey` | String token identifying an adapter in the registry. Returned on dynamic shells; echoed back by client in `componentData()`. |
| `queryVariables` | Seed variables on a `DynamicComponent` shell. Client uses as starting point for the `componentData()` request. |
| `StaticComponent` | A `Component` fully resolved on initial page load. No further queries required. |
| `TaxonomyContext` | Input object for both GraphQL queries. Encodes `country`, `language`, `level`, `categoryId`, and `ancestorIds`. |
| `TaxonomyLevel` | Enum: `CATEGORY` \| `PRODUCT_LINE` \| `PLATFORM` \| `OFFER` \| `PARTS`. Identifies depth in the product hierarchy. |
