import { resolveAdminNotice } from "@/lib/admin/admin-notice";
import { Notice } from "@auction/staff-ui";

/**
 * The fixed sentence for a notice code in the page's `?notice=`, above the page's work. An
 * unknown code, or none, renders nothing.
 */
export function AdminCodeNotice({
  code,
  errorTitle = "That did not go through",
}: {
  code: string | string[] | undefined;
  errorTitle?: string;
}) {
  const { success, error } = resolveAdminNotice(code);
  if (success) return <Notice tone="success" title={success} />;
  if (error) {
    return (
      <Notice tone="danger" alert title={errorTitle}>
        {error}
      </Notice>
    );
  }
  return null;
}
