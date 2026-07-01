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

export type TierPreview =
  | { ok: false }
  | {
      ok: true;
      kind: "tiered" | "flat";
      at250k: { hammer: string; premium: string };
      at600k: { hammer: string; premium: string };
    };

export type SaleScheduleStepProps = {
  form: UseFormReturn<AdminSaleFormValues>;
  isDraft: boolean;
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
