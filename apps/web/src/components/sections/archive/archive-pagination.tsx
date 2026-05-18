"use client";

import { MarketingPagination } from "@auction/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
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

  if (totalPages <= 1) {
    return null;
  }

  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);

  const windowStart = Math.max(1, page - 1);
  const windowEnd = Math.min(totalPages, page + 1);
  const pages: { page: number; href: string; current?: boolean }[] = [];
  for (let p = windowStart; p <= windowEnd; p += 1) {
    pages.push({ page: p, href: buildHref(searchParams, p), current: p === page });
  }

  const showEllipsis = totalPages > windowEnd;
  const trailingPage =
    showEllipsis && totalPages > windowEnd
      ? { page: totalPages, href: buildHref(searchParams, totalPages) }
      : null;

  return (
    <div className="mx-auto mt-32 flex max-w-screen-2xl justify-center border-t border-border-hairline pt-16">
      <MarketingPagination
        aria-label="Archive pagination"
        prev={{
          href: page <= 1 ? null : buildHref(searchParams, prev),
          label: (
            <>
              <ChevronLeft className="text-sm" aria-hidden />
              Previous
            </>
          ),
        }}
        next={{
          href: page >= totalPages ? null : buildHref(searchParams, next),
          label: (
            <>
              Next
              <ChevronRight className="text-sm" aria-hidden />
            </>
          ),
        }}
        pages={pages}
        showEllipsis={showEllipsis}
        {...(trailingPage ? { trailingPage } : {})}
        renderLink={({ href, className, children, "aria-current": ariaCurrent }) => (
          <Link href={href} className={className} aria-current={ariaCurrent}>
            {children}
          </Link>
        )}
      />
    </div>
  );
}
