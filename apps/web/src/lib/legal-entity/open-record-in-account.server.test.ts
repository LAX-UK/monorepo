import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const redirect = vi.fn((href: string) => {
  throw new Error(`redirect:${href}`);
});
vi.mock("next/navigation", () => ({ redirect: (href: string) => redirect(href) }));
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
  beforeEach(() => vi.clearAllMocks());

  it("hands the switch hop to the page to load, instead of redirecting through the router", async () => {
    findRecordAccount.mockResolvedValue({ kind: "ok", legalEntityId: "org-1" });
    await expect(openRecordInItsAccount(input)).resolves.toBe(
      `/switch-account?to=org-1&next=${encodeURIComponent(input.next)}`,
    );
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects to the explanations, which change no cookie", async () => {
    findRecordAccount.mockResolvedValue({ kind: "unavailable" });
    await expect(openRecordInItsAccount(input)).rejects.toThrow(
      "redirect:/switch-account/unavailable",
    );
    findRecordAccount.mockResolvedValue({ kind: "no_access" });
    await expect(openRecordInItsAccount(input)).rejects.toThrow("redirect:/no-access");
  });

  it("returns null when the page belongs in this account", async () => {
    findRecordAccount.mockResolvedValue({ kind: "ok", legalEntityId: "me" });
    await expect(openRecordInItsAccount(input)).resolves.toBeNull();
  });
});
