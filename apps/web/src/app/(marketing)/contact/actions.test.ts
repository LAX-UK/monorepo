import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/observability/instrument-server-action", () => ({
  instrumentServerAction: async (_name: string, run: () => Promise<unknown>) => run(),
}));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      "x-forwarded-for": "203.0.113.9",
      referer: "https://lax.bid/contact?intent=press",
    }),
}));
const dispatch = vi.fn();
vi.mock("@/lib/contact/http-contact-dispatcher.server", () => ({
  httpContactDispatcher: { dispatch: (input: unknown) => dispatch(input) },
}));

const { submitContactFormResult } = await import("./actions");
const { ContactDispatchError } = await import("@/lib/contact/contact-dispatcher");

const values = {
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  topic: "press" as const,
  message: "A question about the next sale.",
  website: "",
};

describe("submitContactFormResult", () => {
  beforeEach(() => {
    dispatch.mockReset();
  });

  it("sends the enquiry with the page it came from and reports success", async () => {
    dispatch.mockResolvedValue(undefined);

    const result = await submitContactFormResult(values);

    expect(result).toEqual({ ok: true });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Ada Lovelace",
        topic: "press",
        sourcePage: "/contact?intent=press",
      }),
    );
  });

  it("answers with a failure, never a success, when the enquiry is not delivered", async () => {
    dispatch.mockRejectedValue(new ContactDispatchError("down", 502));

    const result = await submitContactFormResult(values);

    expect(result).toMatchObject({ ok: false, status: 502 });
  });

  it("asks the visitor to wait when the API rate limits them", async () => {
    dispatch.mockRejectedValue(new ContactDispatchError("limited", 429));

    const result = await submitContactFormResult(values);

    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("Too many") });
  });

  it("does not send a honeypot submission, and says nothing about it", async () => {
    const result = await submitContactFormResult({ ...values, website: "https://spam.test" });

    expect(result).toEqual({ ok: true });
    expect(dispatch).not.toHaveBeenCalled();
  });
});
