"use client";

import {
  StaffButton,
  type TimelineEvent,
  WhereItIsChip,
  type WhereItIsChipSpec,
  WhereItIsSection,
} from "@auction/staff-ui";
import { ArrowRight, ExternalLink, Gavel, Globe } from "lucide-react";
import { SheetSection, StateRow } from "./sheet-frame";

/** The chips as `@auction/artwork-register-contracts` defines them. */
const CHIPS = {
  notOffered: { label: "Not offered", tone: "neutral", marker: "hollow" },
  draftLaxArt: { label: "Draft on lax.art", tone: "info", marker: "hollow" },
  laxArt: { label: "On lax.art", tone: "success", marker: "filled" },
  draftLot: { label: "Draft lot in LAX Bid", tone: "info", marker: "hollow" },
  bidSale: { label: "In a LAX Bid sale", tone: "info", marker: "filled" },
  privateSale: { label: "In a private sale", tone: "info", marker: "filled" },
  withdrawn: { label: "Withdrawn", tone: "warning", marker: "filled" },
  sold: { label: "Sold", tone: "neutral", marker: "check" },
} as const satisfies Record<string, WhereItIsChipSpec>;

const MOVES: readonly TimelineEvent[] = [
  {
    id: "m1",
    title: "Published on lax.art",
    detail: "Not offered → On lax.art",
    actor: "Lena Hart",
    at: "2026-11-02T15:20:00Z",
    tone: "success",
  },
  {
    id: "m2",
    title: "Came in from Zoho",
    actor: "Nightly check",
    at: "2026-11-02T02:10:00Z",
  },
];

const offerActions = (
  <>
    <StaffButton variant="secondary" size="sm">
      <Globe aria-hidden className="size-4" strokeWidth={1.75} />
      Offer on lax.art…
    </StaffButton>
    <StaffButton variant="secondary" size="sm">
      <Gavel aria-hidden className="size-4" strokeWidth={1.75} />
      Offer at auction…
    </StaffButton>
  </>
);

const openOnLaxArt = (
  <>
    <StaffButton variant="secondary" size="sm">
      <ArrowRight aria-hidden className="size-4" strokeWidth={1.75} />
      Open on lax.art
    </StaffButton>
    <StaffButton variant="ghost" size="sm">
      <ExternalLink aria-hidden className="size-4" strokeWidth={1.75} />
      View on lax.art
    </StaffButton>
  </>
);

const openLot = (
  <StaffButton variant="secondary" size="sm">
    <ExternalLink aria-hidden className="size-4" strokeWidth={1.75} />
    Open lot in LAX Bid
  </StaffButton>
);

export function SheetWhereItIs() {
  return (
    <SheetSection
      id="where-it-is"
      densities={["staff"]}
      title="Where it is"
      description="One block for the From Zoho record, the lax.art artwork page and the Bid lot page. A hollow marker means buyers can't see it yet, a filled one that they can, a tick that it is sold. The words always name the place."
    >
      {() => (
        <div className="flex flex-col gap-4">
          <StateRow label="Chips">
            {Object.values(CHIPS).map((chip) => (
              <WhereItIsChip key={chip.label} chip={chip} />
            ))}
          </StateRow>
          <WhereItIsSection
            chip={CHIPS.notOffered}
            lead="Not offered"
            trail=" anywhere"
            note="It can go on lax.art or into a LAX Bid sale. Only one place at a time."
            actions={offerActions}
            facts={[
              { label: "Original or print", value: "Original" },
              { label: "Zoho status", value: "Available" },
            ]}
          />
          <WhereItIsSection
            chip={CHIPS.draftLaxArt}
            lead="Draft on lax.art"
            trail=" · created Wed 4 Nov by Lena Hart"
            note="Buyers can't see it until it is published."
            actions={openOnLaxArt}
          />
          <WhereItIsSection
            chip={CHIPS.laxArt}
            lead="Live on lax.art"
            trail=" since Mon 2 Nov, 15:20 GMT"
            note="Enquiries open. To move it to auction, use Offer at auction."
            actions={openOnLaxArt}
            moves={{ events: MOVES, historyHref: "#history" }}
          />
          <WhereItIsSection
            chip={CHIPS.draftLot}
            lead="Draft lot in LAX Bid"
            trail=" · Winter Modern and Contemporary, lot 14"
            note="The lax.art draft stays a draft."
            actions={openLot}
          />
          <WhereItIsSection
            chip={CHIPS.bidSale}
            lead="In a LAX Bid sale"
            trail=" · Winter Modern and Contemporary, lot 14"
            note="Bidding opens Thu 26 Nov, 18:00 GMT."
            actions={openLot}
          />
          <WhereItIsSection
            chip={CHIPS.privateSale}
            lead="In a private sale"
            trail=" · PS-0004"
            note="Held for a private sale with Tom Reyes."
          />
          <WhereItIsSection
            chip={CHIPS.withdrawn}
            lead="Withdrawn"
            trail=" from LAX Bid · Mon 30 Nov"
            note="Ended unsold. It can be offered again, or returned to lax.art from the lot."
            actions={offerActions}
          />
          <WhereItIsSection
            chip={CHIPS.sold}
            lead="Sold in LAX Bid"
            trail=" · lot 14 · Thu 26 Nov"
            note="Sold is final. Nothing can offer it again."
            actions={
              <StaffButton variant="ghost" size="sm">
                <ExternalLink aria-hidden className="size-4" strokeWidth={1.75} />
                Open lot in LAX Bid
              </StaffButton>
            }
          />
          <WhereItIsSection
            chip={CHIPS.sold}
            lead="Sold in the gallery"
            trail=", per Zoho · Wed 4 Nov"
            note="Zoho's Status changed to Sold. Anything LAX had offered was closed."
          />
          <WhereItIsSection
            chip={CHIPS.notOffered}
            lead="Not offered"
            trail=" anywhere"
            note="View only. You can't offer this artwork."
          />
          <WhereItIsSection chip={CHIPS.notOffered} lead="" loading />
        </div>
      )}
    </SheetSection>
  );
}
