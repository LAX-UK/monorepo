"use client";

import { adminUpdateSaleResultAction } from "@/lib/actions/admin-sales";
import { notify } from "@/lib/ui/notify";
import type { SalePressRef } from "@auction/types";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

export type PressItem = SalePressRef & { id: string };

export function toPressItem(ref: SalePressRef, index: number): PressItem {
  return { ...ref, id: `${index}::${ref.url}` };
}

export function pressItemsToCoverage(items: PressItem[]): SalePressRef[] {
  return items.map(({ id: _id, ...r }) => r);
}

export function usePressMutations(saleId: string) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const persistPressCoverage = useCallback(
    async (nextItems: PressItem[]): Promise<boolean> => {
      setSaving(true);
      try {
        const pressCoverage = pressItemsToCoverage(nextItems);
        const result = await adminUpdateSaleResultAction(saleId, { pressCoverage });
        if (result.ok) {
          router.refresh();
          return true;
        }
        notify.error("Save failed", {
          description: !result.ok && result.error ? result.error : "Please try again.",
        });
        return false;
      } finally {
        setSaving(false);
      }
    },
    [router, saleId],
  );

  return { saving, persistPressCoverage };
}
