"use client";

import { OverflowMenu, StaffButton, type StaffLinkComponent } from "@auction/staff-ui";
import { FileInput, Plus } from "@auction/staff-ui/icons";
import Link from "next/link";

const NextLink: StaffLinkComponent = Link;

/**
 * The artwork list's header actions: a new artwork, and import by catalogue key for re-syncing
 * a row from an external catalogue (the one thing the editor does not do).
 */
export function ArtworksPageActions() {
  return (
    <>
      <OverflowMenu
        Link={NextLink}
        actions={[
          {
            id: "import",
            label: "Import by catalogue key",
            icon: FileInput,
            href: "/artworks/import",
          },
        ]}
      />
      <StaffButton asChild variant="primary" icon={<Plus aria-hidden />}>
        <Link href="/artworks/new">New artwork</Link>
      </StaffButton>
    </>
  );
}
