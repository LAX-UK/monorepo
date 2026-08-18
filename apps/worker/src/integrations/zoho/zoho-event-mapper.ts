import { parseDomainEventPayload } from "@auction/types";
import type { ZohoUpsertRecord } from "./types.js";

export type DomainEventRowForZoho = {
  id: number;
  eventType: string;
  aggregateId: string;
  payload: unknown;
  schemaVersion?: number;
};

function parseOrNull(event: DomainEventRowForZoho): unknown | null {
  const parsed = parseDomainEventPayload(event.eventType, event.schemaVersion ?? 1, event.payload);
  return parsed.ok ? parsed.data : null;
}

export function mapDomainEventToZohoUpsert(event: DomainEventRowForZoho): ZohoUpsertRecord | null {
  const payload = parseOrNull(event);
  if (
    payload === null &&
    (event.eventType.startsWith("user.") || event.eventType.startsWith("bid."))
  ) {
    return null;
  }

  switch (event.eventType) {
    case "user.registered": {
      const p = payload as { userId: string; email: string; name: string; source: string };
      return {
        module: "Contacts",
        externalId: `user:${p.userId}`,
        fields: {
          Last_Name: p.name || p.email,
          Email: p.email,
          Lead_Source: p.source,
        },
      };
    }
    case "user.email_verified": {
      const p = payload as { userId: string; email: string };
      return {
        module: "Contacts",
        externalId: `user:${p.userId}`,
        fields: {
          Email: p.email,
          Email_Verified: true,
        },
      };
    }
    case "bid.lot_won": {
      const p = payload as {
        lotId: string;
        userId: string;
        winningBidId: string;
        amountCents: number;
      };
      return {
        module: "Deals",
        externalId: `lot-won:${p.lotId}:${p.winningBidId}`,
        fields: {
          Deal_Name: `Lot won ${p.lotId}`,
          Amount: p.amountCents / 100,
          Contact_External_Id: `user:${p.userId}`,
        },
      };
    }
    case "bid.first_for_user": {
      const p = payload as { bidId: string; lotId: string; userId: string; amountCents: number };
      return {
        module: "Deals",
        externalId: `first-bid:${p.bidId}`,
        fields: {
          Deal_Name: `First bid on ${p.lotId}`,
          Amount: p.amountCents / 100,
          Contact_External_Id: `user:${p.userId}`,
        },
      };
    }
    case "bid.outbid": {
      const p = payload as {
        previousBidId: string;
        lotId: string;
        userId: string;
        newHighAmountCents: number;
      };
      return {
        module: "Deals",
        externalId: `outbid:${p.previousBidId}`,
        fields: {
          Deal_Name: `Outbid on ${p.lotId}`,
          Amount: p.newHighAmountCents / 100,
          Contact_External_Id: `user:${p.userId}`,
        },
      };
    }
    case "lot.ended":
      return {
        module: "Sales_Orders",
        externalId: `lot-ended:${event.aggregateId}`,
        fields: {
          Subject: `Lot ended ${event.aggregateId}`,
        },
      };
    case "payment.captured":
      return {
        module: "Sales_Orders",
        externalId: `payment-captured:${event.aggregateId}`,
        fields: {
          Subject: `Payment captured ${event.aggregateId}`,
          Status: "Paid",
        },
      };
    default:
      return null;
  }
}
