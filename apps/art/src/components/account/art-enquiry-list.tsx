import type { ArtEnquiryItemVm } from "@/lib/account/account-enquiries.vm";
import { MarketingEnquiryListItem } from "@auction/marketing-ui";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";

/** Enquiry rows, newest first: on the Enquiries tab and, the latest few, on the overview. */
export function ArtEnquiryList({ items }: { items: readonly ArtEnquiryItemVm[] }) {
  return (
    <ul data-testid="art-account-enquiries">
      {items.map((item) => (
        <li key={item.id}>
          <MarketingEnquiryListItem
            variant={item.variant}
            typeLabel={item.typeLabel}
            title={item.title}
            description={item.description}
            href={item.href}
            status={
              item.status ? (
                <DotStatusPill label={item.status.label} tone={item.status.tone} />
              ) : null
            }
            date={<time dateTime={item.createdAtIso}>{item.createdAtLabel}</time>}
          />
        </li>
      ))}
    </ul>
  );
}
