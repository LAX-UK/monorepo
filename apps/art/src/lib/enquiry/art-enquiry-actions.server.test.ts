import { beforeEach, describe, expect, it, vi } from "vitest";

const bff = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock("@/lib/art-commerce-mutation.server", () => ({ artCommerceMutationClient: bff }));

import { sendArtEnquiry } from "./art-enquiry-actions.server.js";
import { ART_ENQUIRY_SENT_MESSAGE } from "./submit-art-enquiry.js";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("sendArtEnquiry", () => {
  beforeEach(() => bff.mutate.mockReset());

  it("posts an enquiry intent with message and normalised phone", async () => {
    bff.mutate.mockResolvedValue({
      kind: "response",
      status: 201,
      body: { status: "registered" },
    });
    const state = await sendArtEnquiry(
      "warm basket",
      { status: "idle" },
      form({ message: " Is it framed? ", contactPhone: "+44 7700 900123" }),
    );
    expect(state).toEqual({ status: "sent", message: ART_ENQUIRY_SENT_MESSAGE });
    expect(bff.mutate).toHaveBeenCalledWith("/commerce/artworks/warm%20basket/interest", {
      method: "POST",
      body: { intent: "enquiry", message: "Is it framed?", contactPhone: "+447700900123" },
    });
  });

  it("rejects an empty slug without calling the BFF", async () => {
    const state = await sendArtEnquiry(" ", { status: "idle" }, form({}));
    expect(state.status).toBe("error");
    expect(bff.mutate).not.toHaveBeenCalled();
  });

  it("returns field errors without calling the BFF", async () => {
    const state = await sendArtEnquiry(
      "work",
      { status: "idle" },
      form({ contactPhone: "07700 900123" }),
    );
    expect(state.status).toBe("invalid");
    expect(bff.mutate).not.toHaveBeenCalled();
  });

  it.each([
    [{ kind: "response", status: 401, body: {} }, "sign_in_required", /Sign in/],
    [{ kind: "response", status: 403, body: { error: "csrf_failed" } }, "error", /session expired/],
    [{ kind: "csrf_unavailable" }, "error", /session expired/],
    [{ kind: "response", status: 404, body: {} }, "error", /no longer available/],
    [{ kind: "response", status: 409, body: {} }, "error", /no longer accepting/],
    [{ kind: "response", status: 400, body: {} }, "error", /Check your details/],
    [{ kind: "response", status: 429, body: {} }, "error", /few minutes/],
    [{ kind: "response", status: 503, body: null }, "error", /Try again shortly/],
    [{ kind: "network_error" }, "error", /Try again shortly/],
  ] as const)("maps %o to a %s notice", async (result, status, message) => {
    bff.mutate.mockResolvedValue(result);
    const state = await sendArtEnquiry("work", { status: "idle" }, form({}));
    expect(state.status).toBe(status);
    expect("message" in state ? state.message : "").toMatch(message);
  });
});
