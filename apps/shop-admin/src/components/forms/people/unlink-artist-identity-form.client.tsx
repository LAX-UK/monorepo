"use client";

import { useAdminMutation } from "@/components/use-admin-mutation";
import { unlinkArtistIdentity } from "@/server/application/admin-people-actions.server";
import { ConfirmDialog } from "@auction/ui";
import { useState } from "react";
import { AdminForm } from "../admin-form";

/** Unlinking changes who can act as this artist, so it asks first. */
export function UnlinkArtistIdentityForm({ artistId }: { artistId: string }) {
  const mutation = useAdminMutation();
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <AdminForm
        title="Unlink login"
        mutation={mutation}
        errors={{}}
        submitLabel="Unlink identity"
        onSubmit={() => setConfirming(true)}
      >
        {null}
      </AdminForm>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Unlink this artist's login"
        body="The login is no longer linked to this artist. You can link a login again by email."
        confirmLabel="Unlink login"
        tone="warning"
        loading={mutation.pending}
        onConfirm={async () => {
          await mutation.run(
            () => unlinkArtistIdentity({ artistId, idempotencyKey: mutation.idempotencyKey }),
            "Identity unlinked",
          );
          setConfirming(false);
        }}
      />
    </>
  );
}
