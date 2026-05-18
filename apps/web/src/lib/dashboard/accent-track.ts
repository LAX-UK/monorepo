export type AccentTrack = "buying" | "selling" | "live";

export function accentEyebrowClass(track: AccentTrack = "buying"): string {
  if (track === "selling") return "text-lot-orange";
  if (track === "live") return "text-live-red";
  return "text-primary";
}

export function accentLinkClass(track: AccentTrack = "buying"): string {
  if (track === "selling") return "text-lot-orange hover:underline";
  if (track === "live") return "text-live-red hover:underline";
  return "text-primary hover:underline";
}

export function accentHeroBorderClass(track: AccentTrack = "buying"): string {
  if (track === "selling") return "border-lot-orange/30";
  if (track === "live") return "border-live-red/30";
  return "border-border-hairline";
}
