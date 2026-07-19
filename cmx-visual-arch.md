# CMX Visual Authoring and Customer Experience Platform

## Functional Specification and Architecture Description

**Version:** 1.0  
**Purpose:** Architecture Functional Specification  
**Audience:** Architects, Engineering Teams, Product Teams, Leadership, New Team Members

***

# 1. Executive Summary

The CMX platform is a configuration-driven digital experience platform that enables business users, content authors, and developers to collaboratively build, manage, preview, and deliver customer-facing experiences without requiring page-specific application development.

The platform separates:

* Layout composition
* UI component development
* Content authoring
* API orchestration
* Runtime rendering
* Enterprise data access

into distinct capabilities while maintaining a unified execution model.

The same configuration artifacts, shared React components, and orchestration definitions are used across both authoring and runtime, ensuring that content previews accurately represent what customers experience.

The platform is built around five key principles:

1. Configuration-driven experiences
2. Shared component architecture
3. API orchestration-driven integration
4. Separation of content and enterprise data
5. Server-side rendered customer experiences

***

# 2. System Objectives

The platform is designed to:

* Eliminate page-specific front-end development
* Enable business teams to construct experiences visually
* Enable reusable UI components
* Centralize API integration logic
* Support enterprise-scale content management
* Deliver pixel-perfect preview experiences
* Enable rapid experience creation through configuration
* Support runtime personalization and contextualization

***

# 3. Platform Roles and Personas

The platform supports four primary personas.

***

## 3.1 Layout Designer

Responsible for:

* Designing page structure
* Managing page layouts
* Organizing visual composition
* Defining component placement
* Configuring layout-level data bindings

The Layout Designer does not create React components or content.

The output produced by this persona is:

```text
Layout Definitions
```

***

## 3.2 Component Developer

Responsible for:

* Creating reusable React components
* Implementing rendering logic
* Supporting authoring mode
* Supporting preview mode
* Supporting runtime mode
* Maintaining component versioning

The output produced by this persona is:

```text
Shared Component Library
```

***

## 3.3 Orchestration Editor

Responsible for:

* Defining API orchestration flows
* Creating service integrations
* Defining request mappings
* Defining response mappings
* Managing execution strategies
* Aggregating responses

The output produced by this persona is:

```text
Orchestration Definitions
```

***

## 3.4 Content Author

Responsible for:

* Creating marketing content
* Creating merchandising content
* Publishing page experiences
* Managing content updates
* Reviewing live previews

The output produced by this persona is:

```text
Published Experience Templates
```

***

# 4. Core Architecture Building Blocks

The platform is composed of four primary configuration artifacts.

***

## 4.1 Layout Definitions

Layout definitions describe:

* Page structure
* Columns
* Rows
* Placeholders
* Component placement
* Styling
* Data-source references

Layouts do not contain business logic.

Layouts are stored as JSON configurations.

Example:

```json
{
  "page": "PLP",
  "components": [
    "HeroBanner",
    "ProductGrid",
    "FacetPanel"
  ]
}
```

***

## 4.2 Shared Component Library

The Shared Component Library contains reusable React components.

Examples:

```text
Hero Banner
Product Grid
Product Card
Breadcrumb
Carousel
Facet Navigation
Recommendation Widget
```

Each component supports multiple execution modes.

### Authoring Mode

Provides:

* Editing overlays
* Author controls
* Content management features

### Preview Mode

Provides:

* Accurate preview rendering
* Testing before publishing

### Runtime Mode

Provides:

* Customer-facing rendering
* Optimized execution

This design ensures:

```text
Authoring = Preview = Runtime
```

using the same component implementation.

***

## 4.3 Orchestration Definitions

Orchestration Definitions describe how enterprise APIs are executed.

Definitions include:

* APIs to call
* Execution order
* Parallel execution
* Request transformations
* Response transformations
* Aggregation rules

Example:

```text
Product API
    +
Pricing API
    +
Inventory API
    +
Promotion API
```

↓

```text
Unified Product Response
```

Orchestration Definitions are stored as JSON.

***

## 4.4 Published Experience Templates

Published Experience Templates represent complete customer experiences.

A template combines:

```text
Layout
+
Components
+
Content
+
Bindings
+
Orchestration References
```

Examples:

```text
PLP
PDP
Cart
Checkout
Home Page
Brand Landing Page
```

Within the company, a Template represents a page definition.

***

# 5. Authoring Environment

The Authoring Environment consists of four applications.

***

# 5.1 Layout Builder

The Layout Builder allows designers to:

### Create Layouts

Define:

* Rows
* Columns
* Regions

### Configure Components

Assign:

* Components
* Placeholders
* Visibility rules

### Configure Data Sources

Associate:

```text
Component
→
Orchestration
```

or

```text
Component
→
Direct Domain API
```

### Output

Produces:

```text
Layout Definition JSON
```

***

# 5.2 Component Library Management

Used by component developers.

Capabilities:

### Component Creation

Build reusable components.

### Rendering Modes

Support:

```text
Authoring
Preview
Runtime
```

### Versioning

Manage:

```text
v1
v2
v3
...
```

