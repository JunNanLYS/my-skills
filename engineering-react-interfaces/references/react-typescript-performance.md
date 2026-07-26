# React, TypeScript, and Performance

Use this reference when implementing React components, hooks, data flows, large lists, media-heavy pages, route bundles, or performance-sensitive interactions.

## Contents

- Project-fit rules
- Component architecture
- TypeScript contract
- State and async modeling
- Effects
- Rendering and identity
- Lists and virtualization
- Network, media, and bundle performance
- CSS and animation performance
- Measurement workflow
- Testing matrix
- Common mistakes

## Project-fit rules

Inspect the repository before choosing patterns:

- React/version and rendering mode (client, SSR, streaming, server components where relevant).
- Router, data-fetching layer, state management, styling method, component library, tests, linting, build tool, and browser support.
- Existing design tokens, primitives, error handling, analytics, and feature boundaries.

Follow established conventions when they are healthy. Do not introduce a new global store, styling system, form library, animation package, icon package, or component library for one feature without evidence that existing tools cannot meet the requirement.

## Component architecture

Organize by user-visible responsibility and change boundary, not by forcing every component under an arbitrary line count.

A useful feature shape when the repository has no stronger convention:

```text
features/catalog/
  api/
  components/
  hooks/
  model/
  routes/
  tests/
```

Rules:

- Keep route/page components focused on composition and orchestration.
- Extract a component when it has a meaningful contract, reuse, independent state, independent testing value, or reduces cognitive load.
- Keep closely related markup and state together; excessive fragmentation obscures flow.
- Prefer composition over boolean-prop explosions.
- Keep domain types near the domain; do not create global dumping-ground type files.
- Import concrete modules unless the project deliberately uses safe barrel exports.

## TypeScript contract

Keep strict mode and make invalid states hard to represent.

Type explicitly at boundaries:

- Component props and reusable render callbacks.
- API input/output after runtime validation.
- Public hooks and utilities.
- Events when inference is not obvious.
- Reducer actions and state machines.
- CSS custom properties passed through `style` when needed.

Allow obvious local inference. Requiring annotations on every local constant adds noise without safety.

Avoid:

- `any`, broad `object`, and unbounded `Record<string, unknown>` leaking into the UI.
- Non-null assertions used to silence lifecycle uncertainty.
- Double assertions such as `value as unknown as T`.
- Optional-property collections that permit impossible combinations.
- Treating API data as trusted merely because it has a TypeScript interface.

Model UI states as a discriminated union:

```ts
type ResourceState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'empty' }
  | { status: 'error'; message: string; retryable: boolean };
```

If stale data remains visible during refetch, model that state explicitly rather than conflating it with first load.

## State and async modeling

Choose the narrowest owner:

1. Derive from props/data during render when possible.
2. Local component state for local interaction.
3. URL state for navigation, filters, selection, and shareable views.
4. Server-state library/cache for remote data lifecycle.
5. Context for stable cross-tree concerns.
6. Global client store only for genuinely shared, frequently changing client state.

Do not synchronize duplicate state with effects. Derived state drifts.

For async work:

- Validate responses at the system boundary when data is untrusted.
- Handle abort/cancellation and stale responses.
- Keep prior data during refetch only when the UX calls for it.
- Define initial loading, empty, partial, error, retry, and success states.
- Disable or deduplicate destructive submissions while pending.
- Use optimistic updates only with rollback and conflict behavior.
- Ensure controls that appear functional actually change state/data or navigate.

## Effects

Effects synchronize React with external systems. They are not a generic place to calculate data.

Before writing an effect, ask whether the value can be:

- Calculated during render.
- Computed in an event handler.
- Encapsulated by the data/router/form library already in use.
- Represented by a key or component boundary reset.

For every effect:

- Dependencies are complete.
- Setup and cleanup are symmetrical.
- Async work cannot write stale state after unmount or parameter change.
- Subscriptions are not duplicated in development Strict Mode.
- The effect does not create a render loop or duplicate source of truth.

## Rendering and identity

Correctness first:

- Render is pure.
- Keys represent stable domain identity.
- Event handlers do not accidentally execute during render.
- Context values do not change identity needlessly in hot trees.
- State is placed low enough to avoid invalidating unrelated regions.

Optimize based on measured work:

- `memo` helps when a component rerenders often with equal props and meaningful render cost.
- `useMemo` helps when a calculation is measurably expensive or stable identity is required by a dependency.
- `useCallback` helps when function identity affects a memoized child or external subscription.
- None of these guarantee speed; all add code and comparison/allocation costs.

Use React Profiler or framework tooling to confirm the hot path before and after.

## Lists and virtualization

Use realistic data volumes.

| Size/behavior | Likely strategy |
|---|---|
| Small list | Render normally; keep keys stable |
| Hundreds of simple items | Measure; pagination or `content-visibility` may suffice |
| Large/expensive list | Virtualize or paginate |
| Variable-height interactive rows | Use a mature virtualizer with measurement/focus support |
| SEO/print/find-in-page critical | Consider pagination or progressive rendering over virtualization |

