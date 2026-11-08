import { EDITION_PAGE_COPY } from "@/content/artwork-edition-copy";
import type { ArtworkFactsVm } from "@/lib/artwork/artwork-product-page.vm";
import { FOCUS_RING } from "@auction/branding";
import { MarketingArrowUpRightIcon, MarketingSpecList } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import Link from "next/link";

/**
 * "About this edition", always open: the run, signature, number, certificate and any kept proofs
 * as label-value rows, the other runs of the same image and the way to
 * the original. What a limited edition is lives in `ArtworkEditionExplainer`, after this block. Every sentence about the edition is written by shop-domain.
 */
export function ArtworkEditionFacts({ facts }: { facts: ArtworkFactsVm }) {
  return (
    <section className="shop-edition-facts" aria-labelledby="edition-facts-heading">
      <h2 id="edition-facts-heading" className="shop-edition-section__title">
        {EDITION_PAGE_COPY.factsTitle}
      </h2>
      <MarketingSpecList items={facts.rows} />

      {facts.alsoAvailable.length > 0 ? (
        <div className="shop-edition-facts__also">
          <h3 className="shop-edition-facts__also-title">{EDITION_PAGE_COPY.alsoAvailableTitle}</h3>
          <ul className="shop-edition-facts__also-list">
            {facts.alsoAvailable.map((other) => (
              <li key={other.slug}>
                <Link href={other.href} className={cn("shop-inline-link", FOCUS_RING)}>
                  {other.label}
                </Link>
                {other.trailing ? (
                  <>
                    <span aria-hidden="true"> · </span>
                    <span className="shop-edition-facts__also-trailing">{other.trailing}</span>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {facts.originalOnArtHref ? (
        <a
          href={facts.originalOnArtHref}
          className={cn("shop-edition-facts__original", FOCUS_RING)}
        >
          {EDITION_PAGE_COPY.originalLink}
          <MarketingArrowUpRightIcon className="shop-edition-facts__original-icon" />
        </a>
      ) : null}
    </section>
  );
}
