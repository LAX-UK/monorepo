"use client";

import { openAdminLegalEntityAction } from "@/lib/admin/legal-entity-lifecycle.actions";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { Label } from "@auction/ui/components/label";
import { useState, useTransition } from "react";
import { AdminLegalEntityPicker } from "./admin-legal-entity-picker";

export function AdminLegalEntityOpenForm() {
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const id = selectedId ?? "";
        startTransition(async () => {
          const nextFd = new FormData();
          nextFd.set("legalEntityId", id);
          try {
            await openAdminLegalEntityAction(nextFd);
            notify.success("Opening entity");
          } catch (e) {
            notify.error(e instanceof Error ? e.message : "Could not open entity");
          }
        });
      }}
    >
      <div className="space-y-2">
        <Label>Legal entity</Label>
        <AdminLegalEntityPicker
          value={selectedId}
          displayLabel={selectedLabel}
          disabled={pending}
          onChange={(id, row) => {
            setSelectedId(id);
            setSelectedLabel(
              row ? `${row.displayName} · ${row.status.replaceAll("_", " ")}` : null,
            );
          }}
        />
        <p className="text-sm text-on-surface-variant">
          Search by name, then open the detail page to review verification and lifecycle actions.
        </p>
      </div>

      <Button type="submit" disabled={pending || !selectedId} className="min-h-11 w-full sm:w-auto">
        {pending ? "Opening…" : "Open entity"}
      </Button>
    </form>
  );
}
