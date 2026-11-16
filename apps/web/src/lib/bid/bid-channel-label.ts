export function formatBidChannelLabel(placedVia: string | null | undefined): string | null {
  if (!placedVia) return null;
  switch (placedVia) {
    case "web":
      return "Online";
    case "saleroom":
      return "Floor";
    case "telephone":
      return "Telephone";
    case "absentee":
      return "Absentee";
    default:
      return placedVia;
  }
}

/** The clerk panel's name for a bidder with no paddle on the roster: their channel, never an id. */
export function formatChannelBidderLabel(channel: string | null): string {
  return channel ? `${channel} bidder` : "Online bidder";
}

/** The clerk panel's name for a bidder on the paddle roster. */
export function formatPaddleBidderLabel(
  paddleNumber: number | string,
  name?: string | null,
): string {
  const paddle = `Paddle ${paddleNumber}`;
  const trimmed = name?.trim();
  return trimmed ? `${paddle} · ${trimmed}` : paddle;
}
