"use client";

import { SOF_EVIDENCE_CHECKLIST } from "@/lib/admin/sof-evidence-checklist";
import type { AdminSourceOfFundsDetail } from "@/lib/data/http/compliance.server";

type Props = {
  detail: AdminSourceOfFundsDetail | null;
  evidenceCount: number;
};

export function SofEvidenceList({ detail, evidenceCount }: Props) {
  const downloads = detail?.evidenceDownloads ?? [];

  if (downloads.length === 0 && evidenceCount === 0) {
    return (
      <div className="space-y-2">
        <p className="font-body text-sm text-on-surface-variant">None submitted</p>
        <div>
          <p className="font-label text-[10px] uppercase text-on-surface-variant">
            Documents to request
          </p>
          <ul className="mt-1 list-inside list-disc font-body text-sm text-on-surface-variant">
            {SOF_EVIDENCE_CHECKLIST.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if (downloads.length === 0) {
    return (
      <p className="font-body text-sm text-on-surface-variant">
        {evidenceCount} file{evidenceCount === 1 ? "" : "s"} attached — reload detail to fetch
        download links.
      </p>
    );
  }

  return (
    <ul className="mt-1 space-y-1">
      {downloads.map((file) => (
        <li
          key={file.key}
          className="flex items-center gap-2 rounded border border-border-hairline bg-surface-container-low px-2 py-1 text-sm"
        >
          {file.downloadUrl ? (
            <a
              href={file.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-link underline"
              title={file.key}
            >
              {file.fileName}
            </a>
          ) : (
            <span className="truncate text-on-surface-variant" title={file.key}>
              {file.fileName}
            </span>
          )}
          <span className="shrink-0 font-label text-[9px] uppercase tracking-wide text-secondary">
            {file.downloadUrl ? "Download" : "Unavailable"}
          </span>
        </li>
      ))}
    </ul>
  );
}
