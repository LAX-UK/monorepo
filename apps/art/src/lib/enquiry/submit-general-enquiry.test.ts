import type {
  ArtCommerceMutationClient,
  ArtCommerceMutationResult,
} from "@/lib/art-commerce-mutation.server";
import { describe, expect, it } from "vitest";
import { submitGeneralEnquiry } from "./submit-general-enquiry";

function recordingClient(result: ArtCommerceMutationResult) {
  const calls: { path: string; body: unknown }[] = [];
  const client: ArtCommerceMutationClient = {
    async mutate(path, init) {
      calls.push({ path, body: init.body });
      return result;
    },
  };
  return { client, calls };
}

const CONTACT = { name: "Grace Hopper", email: "grace@example.com" };
const SENT: ArtCommerceMutationResult = {
  kind: "response",
  status: 201,
  body: { enquiryId: "11111111-1111-4111-8111-111111111111", reference: "E-2041" },
};

describe("submitGeneralEnquiry", () => {
  it("posts a trimmed enquiry with context and phone", async () => {
    const { client, calls } = recordingClient(SENT);
    const state = await submitGeneralEnquiry(client, {
      topic: "exhibition",
      ...CONTACT,
      message: "  Is the show open on Sunday?  ",
      phone: " +44 20 0000 ",
      contextSlug: "summer-show",
    });
    expect(state).toEqual({ status: "sent", email: "grace@example.com", reference: "E-2041" });
    expect(calls).toEqual([
      {
        path: "/commerce/me/general-enquiries",
        body: {
          topic: "exhibition",
          ...CONTACT,
          message: "Is the show open on Sunday?",
          phone: "+44 20 0000",
          contextSlug: "summer-show",
        },
      },
    ]);
  });

  it("rejects whitespace-only messages and unknown topics without calling the API", async () => {
    const { client, calls } = recordingClient(SENT);
    expect(
      await submitGeneralEnquiry(client, {
        topic: "general",
        ...CONTACT,
        message: "   ",
        phone: "",
      }),
    ).toMatchObject({ status: "invalid" });
    expect(
      await submitGeneralEnquiry(client, {
        topic: "refunds",
        ...CONTACT,
        message: "Hi",
        phone: "",
      }),
    ).toMatchObject({ status: "invalid" });
    expect(calls).toHaveLength(0);
  });

  it("drops malformed context slugs", async () => {
    const { client, calls } = recordingClient(SENT);
    await submitGeneralEnquiry(client, {
      topic: "general",
      ...CONTACT,
      message: "Hello",
      phone: null,
      contextSlug: "../admin",
    });
    expect(calls[0]?.body).toEqual({ topic: "general", ...CONTACT, message: "Hello" });
  });

  it("requires a valid name and email and reports each field", async () => {
    const { client, calls } = recordingClient(SENT);
    const state = await submitGeneralEnquiry(client, {
      topic: "general",
      name: "",
      email: "nope",
      message: "Hello",
      phone: "",
    });
    expect(state).toMatchObject({
      status: "invalid",
      fieldErrors: { name: expect.any(String), email: expect.any(String) },
    });
    expect(calls).toHaveLength(0);
  });

  it("forwards a filled honeypot for the API to drop", async () => {
    const { client, calls } = recordingClient(SENT);
    await submitGeneralEnquiry(client, {
      topic: "general",
      ...CONTACT,
      message: "Hello",
      phone: "",
      website: "https://spam.example",
    });
    expect(calls[0]?.body).toMatchObject({ website: "https://spam.example" });
  });

  it.each([
    [{ kind: "response", status: 429, body: null }, /few minutes/],
    [{ kind: "response", status: 401, body: null }, /Try again shortly/],
    [{ kind: "csrf_unavailable" }, /session expired/],
    [{ kind: "network_error" }, /Try again shortly/],
  ] as const)("maps %o to a retryable error", async (result, message) => {
    const state = await submitGeneralEnquiry(recordingClient(result).client, {
      topic: "general",
      ...CONTACT,
      message: "Hello",
      phone: "",
    });
    expect(state).toMatchObject({ status: "error", message: expect.stringMatching(message) });
  });
});
