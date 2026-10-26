import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { Notice } from "@auction/staff-ui";

/**
 * The reason an action that redirected back to a record page failed, read from the page's
 * `?error=` parameter, above the page's work. Nothing renders without one.
 */
export function StaffActionError({
  error,
  title = "That did not go through",
}: {
  error?: string | null | undefined;
  title?: string;
}) {
  const message = error ? safeDecodeAdminErrorParam(error) : null;
  if (!message) return null;
  return (
    <Notice tone="danger" alert title={title}>
      {message}
    </Notice>
  );
}
