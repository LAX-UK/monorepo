"use client";

import { LotImageManager } from "@/components/admin/lot-image-manager";
import { adminUpdateLotResultAction } from "@/lib/actions/admin";
import { adminUpdateLotMarketingDetailsResultAction } from "@/lib/actions/admin";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type LotImageTabEntry = {
  key: string;
  alt: string;
};

type Props = {
  lotId: string;
  initialImages: string[];
  initialAlts: (string | undefined)[];
};

export function LotImageTab({ lotId, initialImages, initialAlts }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [entries, setEntries] = useState<LotImageTabEntry[]>(
    initialImages.map((key, i) => ({ key, alt: initialAlts[i] ?? "" })),
  );
  const [dirty, setDirty] = useState(false);

  function handleChange(next: LotImageTabEntry[]) {
    setEntries(next);
    setDirty(true);
  }

  function handleSave() {
    startTransition(async () => {
      const images = entries.map((e) => e.key);
      const alts = entries.map((e) => e.alt);
      const r = await adminUpdateLotResultAction(lotId, { images });
      if (!r.ok) {
        notify.error("Images save failed", { description: r.error });
        return;
      }
      const hasAlts = alts.some((a) => a.trim().length > 0);
      if (hasAlts) {
        const altResult = await adminUpdateLotMarketingDetailsResultAction(lotId, {
          imageAlts: alts,
        });
        if (!altResult.ok) {
          notify.warning("Images saved, but alt text could not be saved", {
            description: altResult.error,
          });
        }
      }
      notify.success("Images saved");
      setDirty(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <LotImageManager value={entries} onChange={handleChange} />
      {dirty ? (
        <Button type="button" onClick={handleSave} disabled={pending} className="w-full">
          {pending ? "Saving…" : "Save image changes"}
        </Button>
      ) : null}
    </div>
  );
}
