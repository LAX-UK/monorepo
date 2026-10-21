import { cn } from "@auction/ui";
import Link from "next/link";
import {
  MarketingSubNavAnchor,
  type MarketingSubNavAnchorProps,
} from "./marketing-sub-nav-anchor.js";
import {
  MARKETING_UNDERLINE_TAB,
  MARKETING_UNDERLINE_TAB_ACTIVE,
  MARKETING_UNDERLINE_TAB_LIST,
} from "./marketing-underline-tab.js";

export type MarketingSubNavLinkItem = {
  id: string;
  label: string;
  href: string;
};

export type MarketingSubNavLinkProps = {
  mode?: "link";
  ariaLabel: string;
  items: readonly MarketingSubNavLinkItem[];
  /** Id of the current route's tab. */
  active: string;
  className?: string;
};

export type MarketingSubNavProps = MarketingSubNavLinkProps | MarketingSubNavAnchorProps;

/**
 * Underline sub-navigation. `link` mode renders route tabs on the server; `anchor` mode is a
 * client island with scroll-spy, an optional sticky identity bar and reading progress.
 */
export function MarketingSubNav(props: MarketingSubNavProps) {
  if (props.mode === "anchor") return <MarketingSubNavAnchor {...props} />;
  const { ariaLabel, items, active, className } = props;
  return (
    <nav aria-label={ariaLabel} className={cn(MARKETING_UNDERLINE_TAB_LIST, className)}>
      {items.map((item) => {
        const current = item.id === active;
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={cn(MARKETING_UNDERLINE_TAB, current && MARKETING_UNDERLINE_TAB_ACTIVE)}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
