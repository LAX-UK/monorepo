import { WorkspacePanel } from "@/components/dashboard/primitives/workspace-panel";
import { PAY_COPY } from "@/lib/pay/pay-copy";
import type { PayDeliveryVm } from "@/lib/pay/pay-page.vm";
import { StatusBadge } from "@auction/ui/components/status-badge";
import { TextLink } from "@auction/ui/lax/text-link";
import Link from "next/link";

/**
 * How each lot in this payment is delivered. A courier quote the buyer accepted is a charge in
 * this payment and shows its price; every other lot says the choice comes after paying. The
 * figures are the server's; nothing is added up here.
 */
export function PayDeliveryPanel({ delivery }: { delivery: PayDeliveryVm }) {
  return (
    <WorkspacePanel title={PAY_COPY.panelDelivery}>
      <ul className="flex flex-col divide-y divide-lax-line-subtle">
        {delivery.rows.map((row) => (
          <li
            key={row.lotId}
            className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-4 first:pt-0 last:pb-0"
          >
            <div className="min-w-0 flex-1 basis-48">
              <p className="text-lax-14 font-medium text-lax-fg">{row.title}</p>
              {row.detail ? <p className="text-lax-13 text-lax-muted">{row.detail}</p> : null}
            </div>
            <StatusBadge tone={row.badge.tone} shape={row.badge.shape}>
              {row.badge.label}
            </StatusBadge>
          </li>
        ))}
      </ul>
      {delivery.note ? <p className="mt-3 text-lax-13 text-lax-muted">{delivery.note}</p> : null}
      {delivery.quoteLink ? (
        <p className="mt-3 text-lax-13 text-lax-muted">
          {delivery.quoteLink.before}{" "}
          <TextLink href={delivery.quoteLink.href} Link={Link}>
            {delivery.quoteLink.label}
          </TextLink>
          . {delivery.quoteLink.after}
        </p>
      ) : null}
    </WorkspacePanel>
  );
}
