"use client";

import type { BidNotice, BidRemedy } from "@auction/domain";
import { Button, ButtonLink, Notice } from "@auction/ui/lax";
import Link from "next/link";
import type { ReactNode } from "react";

/** Where the organisation's members and their limits are managed. */
const ORGANISATIONS_HREF = "/organisations";

type RemedyContext = {
  format: { money(amount: string): string };
  registerHref: string | null;
  onUseAmount: (amount: string) => void;
};

/**
 * One row per remedy, so a new way forward is a new row. A remedy that the confirm button already
 * carries (asking again at a new amount, trying again) needs no button of its own.
 */
const REMEDY_ACTIONS: Readonly<{
  [K in BidRemedy["kind"]]: (
    remedy: Extract<BidRemedy, { kind: K }>,
    ctx: RemedyContext,
  ) => ReactNode;
}> = {
  reconfirm: () => null,
  retry: () => null,
  close: () => null,
  none: () => null,
  use_amount: (remedy, ctx) => (
    <Button size="sm" variant="secondary" onClick={() => ctx.onUseAmount(remedy.amount)}>
      Use {ctx.format.money(remedy.amount)}
    </Button>
  ),
  register: (_remedy, ctx) =>
    ctx.registerHref ? (
      <ButtonLink href={ctx.registerHref} Link={Link} size="sm" variant="secondary">
        Register
      </ButtonLink>
    ) : null,
  limit_help: () => (
    <ButtonLink href={ORGANISATIONS_HREF} Link={Link} size="sm" variant="secondary">
      Ask an admin
    </ButtonLink>
  ),
};

function actionFor(remedy: BidRemedy, ctx: RemedyContext): ReactNode {
  // Each row takes its own remedy; the table is looked up by that same kind.
  const build = REMEDY_ACTIONS[remedy.kind] as (remedy: BidRemedy, ctx: RemedyContext) => ReactNode;
  return build(remedy, ctx);
}

/**
 * Why the bid didn't go through, in plain words, with the one thing to do next. An alert, so a
 * screen reader hears it at once; the confirm button points back to it as its description.
 */
export function BidDialogNotice({
  id,
  notice,
  ...ctx
}: { id: string; notice: BidNotice } & RemedyContext) {
  return (
    <div id={id}>
      <Notice tone={notice.tone} title={notice.title} alert actions={actionFor(notice.remedy, ctx)}>
        {notice.detail}
      </Notice>
    </div>
  );
}
