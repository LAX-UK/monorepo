"use client";

import { startAdminImpersonationAfterLookup } from "@/lib/legal-entity/acting-context.actions";
import { notify } from "@/lib/ui/notify";
import { Button } from "@auction/ui/components/button";
import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

type Props = {
  legalEntityId: string;
  displayName: string;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
};

export function LegalEntityImpersonationButton({
  legalEntityId,
  displayName,
  className,
  variant = "outline",
  size = "sm",
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const start = useCallback(() => {
    startTransition(() => {
      void (async () => {
        const result = await startAdminImpersonationAfterLookup(legalEntityId);
        if (result.ok) {
          notify.success("Impersonation started");
          router.push("/dashboard");
          router.refresh();
          return;
        }
        notify.error(result.message ?? "Could not start impersonation");
      })();
    });
  }, [legalEntityId, router]);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
      onClick={start}
    >
      {pending ? "Starting…" : `Impersonate · ${displayName}`}
    </Button>
  );
}
