import { TextLink, type TextLinkProps } from "@auction/ui/lax";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = Omit<TextLinkProps, "children" | "Link" | "chevron"> & {
  /** Screen-reader context after “View all” (e.g. “auctions and sales”). */
  srSuffix?: string;
  children?: ReactNode;
};

/** Canonical “View all” link for a rail or list: ink, underlined, with the kit chevron. */
export function MarketingViewAllLink({
  srSuffix,
  children = "View all",
  className,
  ...linkProps
}: Props) {
  return (
    <TextLink Link={Link} chevron {...linkProps} {...(className ? { className } : {})}>
      <span>{children}</span>
      {srSuffix ? <span className="sr-only"> {srSuffix}</span> : null}
    </TextLink>
  );
}
