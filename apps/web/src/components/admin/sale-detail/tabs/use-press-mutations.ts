"use client";

import { adminUpdateSaleResultAction } from "@/lib/actions/admin-sales";
import type { SalePressRef } from "@auction/types";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export type PressItem = SalePressRef & { id: string };

export type PressSaveResult = { ok: true } | { ok: false; error: string; errorCode?: string };

export function toPressItem(ref: SalePressRef, index: number): PressItem {
  return { ...ref, id: `${index}::${ref.url}` };
}

export function pressItemsToCoverage(items: PressItem[]): SalePressRef[] {
  return items.map(({ id: _id, ...r }) => r);
}

/**
 * Saves a sale's whole press list. The caller shows a failure where it happened (in the dialog
 * that edited the list), so this reports it instead of announcing it.
 */
export function usePressMutations(saleId: string) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const persistPressCoverage = useCallback(
    async (nextItems: PressItem[]): Promise<PressSaveResult> => {
      setSaving(true);
      try {
        const result = await adminUpdateSaleResultAction(saleId, {
          pressCoverage: pressItemsToCoverage(nextItems),
        });
        if (result.ok) {
          router.refresh();
          return { ok: true };
        }
        return {
          ok: false,
          error: result.error || "The press list could not be saved. Try again.",
          ...(result.errorCode ? { errorCode: result.errorCode } : {}),
        };
      } finally {
        setSaving(false);
      }
    },
    [router, saleId],
  );

  return { saving, persistPressCoverage };
}
