"use client";

import {
  type ConfirmedUpload,
  useUploadObjectLifecycle,
} from "@/hooks/use-upload-object-lifecycle";
import {
  type CatalogImageUploadKind,
  getCatalogImagePolicy,
} from "@/lib/upload/upload-policies.client";
import { useCallback, useEffect, useState } from "react";

export type UploadGalleryItem = {
  id: string;
  fileName: string;
  status: "uploading" | "validating" | "done" | "error";
  message?: string;
  progress?: number;
  file?: File;
  replace?: boolean;
};

type Args = {
  kind: CatalogImageUploadKind;
  value: string[];
  onChange: (next: string[]) => void;
  maxFiles: number;
  onError?: (message: string) => void;
};

type UploadFilesOptions = {
  /** Replace the current collection instead of appending to it. */
  replace?: boolean;
};

export function useUploadGallery({ kind, value, onChange, maxFiles, onError }: Args) {
  const { uploadFile } = useUploadObjectLifecycle();
  const [items, setItems] = useState<UploadGalleryItem[]>([]);

  const updateItem = useCallback((itemId: string, patch: Partial<UploadGalleryItem>) => {
    setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item)));
  }, []);

  const uploadOne = useCallback(
    async (
      file: File,
      currentValue: string[],
      options: UploadFilesOptions = {},
    ): Promise<ConfirmedUpload | null> => {
      const itemId = crypto.randomUUID();
      setItems((prev) => [
        ...prev,
        {
          id: itemId,
          fileName: file.name,
          status: "uploading",
          progress: 10,
          file,
          ...(options.replace ? { replace: true } : {}),
        },
      ]);
      const policy = getCatalogImagePolicy(kind);
      const acceptedTypes = new Set(policy.accept.split(","));
      const validationMessage =
        file.size > policy.maxBytes
          ? `File exceeds the ${Math.round(policy.maxBytes / 1024 / 1024)} MB limit.`
          : file.type && !acceptedTypes.has(file.type)
            ? "Unsupported file type."
            : null;
      if (validationMessage) {
        updateItem(itemId, { status: "error", message: validationMessage });
        onError?.(validationMessage);
        return null;
      }
      try {
        updateItem(itemId, { status: "validating", progress: 60, message: "Validating…" });
        const uploaded = await uploadFile(file, kind);
        updateItem(itemId, { status: "done", progress: 100, message: "Uploaded" });
        const nextUploads = [uploaded.key].filter((key) => !currentValue.includes(key));
        if (nextUploads.length > 0) {
          onChange([...currentValue, ...nextUploads]);
        }
        return uploaded;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        updateItem(itemId, { status: "error", message });
        onError?.(message);
        return null;
      }
    },
    [kind, onChange, onError, updateItem, uploadFile],
  );

  const uploadFiles = useCallback(
    async (files: FileList | File[], options: UploadFilesOptions = {}) => {
      const currentValue = options.replace ? [] : value;
      const fileArray = Array.from(files).slice(0, Math.max(0, maxFiles - currentValue.length));
      let current = currentValue;
      for (const file of fileArray) {
        const uploaded = await uploadOne(file, current, options);
        if (uploaded) current = [...current, uploaded.key];
      }
    },
    [maxFiles, uploadOne, value],
  );

  const retry = useCallback(
    async (itemId: string) => {
      const item = items.find((i) => i.id === itemId);
      if (!item?.file) return;
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      await uploadOne(item.file, item.replace ? [] : value, item.replace ? { replace: true } : {});
    },
    [items, uploadOne, value],
  );

  const clearFinished = useCallback(() => {
    setItems((prev) => prev.filter((i) => i.status === "uploading" || i.status === "validating"));
  }, []);

  useEffect(() => {
    if (!items.some((item) => item.status === "done")) return;
    const timeout = window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.status !== "done"));
    }, 2_000);
    return () => window.clearTimeout(timeout);
  }, [items]);

  return { items, uploadFiles, retry, clearFinished };
}
