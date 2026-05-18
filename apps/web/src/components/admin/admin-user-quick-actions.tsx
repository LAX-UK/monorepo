"use client";

import { startAdminImpersonationAfterLookup } from "@/lib/legal-entity/acting-context.actions";
import { notify } from "@/lib/ui/notify";
import type { LegalEntity } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@auction/ui/components/tooltip";
import { Copy, KeyRound, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

type Props = {
  userId: string;
  email: string;
  legalEntities: Pick<LegalEntity, "id" | "displayName">[];
};

export function AdminUserQuickActions({ userId, email, legalEntities }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const copy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text).then(() => notify.success(`${label} copied`));
  };

  const impersonate = (legalEntityId: string) => {
    startTransition(() => {
      void (async () => {
        const r = await startAdminImpersonationAfterLookup(legalEntityId);
        if (r.ok) {
          notify.success("Impersonation started");
          router.push("/dashboard");
          router.refresh();
          return;
        }
        notify.error(r.message ?? "Could not start impersonation");
      })();
    });
  };

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => copy(userId, "User ID")}
        >
          <Copy className="size-3.5" aria-hidden />
          Copy ID
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => copy(email, "Email")}
        >
          <Mail className="size-3.5" aria-hidden />
          Copy email
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled>
                <KeyRound className="size-3.5" aria-hidden />
                Password reset
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Coming soon — admin-triggered password reset</TooltipContent>
        </Tooltip>
      </div>

      {legalEntities.length > 0 ? (
        <div className="space-y-2 border-t border-border-hairline pt-4">
          <p className="font-label text-[10px] uppercase text-on-surface-variant">
            Impersonate via entity
          </p>
          <ul className="space-y-2">
            {legalEntities.map((entity) => (
              <li key={entity.id}>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-auto min-h-10 w-full justify-start text-left"
                  disabled={pending}
                  onClick={() => impersonate(entity.id)}
                >
                  {entity.displayName}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </TooltipProvider>
  );
}
