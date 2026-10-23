import type { AccountAddress } from "@auction/identity-contracts/account";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AddressBook } from "./address-book.client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/server/application/account-identity-actions.server", () => ({
  addAddressAction: vi.fn(),
  deleteAddressAction: vi.fn(),
  setDefaultAddressAction: vi.fn(),
  updateAddressAction: vi.fn(),
}));

const home: AccountAddress = {
  id: "33333333-3333-4333-8333-333333333333",
  label: "Home",
  recipientName: "Ada Lovelace",
  line1: "1 High Street",
  line2: null,
  city: "London",
  region: null,
  postcode: "SW1A 1AA",
  country: "GB",
  phone: "+447700900123",
  isDefaultShipping: true,
  isDefaultBilling: false,
  version: 1,
  createdAt: "2026-10-23T12:00:00.000Z",
  updatedAt: "2026-10-23T12:00:00.000Z",
};

const render = (addresses: AccountAddress[]) =>
  renderToStaticMarkup(
    <AddressBook addresses={addresses} defaultRecipient="Ada" returnTo="/account/profile" />,
  );

describe("AddressBook", () => {
  it("explains the empty state and offers to add", () => {
    const html = render([]);
    expect(html).toContain("You haven&#x27;t saved an address yet");
    expect(html).toContain("Add an address");
    expect(html).not.toContain("<form");
  });

  it("shows each address with its defaults and only the actions that still apply", () => {
    const html = render([home]);
    expect(html).toContain("Home");
    expect(html).toContain("Default shipping");
    expect(html).toContain("United Kingdom");
    expect(html).toContain("+447700900123");
    expect(html).toContain('aria-label="Edit Home"');
    expect(html).toContain('aria-label="Delete Home"');
    expect(html).toContain("Make default billing");
    expect(html).not.toContain("Make default shipping");
  });

  it("stops offering to add at the limit", () => {
    const many = Array.from({ length: 20 }, (_, index) => ({
      ...home,
      id: `33333333-3333-4333-8333-${String(index).padStart(12, "0")}`,
      label: `Address ${index}`,
    }));
    const html = render(many);
    expect(html).not.toContain(">Add an address<");
    expect(html).toContain("most addresses we allow");
  });
});
