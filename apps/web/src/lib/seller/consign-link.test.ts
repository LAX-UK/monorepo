import type { AccountPurchaseFacts } from "@/lib/data/http/account-buying.types";
import type { ReturnedWork } from "@/lib/data/http/workspace-selling.schema";
import { describe, expect, it } from "vitest";
import { decideConsignLink } from "./consign-link";

function purchase(
  lotId: string,
  invoice: string,
  stage: string | undefined = "delivered",
): AccountPurchaseFacts {
  return {
    lotId,
    invoice: { status: invoice },
    delivery: { stage },
  } as unknown as AccountPurchaseFacts;
}
function returned(submissionId: string, canConsignAgain: boolean): ReturnedWork {
  return { submissionId, canConsignAgain } as unknown as ReturnedWork;
}

const base = {
  canSell: true,
  purchases: [] as AccountPurchaseFacts[],
  returned: [] as ReturnedWork[],
};

describe("decideConsignLink", () => {
  it("starts nothing when the link names no work", () => {
    expect(decideConsignLink(base)).toEqual({ kind: "none" });
  });

  it("starts from a paid purchase", () => {
    expect(
      decideConsignLink({ ...base, fromLot: "lot-1", purchases: [purchase("lot-1", "paid")] }),
    ).toEqual({ kind: "lot", lotId: "lot-1" });
  });

  it.each(["open", "overdue", "pending", "void"])("refuses a link to a %s invoice", (invoice) => {
    expect(
      decideConsignLink({ ...base, fromLot: "lot-1", purchases: [purchase("lot-1", invoice)] }),
    ).toEqual({ kind: "refused", note: "You can consign it once it's paid." });
  });

  it("refuses a paid purchase that was cancelled", () => {
    expect(
      decideConsignLink({
        ...base,
        fromLot: "lot-1",
        purchases: [purchase("lot-1", "paid", "cancelled")],
      }).kind,
    ).toBe("refused");
  });

  it("refuses a lot the account did not buy", () => {
    expect(
      decideConsignLink({ ...base, fromLot: "lot-9", purchases: [purchase("lot-1", "paid")] }).kind,
    ).toBe("refused");
  });

  it("refuses when purchases could not be read, instead of letting the link through", () => {
    expect(decideConsignLink({ ...base, fromLot: "lot-1", purchases: null }).kind).toBe("refused");
  });

  it("refuses a member who may not sell, even for a paid purchase", () => {
    expect(
      decideConsignLink({
        ...base,
        canSell: false,
        fromLot: "lot-1",
        purchases: [purchase("lot-1", "paid")],
      }).kind,
    ).toBe("refused");
  });

  it("starts again from a returned work that may be consigned again", () => {
    expect(
      decideConsignLink({ ...base, fromSubmission: "s-1", returned: [returned("s-1", true)] }),
    ).toEqual({ kind: "submission", submissionId: "s-1" });
  });

  it("refuses a returned work that may not be consigned again, or is not the account's", () => {
    expect(
      decideConsignLink({ ...base, fromSubmission: "s-1", returned: [returned("s-1", false)] })
        .kind,
    ).toBe("refused");
    expect(
      decideConsignLink({ ...base, fromSubmission: "s-2", returned: [returned("s-1", true)] }).kind,
    ).toBe("refused");
    expect(decideConsignLink({ ...base, fromSubmission: "s-1", returned: null }).kind).toBe(
      "refused",
    );
  });
});
