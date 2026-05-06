**configuration‑driven orchestration JSON** that translates cleanly into a **single GraphQL request** over simplified APIs.

***

# 1. Orchestration Configuration (JSON)

This is **what is saved**, versioned, and selected by platform / country / locale.  
It describes **what to call, in what order, and how results relate** — no code.

```json
{
  "orchestrationId": "platform-page-v1",
  "context": {
    "platformId": "{{platformId}}",
    "country": "{{country}}",
    "language": "{{language}}"
  },
  "sequence": [
    {
      "id": "platformContent",
      "api": "getPlatformContent",
      "type": "simplified",
      "params": {
        "platformId": "{{platformId}}"
      },
      "select": [
        "id",
        "title",
        "description",
        "heroImage",
        "breadcrumbs"
      ]
    },
    {
      "id": "microContent",
      "api": "getMicroContent",
      "type": "simplified",
      "params": {
        "keys": [
          "platform.hero.badge",
          "platform.cta.primary",
          "platform.cta.secondary",
          "platform.disclaimer"
        ]
      }
    },
    {
      "id": "baseModelGrouping",
      "api": "getBaseModelGrouping",
      "type": "simplified",
      "params": {
        "platformId": "{{platformId}}"
      },
      "select": [
        "groupId",
        "label",
        "sequence"
      ],
      "defaultSelection": "first"
    },
    {
      "id": "offers",
      "api": "getOffersByGroup",
      "type": "simplified",
      "dependsOn": "baseModelGrouping",
      "params": {
        "groupId": "{{baseModelGrouping.selected.groupId}}",
        "limit": 3
      },
      "select": [
        "offerId",
        "title",
        "price",
        "sequence"
      ],
      "defaultSelection": "first"
    },
    {
      "id": "offerSpecs",
      "api": "getOfferSpecs",
      "type": "simplified",
      "dependsOn": "offers",
      "params": {
        "offerId": "{{offers.selected.offerId}}"
      },
      "select": [
        "cpu",
        "memory",
        "storage",
        "display",
        "features"
      ],
      "load": "onInitial"
    }
  ],
  "outputShape": {
    "platform": "$platformContent",
    "microContent": "$microContent",
    "baseModels": "$baseModelGrouping",
    "offers": "$offers",
    "selectedOffer": {
      "offer": "$offers.selected",
      "specs": "$offerSpecs"
    }
  }
}
```

### Why this matters

*   ✅ No orchestration logic in code
*   ✅ Country / locale overrides = new JSON
*   ✅ Fully mappable to GraphQL
*   ✅ Business rules (sequence, defaults) stay outside UI

***

# 2. Generated GraphQL Query (Result of the Orchestration)

This is the **actual query** the runtime executes after reading the configuration above.

```graphql
query PlatformPage(
  $platformId: ID!,
  $country: String!,
  $language: String!
) {
  platformContent: getPlatformContent(
    platformId: $platformId
  ) {
    id
    title
    description
    heroImage
    breadcrumbs
  }

  microContent: getMicroContent(
    keys: [
      "platform.hero.badge"
      "platform.cta.primary"
      "platform.cta.secondary"
      "platform.disclaimer"
    ]
  ) {
    key
    value
  }

  baseModels: getBaseModelGrouping(
    platformId: $platformId
  ) {
    groupId
    label
    sequence
  }

  offers: getOffersByGroup(
    groupId: $baseModelGrouping.selected.groupId
    limit: 3
  ) {
    offerId
    title
    price
    sequence
  }

  selectedOfferSpecs: getOfferSpecs(
    offerId: $offers.selected.offerId
  ) {
    cpu
    memory
    storage
    display
    features
  }
}
```

***

# 3. Example Variables Passed at Runtime

```json
{
  "platformId": "dell-plus",
  "country": "US",
  "language": "en"
}
```

***

# 4. What the UI Receives (Conceptual Output)

