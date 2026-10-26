import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { Notice } from "@auction/staff-ui";

type Props = {
  error?: string | null | undefined;
  title?: string;
  /** Kept for existing callers; the notice sits in the page's own flow and spacing. */
  className?: string;
};

/** Why an action that redirected back to this page failed, from the page's `?error=`. */
export function CatalogDetailActionError({ error, title = "That did not go through" }: Props) {
  const message = error ? safeDecodeAdminErrorParam(error) : null;
  if (!message) return null;
  return (
    <Notice tone="danger" alert title={title}>
      {message}
    </Notice>
  );
}
