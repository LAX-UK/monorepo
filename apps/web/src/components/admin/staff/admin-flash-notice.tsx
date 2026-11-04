import { AdminFlashClear } from "@/components/admin/staff/admin-flash-clear";
import { readAdminFlashForPath } from "@/lib/admin/flash/flash.server";
import { Notice } from "@auction/staff-ui";

/**
 * What the action that sent staff to this page has to say, shown once above the page's work.
 * The message arrives in a signed cookie for this path, never in the URL. Nothing renders when
 * there is no message.
 */
export async function AdminFlashNotice({
  path,
  errorTitle = "That did not go through",
}: {
  path: string;
  errorTitle?: string;
}) {
  const flash = await readAdminFlashForPath(path);
  if (!flash) return null;
  return (
    <>
      {flash.kind === "success" ? (
        <Notice tone="success" title={flash.message} />
      ) : (
        <Notice tone="danger" alert title={errorTitle}>
          {flash.message}
        </Notice>
      )}
      <AdminFlashClear path={path} />
    </>
  );
}
