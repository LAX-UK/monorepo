"use client";

import { DocumentUploadField } from "@/components/forms/document-upload-field";
import { adminFulfillConditionReportAction } from "@/lib/actions/admin";
import { Button } from "@auction/ui/components/button";
import { useState } from "react";

type Props = {
  requestId: string;
};

export function ConditionReportFulfillForm({ requestId }: Props) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  return (
    <form
      action={adminFulfillConditionReportAction}
      className="mt-4 space-y-2 border-t border-border-hairline pt-4"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="downloadUrl" value={downloadUrl ?? ""} />
      <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Publish to catalogue
      </p>
      <input
        name="summary"
        placeholder="Summary (public)"
        className="w-full rounded border border-outline-variant/40 bg-surface px-2 py-2 font-body text-sm"
      />
      <textarea
        name="details"
        placeholder="Details (public)"
        className="min-h-20 w-full rounded border border-outline-variant/40 bg-surface px-2 py-2 font-body text-sm"
      />
      <div className="space-y-1">
        <p className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
          Condition report file
        </p>
        <DocumentUploadField
          kind="lot_document"
          valueMode="publicUrl"
          value={downloadUrl}
          onChange={setDownloadUrl}
        />
      </div>
      <textarea
        name="responseNote"
        placeholder="Internal note (optional)"
        className="min-h-16 w-full rounded border border-outline-variant/40 bg-surface px-2 py-2 font-body text-xs"
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" className="min-h-9">
          Fulfill & publish
        </Button>
      </div>
    </form>
  );
}
