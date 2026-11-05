import { createEngineHarness } from "@auction/alerts/testing";
import { describe, expect, it } from "vitest";
import { createAccountEmailAlertHandlers } from "./account-email-alerts.handler.js";

function setup(waiting = 0) {
  const h = createEngineHarness();
  const handlers = createAccountEmailAlertHandlers({
    preferences: h.preferences,
    countWaitingEditions: async () => waiting,
  });
  return { h, handlers };
}

describe("account email alert handlers", () => {
  it("shows every switchable topic off for a person who never used alerts", async () => {
    const { handlers } = setup(3);
    expect(await handlers.view("s1")).toEqual({
      topics: [
        { topic: "shop.releases", emailOn: false },
        { topic: "art.followed_artists", emailOn: false },
      ],
      waitingEditions: 3,
    });
  });

  it("switches a topic on and off, each product on its own row", async () => {
    const { h, handlers } = setup();
    h.accounts.set("s1", { email: "ada@example.com", verified: true });
    expect(
      await handlers.setTopic({ identitySubjectId: "s1", topic: "shop.releases", on: true }),
    ).toBe(null);
    expect((await handlers.view("s1")).topics).toEqual([
      { topic: "shop.releases", emailOn: true },
      { topic: "art.followed_artists", emailOn: false },
    ]);
    await handlers.setTopic({ identitySubjectId: "s1", topic: "art.followed_artists", on: true });
    await handlers.setTopic({ identitySubjectId: "s1", topic: "shop.releases", on: false });
    expect((await handlers.view("s1")).topics).toEqual([
      { topic: "shop.releases", emailOn: false },
      { topic: "art.followed_artists", emailOn: true },
    ]);
  });

  it("says why an address that is not verified cannot be switched on", async () => {
    const { h, handlers } = setup();
    h.accounts.set("s1", { email: "ada@example.com", verified: false });
    expect(
      await handlers.setTopic({ identitySubjectId: "s1", topic: "shop.releases", on: true }),
    ).toBe("unverified");
  });
});
