import { emailHash } from "@auction/email";
import type {
  IPersonEmailDeliveryReader,
  PersonEmailDeliveryRecord,
} from "@auction/persistence/interfaces";
import { describe, expect, it } from "vitest";
import { NoAlertSubscriptionReader } from "./alert-subscription-reader.js";
import { PersonEmailDeliveryService } from "./person-email-delivery.service.js";

const record = (over: Partial<PersonEmailDeliveryRecord> = {}): PersonEmailDeliveryRecord => ({
  addressStatus: "ok",
  lastDeliveredAt: null,
  block: null,
  sends: [],
  ...over,
});

function service(
  rec: PersonEmailDeliveryRecord,
  address: { email: string } | null = { email: "ana@example.com" },
) {
  const reads: Array<{ emailHash: string; sendLimit: number }> = [];
  const reader: IPersonEmailDeliveryReader = {
    findAddress: async () => address,
    read: async (input) => {
      reads.push(input);
      return rec;
    },
  };
  return { svc: new PersonEmailDeliveryService(reader, new NoAlertSubscriptionReader()), reads };
}

const SUPPORT = { canLift: true, isEmailAdmin: false };
const READ_ONLY = { canLift: false, isEmailAdmin: false };

describe("PersonEmailDeliveryService", () => {
  it("returns nothing for a person with no address", async () => {
    expect(await service(record(), null).svc.get("u1", SUPPORT)).toBeNull();
  });

  it("asks for the latest 20 sends by the address hash", async () => {
    const { svc, reads } = service(record());
    await svc.get("u1", SUPPORT);
    expect(reads).toEqual([
      { userId: "u1", emailHash: emailHash("ana@example.com"), sendLimit: 20 },
    ]);
  });

  it("describes sends in plain words with a status, never the template id or variables", async () => {
    const { svc } = service(
      record({
        sends: [
          {
            id: "o1",
            template: "payment-invoice",
            vars: { secret: "x" },
            outboxStatus: "suppressed",
            createdAt: new Date("2026-11-01T10:00:00Z"),
            sentAt: null,
            events: [],
          },
          {
            id: "o2",
            template: "bid-outbid",
            vars: {},
            outboxStatus: "sent",
            createdAt: new Date("2026-11-01T09:00:00Z"),
            sentAt: new Date("2026-11-01T09:00:05Z"),
            events: [{ type: "delivered", receivedAt: new Date("2026-11-01T09:00:09Z") }],
          },
        ],
      }),
    );
    const view = await svc.get("u1", SUPPORT);
    expect(view?.sends).toMatchObject([
      { label: "Invoice", essential: true, status: "not_sent_blocked", product: "bid" },
      { label: "Outbid", essential: false, status: "delivered", product: "bid" },
    ]);
    expect(JSON.stringify(view)).not.toContain("secret");
    expect(JSON.stringify(view)).not.toContain("payment-invoice");
  });

  it("offers the lift to client services for a bounce and refuses it for a complaint, with the reason", async () => {
    const since = new Date("2026-11-01T10:00:00Z");
    const bounce = service(
      record({
        addressStatus: "bounced",
        block: { emailHash: "h", reason: "hard_bounce", since, providerDetail: "550 5.1.1" },
      }),
    );
    expect((await bounce.svc.get("u1", SUPPORT))?.block).toMatchObject({
      reason: "hard_bounce",
      stopsEssentialEmail: true,
      providerDetail: "550 5.1.1",
      lift: { allowed: true },
    });
    const complaint = service(
      record({ block: { emailHash: "h", reason: "complaint", since, providerDetail: null } }),
    );
    expect((await complaint.svc.get("u1", SUPPORT))?.block).toMatchObject({
      noteRequired: true,
      writtenRequestRequired: true,
      lift: { allowed: false, reason: "Only an administrator can lift a complaint block" },
    });
    expect((await bounce.svc.get("u1", READ_ONLY))?.block?.lift).toMatchObject({ allowed: false });
  });

  it("shows an unsubscribe as the person's choice that nobody lifts", async () => {
    const { svc } = service(
      record({
        block: { emailHash: "h", reason: "unsubscribe", since: new Date(), providerDetail: null },
      }),
    );
    expect((await svc.get("u1", { canLift: true, isEmailAdmin: true }))?.block).toMatchObject({
      stopsEssentialEmail: false,
      liftReasons: [],
      lift: { allowed: false },
    });
  });
});
