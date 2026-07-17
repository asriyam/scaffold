# CMX Visual Authoring and Customer Experience Architecture Diagram

Create a single, polished enterprise architecture and workflow diagram that illustrates the complete **CMX Visual Authoring and Customer Experience platform**. The diagram must combine personas, authoring workflows, shared platform capabilities, configuration and data layers, domain APIs, runtime execution, orchestration, and enterprise integrations into one cohesive view.

The output must resemble a professional architecture diagram suitable for an executive design review or engineering architecture document, comparable in quality to Dell Technologies, Microsoft Azure Architecture Center, or AWS reference architecture diagrams.

## Primary Story the Diagram Must Communicate

The diagram must clearly show the following end-to-end story:

1. Four personas create orchestration definitions, layouts, React components, and authored content.
2. Layout, component, orchestration, and visual-authoring activities form an understandable assembly flow.
3. Authoring and the customer-facing application use the same shared React components and rendering logic.
4. Layout and orchestration definitions are configuration-driven and stored as JSON.
5. Published content and enterprise information feed an **Aggregated and Contextualized Data** capability.
6. The **Production Orchestration Engine** calls a **Domain API / Core Business API Layer**, not repositories directly.
7. The customer-facing Next.js application invokes orchestration and renders the final experience using SSR.
8. The architecture provides pixel-perfect consistency between authoring preview and the customer-facing experience.

## Overall Layout

Organize the diagram into clear horizontal layers from top to bottom. Do not use large left-side vertical bands if they consume valuable space.

Recommended layers:

1. **Personas**
2. **Authoring and Build Flow**
3. **Shared Platform Capabilities**
4. **Definitions and Data Sources**
5. **Domain API / Core Business API Layer**
6. **Customer Experience Runtime and Production Orchestration**
7. **Legend and Architecture Principles**, only if space permits

The overall flow should read primarily from top to bottom, with left-to-right sequencing inside each layer. Use generous whitespace, prevent clutter, and avoid overlapping connectors.

## Personas

Across the top, show four personas with a clear connection to the capability each persona uses.

### Layout Designer

- Designs pages and layouts
- Configures component placement and bindings
- Uses Layout Builder

### React Component Developer

- Develops reusable React components
- Implements component behavior and rendering-mode support
- Publishes versioned components to the Shared React Component Library

### Orchestration Editor

- Builds orchestration definitions and service workflows
- Configures mappings and execution behavior
- Uses Orchestration Builder

### Content Author

- Creates, edits, previews, and publishes content
- Uses Visual Authoring

## Authoring and Build Flow

Arrange the top application panels as an understandable page-building assembly flow. The visual sequence should communicate that orchestration, reusable components, and layouts are prepared before or alongside content authoring.

Use this preferred sequence:

**Orchestration Builder → Layout Builder + Component Development → Visual Authoring**

Layout Builder and Component Development may be shown as adjacent parallel capabilities because layouts consume reusable components. Visual Authoring should appear after the necessary definitions and components are available.

Do not make Visual Authoring or the Shared React Component Library appear to be the only central capability. Shared components and orchestration must have equal architectural importance.

## Authoring Applications

### 1. Orchestration Builder — Purple

Include the following workflow:

- Create Orchestration
- Build Orchestration Flow
- Configure Request Mappings
- Configure Response Mappings
- Configure Sequential / Parallel Execution
- Test Orchestration
- Save Orchestration JSON

Do not use the term **API Tree**. Use **Orchestration Flow**, **Execution Graph**, or **Service Invocation Flow** consistently.

Show the saved orchestration definition flowing to the consolidated definitions layer and being deployed or made available to the Production Orchestration Engine.

### 2. Layout Builder — Blue

Include the following workflow:

- Create / Edit Layout
- Drag Components
- Configure Rows / Columns / Placeholders
- Register Data Sources and Orchestration APIs
- Configure Component Bindings
- Configure Styling
- Save Layout JSON

Show the saved layout definition flowing to the consolidated definitions layer.

### 3. Component Development — Teal

Show this as the capability used by the React Component Developer.

Include:

- Create / Update React Component
- Implement Component Behavior
- Support Authoring, Preview, and Runtime Modes
- Add Documentation and Metadata
- Version and Publish Component

