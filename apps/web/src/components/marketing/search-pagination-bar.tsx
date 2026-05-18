import { MarketingPagination } from "@/components/marketing/marketing-pagination";
import Link from "next/link";

export type SearchPaginationBarProps = {
  offset: number;
  resultCount: number;
  hasNext: boolean;
  hasPrev: boolean;
  prevHref: string;
  nextHref: string;
};

export function SearchPaginationBar({
  offset,
  resultCount,
  hasNext,
  hasPrev,
  prevHref,
  nextHref,
}: SearchPaginationBarProps) {
  const start = resultCount === 0 ? 0 : offset + 1;
  const end = offset + resultCount;
  const approxSuffix = hasNext ? "+" : "";

  return (
    <div className="mt-12 space-y-6 border-t border-border-hairline pt-10">
      <p className="text-center font-body text-sm text-on-surface-variant">
        {resultCount === 0 ? (
          "No lots on this page"
        ) : (
          <>
            Showing{" "}
            <span className="font-medium tabular-nums text-on-surface">
              {start}–{end}
            </span>{" "}
            {approxSuffix ? (
              <>
                of approximately{" "}
                <span className="font-medium tabular-nums text-on-surface">{end}+</span>
              </>
            ) : (
              <>
                of <span className="font-medium tabular-nums text-on-surface">{end}</span>
              </>
            )}
          </>
        )}
      </p>
      <MarketingPagination
        aria-label="Search results pagination"
        className="flex justify-center"
        prev={{
          href: hasPrev ? prevHref : null,
        }}
        next={{
          href: hasNext ? nextHref : null,
        }}
        pages={[]}
        renderLink={({ href, className, children, "aria-current": ariaCurrent }) => (
          <Link
            href={href}
            className={className}
            {...(ariaCurrent ? { "aria-current": ariaCurrent } : {})}
            scroll={false}
          >
            {children}
          </Link>
        )}
      />
    </div>
  );
}
