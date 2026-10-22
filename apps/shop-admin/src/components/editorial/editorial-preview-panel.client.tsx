"use client";

import { formatLondonDateTime } from "@/lib/editorial-time";
import { Button } from "@auction/ui";
import { useState } from "react";

export type EditorialPreview = { token: string; expiresAt: string; url: string | null };

/** A draft preview link. It opens lax.art in a new tab and works for anyone until it expires. */
export function EditorialPreviewPanel({
  preview,
  onClose,
}: {
  preview: EditorialPreview;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");
  const copyValue = preview.url ?? preview.token;
  return (
    <section
      aria-label="Draft preview link"
      className="space-y-2 rounded border border-border-hairline bg-surface-container-low p-3 text-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">Draft preview</p>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          Dismiss
        </Button>
      </div>
      <p className="text-xs text-on-surface-variant">
        Expires {formatLondonDateTime(preview.expiresAt)}. Anyone with the link can view the draft
        until then.
      </p>
      {preview.url ? (
        <a
          href={preview.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block font-medium text-primary underline underline-offset-4"
        >
          Open preview (opens in a new tab)
        </a>
      ) : (
        <p className="text-xs text-on-surface-variant">
          The lax.art address is not configured here, so only the token is shown. Open{" "}
          <code>/preview/&lt;token&gt;</code> on lax.art.
        </p>
      )}
      <code className="block break-all rounded bg-surface px-2 py-1 font-mono text-xs">
        {preview.url ?? preview.token}
      </code>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(copyValue).then(
              () => setCopied("copied"),
              () => setCopied("failed"),
            );
          }}
        >
          {preview.url ? "Copy link" : "Copy token"}
        </Button>
        <output className="text-xs text-on-surface-variant">
          {copied === "copied"
            ? "Copied."
            : copied === "failed"
              ? "Copy failed; select it manually."
              : ""}
        </output>
      </div>
    </section>
  );
}
