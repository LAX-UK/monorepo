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
