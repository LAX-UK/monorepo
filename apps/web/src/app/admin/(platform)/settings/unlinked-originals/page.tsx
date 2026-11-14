import { BlockUnlinkedPublishing } from "@/components/admin/unlinked-originals/block-unlinked-publishing";
import { UnlinkedOriginalsList } from "@/components/admin/unlinked-originals/unlinked-originals-list";
import { loadUnlinkedOriginalsPage } from "@/lib/admin/unlinked-originals/load-unlinked-originals-page";
import { requireAdminCapability } from "@/lib/auth/require-admin-capability";
import { LOTS_READ_ACCESS, PLATFORM_ADMIN_ACCESS } from "@/lib/navigation/staff-nav-access";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { FormPage, Notice } from "@auction/staff-ui";
import { userHasAccessTo } from "@auction/types";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Unlinked originals",
  "Live originals with no Zoho record, and the switch that stops LAX Bid publishing more.",
);

export default async function AdminUnlinkedOriginalsPage() {
  const user = await requireAdminCapability(LOTS_READ_ACCESS, "/admin/settings/unlinked-originals");
  const { view, loadError } = await loadUnlinkedOriginalsPage();
  const canEdit = userHasAccessTo(user.role, user.staffRoles, PLATFORM_ADMIN_ACCESS);

  return (
    <FormPage
      title="Unlinked originals"
      description="Originals that are live without a Zoho record, and the switch that stops LAX Bid publishing more."
    >
      {view ? (
        <>
          <BlockUnlinkedPublishing
            enabled={view.blockPublishing}
            canEdit={canEdit}
            unlinked={view.counts.bid + view.counts.laxArt}
          />
          <UnlinkedOriginalsList items={view.items} counts={view.counts} />
        </>
      ) : (
        <Notice tone="warning" title="The report could not load">
          {loadError}
        </Notice>
      )}
    </FormPage>
  );
}
