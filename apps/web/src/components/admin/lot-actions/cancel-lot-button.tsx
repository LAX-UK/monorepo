"use client";

import { TypedConfirmationDialog } from "@/components/admin/typed-confirmation-dialog";
import { adminCancelLotResultAction } from "@/lib/actions/admin";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  lotId: string;
  disabled?: boolean;
};

export function CancelLotButton({ lotId, disabled }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        disabled={disabled || pending}
        onClick={() => setOpen(true)}
        className="h-auto rounded-md border border-error/40 bg-transparent px-8 py-3 font-label text-xs font-semibold uppercase tracking-widest text-error hover:bg-error/10 hover:text-error disabled:opacity-60"
      >
        Cancel auction
      </Button>
      <TypedConfirmationDialog
        open={open}
        onOpenChange={setOpen}
        title="Cancel this auction?"
        description="Bidders will no longer be able to place bids. This cannot be undone from the catalog UI."
        actionLabel="Cancel auction"
        confirmationPhrase={lotId}
        severity="danger"
        onConfirm={() => {
          startTransition(() => {
            void (async () => {
              const r = await adminCancelLotResultAction(lotId, {});
              if (r.ok) {
                notify.success("Auction cancelled");
                router.refresh();
                return;
              }
              notify.error(r.error);
            })();
          });
        }}
      />
    </>
  );
}