Virtualization affects keyboard navigation, focus restoration, screen readers, sticky elements, dynamic row heights, browser find, printing, and testing. Do not hand-roll it casually. Use an existing project dependency or a mature library when justified.

`content-visibility: auto` reduces rendering work for offscreen content but does not reduce DOM size, event/listener cost, memory, or all accessibility concerns. Supply a defensible intrinsic size and verify scroll stability.

## Network, media, and bundle performance

### Network/data

- Avoid request waterfalls that can run in parallel.
- Cache and deduplicate according to data freshness, not arbitrary durations.
- Debounce only interactions that benefit from delayed work; cancellation still matters.
- Keep loading feedback proportional to actual latency.
- Do not simulate “realistic async data” in production code unless the task is explicitly a prototype.

### Images/fonts

- Reserve dimensions to prevent CLS.
- Request images near their rendered size; use `srcset`/`sizes` or framework image facilities.
- Lazy-load offscreen images, not likely LCP imagery.
- Prefer efficient formats supported by the pipeline.
- Preload only genuinely critical assets.
- Subset and limit font weights/styles; use a deliberate `font-display` strategy.
- Verify fallback-font metrics and avoid invisible text.

### Bundle

- Inspect the production build and compare with the existing baseline/budget.
- Lazy-load route/feature code that is not needed for the initial interaction.
- Import package subpaths only when supported and beneficial.
- Avoid duplicate libraries and entire icon/chart/utility packages for a few primitives.
- Consider server rendering/streaming boundaries in frameworks that support them; do not move client-only code across boundaries accidentally.

A raw bundle number without baseline, route context, caching, and compression is an observation, not a verdict.

## CSS and animation performance

- Prefer transform/opacity animation; avoid repeatedly animating layout and paint-heavy properties.
- Avoid large blurred shadows, filters, backdrop filters, and huge fixed backgrounds in scrolling hot paths unless measured.
- Do not apply `will-change` permanently to every interactive element. It can increase memory and layer cost.
- Keep CSS selectors and layout containment understandable. Aggressive containment can break sticky positioning, sizing, and overlays.
- Prevent layout thrashing: batch reads/writes and avoid repeated synchronous geometry measurement in loops.
- Respect reduced motion and pause non-essential animation when offscreen.

## Measurement workflow

1. **Define the scenario:** route, data volume, device/CPU/network assumptions, interaction.
2. **Capture baseline:** production build, route bundle, Core Web Vitals or equivalent, profiler trace for the target interaction.
3. **Form one hypothesis:** identify the main cost.
4. **Make the smallest change.**
5. **Repeat the same measurement.**
6. **Keep the optimization only if the result improves without breaking UX/accessibility.**

Useful evidence categories:

- Build/type/lint/test results.
- Initial and route chunk sizes, compressed where tooling provides it.
- LCP, CLS, INP and long tasks for representative loading/interaction flows.
- React commit counts/durations for the hot interaction.
- DOM node count and memory only when relevant.
- Scroll behavior with realistic list size.
- Network request count, waterfall, transfer size, cache behavior.

Do not claim an exact frame-time or Web Vitals threshold passed without actually measuring it.

## Testing matrix

Prefer user-observable tests:

- Unit tests for pure formatting, validation, reducers, and domain transforms.
- Component/integration tests with role/name queries and real user events.
- Network mocks at the request boundary when needed; verify loading/error/retry behavior.
- Browser/end-to-end tests for navigation, responsive composition, focus, overlays, and critical workflows.
- Visual regression for stable high-value surfaces where infrastructure exists.
- Performance tests/benchmarks only for identified budgets and regressions.

Test cases include:

- Empty, loading, partial, error, retry, success.
- Rapid parameter changes and stale response prevention.
- Double submit and interrupted navigation.
- Long/translated content and missing media.
- Keyboard path and focus restoration.
- Narrow/breakpoint/wide layouts.

## Common mistakes

| Mistake | Consequence | Better approach |
|---|---|---|
| Copy props into state | Sources diverge | Derive or model an explicit edit buffer |
| Fetch in every leaf | Waterfalls, duplicate state | Use route/server-state boundary |
| Memoize every component | Complexity and comparison overhead | Profile and target hot work |
| Index keys | State follows position, not item | Stable domain ID |
| Ignore rejected promises | Stuck loading or silent failure | Explicit error/retry state |
| Fire-and-forget effect | Stale writes and leaks | Abort/ignore stale result with cleanup |
| Render thousands “because React is fast” | DOM/layout/interaction cost | Measure, paginate, virtualize |
| Lazy-load the hero image | Worse LCP | Prioritize likely LCP media |
| `will-change` on all cards | Memory/layer pressure | Add only to measured transition hot paths |
| Build succeeds, so performance passed | No runtime evidence | Production measurement in realistic scenario |
