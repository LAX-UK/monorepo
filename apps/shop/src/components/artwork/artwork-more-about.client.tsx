"use client";

import { EDITION_PAGE_COPY } from "@/content/artwork-edition-copy";
import { MarketingChevronDownIcon } from "@auction/marketing-ui";
import { useMinWidthMd } from "@auction/ui/hooks/use-media-query";
import { type ReactNode, useState } from "react";

type Props = {
  /** What a limited edition is; shown first, as "About limited editions". */
  statement?: string | null | undefined;
  children?: ReactNode;
};

/**
 * The long reading on an edition page: one "More about this edition" disclosure on phones, so the
 * price, facts and actions stay near the top. From tablet width, and before the width is known
 * (server render, no JavaScript), the content is always open and the summary is hidden.
 */
export function ArtworkMoreAbout({ statement, children }: Props) {
  const wide = useMinWidthMd();
  const [openOnPhone, setOpenOnPhone] = useState(false);
  const open = wide !== false || openOnPhone;

  return (
    <details
      className="shop-more-about"
      open={open}
      onToggle={(event) => {
        if (wide === false) setOpenOnPhone(event.currentTarget.open);
      }}
    >
      <summary className="shop-disclosure__summary shop-more-about__summary shop-focus-ring">
        More about this edition
        <MarketingChevronDownIcon className="shop-disclosure__icon" />
      </summary>
      <div className="shop-more-about__body">
        {statement ? (
          <section className="shop-edition-about" aria-labelledby="about-limited-editions-heading">
            <h2 id="about-limited-editions-heading" className="shop-edition-section__title">
              {EDITION_PAGE_COPY.explainerTitle}
            </h2>
            <p className="shop-edition-about__prose">{statement}</p>
          </section>
        ) : null}
        {children}
      </div>
    </details>
  );
}
