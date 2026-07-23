import { CatalogInfoAsideCopyId } from "@/components/admin/catalog/catalog-info-aside-copy-id";
import { formatAdminTableDateTime } from "@/lib/admin/format-admin-table-datetime";
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
  const updatedPresentation =
    updated && !Number.isNaN(updated.getTime())
      ? formatAdminTableDateTime(updated, "timestamp")
      : null;

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
          <CatalogInfoAsideCopyId entityId={entityId} />
        </div>
      ) : null}
      {updatedPresentation ? (
        <div>
          <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
            Updated
          </p>
          <time
            dateTime={updatedPresentation.iso ?? undefined}
            title={updatedPresentation.title}
            className="mt-1 block text-on-surface-variant"
          >
            <span className="block font-body text-sm">{updatedPresentation.primary}</span>
            {updatedPresentation.secondary ? (
              <span className="block font-body text-xs">{updatedPresentation.secondary}</span>
            ) : null}
          </time>
        </div>
      ) : null}
      {publicHref ? (
        <Link
          href={publicHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-link underline-offset-4 hover:underline"
        >
          {publicLabel}
          <ExternalLink className="size-3" aria-hidden />
        </Link>
      ) : null}
      {children}
    </Surface>
  );
}
