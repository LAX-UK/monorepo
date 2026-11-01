"use client";

import { switchActingLegalEntity } from "@/lib/legal-entity/acting-context.actions";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/lax";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

/** Switches the active account to the person's own, staying on the lot. */
export function SwitchToPersonalButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="primary"
      type="button"
      className=""
      disabled={pending}
      onClick={() => {
        start(async () => {
          const result = await switchActingLegalEntity(null);
          if (result.ok) {
            router.refresh();
            return;
          }
          notify.error("Could not switch", { description: "Please try again in a moment." });
        });
      }}
    >
      {pending ? "Switching…" : "Switch to personal"}
    </Button>
  );
}
