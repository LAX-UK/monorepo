import type { ZohoMirrorBadgeView } from "@/server/domain/zoho-mirror.vm";
import { ZOHO_MIRROR_OPEN_FAILED_JOBS } from "@auction/shop-contracts";
import { CopyButton, StatusDetailsButton, TextLink } from "@auction/staff-ui";

/**
 * The "Mirrored to Zoho" badge beside a record's status (design Z1–Z3,
 * `docs/design/staff-gaps-delivery-zoho-alerts.md`): a button that opens what the state means,
 * with the Zoho record ID to copy when mirrored and the way to Failed jobs when it failed.
 */
export function ZohoMirrorBadge({ view }: { view: ZohoMirrorBadgeView }) {
  return (
    <StatusDetailsButton
      status={{ label: view.label, tone: view.tone, shape: view.shape }}
      name={view.name}
      data-zoho-mirror={view.state}
    >
      <p className="flex items-start gap-1">
        <span>{view.sentence}</span>
        {view.copy ? <CopyButton value={view.copy.value} label={view.copy.label} /> : null}
      </p>
      {view.failedJobsHref ? (
        <TextLink href={view.failedJobsHref} external className="self-start">
          {ZOHO_MIRROR_OPEN_FAILED_JOBS}
        </TextLink>
      ) : null}
    </StatusDetailsButton>
  );
}
