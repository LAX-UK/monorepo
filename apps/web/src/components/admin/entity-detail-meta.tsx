"use client";

import { formatDateTime } from "@/lib/ui/format";
import { Button } from "@auction/ui/components/button";
import { ExternalLink } from "lucide-react";
import Link from "next/link";

type Props = {
  entityId?: string;
  updatedAt?: Date | string;
  publicHref?: string;
  publicLabel?: string;
};

export function EntityDetailMeta({
  entityId,
  updatedAt,
  publicHref,
  publicLabel = "View on site",
}: Props) {
  if (!entityId && !updatedAt && !publicHref) return null;

  const updated = updatedAt instanceof Date ? updatedAt : updatedAt ? new Date(updatedAt) : null;

  return (
    <div className="flex flex-wrap items-center gap-3 font-body text-xs text-on-surface-variant">
      {entityId ? (
        <Button
          type="button"
          variant="secondaryOutline"
          size="sm"
          className="h-8 font-mono text-[11px]"
          onClick={() => void navigator.clipboard.writeText(entityId)}
        >
          Copy ID
        </Button>
      ) : null}
      {updated && !Number.isNaN(updated.getTime()) ? (
        <span>Updated {formatDateTime(updated)}</span>
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
    </div>
  );
}
