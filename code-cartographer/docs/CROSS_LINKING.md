# Cross-linking UI calls to API routes

The cross-link engine produces `http-call` edges from `ng-service` (or
`ng-component` if a component bypasses a service) nodes to `dotnet-action`
or `dotnet-endpoint` nodes.

## UI side — extracting the request

For every `HttpClient.<verb>(url, ...)` call, we extract:

- **verb**: `get` | `post` | `put` | `delete` | `patch` | `head` | `options`
- **url**: the resolved URL pattern. Resolution handles:
  - String literals: `'api/orders'`
  - Template literals: `` `api/orders/${id}` `` → `api/orders/:id`
  - Concatenation: `'api/orders/' + id` → `api/orders/:id`
  - String constants imported from a sibling `*.constants.ts` (resolved via
    the TypeScript symbol table)
  - Environment-prefixed URLs: `${environment.apiBase}/orders` → `/orders`
- **payload type**: from the second argument's inferred TS type
- **response type**: from `<T>` generic (e.g. `http.get<Order[]>`)

## API side — composing the route template

For every action method on a `ControllerBase`-derived class (or class with
`[ApiController]`):

1. Start with the controller-level `[Route("...")]`. If it uses tokens like
   `[controller]`, replace with the controller's name minus `Controller`.
2. Append the action-level `[HttpVerb("...")]` template (or `[Route("...")]`).
3. Replace `{id}`, `{slug:int}`, etc. with `:id`, `:slug`.
4. Lower-case for matching.

For minimal APIs:

- `app.MapGet("/orders/{id}", handler)` → verb=`GET`, route=`/orders/:id`,
  handler= the resolved method symbol.

## Matching

UI URL `api/orders/:id` (verb `GET`) matches API route `/api/orders/:id`
(verb `GET`) by:

1. Normalising both to lower-case.
2. Stripping leading slashes.
3. Replacing parameter tokens with a wildcard placeholder.
4. Comparing path segments one-to-one.
5. If multiple API routes match (e.g. one with `:id` and one without), pick
   the most specific (fewer wildcards) and break ties by declaration order.

## Confidence score

Each `http-call` edge carries a `confidence` in `[0, 1]`:

| Score | Meaning |
|---|---|
| 1.0 | Both URL and verb resolved at compile time and matched a unique route. |
| 0.8 | URL resolved; multiple routes matched, picked the most specific. |
| 0.6 | URL was a template literal with one dynamic segment. |
| 0.4 | URL was concatenation; we inferred the dynamic part as `:param`. |
| 0.2 | URL is fully dynamic (e.g. comes from a function param). Edge is recorded but flagged. |

The UI exposes the score so you can audit tricky links.

## Known limitations (current implementation)

- We don't (yet) follow URL constants across multiple files when the constant
  is re-exported through a barrel.
- We don't resolve `HttpClient` calls hidden behind a custom wrapper unless
  the wrapper itself is detected as a `ng-service` and we trace its callers.
- Open API import (MVP-5.4) will eventually replace the controller-side
  reverse-engineering with the canonical spec.
