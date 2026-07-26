# Resilient Catalog Example

This example shows one cohesive React + TypeScript implementation that remains usable with narrow viewports, long translated content, missing/slow images, async states, and keyboard input. Adapt it to the repository's existing router, data layer, styling, and component primitives.

## Contents

- Behavior contract
- `CatalogPage.tsx`
- `CatalogPage.module.css`
- Why these choices matter
- Acceptance cases

## Behavior contract

- Product names and seller names are essential and wrap; they are not silently line-clamped or hidden behind hover-only disclosure.
- The grid never forces a card below the available container width.
- Media reserves space and has an error fallback.
- Loading, empty, error, and success are explicit states.
- Controls remain semantic and keyboard-usable.
- The page does not hide horizontal overflow to disguise a defect.

## `CatalogPage.tsx`

```tsx
import { useDeferredValue, useMemo, useRef, useState } from 'react';
import styles from './CatalogPage.module.css';

type PriceState =
  | { status: 'loading' }
  | { status: 'error'; message: string; onRetry: () => void }
  | { status: 'available'; formatted: string };

type ImageLoading = {
  loading: 'eager' | 'lazy';
  fetchPriority: 'high' | 'auto';
};

type Product = {
  id: string;
  name: string;
  seller: string;
  price: PriceState;
  imageUrl: string | null;
  imageAlt: string;
  badge?: string;
};

type CatalogState =
  | { status: 'loading' }
  | { status: 'error'; message: string; onRetry: () => void }
  | { status: 'empty' }
  | { status: 'success'; products: readonly Product[] };

type CatalogPageProps = {
  state: CatalogState;
  getImageLoading: (product: Product, index: number) => ImageLoading;
  onOpenProduct: (productId: string) => void;
};

const priceFormatterCache = new Map<string, Intl.NumberFormat>();

function createPriceState(
  value: number,
  currency: string,
  onRetry: () => void,
): PriceState {
  try {
    let formatter = priceFormatterCache.get(currency);

    if (!formatter) {
      formatter = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency,
      });
      priceFormatterCache.set(currency, formatter);
    }

    return { status: 'available', formatted: formatter.format(value) };
  } catch {
    return {
      status: 'error',
      message: 'Price could not be formatted',
      onRetry,
    };
  }
}

export function CatalogPage({ state, getImageLoading, onOpenProduct }: CatalogPageProps) {
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);

  if (state.status === 'loading') {
    return <CatalogSkeleton />;
  }

  if (state.status === 'error') {
    return (
      <main className={styles.page}>
        <section className={styles.feedback} aria-labelledby="catalog-error-title">
          <p className={styles.eyebrow}>Catalog unavailable</p>
          <h1 id="catalog-error-title">Products could not be loaded</h1>
          <p>{state.message}</p>
          <button type="button" onClick={state.onRetry}>
            Retry
          </button>
        </section>
      </main>
    );
  }

  if (state.status === 'empty') {
    return (
      <main className={styles.page}>
        <section className={styles.feedback} aria-labelledby="catalog-empty-title">
          <p className={styles.eyebrow}>Curated collection</p>
          <h1 id="catalog-empty-title">No products are available yet</h1>
          <p>Return later when the next collection has been published.</p>
        </section>
      </main>
    );
  }

  return (
    <CatalogResults
      products={state.products}
      query={query}
      deferredQuery={deferredQuery}
      getImageLoading={getImageLoading}
      onQueryChange={setQuery}
      onOpenProduct={onOpenProduct}
    />
  );
}

type CatalogResultsProps = {
  products: readonly Product[];
  query: string;
  deferredQuery: string;
  getImageLoading: (product: Product, index: number) => ImageLoading;
  onQueryChange: (value: string) => void;
  onOpenProduct: (productId: string) => void;
};

function CatalogResults({
  products,
  query,
  deferredQuery,
  getImageLoading,
  onQueryChange,
  onOpenProduct,
}: CatalogResultsProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const filteredProducts = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLocaleLowerCase();

    if (!normalizedQuery) {
      return products;
    }

    return products.filter((product) =>
      `${product.name} ${product.seller}`
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  }, [deferredQuery, products]);

  const priceSummary = useMemo(
    () =>
      filteredProducts.reduce(
        (summary, product) => ({
          loading: summary.loading + (product.price.status === 'loading' ? 1 : 0),
          errors: summary.errors + (product.price.status === 'error' ? 1 : 0),
        }),
        { loading: 0, errors: 0 },
      ),
    [filteredProducts],
  );
  const priceStatusLabel = priceSummary.errors
    ? `${priceSummary.errors} prices could not be loaded`
    : priceSummary.loading
      ? `Loading ${priceSummary.loading} prices`
      : '';

  const resultLabel = `${filteredProducts.length} ${
    filteredProducts.length === 1 ? 'product' : 'products'
  }`;

  const cardLoading = useMemo(
    () => filteredProducts.map((product, index) => ({
      product,
      imageLoading: getImageLoading(product, index),
    })),
    // Hosts should pass a stable getImageLoading (e.g. via useCallback or a ref).
    // The dep is intentionally [filteredProducts] to keep identity stable even
    // when the host passes an inline lambda; the host accepts the stale policy
    // for the filtered view until the next list change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredProducts],
  );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Independent makers</p>
          <h1>Objects with a traceable hand</h1>
          <p className={styles.intro}>
            A catalog of durable home goods with clear provenance and material detail.
          </p>
        </div>

        <label className={styles.search}>
          <span>Search products or sellers</span>
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.currentTarget.value)}
            placeholder="Try ceramic or Aoki Studio"
          />
        </label>
      </header>

      <div className={styles.resultBar}>
        <p aria-live="polite">{resultLabel}</p>
      </div>
      {priceStatusLabel ? (
        <p className={styles.srOnly} role="status">{priceStatusLabel}</p>
      ) : null}

      {filteredProducts.length === 0 ? (
        <section className={styles.noResults} aria-labelledby="no-results-title">
          <h2 id="no-results-title">No matching products</h2>
          <p>Try a shorter product or seller name.</p>
          <button
            type="button"
            onClick={() => {
              onQueryChange('');
              requestAnimationFrame(() => searchInputRef.current?.focus());
            }}
          >
            Clear search
          </button>
        </section>
      ) : (
        <ul className={styles.grid} aria-label="Product catalog">
          {cardLoading.map(({ product, imageLoading }) => (
            <li key={product.id}>
              <ProductCard
                product={product}
                imageLoading={imageLoading}
                onOpen={onOpenProduct}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

type ProductCardProps = {
  product: Product;
  imageLoading: ImageLoading;
  onOpen: (productId: string) => void;
};

function ProductCard({ product, imageLoading, onOpen }: ProductCardProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const imageFailed = product.imageUrl !== null && failedImageUrl === product.imageUrl;

  return (
    <article className={styles.card}>
      <div className={styles.media}>
        {product.badge ? <span className={styles.badge}>{product.badge}</span> : null}

        {product.imageUrl && !imageFailed ? (
          <img
            src={product.imageUrl}
            alt={product.imageAlt}
            width="640"
            height="480"
            loading={imageLoading.loading}
            fetchPriority={imageLoading.fetchPriority}
            decoding="async"
            onError={() => setFailedImageUrl(product.imageUrl)}
          />
        ) : (
          <div className={styles.imageFallback} role="img" aria-label="Image unavailable">
            <span aria-hidden="true">◇</span>
          </div>
        )}
      </div>

      <div className={styles.cardBody}>
        <div className={styles.cardCopy}>
          <h2>{product.name}</h2>
          <p className={styles.seller}>{product.seller}</p>
        </div>

        <div className={styles.cardFooter}>
          {product.price.status === 'loading' ? (
            <p className={styles.price}>Loading price</p>
          ) : product.price.status === 'error' ? (
            <div className={styles.priceError}>
              <p>{product.price.message}</p>
              <button type="button" onClick={product.price.onRetry}>Retry price</button>
            </div>
          ) : (
            <p className={styles.price}>{product.price.formatted}</p>
          )}

          <button
            type="button"
            onClick={() => onOpen(product.id)}
            aria-label={`View ${product.name} by ${product.seller}`}
          >
            View object
          </button>
        </div>
      </div>
    </article>
  );
}

function CatalogSkeleton() {
  return (
    <main className={styles.page} aria-busy="true" aria-label="Loading catalog">
      <div className={styles.skeletonHeader} aria-hidden="true" />
      <ul className={styles.grid} aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <li key={index} className={styles.skeletonCard} />
        ))}
      </ul>
      <p className={styles.srOnly} role="status">
        Loading products
      </p>
    </main>
  );
}
```

