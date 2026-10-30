"use client";

import { SaleroomPendingSubmit } from "@/components/admin/saleroom-pending-form";
import { useDisplayOverlayState } from "@/features/saleroom/hooks/use-display-overlay-state";
import {
  adminSaleroomDisplayClearOverlayAction,
  adminSaleroomDisplayOverlayAction,
} from "@/lib/actions/admin";
import { Field, TextInput, cn } from "@auction/staff-ui";
import type { SaleroomDisplayOverlay } from "@auction/types";
import { useState } from "react";

type Props = {
  saleId: string;
  initialOverlay?: SaleroomDisplayOverlay | null;
  className?: string;
};

/** What the venue display shows on top of the lot: a fair warning, an announcement, or nothing. */
export function DisplayOverlayActions({ saleId, initialOverlay = null, className }: Props) {
  const [announcement, setAnnouncement] = useState("");
  const {
    activeOverlay,
    hasActiveOverlay,
    setOptimisticOverlay,
    clearOptimisticOverlay,
    refreshOverlay,
  } = useDisplayOverlayState({ saleId, initialOverlay });

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end", className)}>
      <SaleroomPendingSubmit
        pendingLabel="Sending…"
        variant={activeOverlay?.kind === "fair_warning" ? "primary" : "secondary"}
        size="lg"
        aria-pressed={activeOverlay?.kind === "fair_warning"}
        className="w-full sm:w-auto"
        onRun={() => adminSaleroomDisplayOverlayAction({ saleId, kind: "fair_warning" })}
        onSuccess={() => {
          setOptimisticOverlay({ kind: "fair_warning" });
          void refreshOverlay();
        }}
      >
        Fair warning
      </SaleroomPendingSubmit>

      <div className="flex w-full min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Announcement text" optional className="min-w-0 flex-1">
          <TextInput
            size="lg"
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            maxLength={500}
            autoComplete="off"
          />
        </Field>
        <SaleroomPendingSubmit
          pendingLabel="Sending…"
          variant={activeOverlay?.kind === "announcement" ? "primary" : "secondary"}
          size="lg"
          aria-pressed={activeOverlay?.kind === "announcement"}
          className="w-full sm:w-auto"
          onRun={() => {
            const message = announcement.trim();
            return adminSaleroomDisplayOverlayAction({
              saleId,
              kind: "announcement",
              ...(message ? { message } : {}),
            });
          }}
          onSuccess={() => {
            const message = announcement.trim();
            setOptimisticOverlay(
              message ? { kind: "announcement", message } : { kind: "announcement" },
            );
            setAnnouncement("");
            void refreshOverlay();
          }}
        >
          Announce
        </SaleroomPendingSubmit>
      </div>

      <SaleroomPendingSubmit
        pendingLabel="Clearing…"
        variant="ghost"
        size="lg"
        className="w-full sm:w-auto"
        disabled={!hasActiveOverlay}
        onRun={() => adminSaleroomDisplayClearOverlayAction({ saleId })}
        onSuccess={() => {
          clearOptimisticOverlay();
          void refreshOverlay();
        }}
      >
        Clear overlay
      </SaleroomPendingSubmit>
    </div>
  );
}
