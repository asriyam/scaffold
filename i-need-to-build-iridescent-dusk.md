# Plan: JSON-driven SSR Next.js Application ("Sparkle")

## Context

Build a Next.js application where pages are not hand-coded but described by JSON documents (server-driven UI). Each JSON document defines one page: its data sources (APIs), a fixed three-level layout (Page → Rows → Columns), and per-column component bindings. API responses are designed around component props: a component binds to a named data source plus a field path, and the object at that path becomes the component's data props. Pages can be added or changed by editing JSON only — no code changes.

Decisions confirmed with user:
- Page JSON stored as **local files in the repo** (loader abstracted so a CMS/API can replace it later)
- Page-level section for **meta/visual settings** (browser title, description, theme, spacing) where meta fields support **data binding** from API responses
- Data from **mock API route handlers inside the app** for v1
- Layout is **exactly 3 levels: Page → Row → Column**; one component per column
- Column widths are **abstract hints** (`narrow` / `medium` / `wide` / `full`), never spans or CSS classes
- Component styling variations are **abstracted component properties** (e.g. `template: "imageOnly"`), never CSS/Tailwind in JSON
- Data binding is **source name + dot-path** into the response; one API response can feed many components
- Stack: **TypeScript, Next.js App Router (RSC/SSR), Tailwind CSS** (Tailwind used inside components only, invisible to JSON)

## Architecture Overview

```
Request /products
   │
   ▼
app/[[...slug]]/page.tsx  (catch-all dynamic route, server component)
   │  1. PageLoader: read + validate page-configs/products.json
   │  2. DataResolver: fetch all dataSources in parallel (server-side)
   │  3. PageRenderer: render rows → columns → bound components
   ▼
Fully server-rendered HTML
```

### 1. Page definition schema (`src/lib/page-schema.ts`)

Zod schemas + inferred TS types. Shape:

```jsonc
{
  "page": {
    "meta": {                                                  // → generateMetadata
      "title": { "source": "homeApi", "path": "seo.title" },   // bindable: from API…
      "description": "Welcome to Sparkle"                      // …or a fixed value
    },
    "style": {                                                 // abstract page-level visuals
      "theme": "light",                                        // light | dark
      "background": "subtle",                                  // none | subtle | brand
      "contentWidth": "standard",                              // standard | wide | full
      "rowSpacing": "comfortable"                              // compact | comfortable | spacious
    }
  },

  "dataSources": {                                             // any number of APIs
    "homeApi":    { "url": "/api/mock/home" },                 // relative = same app
    "productsApi":{ "url": "/api/mock/products?featured=true" },
    "promoApi":   { "url": "/api/mock/promo/{slug}" }          // {param} from route
  },

  "rows": [                                                    // level 2: rows
    {
      "columns": [                                             // level 3: columns
        {
          "width": "wide",                                     // abstract hint, no CSS
          "component": {
            "name": "Hero",                                    // registry key
            "template": "titleAndImage",                       // abstract style variant
            "options": { "alignment": "left" },                // fixed declarative props
            "data": { "source": "homeApi", "path": "banner" }  // object at path → props
          }
        },
        {
          "width": "narrow",
          "component": {
            "name": "InfoCard",
            "template": "textOnly",
            "options": { "title": "Static card" }               // static-only, no data
          }
        }
      ]
    },
    {
      "columns": [
        { "width": "full",
          "component": {
            "name": "ProductGrid",
            "data": { "source": "productsApi" }                // no path = whole response
          } }
      ]
    }
  ]
}
```

Key rules enforced by the schema:
- `page.meta` fields (browser title, description, and later og-image etc.) are **bindable values**: each accepts either a literal or a `{ "source", "path" }` binding resolved from the fetched data — e.g. a product page's browser title comes from the product API. The same bindable-value type is reused anywhere a literal-or-bound value makes sense
- `page.style` holds **abstract page-level visual properties** (theme, background, content width, row spacing) with fixed enum values — mapped to CSS by the renderer, never CSS classes in JSON
- Exactly 3 levels; no nesting beyond Page → Row → Column; **one component per column**
- `width` ∈ `narrow | medium | wide | full` (optional; columns share the row equally when omitted). The renderer maps hints to CSS internally — JSON never contains classes, spans, or divs
- `template` and `options` values come from each component's own declared enum/props (abstract, fixed values)
- `data.source` must name a declared data source; `data.path` is an optional dot-path (`"sections.banner"`). One source can be referenced by any number of components
- Component data props = object at `path` (or whole response). Merged with `options`; `options` are component-controlled knobs, data is content

### 2. Component registry (`src/components/registry.ts`)

Typed map: `componentName → { Component, propsSchema (zod), templates: [...] }`. The renderer resolves components here; unknown names render a dev-visible error placeholder (skipped in production). Each component's zod schema validates the bound data against its prop contract at render time — enforcing "API response matches component props" and producing clear errors naming the component and field when a backend drifts.

