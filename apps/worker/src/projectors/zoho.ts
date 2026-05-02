export type ZohoEventProjection =
  | { module: "Contacts"; payload: Record<string, unknown> }
  | { module: "Deals"; payload: Record<string, unknown> }
  | { module: "Sales_Orders"; payload: Record<string, unknown> };

export function mapDomainEventToZoho(
  eventType: string,
  payload: unknown,
): ZohoEventProjection | null {
  const body = typeof payload === "object" && payload ? (payload as Record<string, unknown>) : {};
  if (eventType === "user.registered") return { module: "Contacts", payload: body };
  if (eventType === "bid.lot_won") return { module: "Deals", payload: body };
  if (eventType === "order.paid") return { module: "Sales_Orders", payload: body };
  return null;
}
