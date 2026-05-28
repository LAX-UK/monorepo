"use client";

import { MarketingListToolbar } from "@/components/marketing/marketing-list-toolbar";

type Props = {
  resultCount: number;
};

export function SalesNewLotsToolbar({ resultCount }: Props) {
  const countLabel = `${resultCount} lot${resultCount === 1 ? "" : "s"}`;
  return <MarketingListToolbar countLabel={countLabel} />;
}
