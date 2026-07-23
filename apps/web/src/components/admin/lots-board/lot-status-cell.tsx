"use client";

import { lotDotStatusPresentation } from "@/lib/presenters/status/lot-dot-status";
import type { LotStatus } from "@auction/types";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";

type Props = {
  status: LotStatus;
};

/** Single-line lot lifecycle status pill for board tables. */
export function LotStatusCell({ status }: Props) {
  const { label, tone } = lotDotStatusPresentation({ status, context: "global" });
  return <DotStatusPill label={label} tone={tone} />;
}
