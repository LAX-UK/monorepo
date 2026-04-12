"use client";

import { MaterialIcon } from "@/components/ui/material-icon";
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
  const pages: number[] = [];
  for (let p = windowStart; p <= windowEnd; p++) pages.push(p);

  return (
    <div className="mx-auto mt-32 flex max-w-screen-2xl justify-center border-t border-outline-variant/10 pt-16">
      <div className="flex items-center gap-8 md:gap-12">
        <Link
          href={buildHref(searchParams, prev)}
          className={`flex items-center gap-4 font-label text-xs uppercase tracking-[0.2em] transition-colors ${
            page <= 1
              ? "pointer-events-none text-on-surface-variant/40"
              : "text-on-surface-variant hover:text-primary"
          }`}
          aria-disabled={page <= 1}
        >
          <MaterialIcon name="west" className="text-sm" />
          Previous
        </Link>
        <div className="flex items-center gap-6 md:gap-8">
          {pages.map((p) => (
            <Link
              key={p}
              href={buildHref(searchParams, p)}
              className={`font-label text-xs uppercase tracking-[0.2em] transition-colors ${
                p === page
                  ? "font-bold text-primary"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {String(p).padStart(2, "0")}
            </Link>
          ))}
          {totalPages > windowEnd ? (
            <span className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant">
              …
            </span>
          ) : null}
          {totalPages > windowEnd ? (
            <Link
              href={buildHref(searchParams, totalPages)}
              className="font-label text-xs uppercase tracking-[0.2em] text-on-surface-variant transition-colors hover:text-on-surface"
            >
              {String(totalPages).padStart(2, "0")}
            </Link>
          ) : null}
        </div>
        <Link
          href={buildHref(searchParams, next)}
          className={`flex items-center gap-4 font-label text-xs uppercase tracking-[0.2em] transition-colors ${
            page >= totalPages
              ? "pointer-events-none text-on-surface-variant/40"
              : "text-on-surface hover:text-primary"
          }`}
          aria-disabled={page >= totalPages}
        >
          Next
          <MaterialIcon name="east" className="text-sm" />
        </Link>
      </div>
    </div>
  );
}
