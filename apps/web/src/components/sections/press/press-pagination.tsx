"use client";

import { MarketingPaginationControls } from "@/components/marketing/marketing-pagination-controls";
import { useSearchParams } from "next/navigation";

type Props = {
  page: number;
  totalPages: number;
};

function buildHref(searchParams: URLSearchParams, pageNum: number): string {
  const next = new URLSearchParams(searchParams.toString());
  if (pageNum <= 1) next.delete("page");
  else next.set("page", String(pageNum));
  const q = next.toString();
  return q ? `/press?${q}` : "/press";
}

/** Paginated press coverage archive navigation. */
export function PressPagination({ page, totalPages }: Props) {
  const searchParams = useSearchParams();

  return (
    <MarketingPaginationControls
      ariaLabel="Press coverage pagination"
      currentPage={page}
      totalPages={totalPages}
      getPageHref={(pageNum) => buildHref(searchParams, pageNum)}
      className="mt-12 flex justify-center border-t border-border-hairline pt-10"
    />
  );
}
