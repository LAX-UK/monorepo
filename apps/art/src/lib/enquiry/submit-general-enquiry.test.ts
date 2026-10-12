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

const SENT: ArtCommerceMutationResult = { kind: "response", status: 201, body: {} };

describe("submitGeneralEnquiry", () => {
  it("posts a trimmed enquiry with context and phone", async () => {
    const { client, calls } = recordingClient(SENT);
    const state = await submitGeneralEnquiry(client, {
      topic: "exhibition",
      message: "  Is the show open on Sunday?  ",
      phone: " +44 20 0000 ",
      contextSlug: "summer-show",
    });
    expect(state).toEqual({ status: "sent" });
    expect(calls).toEqual([
      {
        path: "/commerce/me/general-enquiries",
        body: {
          topic: "exhibition",
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
      await submitGeneralEnquiry(client, { topic: "general", message: "   ", phone: "" }),
    ).toMatchObject({ status: "invalid" });
    expect(
      await submitGeneralEnquiry(client, { topic: "refunds", message: "Hi", phone: "" }),
    ).toMatchObject({ status: "invalid" });
    expect(calls).toHaveLength(0);
  });

  it("drops malformed context slugs", async () => {
    const { client, calls } = recordingClient(SENT);
    await submitGeneralEnquiry(client, {
      topic: "general",
      message: "Hello",
      phone: null,
      contextSlug: "../admin",
    });
    expect(calls[0]?.body).toEqual({ topic: "general", message: "Hello" });
  });

  it("maps 401 to sign-in required and other failures to a retryable error", async () => {
    expect(
      await submitGeneralEnquiry(
        recordingClient({ kind: "response", status: 401, body: null }).client,
        { topic: "general", message: "Hello", phone: "" },
      ),
    ).toEqual({ status: "sign_in_required" });
    expect(
      await submitGeneralEnquiry(recordingClient({ kind: "csrf_unavailable" }).client, {
        topic: "general",
        message: "Hello",
        phone: "",
      }),
    ).toMatchObject({ status: "error" });
  });
});