## `CatalogPage.module.css`

```css
.page,
.page *,
.page *::before,
.page *::after {
  box-sizing: border-box;
}

.page {
  --page-gutter: clamp(1rem, 4vw, 4rem);
  --content-max: 90rem;
  inline-size: min(calc(100% - 2 * var(--page-gutter)), var(--content-max));
  margin-inline: auto;
  padding-block: clamp(1.5rem, 4vw, 4rem);
}

.header {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(16rem, 0.5fr);
  gap: clamp(1.5rem, 5vw, 6rem);
  align-items: end;
  padding-block-end: clamp(2rem, 5vw, 5rem);
  border-block-end: 1px solid var(--color-border, #c8c3b8);
}

.header h1 {
  max-inline-size: 13ch;
  margin: 0;
  font: 600 clamp(2.5rem, 7vw, 6.75rem) / 0.93 var(--font-display, Georgia, serif);
  letter-spacing: -0.045em;
  text-wrap: balance;
}

.eyebrow {
  margin: 0 0 0.75rem;
  color: var(--color-muted, #665f52);
  font: 700 0.75rem / 1.2 var(--font-utility, system-ui, sans-serif);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.intro {
  max-inline-size: 58ch;
  margin-block: 1.25rem 0;
  color: var(--color-muted, #665f52);
  font: 400 clamp(1rem, 1.5vw, 1.2rem) / 1.6 var(--font-body, system-ui, sans-serif);
}

.search {
  display: grid;
  gap: 0.5rem;
  min-inline-size: 0;
  font: 650 0.82rem / 1.2 var(--font-utility, system-ui, sans-serif);
}

.search input {
  inline-size: 100%;
  min-inline-size: 0;
  min-block-size: 2.75rem;
  padding-inline: 0.85rem;
  border: 1px solid var(--color-border, #8b8478);
  border-radius: 0;
  color: inherit;
  background: transparent;
}

.search input:focus-visible,
.card button:focus-visible,
.feedback button:focus-visible,
.noResults button:focus-visible {
  outline: 3px solid var(--color-focus, #155eef);
  outline-offset: 3px;
}

.resultBar {
  display: flex;
  justify-content: flex-end;
  padding-block: 1rem;
  color: var(--color-muted, #665f52);
  font: 600 0.78rem / 1.2 var(--font-utility, system-ui, sans-serif);
}

.resultBar p,
.price {
  margin: 0;
  font-variant-numeric: tabular-nums;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
  gap: clamp(1rem, 2.5vw, 2rem);
  margin: 0;
  padding: 0;
  list-style: none;
}

.grid > li {
  min-inline-size: 0;
}

.card {
  block-size: 100%;
  display: grid;
  grid-template-rows: auto 1fr;
  border-block-start: 1px solid var(--color-border, #c8c3b8);
}

.media {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: var(--color-subtle, #e9e5dc);
}

.media img {
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
  transition: transform 180ms ease;
}

.card:has(button:hover) .media img {
  transform: scale(1.025);
}

.badge {
  position: absolute;
  z-index: 1;
  inset-block-start: 0.75rem;
  inset-inline-start: 0.75rem;
  max-inline-size: calc(100% - 1.5rem);
  padding: 0.4rem 0.55rem;
  color: #fff;
  background: #253629;
  font: 700 0.7rem / 1.1 var(--font-utility, system-ui, sans-serif);
  overflow-wrap: anywhere;
}

.imageFallback {
  block-size: 100%;
  display: grid;
  place-items: center;
  color: var(--color-muted, #665f52);
  font-size: 3rem;
}

.cardBody {
  min-inline-size: 0;
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 1.25rem;
  padding-block: 1rem 0.5rem;
}

.cardCopy {
  min-inline-size: 0;
}

.card h2 {
  margin: 0;
  font: 600 clamp(1.1rem, 2vw, 1.45rem) / 1.18 var(--font-display, Georgia, serif);
  overflow-wrap: anywhere;
}

.seller {
  max-inline-size: 100%;
  margin: 0.5rem 0 0;
  color: var(--color-muted, #665f52);
  font: 400 0.9rem / 1.4 var(--font-body, system-ui, sans-serif);
  overflow-wrap: anywhere;
}

.cardFooter {
  min-inline-size: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1rem;
  align-items: center;
  justify-content: space-between;
}

.price {
  font: 700 0.95rem / 1 var(--font-utility, system-ui, sans-serif);
}

.priceError {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.priceError p {
  margin: 0;
  color: var(--color-error, #a12020);
}

.card button,
.feedback button,
.noResults button {
  min-block-size: 2.75rem;
  padding-inline: 1rem;
  border: 1px solid currentColor;
  color: inherit;
  background: transparent;
  font: 700 0.78rem / 1 var(--font-utility, system-ui, sans-serif);
  cursor: pointer;
}

.card button:hover,
.feedback button:hover,
.noResults button:hover {
  color: #fff;
  background: #1f1e1a;
}

.feedback,
.noResults {
  max-inline-size: 42rem;
  padding-block: clamp(3rem, 12vw, 9rem);
}

.feedback h1,
.noResults h2 {
  margin: 0;
  font: 600 clamp(2rem, 5vw, 4rem) / 1 var(--font-display, Georgia, serif);
}

.skeletonHeader,
.skeletonCard {
  background: #e7e3da;
  animation: pulse 1.3s ease-in-out infinite alternate;
}

.skeletonHeader {
  block-size: clamp(12rem, 30vw, 24rem);
  margin-block-end: 2rem;
}

.skeletonCard {
  min-block-size: 24rem;
}

.srOnly {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@keyframes pulse {
  from { opacity: 0.55; }
  to { opacity: 1; }
}

@media (max-width: 48rem) {
  .header {
    grid-template-columns: minmax(0, 1fr);
    align-items: start;
  }

  .header h1 {
    max-inline-size: 11ch;
  }
}

@media (prefers-reduced-motion: reduce) {
  .media img,
  .skeletonHeader,
  .skeletonCard {
    transition: none;
    animation: none;
  }
}
```

