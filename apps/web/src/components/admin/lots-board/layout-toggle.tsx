"use client";

import { buildListHref } from "@/lib/admin/admin-list-params";
import Link from "next/link";

export function LotsLayoutToggle({
  listParams,
  viewPipeline,
}: {
  /** Current list URL params (serializable from RSC). */
  listParams: Record<string, string | undefined>;
  viewPipeline: boolean;
}) {
  const tableHref = buildListHref("/admin/lots", listParams, {
    view: "",
    offset: 0,
  });
  const pipelineHref = buildListHref("/admin/lots", listParams, {
    view: "pipeline",
    offset: 0,
  });

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
