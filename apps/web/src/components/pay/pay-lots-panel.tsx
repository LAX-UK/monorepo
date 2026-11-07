import { WorkspacePanel } from "@/components/dashboard/primitives/workspace-panel";
import { MediaImage } from "@/components/ui/media-image";
import { PAY_COPY } from "@/lib/pay/pay-copy";
import type { PayLotVm } from "@/lib/pay/pay-page.vm";
import { RecordRowMedia } from "@auction/ui";
import { TextLink } from "@auction/ui/lax";
import Link from "next/link";

/**
 * The lots in this payment: each with its artwork, its sale, the day it is due and its invoice
 * total, linked to its purchase.
 */
export function PayLotsPanel({
  lots,
  imageByLot,
}: {
  lots: readonly PayLotVm[];
  imageByLot: Readonly<Record<string, string | null>>;
}) {
  const title = lots.length === 1 ? PAY_COPY.panelLot : PAY_COPY.panelLots(lots.length);
  return (
    <WorkspacePanel title={title}>
      <ul className="flex flex-col divide-y divide-lax-line-subtle">
        {lots.map((lot) => (
          <li key={lot.lotId} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
            <RecordRowMedia className="size-[4.5rem] shrink-0">
              <MediaImage src={imageByLot[lot.lotId] ?? null} alt="" sizes="72px" />
            </RecordRowMedia>
            <div className="min-w-0 flex-1">
              <p className="text-lax-14 font-medium text-lax-fg">
                <TextLink href={lot.href} Link={Link} className="no-underline hover:underline">
                  {lot.title}
                </TextLink>
              </p>
              {lot.subtitle ? <p className="text-lax-13 text-lax-muted">{lot.subtitle}</p> : null}
              <p className="text-lax-13 text-lax-muted">{lot.due}</p>
            </div>
            <p className="shrink-0 text-right text-lax-14 font-medium tabular-nums text-lax-fg">
              {lot.total}
            </p>
          </li>
        ))}
      </ul>
    </WorkspacePanel>
  );
}
