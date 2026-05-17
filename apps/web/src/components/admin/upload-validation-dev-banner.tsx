"use client";

import { useEffect, useState } from "react";

type Health = { ok: boolean; workers: number };

export function UploadValidationDevBanner() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const base = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3001";
    void fetch(`${base}/system/health/upload-validation`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) return;
        const body = (await res.json()) as Health;
        setHealth(body);
      })
      .catch(() => {
        setHealth({ ok: false, workers: 0 });
      });
  }, []);

  if (process.env.NODE_ENV !== "development") return null;
  if (!health || health.ok) return null;

  return (
    <output className="mb-6 block rounded-md border border-error/30 bg-error/5 px-4 py-3 font-body text-sm text-on-surface">
      <p className="font-medium text-error">Upload validation worker offline</p>
      <p className="mt-1 text-on-surface-variant">
        Images upload to storage but stay pending until the BullMQ <code>validate-upload</code>{" "}
        worker runs ({health.workers} workers connected). Start <code>apps/worker</code> locally.
      </p>
    </output>
  );
}
