import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const redirect = vi.fn((href: string) => {
  throw new Error(`redirect:${href}`);
});
vi.mock("next/navigation", () => ({ redirect: (href: string) => redirect(href) }));
let requestHeaders = new Headers({ "sec-fetch-site": "same-origin" });
vi.mock("next/headers", () => ({ headers: async () => requestHeaders }));
const findRecordAccount = vi.fn();
vi.mock("./remembered-account.server", () => ({
  findRecordAccount: (...args: unknown[]) => findRecordAccount(...args),
}));

const { openRecordInItsAccount } = await import("./open-record-in-account.server");

const input = {
  kind: "consignment",
  id: "c1",
  actingId: "me",
  next: "/selling/consignments/c1",
} as const;

describe("openRecordInItsAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestHeaders = new Headers({ "sec-fetch-site": "same-origin" });
  });

  it("hands the switch hop to the page to load, instead of redirecting through the router", async () => {
    findRecordAccount.mockResolvedValue({ kind: "ok", legalEntityId: "org-1" });
    await expect(openRecordInItsAccount(input)).resolves.toEqual({
      kind: "hop",
      href: `/switch-account?to=org-1&next=${encodeURIComponent(input.next)}`,
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("switches silently for a link followed on this site or typed in", async () => {
    findRecordAccount.mockResolvedValue({ kind: "ok", legalEntityId: "org-1" });
    requestHeaders = new Headers({ "sec-fetch-site": "none" });
    await expect(openRecordInItsAccount(input)).resolves.toMatchObject({ kind: "hop" });
  });

  it.each(["cross-site", "same-site"])(
    "asks the person to confirm a switch from a link on another site (%s)",
    async (site) => {
      findRecordAccount.mockResolvedValue({ kind: "ok", legalEntityId: "org-1" });
      requestHeaders = new Headers({ "sec-fetch-site": site });
      await expect(openRecordInItsAccount(input)).rejects.toThrow(
        `redirect:/switch-account/confirm?to=org-1&next=${encodeURIComponent(input.next)}`,
      );
    },
  );

  it("asks to confirm when the browser sends no fetch metadata", async () => {
    findRecordAccount.mockResolvedValue({ kind: "ok", legalEntityId: "org-1" });
    requestHeaders = new Headers();
    await expect(openRecordInItsAccount(input)).rejects.toThrow("redirect:/switch-account/confirm");
  });

  it("redirects to the explanations, which change no cookie", async () => {
    findRecordAccount.mockResolvedValue({ kind: "unavailable" });
    await expect(openRecordInItsAccount(input)).rejects.toThrow(
      "redirect:/switch-account/unavailable",
    );
    findRecordAccount.mockResolvedValue({ kind: "no_access" });
    await expect(openRecordInItsAccount(input)).rejects.toThrow("redirect:/no-access");
  });

  it("renders the page when it belongs in this account", async () => {
    findRecordAccount.mockResolvedValue({ kind: "ok", legalEntityId: "me" });
    await expect(openRecordInItsAccount(input)).resolves.toEqual({ kind: "render" });
  });
});
