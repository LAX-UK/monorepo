"use client";

import { AdminLotConnectRequiredBanner } from "@/components/admin/admin-lot-connect-required-banner";
import { adminPublishLotResultAction } from "@/lib/actions/admin";
import { Can } from "@/lib/auth/capabilities";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  lotId: string;
  sellerLegalEntityId: string | null;
  disabled?: boolean;
};

export function PublishLotButton({ lotId, sellerLegalEntityId, disabled }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [connectRequired, setConnectRequired] = useState(false);

  return (
    <Can requirement="catalogue.write">
      {connectRequired ? (
        <AdminLotConnectRequiredBanner sellerLegalEntityId={sellerLegalEntityId} />
      ) : null}
      <Button
        type="button"
        disabled={disabled || pending}
        onClick={() => {
          startTransition(() => {
            void (async () => {
              const r = await adminPublishLotResultAction(lotId);
              if (r.ok) {
                setConnectRequired(false);
                notify.success("Published");
                router.refresh();
                return;
              }
              if (!r.ok && r.errorCode === "connect_required") {
                setConnectRequired(true);
                return;
              }
              if (!r.ok) notify.error(r.error);
            })();
          });
        }}
        className="h-auto rounded-md bg-gradient-to-br from-primary to-primary-container px-8 py-3 font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-primary shadow-sm hover:opacity-95 disabled:opacity-60"
      >
        Publish
      </Button>
    </Can>
  );
}
