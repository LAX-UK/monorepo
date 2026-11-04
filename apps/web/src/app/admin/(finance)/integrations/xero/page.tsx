import { AdminFlashClear } from "@/components/admin/staff/admin-flash-clear";
import { StaffBreadcrumbs } from "@/components/admin/staff/staff-breadcrumbs";
import { UrlSuccessToast } from "@/components/admin/staff/url-success-toast";
import { XeroIntegrationPanel } from "@/components/admin/xero-integration-panel";
import { adminXeroDisconnectAction, adminXeroOAuthStartAction } from "@/lib/actions/admin";
import { loadAdminXeroIntegrationPage } from "@/lib/admin/finance/load-xero-integration-page";
import { readAdminFlashForPath } from "@/lib/admin/flash/flash.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { Notice, PageHeader } from "@auction/staff-ui";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Xero",
  "Connect a Xero organisation for hosted invoices and payment collection.",
);

const XERO_PATH = "/admin/integrations/xero";

export default async function AdminXeroIntegrationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const { error, connected, status, loadError } = await loadAdminXeroIntegrationPage(
    await searchParams,
  );
  const flash = await readAdminFlashForPath(XERO_PATH);
  const failure = flash?.kind === "error" ? flash.message : error;
  const notice = failure ? (
    <Notice tone="danger" alert title="Xero did not connect">
      {failure}
    </Notice>
  ) : null;

  return (
    <>
      {flash ? <AdminFlashClear path={XERO_PATH} /> : null}
      <UrlSuccessToast
        message={connected && !failure ? "Xero connected" : null}
        param="connected"
      />
      {status ? (
        <XeroIntegrationPanel
          status={status}
          oauthStartAction={adminXeroOAuthStartAction}
          disconnectAction={adminXeroDisconnectAction}
          notice={notice}
        />
      ) : (
        <div className="flex flex-col gap-6">
          <PageHeader
            breadcrumbs={
              <StaffBreadcrumbs
                items={[{ label: "Finance", href: "/admin/finance" }, { label: "Xero" }]}
              />
            }
            title="Xero"
          />
          {notice}
          <Notice tone="danger" alert title="The Xero connection could not load">
            {loadError ?? "Try again in a moment."}
          </Notice>
        </div>
      )}
    </>
  );
}
