"use client";

import { ChoiceFieldset, ChoiceRow, StaffRadio, StaffRadioGroup } from "@auction/staff-ui";
import type { PrivateSaleArtworkUnlinkedReason } from "@auction/types";
import { Link2 } from "lucide-react";
import { useId } from "react";
import { type ArtworkChoice, UNLINKED_REASONS } from "./artwork-choice";
import { ArtworkReviewCard } from "./artwork-review-card";
import { RegisterArtworkPicker, type SearchRegisterArtworks } from "./register-artwork-picker";

type Props = {
  /** The id an error summary links to. */
  id: string;
  value: ArtworkChoice;
  onChange: (choice: ArtworkChoice) => void;
  search: SearchRegisterArtworks;
  /** What staff are told is still missing or refused, shown with the field. */
  error?: string | undefined;
  /** The artwork the work's earlier lot offered, when one was preselected for them. */
  earlierLot?: { artworkId: string; workReference: string } | null;
  /** The reason a switch to "Not in the register" starts on. */
  startReason: PrivateSaleArtworkUnlinkedReason | null;
  refreshKey?: number;
  disabled?: boolean;
};

/**
 * Which artwork the deal is for: an original from the register, which is held for the deal from
 * the moment it opens, or the reason it is not there. Picking one shows a review card so staff can
 * see they chose the right piece before anything is held.
 */
export function RegisterArtworkField({
  id,
  value,
  onChange,
  search,
  error,
  earlierLot,
  startReason,
  refreshKey,
  disabled = false,
}: Props) {
  const ids = useId();
  const registerId = `${ids}-register`;
  const notId = `${ids}-not`;
  const chosen = value.mode === "register" ? value.artwork : null;
  return (
    <ChoiceFieldset
      id={id}
      legend="Artwork"
      description="The original in the register. It is held for this deal from the moment the deal opens."
      error={error}
      disabled={disabled}
    >
      <StaffRadioGroup
        aria-label="Artwork"
        className="grid-cols-[minmax(0,1fr)]"
        value={value.mode}
        onValueChange={(mode) =>
          onChange(
            mode === "register"
              ? { mode: "register", artwork: null }
              : { mode: "not_in_register", reason: startReason },
          )
        }
      >
        <ChoiceRow
          htmlFor={registerId}
          control={<StaffRadio id={registerId} value="register" />}
          label="From the register"
        />
        {value.mode === "register" ? (
          <div className="flex min-w-0 flex-col gap-3 pb-2 pl-[1.625rem]">
            <RegisterArtworkPicker
              aria-label="Artwork from the register"
              value={chosen}
              onChange={(artwork) => onChange({ mode: "register", artwork })}
              search={search}
              invalid={Boolean(error)}
              disabled={disabled}
              {...(refreshKey !== undefined ? { refreshKey } : {})}
            />
            {chosen && earlierLot?.artworkId === chosen.id ? (
              <p className="flex items-center gap-1.5 text-staff-xs text-staff-muted">
                <Link2 aria-hidden className="size-3.5 shrink-0" />
                Linked to {earlierLot.workReference}'s earlier lot
              </p>
            ) : null}
            {chosen ? <ArtworkReviewCard artwork={chosen} /> : null}
          </div>
        ) : null}
        <ChoiceRow
          htmlFor={notId}
          control={<StaffRadio id={notId} value="not_in_register" />}
          label="Not in the register"
        />
      </StaffRadioGroup>
      {value.mode === "not_in_register" ? (
        <StaffRadioGroup
          aria-label="Why it isn't in the register"
          className="grid-cols-[minmax(0,1fr)] pl-[1.625rem]"
          value={value.reason ?? ""}
          onValueChange={(reason) =>
            onChange({
              mode: "not_in_register",
              reason: reason as PrivateSaleArtworkUnlinkedReason,
            })
          }
        >
          {UNLINKED_REASONS.map(({ reason, label, hint }) => (
            <ChoiceRow
              key={reason}
              htmlFor={`${ids}-${reason}`}
              control={<StaffRadio id={`${ids}-${reason}`} value={reason} />}
              label={label}
              description={hint}
            />
          ))}
        </StaffRadioGroup>
      ) : null}
    </ChoiceFieldset>
  );
}
