"use client";

import type { LotCatalogueProfile } from "@/lib/admin/lot-catalogue";
import { Notice, StaffButton } from "@auction/staff-ui";

type Props = {
  profile: LotCatalogueProfile;
  onEditLotType?: (() => void) | undefined;
};

/** Which lot type the pricing and bidding fields below follow, with a way back to change it. */
export function LotTypeSummaryBanner({ profile, onEditLotType }: Props) {
  return (
    <Notice
      tone="info"
      title={profile.label}
      actions={
        onEditLotType ? (
          <StaffButton type="button" size="sm" variant="secondary" onClick={onEditLotType}>
            Change type
          </StaffButton>
        ) : null
      }
    >
      {profile.summary} The pricing and bidding fields below follow this type.
    </Notice>
  );
}
