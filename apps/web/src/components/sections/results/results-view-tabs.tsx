"use client";

import { type ResultsView, resultsHref } from "@/lib/marketing/results-page-params";
import { type LinkProps, TabNav } from "@auction/ui/lax";
import Link from "next/link";

/** A view change keeps the reader's place on the page. */
function ResultsTabLink({ prefetch: _prefetch, ...props }: LinkProps) {
  return <Link {...props} scroll={false} prefetch={false} />;
}

const TABS: readonly { id: ResultsView; label: string }[] = [
  { id: "sales", label: "Sales" },
  { id: "lots", label: "Lots" },
];

type Props = {
  active: ResultsView;
  /** Shown beside a tab only when above zero; a tab without a known count shows none. */
  counts?: Partial<Record<ResultsView, number>>;
  className?: string;
};

/** The two ways into the results: by sale, or by sold work. */
export function ResultsViewTabs({ active, counts = {}, className }: Props) {
  return (
    <TabNav
      label="Results views"
      Link={ResultsTabLink}
      activeId={active}
      {...(className ? { className } : {})}
      items={TABS.map((tab) => {
        const count = counts[tab.id];
        return {
          id: tab.id,
          label: tab.label,
          href: resultsHref(tab.id),
          ...(count !== undefined && count > 0 ? { count } : {}),
        };
      })}
    />
  );
}
