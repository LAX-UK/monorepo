"use client";

import { formatDateTime } from "@/lib/ui/format";
import { Surface } from "@auction/ui/components/surface";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  entityId?: string;
  updatedAt?: Date | string;
  publicHref?: string;
  publicLabel?: string;
  status?: ReactNode;
  children?: ReactNode;
};

/** Quiet right column — IDs, dates, status only (desktop lg+). */
export function CatalogInfoAside({
  entityId,
  updatedAt,
  publicHref,
  publicLabel = "View on site",
  status,
  children,
}: Props) {
  const updated = updatedAt instanceof Date ? updatedAt : updatedAt ? new Date(updatedAt) : null;

  return (
    <Surface variant="quiet" padding="md" className="space-y-4 text-sm">
      {status ? (
        <div>
          <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            Status
          </p>
          <div className="mt-2">{status}</div>
        </div>
      ) : null}
      {entityId ? (
        <div>
          <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            ID
          </p>
          <button
            type="button"
            className="mt-1 block w-full truncate text-left font-mono text-xs text-on-surface hover:text-primary"
            onClick={() => void navigator.clipboard.writeText(entityId)}
          >
            {entityId}
          </button>
        </div>
      ) : null}
      {updated && !Number.isNaN(updated.getTime()) ? (
        <div>
          <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            Updated
          </p>
          <p className="mt-1 text-on-surface-variant">{formatDateTime(updated)}</p>
        </div>
      ) : null}
      {publicHref ? (
        <Link
          href={publicHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
        >
          {publicLabel}
          <ExternalLink className="size-3" aria-hidden />
        </Link>
      ) : null}
      {children}
    </Surface>
  );
}