```json
{
  "platform": { "...": "..." },
  "microContent": { "...": "..." },
  "baseModels": [
    { "label": "14 inch", "selected": true },
    { "label": "16 inch" }
  ],
  "offers": [
    { "title": "Base", "selected": true },
    { "title": "Plus" },
    { "title": "Pro" }
  ],
  "selectedOffer": {
    "offer": { "title": "Base" },
    "specs": { "cpu": "Intel i7", "memory": "16GB" }
  }
}
```

***

# 5. Key Alignment With the Call

✅ Orchestration **is the configuration**  
✅ GraphQL request is **generated, not coded**  
✅ Defaults come from **sequence**, not UI logic  
✅ Same model works for **UK, US, IN**, etc.  
✅ UI simply renders what it gets

***

Below is a **clean, production‑grade example** of the **second GraphQL query** that fires **when a user clicks a different offer** (or base model), fully aligned with the orchestration philosophy from the call.

The key idea:  
✅ **Only fetch what changes**  
✅ **No page re‑orchestration**  
✅ **Same simplified APIs, reused via GraphQL**

***

## Purpose of This Query

Triggered when the user:

*   Clicks a **different offer** (e.g., “Plus” instead of “Base”), or
*   Switches a **base model** (e.g., 14″ → 16″)

This query:

*   Fetches **offer‑specific content + specs**
*   Leaves platform/menu/micro‑content untouched

***

## 1. User Interaction GraphQL Query

### Scenario: User clicks a different offer

```graphql
query OfferSelection(
  $offerId: ID!,
  $platformId: ID!
) {
  selectedOffer: getOfferById(
    offerId: $offerId
  ) {
    offerId
    title
    price
    badges
  }

  selectedOfferSpecs: getOfferSpecs(
    offerId: $offerId
  ) {
    cpu
    memory
    storage
    display
    graphics
    features
  }

  selectedOfferContent: getOfferContent(
    platformId: $platformId
    offerId: $offerId
  ) {
    marketingTitle
    highlights
    footerDisclaimer
  }
}
```

***

## 2. Runtime Variables (from UI Event)

```json
{
  "platformId": "dell-plus",
  "offerId": "offer-plus-16gb"
}
```

***

## 3. UI Interaction Flow (Very Important)

```text
Page Load (Initial GraphQL)
   ├─ Platform Content
   ├─ Micro Content
   ├─ Default Base Model
   ├─ Default Offer + Specs
   ↓
User clicks another Offer
   ├─ Fire OfferSelection GraphQL
   ├─ Replace:
   │   ├─ Offer card
   │   ├─ Specs panel
   │   └─ Feature list
   └─ No page reload
```

✅ Menu, breadcrumbs, hero → unchanged  
✅ Only **offer‑scoped components** rerender

***

## 4. Why This Fits the Architecture Decision

### ✅ From the Call (Direct Alignment)

| Call Principle                  | How This Query Matches         |
| ------------------------------- | ------------------------------ |
| “Don’t hardcode orchestration”  | Query built from config        |
| “Simplified APIs only”          | Uses getOffer\*, getOfferSpecs |
| “GraphQL is just a request”     | No backend state mutation      |
| “Defaults come from sequence”   | UI drives selection            |
| “Dynamic calls on click are OK” | This *is* the dynamic call     |

***

## 5. Optional: Base Model Switch Variant

If the user switches **base model (14″ → 16″)**:

```graphql
query BaseModelSwitch(
  $platformId: ID!,
  $groupId: ID!
) {
  offers: getOffersByGroup(
    groupId: $groupId
    limit: 3
  ) {
    offerId
    title
    price
    sequence
  }
}
```

UI then:

*   Automatically selects **first offer by sequence**
*   Fires the **OfferSelection query** above

***

## 6. What You Do *Not* Do (By Design)

❌ Re-run full page orchestration  
❌ Re-fetch platform or category content  
❌ Encode business logic in UI  
❌ Create a new backend endpoint

***

## 7. One‑Line Mental Model

> **Initial query builds the page.  
> Interaction queries update the selection.  
> Configuration decides the shape.**

***

