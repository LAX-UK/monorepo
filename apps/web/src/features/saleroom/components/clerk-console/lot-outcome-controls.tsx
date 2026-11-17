"use client";

import { ConsoleSectionLabel } from "@/features/saleroom/components/clerk-console/console-panel";
import { CLERK_COMMAND_COPY } from "@/features/saleroom/lib/clerk-command-copy";
import {
  LOT_NOT_ON_BLOCK,
  clerkHammer,
  clerkNoSale,
} from "@/features/saleroom/lib/clerk-commands.client";
import {
  ClerkRoomRecheckContext,
  settleUnknownOutcome,
} from "@/features/saleroom/lib/clerk-room-recheck";
import type { ActionResult } from "@/lib/forms/form-result";
import { notify } from "@/lib/ui/notify";
import { HoldButton, cn } from "@auction/staff-ui";
import { useRouter } from "next/navigation";
import { type ReactNode, useContext, useTransition } from "react";

type Props = {
  saleId: string;
  /** The lot the clerk sees on the block: hammer and pass name it, so they never end another. */
  lotId: string | null;
  canHammer: boolean;
  className?: string;
  compact?: boolean;
  /** Hammer is secondary unless the caller says it is the one primary action. */
  hammerVariant?: "primary" | "secondary";
};

const OUTCOME_TOAST = "clerk-lot-outcome";

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
  // The console's recheck: refetch the page and read the session again from the API.
  const recheck = useContext(ClerkRoomRecheckContext) ?? (async () => router.refresh());
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
            // The lot may have ended anyway (a lost response) or the room moved on. Never guess:
            // read the room again, and say the outcome is unknown until it answers.
            if (result.errorCode !== LOT_NOT_ON_BLOCK) {
              await settleUnknownOutcome(recheck, result.error, OUTCOME_TOAST);
              return;
            }
            notify.error(CLERK_COMMAND_COPY.lotNotOnBlock, { id: OUTCOME_TOAST });
            await recheck();
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
  lotId,
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
          run={() => clerkHammer({ saleId, lotId: lotId ?? "" })}
        >
          Hold to hammer
        </OutcomeHold>
        <OutcomeHold
          variant="secondary"
          disabled={!canHammer}
          hint="Press and hold to close the lot with no sale. Release early to cancel."
          done="Lot passed with no sale"
          run={() => clerkNoSale({ saleId, lotId: lotId ?? "" })}
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
