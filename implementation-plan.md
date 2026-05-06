# AssemblerQL — GraphQL Implementation Plan
## C# / HotChocolate

---

## Overview

This document is the implementation plan for the Product Detail Page (PDP) GraphQL API using [HotChocolate](https://chillicream.com/docs/hotchocolate) in C#. The implementation follows the design agreed in the team discussion: the GraphQL response shape requested by the client IS the orchestration — each resolver calls the appropriate downstream microservice API. No custom orchestration config layer is needed.

**Inputs to every query:** `platformId`, `categoryId`, `country`, `language`, `segment`, `microcontent` (array of entry IDs the UI wants to display).

**Downstream microservices (each called independently by its resolver):**
- Platform Content API
- Model Grouping API
- Offers & Pricing API
- Parts / Specs API
- Microcontent API

---

## Phase 1 — Project Setup

### 1.1 Create the solution

```
AssemblerQL/
├── AssemblerQL.Api/          ← HotChocolate GraphQL host
├── AssemblerQL.Domain/       ← Shared types / models
├── AssemblerQL.Resolvers/    ← Resolver classes (one per domain)
├── AssemblerQL.Services/     ← HTTP clients for each microservice
└── AssemblerQL.Tests/        ← Unit + integration tests
```

```bash
dotnet new sln -n AssemblerQL
dotnet new webapi -n AssemblerQL.Api
dotnet new classlib -n AssemblerQL.Domain
dotnet new classlib -n AssemblerQL.Resolvers
dotnet new classlib -n AssemblerQL.Services
dotnet new xunit -n AssemblerQL.Tests
```

### 1.2 NuGet packages

In `AssemblerQL.Api`:

```xml
<PackageReference Include="HotChocolate.AspNetCore" Version="14.*" />
<PackageReference Include="HotChocolate.Data" Version="14.*" />
```

In `AssemblerQL.Services`:

```xml
<PackageReference Include="Microsoft.Extensions.Http" Version="8.*" />
<PackageReference Include="System.Text.Json" Version="8.*" />
```

### 1.3 Register HotChocolate in `Program.cs`

```csharp
builder.Services
    .AddGraphQLServer()
    .AddQueryType<QueryType>()
    .AddType<PlatformType>()
    .AddType<ModelGroupType>()
    .AddType<OfferType>()
    .AddType<MicrocontentType>()
    .AddType<BreadcrumbType>();
```

---

## Phase 2 — Domain Models

Create C# record types in `AssemblerQL.Domain` mirroring the GraphQL schema and the mock data JSON shape. These are the objects resolvers return — HotChocolate maps them to GraphQL types automatically.

### 2.1 Breadcrumb

```csharp
public record BreadcrumbResult(IReadOnlyList<Crumb> Crumbs);
public record Crumb(string Label, string? Url);
```

### 2.2 Platform

```csharp
public record PlatformResult(
    string Id,
    string Name,
    string ModelCode,
    Rating Rating,
    string Description,
    IReadOnlyList<PlatformImage> Images,
    IReadOnlyList<Badge> Badges,
    string OrderCode
);

public record Rating(double Score, int ReviewCount);

public record PlatformImage(string Url, string AltText, int SortOrder, ImageType Type);

public enum ImageType { Hero, Gallery, Thumbnail }

public record Badge(string Label, string ImageUrl);
```

### 2.3 Microcontent

```csharp
public record MicrocontentEntry(string Id, string Key, string Value);
```

### 2.4 Model Groups & Offers

```csharp
public record ModelGroup(
    string Id,
    string Label,
    int SortOrder,
    bool IsDefault,
    string DefaultOfferId,
    IReadOnlyList<Offer> Offers
);

public record Offer(
    string Id,
    string? Name,
    string? Badge,
    bool IsDefault,
    int SortOrder,
    Pricing Pricing,
    IReadOnlyList<Spec> Specs,
    ShippingDetails ShippingDetails
);

public record Pricing(
    decimal CurrentPrice,
    decimal OriginalPrice,
    decimal SavingsAmount,
    decimal MonthlyPayment,
    int MonthlyTerm,
    string MonthlyProvider,
    string MonthlyDetailsUrl,
    string CurrencyCode
);

public record Spec(string SpecKey, string SpecValue, int SortOrder);

public record ShippingDetails(string EstimatedDate, string PostalCode, string DeliveryDatesUrl);
```

---

## Phase 3 — GraphQL Type Definitions

Define HotChocolate ObjectTypes in `AssemblerQL.Resolvers`. Use the **Code-First** approach so type definitions stay close to the C# models.

### 3.1 Root Query

```csharp
public class QueryType : ObjectType
{
    protected override void Configure(IObjectTypeDescriptor descriptor)
    {
        descriptor.Name("Query");

        descriptor
            .Field("breadcrumb")
            .Argument("categoryId", a => a.Type<NonNullType<IdType>>())
            .Argument("platformId", a => a.Type<NonNullType<IdType>>())
            .ResolveWith<BreadcrumbResolver>(r => r.GetBreadcrumb(default!, default!));

        descriptor
            .Field("platform")
            .Argument("platformId", a => a.Type<NonNullType<IdType>>())
            .Argument("country",    a => a.Type<NonNullType<StringType>>())
            .Argument("language",   a => a.Type<NonNullType<StringType>>())
            .Argument("segment",    a => a.Type<NonNullType<StringType>>())
            .ResolveWith<PlatformResolver>(r => r.GetPlatform(default!, default!, default!, default!));

        descriptor
            .Field("microcontent")
            .Argument("ids",      a => a.Type<NonNullType<ListType<NonNullType<IdType>>>>())
            .Argument("country",  a => a.Type<NonNullType<StringType>>())
            .Argument("language", a => a.Type<NonNullType<StringType>>())
            .ResolveWith<MicrocontentResolver>(r => r.GetMicrocontent(default!, default!, default!));

        descriptor
            .Field("modelGroups")
            .Argument("platformId", a => a.Type<NonNullType<IdType>>())
            .Argument("country",    a => a.Type<NonNullType<StringType>>())
            .Argument("segment",    a => a.Type<NonNullType<StringType>>())
            .ResolveWith<ModelGroupResolver>(r => r.GetModelGroups(default!, default!, default!));
    }
}
```

### 3.2 Nested Offers resolver on ModelGroup

Offers are resolved as a child of each ModelGroup. HotChocolate calls the resolver once per ModelGroup instance, passing `country`, `language`, `segment` from the parent query arguments (forwarded via context).

```csharp
public class ModelGroupType : ObjectType<ModelGroup>
{
    protected override void Configure(IObjectTypeDescriptor<ModelGroup> descriptor)
    {
        descriptor
            .Field("offers")
            .Argument("country",  a => a.Type<NonNullType<StringType>>())
            .Argument("language", a => a.Type<NonNullType<StringType>>())
            .Argument("segment",  a => a.Type<NonNullType<StringType>>())
            .ResolveWith<OfferResolver>(r => r.GetOffers(default!, default!, default!, default!));
    }
}
```

> **Note:** To avoid N+1 calls (one Offers API call per model group), use HotChocolate's **DataLoader** pattern — batch all modelGroupIds from a page request into a single Offers API call, then fan out the results.

---

## Phase 4 — Service Clients (HTTP Adapters)

Each microservice gets a typed `HttpClient` registered in DI. Services are responsible for calling the downstream REST/internal API and mapping the response to the domain model. Resolvers call services — they never call HTTP directly.

### 4.1 Interface pattern

```csharp
public interface IPlatformService
{
    Task<PlatformResult> GetPlatformAsync(
        string platformId, string country, string language, string segment,
        CancellationToken ct = default);
}

public interface IModelGroupService
{
    Task<IReadOnlyList<ModelGroup>> GetModelGroupsAsync(
        string platformId, string country, string segment,
        CancellationToken ct = default);
}

public interface IOfferService
{
    Task<IReadOnlyList<Offer>> GetOffersAsync(
        string modelGroupId, string country, string language, string segment,
        CancellationToken ct = default);

    // Batched overload for DataLoader
    Task<IDictionary<string, IReadOnlyList<Offer>>> GetOffersByModelGroupsAsync(
        IReadOnlyList<string> modelGroupIds, string country, string language, string segment,
        CancellationToken ct = default);
}

public interface ISpecService
{
    Task<IReadOnlyList<Spec>> GetSpecsAsync(
        string offerId, CancellationToken ct = default);
}

public interface IMicrocontentService
{
    Task<IReadOnlyList<MicrocontentEntry>> GetMicrocontentAsync(
        IReadOnlyList<string> ids, string country, string language,
        CancellationToken ct = default);
}
```

### 4.2 Mock implementations (Phase 4a — for early dev/testing)

Before real microservices are available, implement each interface as a `MockXxxService` that reads from `pdp_mock_data.json` (committed to the repo under `AssemblerQL.Tests/MockData/`). This lets resolver and integration tests run end-to-end without real APIs.

```csharp
public class MockPlatformService : IPlatformService
{
    private readonly PdpMockData _data; // deserialized from pdp_mock_data.json

    public Task<PlatformResult> GetPlatformAsync(
        string platformId, string country, string language, string segment,
        CancellationToken ct = default)
        => Task.FromResult(_data.Data.Platform);
}
```

Register mocks in `Program.cs` behind a feature flag or environment variable (`USE_MOCK_SERVICES=true`) so real and mock implementations are swappable without code changes.

### 4.3 Real implementations (Phase 4b)

Replace mock services with real `HttpClient`-based implementations once microservice endpoints are available. Use `System.Text.Json` for deserialization. Map microservice DTOs to domain models inside the service — resolvers always receive domain types, never raw API responses.

```csharp
public class PlatformService : IPlatformService
{
    private readonly HttpClient _http;

    public PlatformService(HttpClient http) => _http = http;

    public async Task<PlatformResult> GetPlatformAsync(
        string platformId, string country, string language, string segment,
        CancellationToken ct = default)
    {
        var response = await _http.GetFromJsonAsync<PlatformApiResponse>(
            $"/platforms/{platformId}?country={country}&language={language}&segment={segment}", ct);
        return Map(response!);
    }

    private static PlatformResult Map(PlatformApiResponse r) => new(
        r.Id, r.Name, r.ModelCode,
        new Rating(r.Rating.Score, r.Rating.ReviewCount),
        r.Description,
        r.Images.Select(i => new PlatformImage(i.Url, i.AltText, i.SortOrder,
            Enum.Parse<ImageType>(i.Type, ignoreCase: true))).ToList(),
        r.Badges.Select(b => new Badge(b.Label, b.ImageUrl)).ToList(),
        r.OrderCode
    );
}
```

---

## Phase 5 — Resolvers

Resolvers are thin — they accept arguments, call the relevant service, and return domain objects. Business logic lives in services, not resolvers.

```csharp
public class PlatformResolver
{
    public async Task<PlatformResult> GetPlatform(
        [Service] IPlatformService service,
        string platformId, string country, string language, string segment)
        => await service.GetPlatformAsync(platformId, country, language, segment);
}

public class ModelGroupResolver
{
    public async Task<IReadOnlyList<ModelGroup>> GetModelGroups(
        [Service] IModelGroupService service,
        string platformId, string country, string segment)
        => await service.GetModelGroupsAsync(platformId, country, segment);
}

public class OfferResolver
{
    public async Task<IReadOnlyList<Offer>> GetOffers(
        [Parent] ModelGroup modelGroup,
        [Service] IOfferService service,
        string country, string language, string segment)
        => await service.GetOffersAsync(modelGroup.Id, country, language, segment);
}

public class MicrocontentResolver
{
    public async Task<IReadOnlyList<MicrocontentEntry>> GetMicrocontent(
        [Service] IMicrocontentService service,
        IReadOnlyList<string> ids, string country, string language)
        => await service.GetMicrocontentAsync(ids, country, language);
}

public class BreadcrumbResolver
{
    public async Task<BreadcrumbResult> GetBreadcrumb(
        [Service] IPlatformService platformService,
        string platformId, string categoryId)
        => await platformService.GetBreadcrumbAsync(platformId, categoryId);
}
```

---

## Phase 6 — DataLoader (N+1 Prevention)

The `offers` field is resolved per ModelGroup. Without batching, a page with 2 model groups fires 2 separate Offers API calls. Use a DataLoader to batch them.

```csharp
public class OffersByModelGroupDataLoader
    : BatchDataLoader<string, IReadOnlyList<Offer>>
{
    private readonly IOfferService _service;
    private readonly OfferQueryContext _ctx; // holds country/language/segment

    public OffersByModelGroupDataLoader(
        IBatchScheduler scheduler,
        IOfferService service,
        OfferQueryContext ctx)
        : base(scheduler) { _service = service; _ctx = ctx; }

    protected override async Task<IReadOnlyDictionary<string, IReadOnlyList<Offer>>>
        LoadBatchAsync(IReadOnlyList<string> modelGroupIds, CancellationToken ct)
        => await _service.GetOffersByModelGroupsAsync(
               modelGroupIds, _ctx.Country, _ctx.Language, _ctx.Segment, ct);
}
```

Register `OffersByModelGroupDataLoader` and inject it into `OfferResolver` instead of `IOfferService` directly.

---

## Phase 7 — Error Handling

- Return `null` from resolvers for optional fields if a downstream service returns 404 — do not throw.
- For required fields (e.g., `platform`), throw a `GraphQLException` with a structured error code so the client receives a typed error, not a 500.
- Add a global error filter in HotChocolate to catch unhandled exceptions, log them (with correlation ID), and return sanitized errors to the client.

```csharp
builder.Services
    .AddGraphQLServer()
    ...
    .AddErrorFilter<GlobalErrorFilter>();

public class GlobalErrorFilter : IErrorFilter
{
    public IError OnError(IError error)
    {
        // log error.Exception
        return error.WithMessage("An unexpected error occurred.")
                    .RemoveExtension("stackTrace");
    }
}
```

---

## Phase 8 — Testing

### 8.1 Unit tests (per resolver / service)

- Test each service's mapping logic using the mock JSON as input fixture.
- Test resolvers with mock service implementations.
- Verify `sortOrder` determines default selection (first model group and first offer).

### 8.2 Integration tests

- Spin up a test HotChocolate server with all mock services registered.
- Execute the full `ProductDetailPage` query (as written in `pdp_query.graphql`) against the test server.
- Assert the response JSON matches `pdp_mock_data.json` shape exactly.

```csharp
[Fact]
public async Task ProductDetailPage_ReturnsExpectedShape()
{
    var result = await _testServer.ExecuteAsync(@"
        query ProductDetailPage($platformId: ID!, ...) {
            platform(platformId: $platformId, ...) {
                id name modelCode
                rating { score reviewCount }
                ...
            }
            modelGroups(platformId: $platformId, ...) {
                id label isDefault
                offers(...) {
                    id pricing { currentPrice }
                    specs { specKey specValue sortOrder }
                }
            }
        }",
        variables: new { platformId = "platform-db16250", ... });

    result.ShouldNotHaveErrors();
    // assert specific values from mock data
}
```

---

## Phase 9 — Configuration & Deployment

- All downstream API base URLs go in `appsettings.json` / environment variables — never hardcoded.
- Add a `USE_MOCK_SERVICES` environment variable toggle for local dev and CI.
- Expose the GraphQL endpoint at `/graphql` with the Banana Cake Pop IDE available in `Development` only.
- Add response caching at the HotChocolate layer for `platform` and `microcontent` fields (content changes infrequently); `offers` and `pricing` should not be cached.

---

## Implementation Sequence

| Phase | Work | Depends on |
|-------|------|------------|
| 1 | Solution + project setup | — |
| 2 | Domain models | Phase 1 |
| 3 | GraphQL type definitions | Phase 2 |
| 4a | Mock service implementations | Phase 2 |
| 5 | Resolvers wired to mock services | Phases 3, 4a |
| 8.2 | Integration test with mock data | Phase 5 |
| 4b | Real HTTP service implementations | Phase 4a (swap in) |
| 6 | DataLoader for offer batching | Phase 5 |
| 7 | Error handling | Phase 5 |
| 8.1 | Unit tests | Phases 4b, 5 |
| 9 | Config & deployment | All |

---

## Key Design Decisions

- **Code-First over Schema-First** — type definitions live alongside C# models; no SDL file to keep in sync.
- **Resolvers are thin** — all logic (HTTP calls, mapping, defaults) lives in services.
- **Mock-first development** — the `pdp_mock_data.json` file drives both mock services and integration test assertions, keeping them in sync automatically.
- **Sequence = default** — no special flag needed for default model/offer selection; the API returns items in business-logic order and the first is selected by the client.
- **Microcontent is flat** — all key-value text on the page (promotions, banners, financing, rewards, special offers) is fetched in one `microcontent` resolver call using IDs specified by the UI.
