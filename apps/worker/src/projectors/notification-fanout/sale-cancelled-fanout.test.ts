import type { EmailEnqueueInput, IEmailService, TemplateName } from "@auction/email";
import type {
  CreateNotificationRow,
  INotificationWriteRepository,
} from "@auction/persistence/interfaces";
import { describe, expect, it } from "vitest";
import type {
  INotificationFanoutReader,
  SaleCancelledPeople,
} from "../../interfaces/notification-fanout.reader.js";
import type { SaleCancelledPayload } from "./notification-fanout-helpers.js";
import { fanoutSaleCancelled } from "./sale-cancelled-fanout.js";

const SALE_ID = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const LOTS = ["lot-1", "lot-2", "lot-3"];

const CONTACTS: Record<string, { email: string; name: string; firstName: string | null }> = {
  sam: { email: "sam@example.com", name: "Sam Lee", firstName: "Sam" },
  wat: { email: "wat@example.com", name: "Wat Lee", firstName: "Wat" },
  olu: { email: "olu@example.com", name: "Olu A", firstName: "Olu" },
  tom: { email: "tom@example.com", name: "Tom B", firstName: "Tom" },
};

function harness(people: SaleCancelledPeople) {
  const sent: EmailEnqueueInput<TemplateName>[] = [];
  const notices: CreateNotificationRow[] = [];
  const emailService: IEmailService = {
    async enqueue(input) {
      sent.push(input as EmailEnqueueInput<TemplateName>);
      return { outboxId: "9e8d7c6b-5a49-4382-9170-6f5e4d3c2b1a" };
    },
  };
  const notificationWriteRepo = {
    async createMany(rows: CreateNotificationRow[]) {
      notices.push(...rows);
      return [];
    },
  } as unknown as INotificationWriteRepository;
  const notificationFanoutReader = {
    getSaleTitle: async () => "Autumn Sale",
    listSaleCancelledPeople: async () => people,
    listEntityRecipients: async () => [
      { email: "olu@example.com", userId: "olu", firstName: "Olu" },
      { email: "sam@example.com", userId: "sam", firstName: "Sam" },
    ],
    getUserForProxyNotice: async (id: string) => CONTACTS[id] ?? null,
  } as unknown as INotificationFanoutReader;
  return {
    sent,
    notices,
    run: (payload: SaleCancelledPayload = { cancelledLotIds: LOTS }) =>
      fanoutSaleCancelled({
        notificationFanoutReader,
        notificationWriteRepo,
        emailService,
        supportContactEmail: "help@lax.bid",
        eventId: 12,
        saleId: SALE_ID,
        payload,
      }),
  };
}

const PEOPLE: SaleCancelledPeople = {
  bidders: [{ userId: "sam", legalEntityId: null }],
  telephoneClients: [
    { userId: "sam", legalEntityId: "acct-sam" },
    { userId: "tom", legalEntityId: "acct-tom" },
  ],
  consignorEntityIds: ["org-1"],
  watcherUserIds: ["sam", "wat", "tom"],
};

describe("fanoutSaleCancelled", () => {
  it("sends each person one email and one notice, however they were involved", async () => {
    const { sent, notices, run } = harness(PEOPLE);
    await run();
    expect(sent.map((e) => e.to).sort()).toEqual([
      "olu@example.com",
      "sam@example.com",
      "tom@example.com",
      "wat@example.com",
    ]);
    expect(notices.map((n) => n.userId).sort()).toEqual(["olu", "sam", "tom", "wat"]);
    expect(new Set(sent.map((e) => e.idempotencyKey)).size).toBe(4);
  });

  it("words the notice by role: bids void, lots withdrawn, or plain", async () => {
    const { notices, run } = harness(PEOPLE);
    await run();
    const messageOf = (id: string) => notices.find((n) => n.userId === id)?.message;
    expect(messageOf("sam")).toBe('The sale "Autumn Sale" has been cancelled. Your bids are void.');
    expect(messageOf("olu")).toContain("Your lots in it are withdrawn.");
    expect(messageOf("wat")).not.toContain("bids are void");
    expect(notices.find((n) => n.userId === "olu")?.legalEntityId).toBe("org-1");
    expect(notices.every((n) => n.type === "sale_cancelled")).toBe(true);
  });

  it("emails the bidder as a bidder in the template variables", async () => {
    const { sent, run } = harness(PEOPLE);
    await run();
    expect(sent.find((e) => e.to === "sam@example.com")).toMatchObject({
      template: "sale-cancelled-notice",
      vars: { saleTitle: "Autumn Sale", audience: "bidder", userName: "Sam" },
    });
  });

  it("does nothing when the event names no cancelled lots", async () => {
    const { sent, notices, run } = harness(PEOPLE);
    await run({ cancelledLotIds: [] });
    await run({});
    expect(sent).toEqual([]);
    expect(notices).toEqual([]);
  });
});