Initial components (server components, Tailwind inside only), each with `template` variants:
- `Hero` — templates: `titleAndImage`, `imageOnly`, `titleOnly`
- `ProductGrid` / `ProductCard` — templates: `imageAndText`, `imageOnly`, `compact`
- `InfoCard` — templates: `titleAndBody`, `textOnly`, `iconAndText`
- `StatsBar`, `RichText`
- One `'use client'` component (e.g. `Accordion`) to prove interactive components work in the registry

### 3. Page loader (`src/lib/page-loader.ts`)

`loadPageDefinition(slug: string[]): Promise<PageDefinition | null>` — reads `page-configs/<slug>.json` (`/` → `home.json`), parses, validates with zod. `null` → `notFound()`; validation failure throws a descriptive error (caught by `error.tsx`). Single seam to later swap in a CMS/API/database.

### 4. Data resolver (`src/lib/data-resolver.ts` + `src/lib/binding.ts`)

- `resolveDataSources(defs, routeParams)` — interpolates `{param}` placeholders, fires all fetches **in parallel** (`Promise.allSettled`) server-side; relative URLs resolve against the app's own origin, absolute pass through (future external backends); `cache: 'no-store'` for true per-request SSR
- `bindData(results, { source, path })` — walks the dot-path into the fetched response and returns the object that becomes the component's data props
- Per-source failure does not fail the page: components bound to a failed source render an error fallback; the rest render normally

### 5. Page renderer (`src/components/layout/PageRenderer.tsx`)

Simple, non-recursive server component (the hierarchy is fixed):
- Page → vertical sequence of rows
- Row → flex/grid container; width hints map to fractions internally (e.g. `narrow`=1/4, `medium`=1/3, `wide`=2/3, `full`=100%; unhinted columns share remaining space equally)
- Column → registry lookup, bind data via source+path, validate against prop schema, render with `template` + `options`
- `ComponentErrorBoundary` (client component) so one broken component can't blank the page

### 6. Catch-all route (`src/app/[[...slug]]/page.tsx`)

- `export const dynamic = 'force-dynamic'` (SSR every request)
- `generateMetadata` resolves `page.meta` — including data-bound fields like a browser title sourced from an API. Because both `generateMetadata` and the page component need the fetched data, the load + resolve pipeline is wrapped in React `cache()` so data sources are fetched **once per request** and shared between metadata and rendering
- `page.style` properties are applied by `PageRenderer` to the page shell (theme class, background, max-width, row gap)
- Orchestrates load → resolve → render; plus `not-found.tsx` and `error.tsx`

### 7. Mock APIs (`src/app/api/mock/*/route.ts`)

Route handlers returning JSON shaped for the components, including one **composite endpoint** (e.g. `/api/mock/home` returning `{ banner: {...}, featured: {...}, stats: {...} }`) consumed by multiple components via different paths — demonstrating the one-source/many-components binding.

## File Structure

```
sparkle/
├── page-configs/
│   ├── home.json
│   └── products.json
├── src/
│   ├── app/
│   │   ├── [[...slug]]/page.tsx        # catch-all SSR route
│   │   ├── api/mock/.../route.ts       # mock data APIs
│   │   ├── layout.tsx  globals.css  not-found.tsx  error.tsx
│   ├── lib/
│   │   ├── page-schema.ts              # zod schemas + types for page JSON
│   │   ├── page-loader.ts              # filesystem loader (swappable seam)
│   │   ├── data-resolver.ts            # parallel server-side fetching
│   │   └── binding.ts                  # dot-path binding into responses
│   └── components/
│       ├── registry.ts                 # name → component + schema + templates
│       ├── layout/PageRenderer.tsx     # rows → columns → components
│       └── ui/                         # Hero, ProductGrid, InfoCard, ...
```

## Implementation Steps

1. Scaffold: `create-next-app` (TS, App Router, Tailwind, src dir, ESLint) + `zod`
2. `page-schema.ts` — zod schemas for meta / dataSources / rows / columns / component binding
3. `page-loader.ts` — filesystem load + validate
4. `data-resolver.ts` + `binding.ts` — interpolation, parallel fetch, dot-path binding, per-source error capture
5. UI components with `template` variants and zod prop schemas; `registry.ts`
6. `PageRenderer.tsx` + component error boundary
7. Catch-all route with `generateMetadata`, `not-found.tsx`, `error.tsx`
8. Mock API route handlers, including the composite endpoint
9. Sample page configs (`home.json`, `products.json`) exercising: multiple data sources, one source feeding multiple components via paths, width hints, template variants, static-only components, `{param}` interpolation, a data-bound browser title, and page-level style settings

## Verification

- `npm run dev`, visit `/` and `/products` — pages render from JSON
- View page source (or `curl`) — content present in initial HTML (true SSR)
- Edit a page JSON (reorder rows, change a `template` or `width` hint), refresh — page changes without code changes
- Confirm two components on `home` are fed by the same API response via different paths
- Confirm the browser tab title on one page comes from an API response (data-bound `page.meta.title`), and changing `page.style` values (theme/spacing) visibly restyles the page
- Unknown slug → 404; unknown component → dev placeholder; kill one mock endpoint → only bound components show fallback
- Mismatched API response vs prop schema → validation error naming component and field
- `npm run build` passes
