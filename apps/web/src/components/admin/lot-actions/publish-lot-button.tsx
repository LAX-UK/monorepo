"use client";

import { AdminLotConnectRequiredBanner } from "@/components/admin/admin-lot-connect-required-banner";
import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import { adminPublishLotResultAction } from "@/lib/actions/admin";
import { Can } from "@/lib/auth/capabilities";
import { SALES_ACCESS } from "@/lib/navigation/staff-nav-access";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

type Props = {
  lotId: string;
  sellerLegalEntityId: string | null;
  disabled?: boolean;
};

export function PublishLotButton({ lotId, sellerLegalEntityId, disabled }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [connectRequired, setConnectRequired] = useState(false);
  const [open, setOpen] = useState(false);
  const idempotencyKeyRef = useRef(`lot-publish-${crypto.randomUUID()}`);

  return (
    <Can requirement={SALES_ACCESS}>
      {connectRequired ? (
        <AdminLotConnectRequiredBanner sellerLegalEntityId={sellerLegalEntityId} />
      ) : null}
      <Button type="button" size="sm" disabled={disabled || pending} onClick={() => setOpen(true)}>
        Publish
      </Button>
      <TypedConfirmationDialog
        open={open}
        onOpenChange={setOpen}
        title="Publish this lot?"
        description="The lot will be scheduled and visible according to its sale timing. Confirm only when catalogue details are complete."
        actionLabel="Publish lot"
        confirmationPhrase="PUBLISH"
        severity="warning"
        onConfirm={async () => {
          await new Promise<void>((resolve, reject) => {
            startTransition(() => {
              void (async () => {
                try {
                  const r = await adminPublishLotResultAction(lotId, idempotencyKeyRef.current);
                  if (r.ok) {
                    setConnectRequired(false);
                    notify.success("Published");
                    router.refresh();
                    resolve();
                    return;
                  }
                  if (r.errorCode === "connect_required") {
                    setConnectRequired(true);
                    reject(new Error("connect_required"));
                    return;
                  }
                  notify.error(r.error);
                  reject(new Error(r.error));
                } catch (e) {
                  reject(e);
                }
              })();
            });
          });
        }}
      />
    </Can>
  );
}
