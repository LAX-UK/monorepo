import { describe, expect, it } from "vitest";
import { renderEmail } from "./render.js";
import { OPTIONAL_EMAIL_TEMPLATES } from "./suppression-policy.js";

describe("lot-fulfilment-update email", () => {
  it("shows the heading and message the sender wrote, with a link to the purchase", async () => {
    const rendered = await renderEmail("lot-fulfilment-update", {
      userName: "Ada",
      lotTitle: "Blue Vase",
      heading: "Your lot is on its way",
      message: '"Blue Vase" has been sent with DHL. Tracking number: JD01.',
      purchaseUrl: "https://lax.bid/purchases",
    });
    expect(rendered.subject).toBe("An update on your purchase");
    expect(rendered.html).toContain("Your lot is on its way");
    expect(rendered.text).toContain("Tracking number: JD01.");
    expect(rendered.html).toContain("https://lax.bid/purchases");
    expect(rendered.text).toContain("Hi Ada,");
  });

  it("is transactional: an unsubscribe never silences it", () => {
    expect(OPTIONAL_EMAIL_TEMPLATES).not.toContain("lot-fulfilment-update");
  });
});
