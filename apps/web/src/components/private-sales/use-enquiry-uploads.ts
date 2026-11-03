"use client";

import { EnquiryUploadError, uploadEnquiryFile } from "@/lib/private-sales/enquiry-upload.client";
import {
  type UploadItem,
  addPicked,
  doneUploadIds,
  markDone,
  markProgress,
  markRejected,
  pickFiles,
  removeItem,
} from "@/lib/private-sales/enquiry-uploads";
import { useCallback, useEffect, useRef, useState } from "react";

export type StartDraft = () => Promise<string | null>;

export type EnquiryUploads = {
  items: UploadItem[];
  addFiles: (files: File[]) => void;
  remove: (id: string) => void;
  /** The checked files to send, in the order shown. */
  uploadIds: string[];
  /** The draft the files are held under; null for a signed-in sender or before the first file. */
  draftToken: string | null;
  /** True once a file has been picked, so the page knows to keep the draft with the form. */
  hasFiles: boolean;
};

/**
 * The queue of photos and documents for one enquiry. A visitor's first file starts a draft
 * (their files are held under it for 24 hours); a signed-in sender uploads with their session.
 * Files upload as they are chosen, one queue entry each, and a refused file stays with its reason.
 */
export function useEnquiryUploads({
  signedIn,
  startDraft,
}: {
  signedIn: boolean;
  startDraft: StartDraft;
}): EnquiryUploads {
  const [items, setItems] = useState<UploadItem[]>([]);
  const itemsRef = useRef<UploadItem[]>([]);
  const draft = useRef<Promise<string | null> | null>(null);
  const [draftToken, setDraftToken] = useState<string | null>(null);
  const previews = useRef(new Map<string, string>());
  const aborts = useRef(new Map<string, AbortController>());

  const commit = useCallback((next: (current: UploadItem[]) => UploadItem[]) => {
    itemsRef.current = next(itemsRef.current);
    setItems(itemsRef.current);
  }, []);

  const ensureDraft = useCallback((): Promise<string | null> => {
    if (signedIn) return Promise.resolve(null);
    if (!draft.current) {
      draft.current = startDraft().then((token) => {
        setDraftToken(token);
        return token;
      });
    }
    return draft.current;
  }, [signedIn, startDraft]);

  const upload = useCallback(
    async (id: string, file: File, kind: UploadItem["kind"]) => {
      const abort = new AbortController();
      aborts.current.set(id, abort);
      try {
        const token = await ensureDraft();
        if (!signedIn && !token) {
          throw new EnquiryUploadError("we couldn't start the upload. Try again in a moment.");
        }
        const uploadId = await uploadEnquiryFile(file, kind, {
          draftToken: token ?? undefined,
          signal: abort.signal,
          onProgress: (fraction) => commit((current) => markProgress(current, id, fraction)),
        });
        commit((current) => markDone(current, id, uploadId));
      } catch (error) {
        if (abort.signal.aborted) return;
        const reason = error instanceof EnquiryUploadError ? error.reason : "the upload failed";
        commit((current) => markRejected(current, id, reason));
      } finally {
        aborts.current.delete(id);
      }
    },
    [commit, ensureDraft, signedIn],
  );

  const addFiles = useCallback(
    (files: File[]) => {
      const picked = pickFiles(files, itemsRef.current);
      const ids = picked.map(() => crypto.randomUUID());
      let index = 0;
      commit((current) =>
        addPicked(current, picked, () => ids[index++] as string).map((item) => {
          const at = ids.indexOf(item.id);
          const pick = at >= 0 ? picked[at] : undefined;
          if (pick && pick.kind === "image" && !pick.refusal) {
            const url = URL.createObjectURL(pick.file);
            previews.current.set(item.id, url);
            return { ...item, previewUrl: url };
          }
          return item;
        }),
      );
      picked.forEach((pick, at) => {
        if (!pick.refusal) void upload(ids[at] as string, pick.file, pick.kind);
      });
    },
    [commit, upload],
  );

  const remove = useCallback(
    (id: string) => {
      aborts.current.get(id)?.abort();
      const url = previews.current.get(id);
      if (url) {
        URL.revokeObjectURL(url);
        previews.current.delete(id);
      }
      commit((current) => removeItem(current, id));
    },
    [commit],
  );

  useEffect(() => {
    const urls = previews.current;
    const running = aborts.current;
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
      for (const abort of running.values()) abort.abort();
    };
  }, []);

  return {
    items,
    addFiles,
    remove,
    uploadIds: doneUploadIds(items),
    draftToken,
    hasFiles: items.length > 0,
  };
}