Connect Component Development to the Shared React Component Library.

### 4. Visual Authoring — Blue

Include the following workflow:

- Select Category
- Open Visual Preview
- Resolve Layout JSON
- Load Shared React Components
- Resolve Registered Data Sources
- Invoke Orchestration APIs
- Evaluate Component Data Bindings
- Render Page via SSR
- Send HTML to Browser
- Wrap Components with Editing Toolbar
- Edit Content
- Save Content
- Refresh Affected Components
- Publish Content

Display a small **Live Preview — Authoring Mode** browser window inside the panel.

Show authored and published content flowing into **Aggregated and Contextualized Data**. Do not show a separate, dominant runtime CMS repository.

## Shared Platform Capabilities

Place two peer capabilities at the same architectural level, with comparable visual size and prominence.

### Shared React Component Library — Teal

Keep this box compact. Include only the essential concepts:

- Reusable, documented, versioned React components
- Used by both Visual Authoring and the Customer Experience App
- Shared rendering logic and SSR support
- Supports Authoring, Preview, and Runtime modes

Show the three rendering modes only once. Do not repeat the same mode explanation in both bullets and a second diagram.

Include a concise caption:

**Same Components. Same Structure. Mode-Specific Behavior.**

Do not create a separate **Component Catalog** box. Component catalog, documentation, versioning, and reusable-component responsibilities are part of the Shared React Component Library.

### Orchestration Capability — Purple

Represent orchestration as a peer to the Shared React Component Library.

Include:

- Reusable orchestration definitions
- Request and response mappings
- Sequential and parallel execution definitions
- Versioned configuration
- Deployment to the Production Orchestration Engine

The component and orchestration boxes should be visually balanced and equally important.

## Definitions and Data Sources

Do not show three large standalone database cylinders beneath the authoring tools. Avoid making the architecture look centered around three large databases.

Create a compact horizontal layer containing the following two logical areas.

### Layout and Orchestration Definitions

Represent layout and orchestration persistence together in one consolidated area.

Include:

- Layout JSON
- Layout Definitions
- Component Bindings
- Registered Data Sources
- Styles and Settings
- Orchestration JSON
- Orchestration Flows
- Request / Response Mappings
- Version History

This area may use a compact repository or document icon, but it should not dominate the diagram.

Show:

- Layout Builder writing Layout JSON
- Orchestration Builder writing Orchestration JSON
- Visual Authoring resolving layout definitions
- Customer Experience App resolving layout definitions
- Production Orchestration Engine loading orchestration definitions

### Aggregated and Contextualized Data

Use this exact title:

**Aggregated and Contextualized Data**

Represent it as a data-source capability rather than merely a CMS database.

Include:

- Published Content
- Assets and Localization
- Product and Catalog Context
- Pricing and Inventory Context
- Customer and Session Context
- Search or Analytics Context
- Versioned or Indexed Data

Show authored content publishing into this data capability.

Do not show the Customer Experience App or Production Orchestration Engine directly reading data repositories. Access to operational data must occur through the Domain API / Core Business API Layer.

## Enterprise Data Sources

Replace the large vertical stack of individual orange enterprise-service boxes with one compact orange box, or at most two compact boxes.

Title:

**Enterprise Data Sources and Specialized Services**

List only representative examples, separated by commas or vertical bars:

- Core Product
- Pricing
- Inventory
- Search
- Configuration
- Analytics
- Other Enterprise Services

Show most enterprise information feeding **Aggregated and Contextualized Data**.

Specialized real-time services may connect to the Domain API layer where architecturally necessary, but enterprise systems must not become a major visual anchor.

Do not show every service as a separate large box.

## Domain API / Core Business API Layer

Add a distinct layer between operational data and the Production Orchestration Engine.

Use the title:

**Domain APIs / Core Business Logic APIs**

Include representative capabilities such as:

- Product Domain API
- Pricing Domain API
- Inventory Domain API
- Search Domain API
- Configuration Domain API
- Customer Context API

Show the following architectural rule clearly:

- Production Orchestration Engine calls Domain APIs.
- Domain APIs access Aggregated and Contextualized Data or specialized enterprise services.
- Production Orchestration Engine does not access repositories directly.
- Customer Experience App does not access operational data repositories directly.

