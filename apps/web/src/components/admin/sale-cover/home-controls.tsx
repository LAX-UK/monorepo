"use client";

import {
  type HomeDraft,
  canTakePinPlace,
  titleLengthWarning,
} from "@/lib/admin/sale-cover/cover-draft";
import type { CoverView } from "@/lib/admin/sale-cover/cover-view";
import { canPinToHome } from "@auction/domain";
import {
  ChoiceRow,
  DateInput,
  Field,
  Notice,
  Section,
  StaffCheckbox,
  TextInput,
} from "@auction/staff-ui";
import { SALE_HOME_PINS_MAX, SALE_SUBTITLE_MAX_LENGTH, type SaleStatus } from "@auction/types";
import { useId } from "react";

type Props = {
  view: CoverView;
  home: HomeDraft;
  saleTitle: string;
  saleStatus: SaleStatus;
  canEdit: boolean;
  onChange: (patch: Partial<HomeDraft>) => void;
};

/** Why this sale cannot take a home pin right now, or null when it can. */
function pinBlockedReason(view: CoverView, status: SaleStatus): string | null {
  if (!canPinToHome(status)) return "Only a published sale can be pinned to the home page.";
  if (!canTakePinPlace(view, view.home.homePinOrder !== null)) {
    const names = view.pins.map((pin) => pin.title).join(", ");
    return `${SALE_HOME_PINS_MAX} sales are already pinned (${names}). Unpin one of them first.`;
  }
  return null;
}

function pinPlace(view: CoverView, pinned: boolean): string {
  const current = view.pins.find((pin) => pin.saleId === view.saleId);
  const place = current?.position ?? view.pins.length + 1;
  return pinned
    ? `Position ${place} of ${SALE_HOME_PINS_MAX}. Live sales lead, then this order.`
    : "Not pinned. The home hero leads with the live sale, then the next one.";
}

/** Home-page choices for this sale: its pin, the subtitle under the title and the consigning deadline. */
export function HomeControls({ view, home, saleTitle, saleStatus, canEdit, onChange }: Props) {
  const pinId = useId();
  const blocked = pinBlockedReason(view, saleStatus);
  const pinDisabled = !canEdit || (blocked !== null && !home.pinned);
  const titleWarning = titleLengthWarning(saleTitle);

  return (
    <Section title="Home" description="How this sale appears on the home page.">
      <div className="flex flex-col gap-4">
        <ChoiceRow
          htmlFor={pinId}
          label="Pin to the home hero"
          description={blocked && !home.pinned ? blocked : pinPlace(view, home.pinned)}
          disabled={canEdit && pinDisabled}
          control={
            <StaffCheckbox
              id={pinId}
              checked={home.pinned}
              disabled={pinDisabled}
              onCheckedChange={(checked) => onChange({ pinned: checked === true })}
            />
          }
        />

        <Field
          label="Subtitle"
          optional
          description={`Shown under the title, one line of fact. Up to ${SALE_SUBTITLE_MAX_LENGTH} characters.`}
        >
          <TextInput
            value={home.subtitle}
            maxLength={SALE_SUBTITLE_MAX_LENGTH}
            placeholder="British and European paintings and works on paper"
            disabled={!canEdit}
            onChange={(event) => onChange({ subtitle: event.target.value })}
          />
        </Field>
        {titleWarning ? (
          <Notice tone="warning" title="The title is long for the cover">
            {titleWarning}
          </Notice>
        ) : null}

        <Field
          label="Consignment deadline"
          optional
          description="The last day to consign works to this sale. Shown on the home page while it is open."
        >
          <DateInput
            value={home.consignmentDay}
            disabled={!canEdit}
            onValueChange={(day) => onChange({ consignmentDay: day })}
          />
        </Field>
      </div>
    </Section>
  );
}
