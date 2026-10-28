import type { ArtworkKeyFactVm } from "@/lib/artwork/artwork-product-page.vm";

/** Edition, size and technique side by side under the title, so the essentials read at a glance. */
export function ArtworkKeyFacts({ facts }: { facts: readonly ArtworkKeyFactVm[] }) {
  if (facts.length === 0) return null;
  return (
    <dl className="shop-key-facts" data-count={facts.length}>
      {facts.map((fact) => (
        <div key={fact.label} className="shop-key-facts__item">
          <dt className="shop-key-facts__label">{fact.label}</dt>
          <dd className="shop-key-facts__value">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
