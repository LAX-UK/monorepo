"use client";

import { MarketingFilterSheet } from "@/components/marketing/marketing-filter-sheet";
import { MarketingFilterTrigger } from "@/components/marketing/marketing-filter-trigger";
import type { ReactNode } from "react";
import { useState } from "react";

type Props = {
  children: ReactNode;
  activeCount?: number;
  title?: string;
};

/** Mobile filter drawer for staff list pages; filters stay visible on `lg+`. */
export function AdminListFilterSheet({ children, activeCount = 0, title = "Filters" }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <AdminListFilterTrigger activeCount={activeCount} onOpen={() => setOpen(true)} />
      <MarketingFilterSheet open={open} onOpenChange={setOpen} title={title}>
        <div className="space-y-4">{children}</div>
      </MarketingFilterSheet>
    </>
  );
}

function AdminListFilterTrigger({
  activeCount,
  onOpen,
}: {
  activeCount: number;
  onOpen: () => void;
}) {
  return (
    <div className="lg:hidden">
      <MarketingFilterTrigger onClick={onOpen} activeCount={activeCount} />
    </div>
  );
}
