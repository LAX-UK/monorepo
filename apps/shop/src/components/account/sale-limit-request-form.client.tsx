"use client";

import { shopButtonClassName } from "@/components/shop-commerce-button";
import { ShopNotice } from "@/components/shop-notice";
import {
  type SaleAuthorityRequestFormState,
  submitSaleAuthorityRequest,
} from "@/lib/shop-portal-actions.server";
import type { PortalSaleAuthorityItem } from "@auction/shop-portal/portal";
import { Button } from "@auction/ui/components/button";
import { useActionState, useEffect, useState } from "react";

const initialState: SaleAuthorityRequestFormState = { ok: false, message: "" };

export function SaleLimitRequestForm({ artworks }: { artworks: PortalSaleAuthorityItem[] }) {
  const [state, action, pending] = useActionState(submitSaleAuthorityRequest, initialState);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    if (state.ok) {
      setIdempotencyKey(crypto.randomUUID());
    }
  }, [state.ok]);

  return (
    <form action={action} className="space-y-3 rounded-md border border-outline-variant p-4">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} readOnly />
      <h2 className="text-sm font-semibold text-on-surface">Request a limit change</h2>
      <label className="block text-sm">
        <span className="text-on-surface-variant">Artwork</span>
        <select name="artworkId" required className="shop-field mt-1 w-full">
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
          className="shop-field mt-1 w-full"
        />
      </label>
      <label className="block text-sm">
        <span className="text-on-surface-variant">Note (optional)</span>
        <textarea name="note" rows={3} className="shop-field mt-1 w-full" />
      </label>
      {state.message ? (
        <ShopNotice tone={state.ok ? "success" : "error"} className="text-sm">
          {state.message}
        </ShopNotice>
      ) : null}
      <Button
        type="submit"
        disabled={pending}
        className={shopButtonClassName("default", "standard")}
      >
        {pending ? "Submitting…" : "Submit request"}
      </Button>
    </form>
  );
}
