"use client";

import { CatalogPublishReadiness } from "@/components/admin/catalog/catalog-publish-readiness";
import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";

export type CatalogReadinessVariant = "compact" | "full";

type Props = {
  title: string;
  readiness: CatalogReadinessResult;
  variant?: CatalogReadinessVariant;
  dismissKey?: string;
  onDismiss?: () => void;
};

/** Shared readiness checklist renderer for detail rails, banners, and wizards. */
export function CatalogReadinessChecklist({
  title,
  readiness,
  variant = "full",
  dismissKey,
  onDismiss,
}: Props) {
  return (
    <CatalogPublishReadiness
      title={title}
      readiness={readiness}
      compact={variant === "compact"}
      {...(dismissKey ? { dismissKey } : {})}
      {...(onDismiss ? { onDismiss } : {})}
    />
  );
}
