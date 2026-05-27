"use client";

import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import { adminPublishLotResultAction } from "@/lib/actions/admin";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";

type Props = {
  lotId: string;
  sellerLegalEntityId: string | null;
  disabled?: boolean;
  /** Proactive server check — disables publish; banner shown by page/layout, not here. */
  connectBlocked?: boolean;
};

/** Publish control — parent gates visibility via `canPublish` (capability + lot status). */
export function PublishLotButton({
  lotId,
  sellerLegalEntityId: _sellerLegalEntityId,
  disabled,
  connectBlocked = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reactiveConnect = searchParams.get("error_code") === "connect_required";
  const connectBlockedEffective = connectBlocked || reactiveConnect;
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const idempotencyKeyRef = useRef(`lot-publish-${crypto.randomUUID()}`);

  const publishDisabled = disabled || connectBlockedEffective || pending;

  const promoteConnectToShell = (detail?: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("error_code", "connect_required");
    if (detail?.trim()) {
      params.set("error", detail.trim());
    } else {
      params.delete("error");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <>
      <Button type="button" size="sm" disabled={publishDisabled} onClick={() => setOpen(true)}>
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
                    notify.success("Published");
                    router.refresh();
                    resolve();
                    return;
                  }
                  if (r.errorCode === "connect_required") {
                    promoteConnectToShell(r.error);
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
    </>
  );
}
