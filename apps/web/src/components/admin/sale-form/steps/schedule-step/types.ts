import type { AdminSaleFormValues } from "@/lib/forms/schemas/admin-sale-form";
import type { Lot, Venue } from "@auction/types";
import type { RefObject } from "react";
import type {
  FieldArrayWithId,
  UseFieldArrayAppend,
  UseFieldArrayRemove,
  UseFormReturn,
} from "react-hook-form";
import type { StreamUrlVerificationGate } from "../../stream-url-verify-control";
import type { SaleTierBandPreview } from "../../use-sale-tier-preview";

/** The premium the sale form's choice would charge, in words and as a worked example. */
export type TierPreview = SaleTierBandPreview;

export type SaleScheduleStepProps = {
  form: UseFormReturn<AdminSaleFormValues>;
  isDraft: boolean;
  /** The zone the sale is saved in, which the saved lots' times are written in. */
  savedTimeZone?: string | undefined;
  /** The sale was announced once, so its time zone cannot change even as a draft. */
  timeZoneLocked?: boolean;
  /** ATG holds this sale's auction, so its zone is fixed there. */
  timeZoneFixedByAtg?: boolean;
  isSaleroom: boolean;
  pending: boolean;
  fields: FieldArrayWithId<AdminSaleFormValues, "buyerPremiumTiers", "id">[];
  append: UseFieldArrayAppend<AdminSaleFormValues, "buyerPremiumTiers">;
  remove: UseFieldArrayRemove;
  tierBandPreview: TierPreview;
  formattedPreviewAddress: string;
  previewMapUrl: string | null;
  customMapUrl: string | undefined;
  postcodeIsValid: boolean;
  lots?: readonly Lot[];
  lotsSetupHref?: string;
  venues?: readonly Venue[];
  /** When true, staff can edit the live stream URL (draft or scheduled/active). */
  streamUrlEditable?: boolean;
  initialStreamUrl?: string;
  streamUrlGateRef?: RefObject<StreamUrlVerificationGate | null>;
};
