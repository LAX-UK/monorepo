import type { PublicFramingOption } from "@auction/shop-contracts";

/**
 * The words buyers read about framing, on the edition page and in the basket. What each option is
 * made of is named here once, from the catalogue's codes, so both places say it the same way.
 */
export const FRAMING_COPY = {
  heading: "Framing",
  detailsLink: "See framing details",
  unframed: "Unframed",
  unframedDetail: "Ships flat in archival packing",
  requiredIntro: "This edition is sold framed. Choose a frame.",
  framedByArtistHeading: "Framing",
  unavailable: "Not available to order right now",
  unavailableDetail: "The frames for this edition are not on offer at the moment.",
  unavailableOption: "Not available for this edition right now",
  previewCaption: "Shown framed. Illustration of the frame, not to scale.",
  changeFraming: "Change framing",
  chooseFraming: "Choose framing",
  noLongerOffered: (name: string) =>
    `${name} is no longer offered. Choose another framing or unframed.`,
  detailsTitle: "Framing details",
  detailsIntro: "Each frame is made to order for your print.",
  detailsRows: {
    frame: "Frame",
    mount: "Mount",
    glazing: "Glazing",
    hanging: "Hanging",
    leadTime: "Time to frame",
  },
  detailsReturns:
    "Because a framed print is made to order, returns and cancellation are explained in our returns policy.",
  returnsLink: "Returns policy",
  close: "Close",
} as const;

export const FRAME_LABELS: Record<PublicFramingOption["frame"], string> = {
  black_wood: "Black wood",
  white_wood: "White wood",
  natural_oak: "Natural oak",
};

const MOUNT_LABELS: Record<PublicFramingOption["mount"], string> = {
  window_conservation: "White conservation mount",
  float_conservation: "Float mount on white conservation board, paper edge visible",
};

const GLAZING_LABELS: Record<PublicFramingOption["glazing"], string> = {
  uv_acrylic: "UV-filtering acrylic",
};

const HANGING_LABELS: Record<PublicFramingOption["hanging"], string> = {
  d_rings_cord: "D-rings and cord",
};

export const framingMountLabel = (mount: PublicFramingOption["mount"]) => MOUNT_LABELS[mount];
export const framingGlazingLabel = (glazing: PublicFramingOption["glazing"]) =>
  GLAZING_LABELS[glazing];
export const framingHangingLabel = (hanging: PublicFramingOption["hanging"]) =>
  HANGING_LABELS[hanging];

/** "White conservation mount, UV-filtering acrylic": the line under an option's name. */
export function framingOptionSummary(
  option: Pick<PublicFramingOption, "mount" | "glazing">,
): string {
  return `${MOUNT_LABELS[option.mount]}, ${GLAZING_LABELS[option.glazing]}`;
}

/** "Adds 10 to 15 working days", or "Adds 10 working days". */
export function framingLeadLabel(minDays: number, maxDays: number): string {
  return minDays === maxDays
    ? `Adds ${minDays} working days`
    : `Adds ${minDays} to ${maxDays} working days`;
}
