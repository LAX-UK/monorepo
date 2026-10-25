"use client";

import {
  adminUpdateLotMarketingDetailsResultAction,
  adminUpdateLotResultAction,
} from "@/lib/actions/admin";
import { notify } from "@/lib/ui/notify";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

export type LotImageSaveEntry = {
  key: string;
  alt: string;
};

export function useLotImagesSave(lotId: string) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lastResult, setLastResult] = useState<"idle" | "ok" | "partial" | "error">("idle");
  /** Why the last save failed, shown beside the photos rather than in a passing toast. */
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(
    (entries: LotImageSaveEntry[]) => {
      setError(null);
      startTransition(async () => {
        const images = entries.map((e) => e.key);
        const alts = entries.map((e) => e.alt);
        const r = await adminUpdateLotResultAction(lotId, { images });
        if (!r.ok) {
          setLastResult("error");
          setError(`The photos were not saved. ${r.error}`);
          return;
        }
        if (entries.length > 0) {
          const altResult = await adminUpdateLotMarketingDetailsResultAction(lotId, {
            imageAlts: alts,
          });
          if (!altResult.ok) {
            setLastResult("partial");
            setError(`The photos were saved, but their alt text was not. ${altResult.error}`);
            router.refresh();
            return;
          }
        }
        setLastResult("ok");
        notify.success("Photos saved");
        router.refresh();
      });
    },
    [lotId, router],
  );

  return { save, pending, lastResult, error };
}
