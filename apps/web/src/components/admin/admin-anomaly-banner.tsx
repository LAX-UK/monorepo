"use client";

import type { AdminAnomaly } from "@/lib/admin/anomaly-detection";
import { Button } from "@auction/ui/components/button";
import { AlertTriangle, Info, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const STORAGE_PREFIX = "lax.adminAnomaly.dismissed.";

type Props = {
  anomalies: readonly AdminAnomaly[];
  storageKey: string;
  className?: string;
};

function severityIcon(severity: AdminAnomaly["severity"]) {
  if (severity === "critical" || severity === "warning") {
    return <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />;
  }
  return <Info className="size-4 shrink-0 text-primary" aria-hidden />;
}

function severityBorder(severity: AdminAnomaly["severity"]): string {
  if (severity === "critical") return "border-live-red/40 bg-live-red/5";
  if (severity === "warning") return "border-warning/40 bg-warning-container/20";
  return "border-primary/25 bg-primary-container/15";
}

/** Dismissible callout listing operational anomalies for finance and home dashboards. */
export function AdminAnomalyBanner({ anomalies, storageKey, className }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const storageId = `${STORAGE_PREFIX}${storageKey}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageId);
      if (!raw) return;
      const ids = JSON.parse(raw) as string[];
      if (Array.isArray(ids)) setDismissed(new Set(ids));
    } catch {
      /* ignore */
    }
  }, [storageId]);

  const visible = useMemo(
    () => anomalies.filter((a) => !dismissed.has(a.id)),
    [anomalies, dismissed],
  );

  if (visible.length === 0) return null;

  const dismissAll = () => {
    const next = new Set(dismissed);
    for (const a of visible) next.add(a.id);
    setDismissed(next);
    try {
      localStorage.setItem(storageId, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  };

  return (
    <aside
      className={
        className ??
        "mb-4 rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3"
      }
      aria-label="Operational anomalies"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="font-label text-xs font-semibold uppercase tracking-widest text-secondary">
          Needs attention
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-8 gap-1"
          onClick={dismissAll}
        >
          <X className="size-4" aria-hidden />
          Dismiss
        </Button>
      </div>
      <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
        {visible.map((a) => (
          <li
            key={a.id}
            className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${severityBorder(a.severity)}`}
          >
            {severityIcon(a.severity)}
            {a.href ? (
              <Link
                href={a.href}
                className="font-body text-on-surface underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {a.message}
              </Link>
            ) : (
              <span className="font-body text-on-surface">{a.message}</span>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}
