"use client";

import { LotImageManager } from "@/components/admin/lot-image-manager";
import { type LotImageSaveEntry, useLotImagesSave } from "@/lib/admin/lots/use-lot-images-save";
import { Button } from "@auction/ui/components/button";
import { useEffect, useState } from "react";

export type LotImageTabEntry = LotImageSaveEntry;

type Props = {
  lotId: string;
  initialImages: string[];
  initialAlts: (string | undefined)[];
};

export function LotImageTab({ lotId, initialImages, initialAlts }: Props) {
  const { save, pending, lastResult } = useLotImagesSave(lotId);
  const [entries, setEntries] = useState<LotImageTabEntry[]>(
    initialImages.map((key, i) => ({ key, alt: initialAlts[i] ?? "" })),
  );
  const [dirty, setDirty] = useState(false);

  function handleChange(next: LotImageTabEntry[]) {
    setEntries(next);
    setDirty(true);
  }

  useEffect(() => {
    if (lastResult === "ok" || lastResult === "partial") setDirty(false);
  }, [lastResult]);

  function handleSave() {
    save(entries);
  }

  return (
    <div className="space-y-6">
      <LotImageManager value={entries} onChange={handleChange} disabled={pending} />
      {dirty ? (
        <Button type="button" onClick={handleSave} disabled={pending} className="w-full">
          {pending ? "Saving…" : "Save image changes"}
        </Button>
      ) : null}
    </div>
  );
}
