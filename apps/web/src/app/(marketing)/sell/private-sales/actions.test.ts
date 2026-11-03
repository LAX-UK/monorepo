import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: async (_name: string, run: () => Promise<unknown>) => run(),
}));
let address = "203.0.113.9";
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      "x-forwarded-for": address,
      referer: "https://lax.bid/sell/private-sales?path=sell",
    }),
}));
const dispatch = vi.fn();
const startDraft = vi.fn();
const organisations = vi.fn();
vi.mock("@/lib/contact/http-contact-dispatcher.server", () => ({
  httpContactDispatcher: {
    dispatch: (input: unknown) => dispatch(input),
    startDraft: () => startDraft(),
    organisations: () => organisations(),
  },
}));

const { submitPrivateSaleEnquiry, startEnquiryDraft, loadEnquirerOrganisations } = await import(
  "./actions"
);
const { ContactDispatchError } = await import("@/lib/contact/contact-dispatcher");
const { emptyEnquiryValues } = await import("@/lib/private-sales/enquiry-values");

const sell = {
  ...emptyEnquiryValues("sell"),
  departmentSlug: "paintings",
  artist: "Iris Calder",
  title: "Low tide at Maldon",
  location: "London, UK",
  name: "Daniel Price",
  email: "daniel.price@example.com",
};
const context = { uploadIds: ["u1"], draftToken: "tok.sig" };
const receipt = { reference: "E-1042", replyBy: "2026-11-04T10:30:00.000Z" };

describe("submitPrivateSaleEnquiry", () => {
  beforeEach(() => {
    dispatch.mockReset();
    startDraft.mockReset();
    address = `203.0.113.${Math.floor(Math.random() * 200)}`;
  });

  it("sends the structured payload with the page it came from and returns the reference", async () => {
    dispatch.mockResolvedValue(receipt);
    const result = await submitPrivateSaleEnquiry(sell, context);
    expect(result).toEqual({ ok: true, data: receipt });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: "private_sale_sell",
        departmentSlug: "paintings",
        uploadIds: ["u1"],
        draftToken: "tok.sig",
        sourcePage: "/sell/private-sales?path=sell",
      }),
    );
  });

  it("checks the answers again and sends nothing when they are not valid", async () => {
    const result = await submitPrivateSaleEnquiry({ ...sell, artist: "" }, context);
    expect(result).toMatchObject({ ok: false });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("answers a filled honeypot as a success without sending", async () => {
    const result = await submitPrivateSaleEnquiry({ ...sell, website: "http://spam" }, context);
    expect(result.ok).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("answers with a failure, never a success, when the enquiry is not delivered", async () => {
    dispatch.mockRejectedValue(new ContactDispatchError("down", 502));
    expect(await submitPrivateSaleEnquiry(sell, context)).toMatchObject({
      ok: false,
      error: "We couldn't send your enquiry. Please try again.",
      status: 502,
    });
  });

  it("asks the visitor to wait when the API limits them", async () => {
    dispatch.mockRejectedValue(new ContactDispatchError("limited", 429));
    expect(await submitPrivateSaleEnquiry(sell, context)).toMatchObject({
      ok: false,
      error: "Too many submissions. Please wait a minute and try again.",
    });
  });

  it("says why an organisation was refused", async () => {
    dispatch.mockRejectedValue(new ContactDispatchError("no", 403, "organisation_not_permitted"));
    const result = await submitPrivateSaleEnquiry(sell, { ...context, legalEntityId: "e1" });
    expect(result).toMatchObject({ ok: false, errorCode: "organisation_not_permitted" });
    expect((result as { error: string }).error).toContain("Choose Myself");
  });

  it("limits how often one address can send", async () => {
    dispatch.mockResolvedValue(receipt);
    for (let i = 0; i < 4; i += 1) await submitPrivateSaleEnquiry(sell, context);
    expect(await submitPrivateSaleEnquiry(sell, context)).toMatchObject({ ok: false, status: 429 });
  });
});

describe("startEnquiryDraft", () => {
  beforeEach(() => {
    startDraft.mockReset();
    address = `198.51.100.${Math.floor(Math.random() * 200)}`;
  });

  it("gives back the draft token", async () => {
    startDraft.mockResolvedValue({ draftToken: "tok.sig", expiresAt: "2026-11-03T10:00:00.000Z" });
    expect(await startEnquiryDraft()).toEqual({ ok: true, data: { draftToken: "tok.sig" } });
  });

  it("fails when the API gives no token", async () => {
    startDraft.mockResolvedValue({ draftToken: "", expiresAt: "" });
    expect(await startEnquiryDraft()).toMatchObject({ ok: false });
  });

  it("fails, never pretends, when the API cannot be reached", async () => {
    startDraft.mockRejectedValue(new ContactDispatchError("down"));
    expect(await startEnquiryDraft()).toMatchObject({ ok: false });
  });
});

describe("loadEnquirerOrganisations", () => {
  it("lists what the API allows", async () => {
    const list = [{ id: "e1", name: "Marlow", role: "owner", canBuy: true, canSell: true }];
    organisations.mockResolvedValue(list);
    expect(await loadEnquirerOrganisations()).toEqual(list);
  });

  it("leaves the person enquiring as themselves when the list cannot be loaded", async () => {
    organisations.mockRejectedValue(new ContactDispatchError("down", 502));
    expect(await loadEnquirerOrganisations()).toEqual([]);
  });
});
