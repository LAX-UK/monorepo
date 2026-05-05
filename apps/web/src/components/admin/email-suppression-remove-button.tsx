"use client";

import { removeEmailSuppressionAction } from "@/lib/actions/admin-email";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function EmailSuppressionRemoveButton({ emailHash }: { emailHash: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="min-h-11"
      disabled={pending}
      onClick={() => {
        startTransition(() => {
          void (async () => {
            const result = await removeEmailSuppressionAction(emailHash);
            if (result.ok) {
              notify.success("Suppression removed");
              router.refresh();
              return;
            }
            notify.error(result.error);
          })();
        });
      }}
    >
      {pending ? "Removing…" : "Remove"}
    </Button>
  );
}
