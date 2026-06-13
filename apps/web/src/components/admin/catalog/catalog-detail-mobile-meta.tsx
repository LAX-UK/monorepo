"use client";

import { CatalogInfoAsideCopyId } from "@/components/admin/catalog/catalog-info-aside-copy-id";
import { formatDateTime } from "@/lib/ui/format";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetTrigger,
} from "@auction/ui/components/bottom-sheet";
import { Button } from "@auction/ui/components/button";
import { ExternalLink, Info } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  entityId?: string;
  updatedAt?: Date | string;
  publicHref?: string;
  publicLabel?: string;
  status?: ReactNode;
  /** Inline links shown before the context sheet trigger. */
  quickLinks?: readonly { label: string; href: string }[];
  /** Primary CTA in the context sheet header. */
  primaryAction?: ReactNode;
  children?: ReactNode;
};

/** Compact facts row on mobile with expandable sheet for full metadata. */
export function CatalogDetailMobileMeta({
  entityId,
  updatedAt,
  publicHref,
  publicLabel = "View on site",
  status,
  quickLinks = [],
  primaryAction,
  children,
}: Props) {
  const updated = updatedAt instanceof Date ? updatedAt : updatedAt ? new Date(updatedAt) : null;
  const hasSheetContent =
    Boolean(entityId) ||
    Boolean(updated && !Number.isNaN(updated.getTime())) ||
    Boolean(publicHref) ||
    Boolean(children);

  if (!status && !hasSheetContent) return null;

  return (
    <div className="flex items-center justify-between gap-3 lg:hidden">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {status ? <div className="min-w-0">{status}</div> : null}
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="truncate font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-link hover:underline"
          >
            {link.label}
          </Link>
        ))}
      </div>
      {hasSheetContent ? (
        <BottomSheet>
          <BottomSheetTrigger asChild>
            <Button type="button" variant="secondary" size="sm" className="shrink-0 gap-1.5">
              <Info className="size-4" aria-hidden />
              Context
            </Button>
          </BottomSheetTrigger>
          <BottomSheetContent className="max-h-[85vh] rounded-t-2xl">
            <BottomSheetHeader className="px-6 pt-0 text-left">
              <BottomSheetTitle>Context</BottomSheetTitle>
            </BottomSheetHeader>
            <div className="space-y-4 px-6 pb-6 text-sm">
              {primaryAction ? <div>{primaryAction}</div> : null}
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
                  className="inline-flex items-center gap-1 text-link underline-offset-4 hover:underline"
                >
                  {publicLabel}
                  <ExternalLink className="size-3" aria-hidden />
                </Link>
              ) : null}
              {children}
            </div>
          </BottomSheetContent>
        </BottomSheet>
      ) : null}
    </div>
  );
}
