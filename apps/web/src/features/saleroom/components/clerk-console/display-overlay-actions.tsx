"use client";

import { SaleroomPendingSubmit } from "@/components/admin/saleroom-pending-form";
import { useDisplayOverlayState } from "@/features/saleroom/hooks/use-display-overlay-state";
import {
  adminSaleroomDisplayClearOverlayAction,
  adminSaleroomDisplayOverlayAction,
} from "@/lib/actions/admin";
import type { SaleroomDisplayOverlay } from "@auction/types";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import { cn } from "@auction/ui/lib/utils";
import { useState } from "react";

type Props = {
  saleId: string;
  initialOverlay?: SaleroomDisplayOverlay | null;
  className?: string;
};

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
    <div className={cn("flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end", className)}>
      <SaleroomPendingSubmit
        pendingLabel="Sending…"
        variant={activeOverlay?.kind === "fair_warning" ? "default" : "outline"}
        className={cn(
          "min-h-11 w-full sm:w-auto",
          activeOverlay?.kind === "fair_warning" && "ring-2 ring-primary/30",
        )}
        onRun={() => adminSaleroomDisplayOverlayAction({ saleId, kind: "fair_warning" })}
        onSuccess={() => {
          setOptimisticOverlay({ kind: "fair_warning" });
          void refreshOverlay();
        }}
      >
        Fair warning
      </SaleroomPendingSubmit>

      <div className="flex w-full min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1">
          <Label htmlFor={`display-announce-${saleId}`} className="sr-only">
            Announcement text
          </Label>
          <Input
            id={`display-announce-${saleId}`}
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
            placeholder="Announcement text"
            className="h-11 font-body text-sm"
            maxLength={500}
          />
        </div>
        <SaleroomPendingSubmit
          pendingLabel="Sending…"
          variant={activeOverlay?.kind === "announcement" ? "default" : "outline"}
          className={cn(
            "min-h-11 w-full sm:w-auto",
            activeOverlay?.kind === "announcement" && "ring-2 ring-primary/30",
          )}
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
        className="min-h-11 w-full text-secondary sm:w-auto"
        disabled={!hasActiveOverlay}
        aria-disabled={!hasActiveOverlay}
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
