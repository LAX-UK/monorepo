"use client";

import type { LotReofferBundle } from "@/lib/admin/reoffer/reoffer-bundle";
import { buildReofferCard } from "@/lib/admin/reoffer/reoffer-card.vm";
import { showsReofferCard } from "@/lib/admin/reoffer/reoffer-lot-state";
import { ErrorState, Section, StaffButton } from "@auction/staff-ui";
import type { LotStatus } from "@auction/types";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { ReofferCard } from "./reoffer-card";
import { useReofferActions } from "./use-reoffer-actions";

type Props = {
  bundle: LotReofferBundle;
  lot: { id: string; title: string; status: LotStatus; hasWinner: boolean };
  /** Whether the person may act on an offer (Sales manager, Finance, Administrator). */
  canAct: boolean;
  /** Whether the person may record the seller's answer for them (auction.manage). */
  canRecordAnswer: boolean;
};

/** The Re-offer card on a lot's Overview: loaded state, a retry when the load failed, and nothing otherwise. */
export function ReofferCardSection({ bundle, lot, canAct, canRecordAnswer }: Props) {
  const router = useRouter();
  const actions = useReofferActions(lot);
  const model = useMemo(
    () =>
      bundle.status === "ready" && showsReofferCard(bundle, lot)
        ? buildReofferCard({
            buyerDefault: bundle.buyerDefault,
            offers: bundle.offers,
            preview: bundle.preview,
            access: { canAct, canRecordAnswer },
          })
        : null,
    [bundle, lot, canAct, canRecordAnswer],
  );

  if (bundle.status === "failed") {
    return (
      <Section title="Re-offer">
        <ErrorState
          title="We couldn't load this re-offer."
          description="The lot is as it was. Try again in a moment."
          action={
            <StaffButton variant="secondary" onClick={() => router.refresh()}>
              Try again
            </StaffButton>
          }
          headingLevel="h3"
          size="compact"
        />
      </Section>
    );
  }
  if (!model) return null;
  const { preview } = bundle;

  return (
    <>
      <ReofferCard
        model={model}
        onAction={(id) => actions.run(id, { offer: model.current, preview })}
      />
      {actions.dialogs}
    </>
  );
}
