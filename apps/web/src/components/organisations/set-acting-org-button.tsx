"use client";

import { switchActingLegalEntity } from "@/lib/legal-entity/acting-context.actions";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Props = { legalEntityId: string };

const FAILURE_TITLES: Record<"not_a_member" | "unauthenticated" | "unknown", string> = {
  not_a_member: "Cannot set active",
  unauthenticated: "Session expired",
  unknown: "Could not set active",
};

const FAILURE_DESCRIPTIONS: Record<"not_a_member" | "unauthenticated" | "unknown", string> = {
  not_a_member: "You no longer have access to this organisation.",
  unauthenticated: "Sign in again to continue.",
  unknown: "Please try again in a moment.",
};

export function SetActingOrgButton({ legalEntityId }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button
      type="button"
      variant="cta"
      size="sm"
      className="min-h-11 sm:min-h-9"
      disabled={pending}
      onClick={() => {
        start(async () => {
          const r = await switchActingLegalEntity(legalEntityId);
          if (r.ok) {
            router.refresh();
            return;
          }
          notify.error(FAILURE_TITLES[r.error], {
            description: FAILURE_DESCRIPTIONS[r.error],
          });
        });
      }}
    >
      Set as active
    </Button>
  );
}