## Customer Experience Runtime

Do not use **Production Environment** as the primary title for the application. Do not label the application merely **Production Runtime**, because the box represents a customer-facing application rather than an environment.

### Customer Browser

Show a small browser icon representing end users.

Flow:

**Request Page URL → Customer Experience App**

and

**Customer Experience App → Return HTML via SSR → Customer Browser**

### Customer Experience App — Green

Use the title:

**Customer Experience App — Next.js SSR**

Alternative acceptable title:

**Customer-Facing Next.js Experience App**

Include:

- Resolve Layout JSON
- Load Shared React Components
- Invoke Production Orchestration APIs
- Evaluate Component Data Bindings
- SSR Render Page
- Return HTML to Browser

Show the application using:

- Layout definitions
- Shared React Component Library
- Production Orchestration Engine

Do not show the application directly reading the Aggregated and Contextualized Data store.

Place the Customer Experience App near the bottom of the architecture so it appears as the final customer-facing consumer of the platform.

### Production Orchestration Engine — Purple

Show this as an independent production service with comparable prominence to runtime.

Workflow:

- Receive Request
- Load Orchestration Definition
- Execute Orchestration Flow
- Perform Sequential / Parallel Execution
- Apply Request Mappings
- Invoke Domain APIs
- Apply Response Mappings
- Aggregate Results
- Return Consolidated Response

Show:

- Customer Experience App invoking the Production Orchestration Engine
- Production Orchestration Engine loading orchestration definitions
- Production Orchestration Engine invoking Domain APIs
- Domain APIs accessing aggregated/contextualized data and specialized services

The orchestration engine may use a horizontal shape if that improves the layered layout.

## Required End-to-End Runtime Flow

Make this flow unmistakable:

1. Customer Browser requests a page URL.
2. Customer Experience App resolves Layout JSON.
3. Customer Experience App loads shared React components.
4. Customer Experience App invokes the Production Orchestration Engine.
5. Production Orchestration Engine loads the orchestration definition.
6. Production Orchestration Engine calls Domain APIs.
7. Domain APIs obtain aggregated/contextualized information or call specialized enterprise services.
8. Production Orchestration Engine aggregates and returns a consolidated response.
9. Customer Experience App evaluates component bindings and renders the page using Next.js SSR.
10. Customer Experience App returns HTML to the Customer Browser.

## Direct API Calls

Do not add a new dotted direct-runtime-to-enterprise-API connector merely as an alternative to orchestration.

If direct APIs configured in Layout JSON are retained because they are part of the actual solution, represent the behavior sparingly and label it clearly as an optional configuration-driven path. The main architectural path must remain:

**Customer Experience App → Production Orchestration Engine → Domain APIs**

## Connectors and Relationships

Use clean, directional connectors with no overlap.

Required connections:

- Layout Designer → Layout Builder
- React Component Developer → Component Development
- Component Development → Shared React Component Library
- Orchestration Editor → Orchestration Builder
- Content Author → Visual Authoring
- Layout Builder → Layout and Orchestration Definitions
- Orchestration Builder → Layout and Orchestration Definitions
- Layout and Orchestration Definitions → Visual Authoring
- Layout and Orchestration Definitions → Customer Experience App
- Layout and Orchestration Definitions → Production Orchestration Engine
- Shared React Component Library → Visual Authoring
- Shared React Component Library → Customer Experience App
- Visual Authoring → Aggregated and Contextualized Data, labelled Save / Publish Content
- Enterprise Data Sources → Aggregated and Contextualized Data
- Customer Experience App → Production Orchestration Engine
- Production Orchestration Engine → Domain APIs
- Domain APIs → Aggregated and Contextualized Data
- Domain APIs ↔ Specialized Enterprise Services, only where needed
- Customer Browser ↔ Customer Experience App

## Architecture Principles

If space permits, include four compact callout cards at the bottom. If the diagram becomes crowded, move these cards to a separate slide or omit them from this detailed architecture view.

### Pixel-Perfect Preview

Authoring and the customer-facing application render with the same shared React components and rendering logic.

### Shared Components

Components share structure across Authoring, Preview, and Runtime while allowing behavior to vary by rendering mode.

