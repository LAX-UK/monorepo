import { textOf } from "@/test/text-of";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DeleteAccountSection } from "./delete-account-section";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/application/account-identity-actions.server", () => ({
  cancelAccountDeletionAction: vi.fn(),
  requestAccountDeletionAction: vi.fn(),
}));

const PAGE = "/account/security/delete";
const render = (vm: Parameters<typeof DeleteAccountSection>[0]["vm"]) =>
  renderToStaticMarkup(<DeleteAccountSection vm={vm} pagePath={PAGE} />);

const BID = {
  code: "account_deletion_pending_payments",
  message: "You have a payment still to make. Pay it before deleting your account.",
  href: "https://bid.example/purchases#payment-history",
};
const SHOP = {
  code: "shop_open_orders",
  message: "You have 2 orders that haven't been paid for or delivered yet.",
  href: "https://shop.example/account/orders",
};

describe("DeleteAccountSection", () => {
  it("offers a try again when Identity could not be asked, and no delete button", () => {
    const html = render({ kind: "unavailable" });
    expect(html).toContain("We can&#x27;t check your account right now");
    expect(html).toContain(`href="${PAGE}"`);
    expect(html).not.toContain("Delete my account");
  });

  describe("blocked", () => {
    const vm = {
      kind: "blocked" as const,
      groups: [
        { product: "bid" as const, label: "LAX Bid", blockers: [BID] },
        { product: "shop" as const, label: "LAX Shop and lax.art", blockers: [SHOP] },
      ],
      unreachable: [],
    };

    it("lists every blocker under its product, each linking into that product", () => {
      const html = render(vm);
      expect(html).toContain("You can&#x27;t delete your account yet");
      expect(textOf(html).indexOf("LAX Bid")).toBeLessThan(
        textOf(html).indexOf("LAX Shop and lax.art"),
      );
      expect(html).toContain(BID.message);
      expect(html).toContain(`href="${BID.href}"`);
      expect(html).toContain(SHOP.message.replace("haven't", "haven&#x27;t"));
      expect(html).toContain(`href="${SHOP.href}"`);
    });

    it("offers no way to delete while something is in the way", () => {
      const html = render(vm);
      expect(html).not.toContain("Delete my account");
      expect(html).not.toContain("DELETE MY ACCOUNT");
      expect(html).toContain("Check again");
    });

    it("shows a blocker with no page as plain text", () => {
      const html = render({
        ...vm,
        groups: [{ product: "bid", label: "LAX Bid", blockers: [{ ...BID, href: null }] }],
      });
      expect(html).toContain(BID.message);
      expect(html).not.toContain(`href="${BID.href}"`);
    });

    it("says which product could not be checked, so there may be more to do", () => {
      const html = render({ ...vm, unreachable: ["LAX Shop and lax.art"] });
      expect(html).toContain("We couldn&#x27;t check everything");
      expect(textOf(html)).toContain("LAX Shop and lax.art just now");
    });
  });

  it("asks the person to try again when a product could not be asked, and offers no delete button", () => {
    const html = render({ kind: "check_failed", unreachable: ["LAX Shop and lax.art"] });
    expect(html).toContain("We couldn&#x27;t finish checking your account");
    expect(html).toContain("nothing has changed");
    expect(html).not.toContain("Delete my account");
  });

  it("shows the dates and a cancel button once deletion has been requested", () => {
    const html = render({
      kind: "requested",
      requestedOn: "23 October 2026",
      deleteOn: "22 November 2026",
    });
    expect(html).toContain("Your account is scheduled for deletion");
    expect(html).toContain("23 October 2026");
    expect(html).toContain("22 November 2026");
    expect(html).toContain("Cancel deletion");
    expect(html).not.toContain("Delete my account");
  });

  describe("eligible", () => {
    const vm = {
      kind: "eligible" as const,
      phrase: "DELETE MY ACCOUNT",
      consequences: [
        "We'll schedule your account for deletion.",
        "We keep legally required records.",
      ],
    };

    it("explains what happens and asks for the exact phrase", () => {
      const html = render(vm);
      expect(html).toContain("We&#x27;ll schedule your account for deletion.");
      expect(html).toContain("We keep legally required records.");
      expect(html).toContain("DELETE MY ACCOUNT");
      expect(html).toContain("<label");
      expect(html).toContain('autoComplete="off"');
    });

    it("keeps the destructive button disabled until the phrase is typed", () => {
      const html = render(vm);
      expect(html).toMatch(/<button[^>]*\sdisabled=""[^>]*>Delete my account/);
    });
  });
});
