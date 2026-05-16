import { MarketingPagination } from "@/components/marketing/marketing-pagination";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

type Props = {
  currentPage: number;
  totalPages: number;
  prevHref: string | null;
  nextHref: string | null;
  getPageHref: (page: number) => string;
};

export function ArtistsDirectoryPagination({
  currentPage,
  totalPages,
  prevHref,
  nextHref,
  getPageHref,
}: Props) {
  if (totalPages <= 1) {
    return null;
  }

  const windowStart = Math.max(1, currentPage - 1);
  const windowEnd = Math.min(totalPages, currentPage + 1);
  const pages = [];
  for (let p = windowStart; p <= windowEnd; p += 1) {
    pages.push({ page: p, href: getPageHref(p), current: p === currentPage });
  }

  const showEllipsis = totalPages > windowEnd;
  const trailingPage =
    showEllipsis && totalPages > windowEnd
      ? { page: totalPages, href: getPageHref(totalPages) }
      : undefined;

  return (
    <div className="mt-10">
      <MarketingPagination
        aria-label="Artist directory pages"
        prev={{
          href: prevHref,
          label: (
            <>
              <ChevronLeft className="text-sm" aria-hidden />
              Previous
            </>
          ),
        }}
        next={{
          href: nextHref,
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
