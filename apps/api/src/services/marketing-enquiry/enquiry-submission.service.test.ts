import { type EnquiryIntakeInput, enquiryIntakeSchema } from "@auction/validators";
import { describe, expect, it, vi } from "vitest";
import { HmacEnquiryDraftTokens } from "./enquiry-draft-token.js";
import { EnquirySubmissionService } from "./enquiry-submission.service.js";

const SECRET = "test-secret-0123456789-abcdef"; // gitleaks:allow
const ENTITY = "6f1c2f60-6a0a-4a53-9a2a-1c9f8f0e9a11";
const drafts = new HmacEnquiryDraftTokens({ secret: SECRET, now: () => new Date() });

const sellerBody = {
  intent: "private_sale_sell",
  name: "Daniel Price",
  email: "daniel@example.com",
  departmentSlug: "paintings",
  artist: "Iris Calder",
  title: "Low tide at Maldon",
  locationTown: "London",
  locationCountry: "UK",
  uploadIds: ["6f1c2f60-6a0a-4a53-9a2a-1c9f8f0e9a21"],
};
const parse = (body: unknown) => enquiryIntakeSchema.parse(body) as EnquiryIntakeInput;
const seller = parse(sellerBody);
const buyer = parse({
  intent: "private_sale_buy",
  name: "Charlotte Hale",
  email: "charlotte@example.com",
  lookingFor: "A mid-century British landscape",
  budgetBand: "10000_to_50000",
  timing: "within_3_months",
  legalEntityId: ENTITY,
});

function setup(memberRole: "owner" | "viewer" | null = "owner") {
  const submit = vi
    .fn()
    .mockResolvedValue({ id: "enq-1", reference: "E-1042", replyBy: "2026-11-04T10:30:00.000Z" });
  const service = new EnquirySubmissionService({
    intake: { submit },
    drafts,
    accounts: {
      resolve: vi.fn().mockImplementation(async ({ viewer, legalEntityId }) => {
        if (viewer?.role === "staff") {
          return { ok: false, status: 403, code: "staff_cannot_enquire", error: "no" };
        }
        if (legalEntityId && !memberRole) {
          return { ok: false, status: 403, code: "organisation_not_permitted", error: "no" };
        }
        return {
          ok: true,
          account: viewer ? { userId: viewer.userId, legalEntityId } : undefined,
        };
      }),
    },
  });
  return { service, submit };
}

describe("EnquirySubmissionService", () => {
  it("sends a visitor's enquiry with the files they uploaded under their draft", async () => {
    const { service, submit } = setup();
    const { token, draftId } = drafts.issue();
    const result = await service.submit(parse({ ...sellerBody, draftToken: token }), null);
    expect(result).toEqual({
      ok: true,
      id: "enq-1",
      reference: "E-1042",
      replyBy: "2026-11-04T10:30:00.000Z",
    });
    expect(submit).toHaveBeenCalledWith(expect.anything(), {
      account: undefined,
      uploadOwner: { enquiryDraftId: draftId },
    });
  });

  it("sends a signed-in sender's enquiry with their account and their own uploads", async () => {
    const { service, submit } = setup();
    await service.submit(seller, { userId: "user-1", role: "client" });
    expect(submit).toHaveBeenCalledWith(expect.anything(), {
      account: { userId: "user-1", legalEntityId: undefined },
      uploadOwner: { ownerUserId: "user-1" },
    });
  });

  it("links an organisation when the account may act for it", async () => {
    const { service, submit } = setup("owner");
    await service.submit(buyer, { userId: "user-1", role: "client" });
    expect(submit.mock.calls[0]?.[1].account).toEqual({ userId: "user-1", legalEntityId: ENTITY });
  });

  it("sends the enquiry without files when the draft token has expired, rather than losing it", async () => {
    const { service, submit } = setup();
    const result = await service.submit(parse({ ...sellerBody, draftToken: "bad.token" }), null);
    expect(result.ok).toBe(true);
    expect(submit.mock.calls[0]?.[1].uploadOwner).toBeUndefined();
  });

  it("refuses staff and organisations the account may not act for, storing nothing", async () => {
    const { service, submit } = setup(null);
    expect(await service.submit(seller, { userId: "staff-1", role: "staff" })).toMatchObject({
      ok: false,
      status: 403,
      code: "staff_cannot_enquire",
    });
    expect(await service.submit(buyer, { userId: "user-1", role: "client" })).toMatchObject({
      ok: false,
      code: "organisation_not_permitted",
    });
    expect(submit).not.toHaveBeenCalled();
  });
});
