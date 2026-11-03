"use client";

import { MarketingChevronDownIcon } from "@auction/marketing-ui";
import { useMinWidthMd } from "@auction/ui/hooks/use-media-query";
import { type ReactNode, useState } from "react";

type Props = {
  children: ReactNode;
};

/**
 * The long reading on an edition page: one "More about this edition" disclosure on phones, so the
 * price, facts and actions stay near the top. From tablet width, and before the width is known
 * (server render, no JavaScript), the content is always open and the summary is hidden.
 */
export function ArtworkMoreAbout({ children }: Props) {
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
      <div className="shop-more-about__body">{children}</div>
    </details>
  );
}
