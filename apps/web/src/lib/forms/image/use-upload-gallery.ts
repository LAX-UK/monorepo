"use client";

import type { ImageUploadKind } from "@/components/forms/image-upload-field";
import {
  type ConfirmedUpload,
  useUploadObjectLifecycle,
} from "@/hooks/use-upload-object-lifecycle";
import { useCallback, useState } from "react";

export type UploadGalleryItem = {
  id: string;
  fileName: string;
  status: "uploading" | "validating" | "done" | "error";
  message?: string;
  progress?: number;
  file?: File;
};

type Args = {
  kind: ImageUploadKind;
  value: string[];
  onChange: (next: string[]) => void;
  maxFiles: number;
  onError?: (message: string) => void;
};

export function useUploadGallery({ kind, value, onChange, maxFiles, onError }: Args) {
  const { uploadFile } = useUploadObjectLifecycle();
  const [items, setItems] = useState<UploadGalleryItem[]>([]);

  const updateItem = useCallback((fileName: string, patch: Partial<UploadGalleryItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.fileName === fileName ? { ...item, ...patch } : item)),
    );
  }, []);

  const uploadOne = useCallback(
    async (file: File, currentValue: string[]): Promise<ConfirmedUpload | null> => {
      const itemId = `${file.name}-${Date.now()}`;
      setItems((prev) => [
        ...prev,
        { id: itemId, fileName: file.name, status: "uploading", progress: 10, file },
      ]);
      try {
        updateItem(file.name, { status: "validating", progress: 60, message: "Validating…" });
        const uploaded = await uploadFile(file, kind);
        updateItem(file.name, { status: "done", progress: 100, message: "Uploaded" });
        const nextUploads = [uploaded.key].filter((key) => !currentValue.includes(key));
        if (nextUploads.length > 0) {
          onChange([...currentValue, ...nextUploads]);
        }
        return uploaded;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        updateItem(file.name, { status: "error", message });
        onError?.(message);
        return null;
      }
    },
    [kind, onChange, onError, updateItem, uploadFile],
  );

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files).slice(0, Math.max(0, maxFiles - value.length));
      let current = value;
      for (const file of fileArray) {
        const uploaded = await uploadOne(file, current);
        if (uploaded) current = [...current, uploaded.key];
      }
    },
    [maxFiles, uploadOne, value],
  );

  const retry = useCallback(
    async (fileName: string) => {
      const item = items.find((i) => i.fileName === fileName);
      if (!item?.file) return;
      setItems((prev) => prev.filter((i) => i.fileName !== fileName));
      await uploadOne(item.file, value);
    },
    [items, uploadOne, value],
  );

  const clearFinished = useCallback(() => {
    setItems((prev) => prev.filter((i) => i.status === "uploading" || i.status === "validating"));
  }, []);

  return { items, uploadFiles, retry, clearFinished };
}
