"use client";

import { useUploadObjectLifecycle } from "@/hooks/use-upload-object-lifecycle";
import { adminUpdateSaleResultAction } from "@/lib/actions/admin-sales";
import { notify } from "@/lib/ui/notify";
import type { SaleDayMediaRef } from "@auction/types";
import { PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { type DayMediaItem, itemsToDayImages, refToItem } from "./day-media-types";

type UseDayPhotosTabArgs = {
  saleId: string;
  saleStatus: string;
  initialDayImages: SaleDayMediaRef[];
  previewUrlByKey: Record<string, string>;
  canManage: boolean;
};

export function useDayPhotosTab({
  saleId,
  saleStatus,
  initialDayImages,
  previewUrlByKey,
  canManage,
}: UseDayPhotosTabArgs) {
  const router = useRouter();
  const [items, setItems] = useState<DayMediaItem[]>(() =>
    initialDayImages.map((r) => refToItem(r, previewUrlByKey)),
  );
  const [saving, setSaving] = useState(false);
  const { uploadFile } = useUploadObjectLifecycle();
  const isEnded = saleStatus === "ended";

  const savedRef = useRef<string>(
    JSON.stringify(initialDayImages.map((r) => refToItem(r, previewUrlByKey))),
  );
  const dirty = JSON.stringify(items) !== savedRef.current;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const arr = Array.from(files);
      for (const file of arr) {
        const tempId = `uploading-${Date.now()}-${file.name}`;
        const mediaType: "image" | "video" = file.type.startsWith("video/") ? "video" : "image";
        setItems((prev) => [
          ...prev,
          { id: tempId, key: "", mediaType, previewUrl: "", caption: "", alt: "", uploading: true },
        ]);
        try {
          const uploaded = await uploadFile(file, "sale_day");
          const objectUrl = URL.createObjectURL(file);
          setItems((prev) =>
            prev.map((it) =>
              it.id === tempId
                ? {
                    id: uploaded.key,
                    key: uploaded.key,
                    mediaType,
                    previewUrl: objectUrl,
                    caption: "",
                    alt: "",
                    uploading: false,
                  }
                : it,
            ),
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Upload failed";
          setItems((prev) =>
            prev.map((it) =>
              it.id === tempId ? { ...it, uploading: false, uploadError: message } : it,
            ),
          );
          notify.error("Upload failed", { description: message });
        }
      }
    },
    [uploadFile],
  );

  const persistDayImages = useCallback(
    async (nextItems: DayMediaItem[]): Promise<boolean> => {
      const pending = nextItems.filter((it) => it.uploading);
      if (pending.length > 0) {
        notify.error("Please wait for uploads to finish before saving.");
        return false;
      }
      if (!isEnded) {
        return true;
      }
      setSaving(true);
      try {
        const result = await adminUpdateSaleResultAction(saleId, {
          dayImages: itemsToDayImages(nextItems),
        });
        if (result.ok) {
          savedRef.current = JSON.stringify(nextItems);
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
    [isEnded, router, saleId],
  );

  const handleSave = useCallback(async () => {
    const ok = await persistDayImages(items);
    if (ok && isEnded) {
      notify.success("Auction day media saved");
    }
  }, [isEnded, items, persistDayImages]);

  const handleRemoveConfirmed = useCallback(
    async (itemId: string) => {
      if (saving) return;
      const next = items.filter((it) => it.id !== itemId);
      if (!isEnded || !canManage) {
        setItems(next);
        return;
      }
      const ok = await persistDayImages(next);
      if (!ok) return;
      setItems(next);
      notify.success("Media removed");
    },
    [canManage, isEnded, items, persistDayImages, saving],
  );

  const anyUploading = items.some((it) => it.uploading);

  return {
    items,
    setItems,
    saving,
    isEnded,
    canManage,
    dirty,
    sensors,
    uploadFiles,
    handleSave,
    handleRemoveConfirmed,
    anyUploading,
  };
}