## Why these choices matter

- `minmax(min(100%, 17rem), 1fr)` preserves the intended card minimum when space permits but never exceeds the container at narrow widths.
- Grid/flex children use `min-inline-size: 0`, and essential product/seller text uses `overflow-wrap: anywhere`, so intrinsic text cannot force page overflow or become available only on hover.
- Media has explicit intrinsic dimensions and an aspect ratio, reducing layout shift.
- The image fallback appears for absent URLs and the specific failed URL; a refreshed URL under the same product identity is attempted normally.
- Per-product price state covers loading, error/retry, and available values instead of blocking the whole catalog.
- `useDeferredValue` keeps typing responsive for a moderate client-side list without inventing a timer. Large datasets should move filtering to indexed/server data or measured virtualization.
- Search-result actions restore focus deliberately when clearing removes the focused button; a host app should apply the same rule if filtering removes a focused product.
- The formatter cache avoids recreating `Intl.NumberFormat` for each card, preserves each currency's native fraction digits, and falls back safely if unvalidated data contains an unsupported code.
- Per-product price state covers loading, error/retry, and available values; formatter failures become the same `error` state rather than silently masquerading as a formatted price.
- Live-region announcements stay aggregate (single per-page status about price loading/errors) so 200 cards do not flood screen readers; price errors are announced deliberately while prices load.
- The primary product action is independent of price state, so latency in price data does not block navigation.
- Image priority comes from a host-supplied policy (`getImageLoading`) based on the rendered composition and measured LCP, not from a hard-coded index cutoff. `CatalogResults` memoizes the resolved `ImageLoading` objects with the filtered list (keyed on `filteredProducts` only) so each card receives a stable reference across renders; hosts should still pass a stable `getImageLoading` (for example, via `useCallback` or a module-level function) for the policy to update alongside filter changes.
- `minmax(min(100%, 17rem), 1fr)` preserves the intended card minimum when space permits but never exceeds the container at narrow widths.
- Grid/flex children use `min-inline-size: 0`, and essential product/seller text uses `overflow-wrap: anywhere`, so intrinsic text cannot force page overflow or become available only on hover.
- Media has explicit intrinsic dimensions and an aspect ratio, reducing layout shift.
- The image fallback appears for absent URLs and the specific failed URL; a refreshed URL under the same product identity is attempted normally.
- `useDeferredValue` keeps typing responsive for a moderate client-side list without inventing a timer. Large datasets should move filtering to indexed/server data or measured virtualization.
- Search-result actions restore focus deliberately when clearing removes the focused button; a host app should apply the same rule if filtering removes a focused product.
- The formatter cache avoids recreating `Intl.NumberFormat` for each card, preserves each currency's native fraction digits, and converts an unvalidated/unsupported currency into the explicit error branch instead of rendering an availability message.
- The skeleton is a single busy region with one status announcement; visual skeleton cells are hidden from assistive technology.
- Motion is small, purposeful, and removed under reduced-motion preference.

## Acceptance cases

Run the real page with:

1. 320 × 568, 375 × 812, 768 × 1024, 1280 × 720, 1440 × 900, and 2560 × 1440.
2. Widths immediately below/above 48rem.
3. A 120-character translated product name and seller name.
4. A 300-character unbroken product token.
5. Missing image URL, broken image URL, portrait image, and slow image.
6. Zero, one, 200, and the product's realistic maximum item count.
7. Loading, error, retry, empty, no-search-results, and success.
8. Keyboard-only search, clear, card activation, and focus visibility.
9. Reduced motion.
10. Production profiling if the realistic product count creates interaction or scroll cost.
11. Verify that with 200 pending prices and later errors there is one aggregate live-region announcement, not 200 status regions, and that an asynchronous price failure is announced.
12. Verify that "View object" remains available while prices are loading or have errored.
13. Verify that the eager image set comes from the host's layout-based policy, not from a hard-coded count.

The example is **Implemented — validation pending** until those checks are executed in its actual host application. The skill version is 1.3.
