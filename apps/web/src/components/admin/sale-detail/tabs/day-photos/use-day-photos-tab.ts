"use client";

import type { StaffActionResult } from "@/components/admin/staff/use-staff-confirm";
import { useUploadObjectLifecycle } from "@/hooks/use-upload-object-lifecycle";
import { adminUpdateSaleResultAction } from "@/lib/actions/admin-sales";
import type { UploadQueueItem } from "@auction/staff-ui";
import type { SaleDayMediaRef } from "@auction/types";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { type DayMediaItem, itemsToDayImages, refToItem } from "./day-media-types";

type UseDayPhotosTabArgs = {
  saleId: string;
  saleStatus: string;
  initialDayImages: SaleDayMediaRef[];
  previewUrlByKey: Record<string, string>;
};

type QueuedUpload = UploadQueueItem & { file: File };

/**
 * The auction day media being arranged: what is in the gallery, files on their way in, and saving.
 * Before the sale ends nothing is saved (the gallery is published with the results); afterwards
 * saving publishes the gallery, and removing an item saves at once.
 */
export function useDayPhotosTab({
  saleId,
  saleStatus,
  initialDayImages,
  previewUrlByKey,
}: UseDayPhotosTabArgs) {
  const router = useRouter();
  const [items, setItems] = useState<DayMediaItem[]>(() =>
    initialDayImages.map((r) => refToItem(r, previewUrlByKey)),
  );
  const [queue, setQueue] = useState<QueuedUpload[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { uploadFile } = useUploadObjectLifecycle();
  const isEnded = saleStatus === "ended";
  const savedRef = useRef(JSON.stringify(itemsToDayImages(items)));
  const dirty = JSON.stringify(itemsToDayImages(items)) !== savedRef.current;

  const send = useCallback(
    async (upload: QueuedUpload) => {
      const mediaType: "image" | "video" = upload.file.type.startsWith("video/")
        ? "video"
        : "image";
      try {
        const uploaded = await uploadFile(upload.file, "sale_day");
        const previewUrl = URL.createObjectURL(upload.file);
        setItems((prev) => [
          ...prev,
          { id: uploaded.key, key: uploaded.key, mediaType, previewUrl, caption: "", alt: "" },
        ]);
        setQueue((prev) => prev.filter((item) => item.id !== upload.id));
      } catch (error) {
        const message = error instanceof Error ? error.message : "The upload failed.";
        setQueue((prev) =>
          prev.map((item) =>
            item.id === upload.id ? { ...item, status: "error", error: message } : item,
          ),
        );
      }
    },
    [uploadFile],
  );

  const uploadFiles = useCallback(
    (files: File[]) => {
      for (const file of files) {
        const upload: QueuedUpload = {
          id: crypto.randomUUID(),
          name: file.name,
          status: "uploading",
          progress: 30,
          file,
        };
        setQueue((prev) => [...prev, upload]);
        void send(upload);
      }
    },
    [send],
  );

  const retry = useCallback(
    (id: string) => {
      const upload = queue.find((item) => item.id === id);
      if (!upload) return;
      const next: QueuedUpload = {
        id: upload.id,
        name: upload.name,
        file: upload.file,
        status: "uploading",
        progress: 30,
      };
      setQueue((prev) => prev.map((item) => (item.id === id ? next : item)));
      void send(next);
    },
    [queue, send],
  );

  const dismissUpload = useCallback((id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const persist = useCallback(
    async (nextItems: DayMediaItem[]): Promise<StaffActionResult> => {
      const result = await adminUpdateSaleResultAction(saleId, {
        dayImages: itemsToDayImages(nextItems),
      });
      if (!result.ok) return { ok: false, error: result.error ?? "The media was not saved." };
      savedRef.current = JSON.stringify(itemsToDayImages(nextItems));
      router.refresh();
      return { ok: true };
    },
    [router, saleId],
  );

  const save = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    const result = await persist(items);
    setSaving(false);
    if (!result.ok) setSaveError(result.error);
    return result.ok;
  }, [items, persist]);

  /** Removes an item; after the sale it also saves, so the public gallery loses it at once. */
  const removeAndSave = useCallback(
    async (itemId: string): Promise<StaffActionResult> => {
      const next = items.filter((item) => item.id !== itemId);
      const result = await persist(next);
      if (result.ok) setItems(next);
      return result;
    },
    [items, persist],
  );

  const update = useCallback((itemId: string, patch: Partial<DayMediaItem>) => {
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  }, []);

  return {
    items,
    setItems,
    update,
    queue,
    uploadFiles,
    retry,
    dismissUpload,
    saving,
    saveError,
    save,
    removeAndSave,
    isEnded,
    dirty,
    anyUploading: queue.some((item) => item.status !== "error"),
  };
}
