"use client";

import {
  type SaleAuthorityRequestFormState,
  submitSaleAuthorityRequest,
} from "@/lib/shop-portal-actions.server";
import type { PortalSaleAuthorityItem } from "@/lib/shop-portal.server";
import { Button } from "@auction/ui/components/button";
import { useActionState } from "react";

const initialState: SaleAuthorityRequestFormState = { ok: false, message: "" };

export function SaleLimitRequestForm({ artworks }: { artworks: PortalSaleAuthorityItem[] }) {
  const [state, action, pending] = useActionState(submitSaleAuthorityRequest, initialState);

  return (
    <form action={action} className="space-y-3 rounded-md border border-outline-variant p-4">
      <h2 className="text-sm font-semibold text-on-surface">Request a limit change</h2>
      <label className="block text-sm">
        <span className="text-on-surface-variant">Artwork</span>
        <select
          name="artworkId"
          required
          className="mt-1 w-full rounded-md border border-outline-variant bg-surface px-3 py-2"
        >
          <option value="">Select artwork</option>
          {artworks.map((row) => (
            <option key={row.artworkId} value={row.artworkId}>
              {row.artworkTitle}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="text-on-surface-variant">Requested authorised count (0–10)</span>
        <input
          name="requestedCount"
          type="number"
          min={0}
          max={10}
          required
          className="mt-1 w-full rounded-md border border-outline-variant bg-surface px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-on-surface-variant">Note (optional)</span>
        <textarea
          name="note"
          rows={3}
          className="mt-1 w-full rounded-md border border-outline-variant bg-surface px-3 py-2"
        />
      </label>
      {state.message ? (
        <p className={state.ok ? "text-sm text-green-700" : "text-sm text-error"}>
          {state.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="min-h-11">
        {pending ? "Submitting…" : "Submit request"}
      </Button>
    </form>
  );
}
