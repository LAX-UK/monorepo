"use client";

import {
  ARTIST_APPLICATION_UPLOAD_PATH,
  checkApplicationImage,
} from "@/lib/artist-application/artist-application-upload";
import type { MyArtistApplication } from "@auction/shop-contracts";
import { ARTIST_APPLICATION_LIMITS } from "@auction/shop-domain";
import { useCallback, useRef, useState } from "react";

export type ApplicationUpload = {
  id: string;
  name: string;
  /** 0 to 1 while sending; null once the file has arrived and is being checked. */
  progress: number | null;
  error: string | null;
};

type Answer = { ok: true; application: MyArtistApplication } | { ok: false; message: string };

function send(
  file: File,
  applicationId: string | null,
  onProgress: (fraction: number | null) => void,
): Promise<Answer> {
  return new Promise((resolve) => {
    const body = new FormData();
    body.set("file", file);
    if (applicationId) body.set("applicationId", applicationId);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", ARTIST_APPLICATION_UPLOAD_PATH);
    xhr.responseType = "json";
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    });
    xhr.upload.addEventListener("load", () => onProgress(null));
    xhr.onload = () => {
      const answer = xhr.response as Answer | null;
      resolve(
        answer && typeof answer === "object" && "ok" in answer
          ? answer
          : { ok: false, message: `We could not upload ${file.name}. Try again.` },
      );
    };
    xhr.onerror = () =>
      resolve({
        ok: false,
        message: `${file.name} did not upload. Check your connection and try again.`,
      });
    xhr.send(body);
  });
}

/**
 * The work step's uploads: files are checked here first (type, size, how many still fit), then
 * sent one at a time so the application is started once and each image lands in order. Every
 * file shows its own progress and, if it fails, why.
 */
export function useApplicationUploads({
  applicationId,
  workCount,
  onUploaded,
}: {
  applicationId: string | null;
  workCount: number;
  onUploaded: (application: MyArtistApplication) => void;
}) {
  const [uploads, setUploads] = useState<ApplicationUpload[]>([]);
  const counter = useRef(0);
  const busy = uploads.some((upload) => upload.error === null);

  const update = useCallback((id: string, change: Partial<ApplicationUpload>) => {
    setUploads((current) =>
      current.map((upload) => (upload.id === id ? { ...upload, ...change } : upload)),
    );
  }, []);

  const add = useCallback(
    async (files: readonly File[]) => {
      const room = ARTIST_APPLICATION_LIMITS.maxWorks - workCount;
      const queued = files.map((file, index) => {
        counter.current += 1;
        const check = checkApplicationImage(file);
        const error = !check.ok
          ? check.message
          : index >= room
            ? `${file.name} was not added: an application holds up to ${ARTIST_APPLICATION_LIMITS.maxWorks} works.`
            : null;
        return {
          file,
          upload: { id: `upload-${counter.current}`, name: file.name, progress: 0, error },
        };
      });
      setUploads((current) => [...current, ...queued.map((item) => item.upload)]);

      let id = applicationId;
      for (const { file, upload } of queued) {
        if (upload.error) continue;
        const answer = await send(file, id, (progress) => update(upload.id, { progress }));
        if (answer.ok) {
          id = answer.application.id;
          onUploaded(answer.application);
          setUploads((current) => current.filter((item) => item.id !== upload.id));
        } else {
          update(upload.id, { error: answer.message, progress: null });
        }
      }
    },
    [applicationId, onUploaded, update, workCount],
  );

  const dismiss = useCallback((id: string) => {
    setUploads((current) => current.filter((upload) => upload.id !== id));
  }, []);

  return { uploads, busy, add, dismiss };
}
