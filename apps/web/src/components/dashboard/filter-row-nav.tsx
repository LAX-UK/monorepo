"use client";

import {
  FilterRow,
  type FilterRowLinkItem,
  type FilterRowProps,
} from "@auction/ui/components/filter-row";
import Link from "next/link";

export type FilterRowNavProps = {
  label: string;
  items: readonly FilterRowLinkItem[];
  className?: string;
  /** Passed to Next.js `Link` for filter chip navigation. */
  scroll?: boolean;
};

/** Next.js adapter for `FilterRow` link mode — use from Server Components instead of `renderLink`. */
export function FilterRowNav({ label, items, className, scroll = false }: FilterRowNavProps) {
  const filterProps: Extract<FilterRowProps, { mode: "link" }> = {
    mode: "link",
    label,
    items,
    renderLink: ({ href, className: chipClass, children, ...rest }) => (
      <Link href={href} scroll={scroll} className={chipClass} {...rest}>
        {children}
      </Link>
    ),
  };
  if (className) filterProps.className = className;
  return <FilterRow {...filterProps} />;
}
