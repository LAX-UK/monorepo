"use client";

import { useCatalogPostCreateSession } from "@/components/admin/catalog/catalog-post-create-session";
import { CatalogPublishReadiness } from "@/components/admin/catalog/catalog-publish-readiness";
import { shouldShowCatalogReadinessBanner } from "@/lib/admin/catalog-detail-readiness-surface";
import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import { useEffect } from "react";

type Props = {
  entityLabel: string;
  readiness: CatalogReadinessResult | null;
  dismissKey: string;
};

/** Post-create nudge: highlights publish readiness when `?created=1` is present. */
export function CatalogWhatsNextBanner({ entityLabel, readiness, dismissKey }: Props) {
  const { isPostCreateBannerActive, registerBannerDismiss } = useCatalogPostCreateSession();

  useEffect(() => {
    try {
      if (window.localStorage.getItem(`catalog-readiness-dismiss:${dismissKey}`) === "1") {
        registerBannerDismiss();
      }
    } catch {
      // ignore
    }
  }, [dismissKey, registerBannerDismiss]);

  if (
    !shouldShowCatalogReadinessBanner({
      readiness,
      isPostCreateBannerActive: isPostCreateBannerActive(readiness),
    }) ||
    !readiness
  ) {
    return null;
  }

  return (
    <CatalogPublishReadiness
      title={`Your ${entityLabel} draft is saved`}
      readiness={readiness}
      dismissKey={dismissKey}
      onDismiss={registerBannerDismiss}
    />
  );
}
