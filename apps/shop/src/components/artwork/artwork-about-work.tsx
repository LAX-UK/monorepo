import { EDITION_PAGE_COPY } from "@/content/artwork-edition-copy";
import type { ArtworkAboutVm } from "@/lib/artwork/artwork-product-page.vm";
import { MarketingReadMore, MarketingSpecList } from "@auction/marketing-ui";

/** "About the work and the print": a paragraph that opens with Read more, then the print's rows. */
export function ArtworkAboutWork({ about }: { about: ArtworkAboutVm }) {
  if (!about.description && about.rows.length === 0) return null;
  return (
    <section className="shop-edition-about" aria-labelledby="about-work-heading">
      <h2 id="about-work-heading" className="shop-edition-section__title">
        {EDITION_PAGE_COPY.aboutWorkTitle}
      </h2>
      {about.description ? (
        <MarketingReadMore>
          <p className="shop-edition-about__prose">{about.description}</p>
        </MarketingReadMore>
      ) : null}
      <MarketingSpecList items={about.rows} />
    </section>
  );
}
