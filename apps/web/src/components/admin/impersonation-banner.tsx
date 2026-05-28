"use client";

import { ConfirmFormSubmit } from "@/components/admin/confirm-form-submit";
import { endAdminImpersonationAction } from "@/lib/legal-entity/acting-context.actions";
import { useEffect, useState } from "react";

type Props = {
  entityName: string;
  expiresAtIso: string;
};

function formatRemaining(totalSeconds: number): string {
  if (totalSeconds <= 0) return "0:00";
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ImpersonationBanner({ entityName, expiresAtIso }: Props) {
  const [remainingSec, setRemainingSec] = useState(() =>
    Math.max(0, Math.floor((Date.parse(expiresAtIso) - Date.now()) / 1000)),
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemainingSec(Math.max(0, Math.floor((Date.parse(expiresAtIso) - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [expiresAtIso]);

  return (
    <div
      className="fixed inset-x-0 top-0 z-[200] border-b border-error/40 bg-error px-4 py-2 text-on-error shadow-md"
      style={{ height: "var(--impersonation-banner-height, 3.5rem)" }}
      // biome-ignore lint/a11y/useSemanticElements: status role on a fixed banner div is intentional
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="text-sm font-medium sm:text-base">
          Impersonating <span className="font-semibold">{entityName}</span>
          <span className="ml-2 text-on-error/80">
            · Session ends in <span className="tabular-nums">{formatRemaining(remainingSec)}</span>
          </span>
        </p>
        <form id="end-impersonation-form" action={endAdminImpersonationAction} className="shrink-0">
          <ConfirmFormSubmit
            formId="end-impersonation-form"
            size="md"
            variant="secondary"
            className="w-full bg-on-error text-error hover:bg-error-container dark:bg-surface-container-highest dark:text-error dark:hover:bg-error/10 sm:w-auto"
            confirmTitle="End impersonation?"
            confirmBody="You will return to your staff session immediately."
            confirmLabel="End now"
            tone="warning"
          >
            End now
          </ConfirmFormSubmit>
        </form>
      </div>
    </div>
  );
}