### JSON-Driven Platform

Layouts and orchestration definitions are configuration-driven and stored as JSON.

### One Source, Multiple Experiences

The same layouts, components, content, and orchestration definitions support both authoring and the customer-facing experience.

## Detail Level

For this version, keep the detailed bullet points inside the principal functional boxes so the architecture can be reviewed for completeness.

After the detailed version is finalized, create a second simplified executive version without the internal workflow bullets.

## Legend

If space permits, create a compact legend:

- Blue solid — Primary application and authoring flow
- Purple solid — Orchestration flow
- Green solid — Content publishing flow
- Orange solid or dashed — Enterprise source integration
- Gray — Definition or configuration read/write
- Teal — Shared component relationship

## Visual Style

Use a modern enterprise design inspired by Dell Technologies.

- White background
- Rounded rectangles
- Subtle shadows
- Thin borders
- Soft gradients only where appropriate
- Professional typography
- Minimal flat enterprise icons
- Consistent spacing and alignment
- Clear visual hierarchy
- Generous whitespace
- No overlapping arrows
- No oversized repository cylinders
- No oversized external-systems column
- Balanced visual weight for shared components and orchestration

## Color Palette

### Blue — Authoring Applications

- Primary Blue: `#0076CE`
- Dark Blue: `#005DAA`
- Light Blue: `#EAF5FE`

### Purple — Orchestration

- Purple: `#6F42C1`
- Light Purple: `#F2ECFB`

### Teal — Shared Components

- Teal: `#00A3A3`
- Light Teal: `#DDF7F7`

### Green — Customer Experience App

- Green: `#2E8B57`
- Light Green: `#EAF8F0`

### Orange — Enterprise Data Sources

- Orange: `#F28C28`
- Light Orange: `#FFF2E6`

### Gray — Definitions and Data

- Background: `#F8F9FA`
- Border: `#D8D8D8`

## Icons

Use clean enterprise icons for:

- Personas
- Applications
- React Components
- Configuration / JSON Documents
- Data Sources
- Domain APIs
- Orchestration Engine
- Customer Browser
- Customer Experience App
- Enterprise Services

Avoid relying on emoji-style icons if the diagram tool can use polished vector enterprise icons.

## Validation Rules

Before finalizing the diagram, verify all of the following:

- Exactly four personas are shown.
- React Component Developer is included.
- Component Development connects to the Shared React Component Library.
- The authoring/build capabilities follow a clear assembly sequence.
- The Shared React Component Library is compact and not duplicated by a separate Component Catalog.
- Rendering modes are explained only once.
- Shared components and orchestration have equal visual weight.
- The term API Tree is not used.
- Three large standalone repository boxes are not shown.
- Layout and orchestration definitions are consolidated.
- Aggregated and Contextualized Data is explicitly shown.
- Authored content publishes into Aggregated and Contextualized Data.
- A Domain API / Core Business API Layer is shown.
- Production Orchestration Engine calls Domain APIs, not repositories.
- Customer Experience App does not read operational data repositories directly.
- Enterprise systems are consolidated into one or two compact boxes.
- The main runtime flow uses orchestration and Domain APIs.
- No unnecessary dotted direct-runtime API path is added.
- The application is named Customer Experience App or Customer-Facing Next.js Experience App, not merely Production Runtime.
- Detailed bullets remain in the current version.
- Bottom principle cards are retained only if they do not crowd the architecture.

## Final Goal

Produce a polished enterprise architecture infographic that clearly communicates:

- Four personas and their responsibilities
- The orchestration, layout, component-development, and visual-authoring assembly flow
- A compact shared React component architecture
- Orchestration as a peer platform capability
- Consolidated layout and orchestration definitions
- Aggregated and Contextualized Data
- A Domain API / Core Business Logic API layer
- The customer-facing Next.js SSR application
- The Production Orchestration Engine
- Simplified enterprise integrations
- End-to-end authoring, publishing, orchestration, and runtime behavior
- JSON-driven configuration
- Pixel-perfect consistency between authoring preview and the customer-facing experience

The final diagram must be visually balanced, highly readable, technically accurate, and suitable for an executive presentation, architecture review, or engineering design document.
