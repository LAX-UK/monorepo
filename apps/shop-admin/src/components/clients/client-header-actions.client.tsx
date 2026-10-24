"use client";

import { GrantSaleAuthorityDialog } from "@/components/clients/grant-sale-authority-dialog.client";
import type { LookupOption } from "@/server/domain/lookup-options.vm";
import { StaffButton } from "@auction/staff-ui";
import { ShieldCheck } from "@auction/staff-ui/icons";
import { useState } from "react";

/** The client page's one primary action: grant sale authority, for roles that can. */
export function ClientHeaderActions({
  client,
  ownedArtworks,
}: {
  client: LookupOption;
  ownedArtworks: LookupOption[];
}) {
  const [granting, setGranting] = useState(false);
  return (
    <>
      <StaffButton
        variant="primary"
        icon={<ShieldCheck aria-hidden />}
        onClick={() => setGranting(true)}
      >
        Grant sale authority
      </StaffButton>
      {granting ? (
        <GrantSaleAuthorityDialog
          open
          onOpenChange={setGranting}
          client={client}
          ownedArtworks={ownedArtworks}
        />
      ) : null}
    </>
  );
}