### Documentation

Document:

* Usage
* Configuration
* Data requirements

***

# 5.3 Orchestration Builder

Allows integration architects to create orchestration flows.

Capabilities:

### Create Orchestration

Define:

```text
Search Flow
Product Flow
Recommendation Flow
Pricing Flow
```

### Configure Request Mappings

Example:

```text
UI Input
→
API Request
```

### Configure Response Mappings

Example:

```text
API Response
→
Component View Model
```

### Sequential Execution

```text
API A
↓
API B
↓
API C
```

### Parallel Execution

```text
API A
     \
API B ---- Aggregate
     /
API C
```

### Save Definition

Produces:

```text
Orchestration Definition
```

***

# 5.4 Visual Authoring

Visual Authoring provides a WYSIWYG authoring experience.

Workflow:

### Step 1

Select experience.

### Step 2

Load:

* Layout Definition
* Components
* Data Sources

### Step 3

Render preview.

### Step 4

Allow author editing.

### Step 5

Publish experience.

Output:

```text
Published Experience Template
```

***

# 6. Domain APIs

Domain APIs are the only supported mechanism for accessing enterprise business data.

The system never directly accesses enterprise databases.

Examples:

```text
Product API
Shipping API
Deals API
Pricing API
Configuration API
```

Responsibilities:

* Encapsulate enterprise data sources
* Apply business logic
* Standardize contracts
* Abstract implementation details

The platform accesses business data exclusively through these APIs.

***

# 7. Aggregated and Contextualized Data

This layer provides prepared enterprise information required by customer experiences.

Examples include:

```text
Specifications
ANAV Data
Merchandising Categories
Offer Contexts
```

This is not CMS-authored content.

This is enterprise business information that has been:

* Aggregated
* Normalized
* Contextualized
* Prepared for experience consumption

The data may be sourced from multiple domain APIs and enterprise systems.

***

# 8. Customer Experience Application

The Customer Experience App is the runtime application responsible for serving experiences to customers.

Implemented using:

```text
Next.js
Server-Side Rendering (SSR)
```

Responsibilities:

### Resolve Layout

Load:

```text
Layout Definitions
```

### Load Components

Retrieve:

```text
Shared Component Library
```

### Load Experience Template

Retrieve:

```text
Published Experience Templates
```

### Retrieve Data

Using one of two approaches:

#### Approach 1: Orchestration

```text
Customer Experience App
        ↓
Orchestration Engine
        ↓
Domain APIs
```

#### Approach 2: Direct API Calls

```text
Customer Experience App
        ↓
Domain APIs
```

Direct API calls are configured through layout definitions and component configuration.

***

# 9. Orchestration API Engine

The Orchestration API Engine executes orchestration definitions at runtime.

Responsibilities:

### Load Definitions

Load orchestration configuration.

### Execute API Flow

Execute:

```text
Sequential
```

or

```text
Parallel
```

service calls.

### Apply Mappings

Transform:

* Requests
* Responses

### Aggregate Results

Combine multiple responses into a single payload.

### Return Unified Response

Return view-model-ready data back to the Customer Experience App.

***

# 10. Runtime Execution Flow

## Standard Orchestration Flow

```text
Customer Browser
        ↓
Customer Experience App
        ↓
Resolve Layout
        ↓
Load Shared Components
        ↓
Load Experience Template
        ↓
Invoke Orchestration
        ↓
Domain APIs
        ↓
Aggregated & Contextualized Data
        ↓
Response Aggregation
        ↓
SSR Render
        ↓
Return HTML
        ↓
Customer Browser
```

***

## Direct API Flow

```text
Customer Browser
        ↓
Customer Experience App
        ↓
Resolve Layout
        ↓
Load Shared Components
        ↓
Invoke Domain API
        ↓
Receive Data
        ↓
SSR Render
        ↓
Return HTML
```

***

# 11. Configuration-Driven Platform Model

The platform's most important characteristic is that experiences are constructed through configuration rather than code.

The primary artifacts are:

```text
Layout Definitions
Shared Component Library
Orchestration Definitions
Published Experience Templates
```

New experiences are typically created by:

1. Constructing layouts
2. Reusing existing components
3. Connecting orchestrations
4. Authoring content
5. Publishing templates

without creating new application pages.

***

# 12. Key Architectural Benefits

## Reusability

Shared React components are reused everywhere.

***

## Consistency

Authoring previews match runtime rendering.

***

## Separation of Concerns

Designers, developers, authors, and integration teams work independently.

***

## Faster Time to Market

Experiences are assembled through configuration.

***

## Enterprise Abstraction

Domain APIs shield experiences from backend system complexity.

***

## Scalability

New experiences can be created without introducing page-specific application code.

***

# 13. Summary

CMX is a configuration-driven experience platform where layouts, reusable React components, orchestration definitions, and published templates combine to generate customer experiences dynamically. The platform separates content authoring from enterprise business data, centralizes backend integrations through Domain APIs and orchestration, and delivers server-side-rendered experiences through a common Customer Experience Application, ensuring consistency between authoring, preview, and runtime while enabling rapid creation of new digital experiences.
