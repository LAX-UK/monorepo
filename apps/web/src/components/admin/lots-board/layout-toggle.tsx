"use client";

import Link from "next/link";

export function LotsLayoutToggle({
  searchQuery,
  viewPipeline,
}: {
  searchQuery: string;
  viewPipeline: boolean;
}) {
  const pipelineHref = (() => {
    const qs = new URLSearchParams();
    qs.set("view", "pipeline");
    if (searchQuery) qs.set("q", searchQuery);
    return `/admin/lots?${qs.toString()}`;
  })();
  const tableHref =
    searchQuery.length > 0 ? `/admin/lots?q=${encodeURIComponent(searchQuery)}` : "/admin/lots";

  return (
    <fieldset className="flex flex-wrap gap-2 border-0 p-0">
      <legend className="sr-only">Layout</legend>
      <Link
        href={tableHref}
        className={`min-h-11 rounded-full px-4 py-2 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] ring-1 transition-colors ${
          !viewPipeline
            ? "bg-surface-container-high text-on-surface ring-outline-variant/25"
            : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80"
        }`}
      >
        Table
      </Link>
      <Link
        href={pipelineHref}
        className={`min-h-11 rounded-full px-4 py-2 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] ring-1 transition-colors ${
          viewPipeline
            ? "bg-surface-container-high text-on-surface ring-outline-variant/25"
            : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80"
        }`}
      >
        Pipeline
      </Link>
    </fieldset>
  );
}
