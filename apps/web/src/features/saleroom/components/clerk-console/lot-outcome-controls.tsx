"use client";

import { ConsoleSectionLabel } from "@/features/saleroom/components/clerk-console/console-panel";
import { adminSaleroomHammerAction, adminSaleroomNoSaleAction } from "@/lib/actions/admin";
import type { ActionResult } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import { HoldButton, cn } from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { type ReactNode, useTransition } from "react";

type Props = {
  saleId: string;
  canHammer: boolean;
  className?: string;
  compact?: boolean;
  /** Hammer is secondary unless the caller says it is the one primary action. */
  hammerVariant?: "primary" | "secondary";
};

/** One outcome as a press-and-hold button: it runs once the hold completes, never on a slip. */
function OutcomeHold({
  children,
  hint,
  variant,
  disabled,
  done,
  run,
}: {
  children: ReactNode;
  hint: string;
  variant: "primary" | "secondary";
  disabled: boolean;
  done: string;
  run: () => Promise<ActionResult<unknown>>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <HoldButton
      variant={variant}
      size="lg"
      disabled={disabled}
      loading={pending}
      holdHint={hint}
      onHoldComplete={() =>
        startTransition(async () => {
          const result = await run();
          if (!result.ok) {
            notify.error(result.error);
            return;
          }
          notify.success(done);
          router.refresh();
        })
      }
    >
      {pending ? "Recording…" : children}
    </HoldButton>
  );
}

/**
 * Ends the lot on the block: hammer it as sold, or pass it with no sale. Both are one press and
 * hold, so a slip of the mouse or a stray key never ends a lot.
 */
export function LotOutcomeControls({
  saleId,
  canHammer,
  className,
  compact = false,
  hammerVariant = "primary",
}: Props) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {!compact ? <ConsoleSectionLabel>Lot outcome</ConsoleSectionLabel> : null}
      <div className="flex flex-wrap gap-2">
        <OutcomeHold
          variant={hammerVariant}
          disabled={!canHammer}
          hint="Press and hold to sell the lot at the current bid. Release early to cancel."
          done="Lot hammered"
          run={() => adminSaleroomHammerAction({ saleId })}
        >
          Hold to hammer
        </OutcomeHold>
        <OutcomeHold
          variant="secondary"
          disabled={!canHammer}
          hint="Press and hold to close the lot with no sale. Release early to cancel."
          done="Lot passed with no sale"
          run={() => adminSaleroomNoSaleAction({ saleId })}
        >
          Hold to pass
        </OutcomeHold>
      </div>
      {!compact ? (
        <p className="text-staff-xs text-staff-muted">
          Pass when the reserve isn&apos;t met or the lot is withdrawn from the block.
        </p>
      ) : null}
    </div>
  );
}
