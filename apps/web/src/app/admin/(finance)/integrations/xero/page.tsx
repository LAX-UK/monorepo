import { StaffBreadcrumbs } from "@/components/admin/staff/staff-breadcrumbs";
import { UrlSuccessToast } from "@/components/admin/staff/url-success-toast";
import { XeroIntegrationPanel } from "@/components/admin/xero-integration-panel";
import { adminXeroDisconnectAction, adminXeroOAuthStartAction } from "@/lib/actions/admin";
import { loadAdminXeroIntegrationPage } from "@/lib/admin/finance/load-xero-integration-page";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { Notice, PageHeader } from "@auction/staff-ui";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Xero",
  "Connect a Xero organisation for hosted invoices and payment collection.",
);

export default async function AdminXeroIntegrationPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; connected?: string }>;
}) {
  const { error, connected, status, loadError } = await loadAdminXeroIntegrationPage(
    await searchParams,
  );
  const notice = error ? (
    <Notice tone="danger" alert title="Xero did not connect">
      {error}
    </Notice>
  ) : null;

  return (
    <>
      <UrlSuccessToast message={connected && !error ? "Xero connected" : null} param="connected" />
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
