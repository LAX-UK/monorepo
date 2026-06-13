"use client";

import type { ConveyorColumnVm } from "@/lib/admin/conveyor-pipeline.vm";
import { submissionStatusLabel } from "@/lib/admin/status-badge-variants";
import type { ItemSubmissionStatus } from "@auction/types";
import Link from "next/link";

type Props = {
  columns: ConveyorColumnVm[];
};

export function ConveyorKanbanBoard({ columns }: Props) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {columns.map((col) => (
        <section
          key={col.id}
          className="flex w-[min(100%,18rem)] shrink-0 flex-col rounded-lg border border-outline-variant/25 bg-surface-container-lowest/60"
        >
          <header className="border-b border-border-hairline px-3 py-3">
            <h2 className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface">
              {col.title}
            </h2>
            <p className="mt-1 font-body text-[11px] leading-snug text-on-surface-variant">
              {col.hint}
            </p>
            <p className="mt-2 font-body text-xs text-secondary">{col.items.length} items</p>
          </header>
          <ul className="flex max-h-[70vh] min-h-[8rem] flex-col gap-2 overflow-y-auto p-2">
            {col.items.length === 0 ? (
              <li className="px-1 py-4 text-center font-body text-xs text-on-surface-variant">—</li>
            ) : (
              col.items.map((item) => (
                <li
                  key={`${col.id}-${item.submissionId}`}
                  className="rounded-md border border-border-hairline bg-surface px-2 py-2"
                >
                  <Link
                    href={`/admin/submissions/${item.submissionId}`}
                    className="line-clamp-2 font-body text-sm font-medium text-link hover:underline"
                  >
                    {item.title}
                  </Link>
                  <p className="mt-1 font-body text-xs text-on-surface-variant">
                    {submissionStatusLabel[item.submissionStatus as ItemSubmissionStatus] ??
                      item.submissionStatus.replaceAll("_", " ")}
                    {item.lotStatus ? ` · ${item.lotStatus.replaceAll("_", " ")}` : ""}
                  </p>
                  {item.lotId ? (
                    <Link
                      href={`/admin/lots/${item.lotId}`}
                      className="mt-1 inline-block font-label text-[10px] uppercase tracking-wide text-secondary hover:text-link"
                    >
                      Open lot
                    </Link>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}
