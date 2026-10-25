"use client";

import type { CatalogReadinessResult } from "@/lib/admin/catalog-readiness";
import { Checklist, type ChecklistItem, type StaffLinkComponent } from "@auction/staff-ui";
import Link from "next/link";
import { useEffect, useState } from "react";

const NextLink: StaffLinkComponent = Link;

type Props = {
  title: string;
  readiness: CatalogReadinessResult;
  /** Remembers in this browser that the person hid the checklist. */
  dismissKey?: string;
  compact?: boolean;
  onDismiss?: () => void;
  description?: string;
};

/** The publish checks as the kit checklist: required ones block publishing, warnings do not. */
export function toChecklistItems(readiness: CatalogReadinessResult): ChecklistItem[] {
  return readiness.items.map((item) => ({
    id: item.id,
    label: item.label,
    done: item.ok,
    severity: item.severity === "required" ? "required" : "recommended",
    ...(item.href ? { href: item.href } : {}),
  }));
}

/**
 * What still stands between a draft and publishing, as a checklist with progress. Hidden once
 * everything is done, or once the person hides it (remembered per browser with `dismissKey`).
 */
export function CatalogPublishReadiness({
  title,
  readiness,
  dismissKey,
  compact = false,
  onDismiss,
  description,
}: Props) {
  const storageKey = dismissKey ? `catalog-readiness-dismiss:${dismissKey}` : null;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!storageKey) return;
    try {
      setDismissed(window.localStorage.getItem(storageKey) === "1");
    } catch {
      // Storage can be unavailable (private windows); the checklist then stays visible.
    }
  }, [storageKey]);

  if (readiness.percent === 100 || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, "1");
      } catch {
        // See above.
      }
    }
    onDismiss?.();
  };

  return (
    <Checklist
      title={title}
      items={toChecklistItems(readiness)}
      Link={NextLink}
      compact={compact}
      {...(description ? { description } : {})}
      {...(storageKey && !compact ? { onDismiss: dismiss } : {})}
    />
  );
}
