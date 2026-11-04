import { DashboardErrorAlert } from "@/components/dashboard/primitives/dashboard-error-alert";
import { FlashClear } from "@/components/flash/flash-clear";
import { CLIENT_FLASH_CLEAR_ENDPOINT } from "@/lib/flash/client-flash";
import { readClientFlashForPath } from "@/lib/flash/client-flash.server";

/**
 * What the action that sent someone back to this page has to say, shown once under the page
 * title. The message arrives in a signed cookie for this path, never in the URL. Nothing renders
 * when there is no message; only errors are shown, as client actions report success by moving on.
 */
export async function ClientFlashNotice({
  path,
  title = "We couldn't save that",
}: {
  path: string;
  title?: string;
}) {
  const flash = await readClientFlashForPath(path);
  if (!flash || flash.kind !== "error") return null;
  return (
    <>
      <DashboardErrorAlert title={title} message={flash.message} role="alert" />
      <FlashClear endpoint={CLIENT_FLASH_CLEAR_ENDPOINT} path={path} />
    </>
  );
}
