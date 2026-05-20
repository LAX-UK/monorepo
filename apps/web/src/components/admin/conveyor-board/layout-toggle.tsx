"use client";

import Link from "next/link";

export function ConveyorLayoutToggle({ viewTable }: { viewTable: boolean }) {
  return (
    <fieldset className="flex flex-wrap gap-2 border-0 p-0">
      <legend className="sr-only">Layout</legend>
      <Link
        href="/admin/conveyor"
        className={`min-h-11 rounded-full px-4 py-2 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] ring-1 transition-colors ${
          !viewTable
            ? "bg-surface-container-high text-on-surface ring-outline-variant/25"
            : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80"
        }`}
      >
        Kanban
      </Link>
      <Link
        href="/admin/conveyor?view=table"
        className={`min-h-11 rounded-full px-4 py-2 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] ring-1 transition-colors ${
          viewTable
            ? "bg-surface-container-high text-on-surface ring-outline-variant/25"
            : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80"
        }`}
      >
        Table
      </Link>
    </fieldset>
  );
}
