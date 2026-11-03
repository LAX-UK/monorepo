import { describe, expect, it } from "vitest";
import type { SaleCancelledPeople } from "../../interfaces/notification-fanout.reader.js";
import { planSaleCancelledRecipients } from "./sale-cancelled-recipients.js";

const NONE: SaleCancelledPeople = {
  bidders: [],
  telephoneClients: [],
  consignorEntityIds: [],
  watcherUserIds: [],
};

describe("planSaleCancelledRecipients", () => {
  it("sends one notice to a person who is a bidder, watcher, consignor and telephone client", () => {
    const plan = planSaleCancelledRecipients(
      {
        bidders: [{ userId: "sam", legalEntityId: "acct-sam" }],
        telephoneClients: [{ userId: "sam", legalEntityId: "acct-sam" }],
        consignorEntityIds: ["org-1"],
        watcherUserIds: ["sam", "sam"],
      },
      [{ userId: "sam", legalEntityId: "org-1" }],
    );
    expect(plan).toEqual([{ userId: "sam", legalEntityId: "acct-sam", audience: "bidder" }]);
  });

  it("keeps the strongest role per person and the first account a bidder bid for", () => {
    const plan = planSaleCancelledRecipients(
      {
        bidders: [{ userId: "bea", legalEntityId: null }],
        telephoneClients: [
          { userId: "tom", legalEntityId: "acct-tom" },
          { userId: "cy", legalEntityId: "acct-cy" },
        ],
        consignorEntityIds: [],
        watcherUserIds: ["cy", "wat"],
      },
      [
        { userId: "cy", legalEntityId: "org-2" },
        { userId: "tom", legalEntityId: "org-2" },
      ],
    );
    expect(plan).toEqual([
      { userId: "bea", legalEntityId: null, audience: "bidder" },
      { userId: "cy", legalEntityId: "org-2", audience: "consignor" },
      { userId: "tom", legalEntityId: "org-2", audience: "consignor" },
      { userId: "wat", legalEntityId: null, audience: "other" },
    ]);
  });

  it("returns nobody for a sale no one was involved in", () => {
    expect(planSaleCancelledRecipients(NONE, [])).toEqual([]);
  });

  it("gives a telephone client who only watched and booked the plain notice", () => {
    const plan = planSaleCancelledRecipients(
      {
        ...NONE,
        telephoneClients: [{ userId: "tom", legalEntityId: "acct-tom" }],
        watcherUserIds: ["tom"],
      },
      [],
    );
    expect(plan).toEqual([{ userId: "tom", legalEntityId: "acct-tom", audience: "other" }]);
  });
});
