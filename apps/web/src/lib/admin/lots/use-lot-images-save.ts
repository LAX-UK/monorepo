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

  const save = useCallback(
    (entries: LotImageSaveEntry[]) => {
      startTransition(async () => {
        const images = entries.map((e) => e.key);
        const alts = entries.map((e) => e.alt);
        const r = await adminUpdateLotResultAction(lotId, { images });
        if (!r.ok) {
          setLastResult("error");
          notify.error("Images save failed", { description: r.error });
          return;
        }
        if (entries.length > 0) {
          const altResult = await adminUpdateLotMarketingDetailsResultAction(lotId, {
            imageAlts: alts,
          });
          if (!altResult.ok) {
            setLastResult("partial");
            notify.warning("Images saved, but alt text could not be saved", {
              description: altResult.error,
            });
            router.refresh();
            return;
          }
        }
        setLastResult("ok");
        notify.success("Images saved");
        router.refresh();
      });
    },
    [lotId, router],
  );

  return { save, pending, lastResult };
}
