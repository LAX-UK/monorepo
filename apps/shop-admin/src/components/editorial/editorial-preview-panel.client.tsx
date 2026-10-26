"use client";

import { Notice, StaffButton, formatStaffDateTime, toast } from "@auction/staff-ui";
import { Copy, ExternalLink } from "@auction/staff-ui/icons";

export type EditorialPreview = { token: string; expiresAt: string; url: string | null };

/** A draft preview link. It opens lax.art in a new tab and works for anyone until it expires. */
export function EditorialPreviewPanel({
  preview,
  onClose,
}: {
  preview: EditorialPreview;
  onClose: () => void;
}) {
  const copyValue = preview.url ?? preview.token;
  return (
    <Notice
      title="Draft preview link"
      actions={
        <>
          {preview.url ? (
            <StaffButton asChild size="sm" variant="secondary" icon={<ExternalLink aria-hidden />}>
              <a href={preview.url} target="_blank" rel="noopener noreferrer">
                Open preview
              </a>
            </StaffButton>
          ) : null}
          <StaffButton
            type="button"
            size="sm"
            variant="secondary"
            icon={<Copy aria-hidden />}
            onClick={() => {
              navigator.clipboard.writeText(copyValue).then(
                () => toast.success(preview.url ? "Link copied" : "Token copied"),
                () => toast.error("Could not copy. Select the link and copy it yourself."),
              );
            }}
          >
            {preview.url ? "Copy link" : "Copy token"}
          </StaffButton>
          <StaffButton type="button" size="sm" variant="ghost" onClick={onClose}>
            Dismiss
          </StaffButton>
        </>
      }
    >
      <p>
        Anyone with the link can view the draft until{" "}
        {formatStaffDateTime(preview.expiresAt, { zoneLabel: true })}.
      </p>
      {preview.url ? null : (
        <p>
          The lax.art address is not set up here, so only the token is available. Open{" "}
          <code>/preview/&lt;token&gt;</code> on lax.art.
        </p>
      )}
    </Notice>
  );
}
