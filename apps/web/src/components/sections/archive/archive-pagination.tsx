"use client";

import { MarketingPaginationControls } from "@/components/marketing/marketing-pagination-controls";
import { MARKETING_PAGE_INNER } from "@/lib/marketing/chrome";
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
  return q ? `?${q}` : "?";
}

export function ArchivePagination({ page, totalPages }: Props) {
  const searchParams = useSearchParams();

  return (
    <MarketingPaginationControls
      ariaLabel="Archive pagination"
      currentPage={page}
      totalPages={totalPages}
      getPageHref={(pageNum) => buildHref(searchParams, pageNum)}
      className={`${MARKETING_PAGE_INNER} mt-12 flex justify-center border-t border-border-hairline pt-10`}
    />
  );
}
